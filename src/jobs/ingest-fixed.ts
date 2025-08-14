// src/jobs/ingest.ts - Fixed version with chunked streaming
import { Worker } from 'bullmq';
import { pool } from '../db';
import { pairQ, fuzzyQ } from '../queues';
import IORedis from 'ioredis';

const connection = new IORedis(process.env.REDIS_URL!, { maxRetriesPerRequest: null });

const BATCH_SIZE = 100;  // Use small batches for INSERT method
const COPY_CHUNK_SIZE = 5000;  // Process in chunks for COPY method

function parseCSV(csvData: string): any[] {
  const lines = csvData.trim().split('\n');
  const headers = lines[0].split(',').map(h => h.trim());
  
  return lines.slice(1).map(line => {
    const values = line.split(',').map(v => v.trim());
    const row: any = {};
    
    headers.forEach((header, index) => {
      const value = values[index] || '';
      
      // Map Omaha CSV headers to expected fields
      switch (header) {
        case 'Utc Time':
          row.ts = value;
          break;
        case 'Lane Type':
          row.direction = value.toUpperCase() === 'IN' ? 'IN' : 
                         value.toUpperCase() === 'OUT' ? 'OUT' : value.toUpperCase();
          break;
        case 'License Plate':
          row.plate_raw = value;
          row.plate_norm = value.replace(/[^A-Z0-9]/g, '').toUpperCase();
          const replacements: {[key: string]: string} = {
            'O': '0', '0': '0', 'I': '1', 'L': '1', '1': '1', 'S': '5', '5': '5'
          };
          row.plate_norm_fuzzy = row.plate_norm.replace(/[O0IL1S5]/g, (m: string) => replacements[m]);
          break;
        case 'Zone':
          row.zone = value || 'DEFAULT';
          break;
        case 'Camera Id':
          row.camera_id = value;
          break;
        default:
          row[header] = value;
      }
    });
    
    // Generate dupe key
    row.dupe_key = `${row.zone}_${row.ts}_${row.plate_norm}_${row.direction}`;
    row.raw = {};
    
    // Set default values
    row.state_raw = row.state_raw || '';
    row.state_norm = row.state_norm || '';
    row.quality = row.quality || 0;
    
    return row;
  });
}

export default new Worker('ingest', async job => {
  console.log(`Processing job ${job.id} - ${job.name}`);
  
  let { uploadId, csvData } = job.data as { uploadId: string, csvData?: string };
  
  if (!csvData) {
    throw new Error('No CSV data provided');
  }
  
  console.log(`Parsing CSV data for upload ${uploadId}`);
  const rows = parseCSV(csvData);
  
  // Filter and validate rows
  const validRows = rows.filter(r => {
    if (!r.ts || !r.direction || !r.plate_raw) {
      return false;
    }
    const date = new Date(r.ts);
    if (isNaN(date.getTime())) {
      return false;
    }
    if (r.direction !== 'IN' && r.direction !== 'OUT') {
      return false;
    }
    return true;
  });
  
  console.log(`Processing ${validRows.length} valid rows out of ${rows.length} total`);
  
  if (validRows.length === 0) {
    await pool.query(
      'UPDATE uploads SET status=$1, error_log=$2, completed_at=NOW() WHERE id=$3',
      ['ERROR', 'No valid rows found in CSV', uploadId]
    );
    throw new Error('No valid rows to process');
  }
  
  // Ensure partitions exist
  const months = new Set<string>();
  for (const r of validRows) {
    const monthStr = new Date(r.ts).toISOString().slice(0, 7) + '-01T00:00:00Z';
    months.add(monthStr);
  }
  
  console.log(`Creating partitions for months: ${Array.from(months).join(', ')}`);
  for (const m of Array.from(months)) {
    await pool.query('SELECT ensure_events_partition($1::timestamptz)', [m]);
  }
  
  let totalInserted = 0;
  const client = await pool.connect();
  
  try {
    // Use transaction for consistency
    await client.query('BEGIN');
    
    // Process in smaller batches with regular INSERT
    // (More reliable for large datasets than COPY streaming)
    for (let i = 0; i < validRows.length; i += BATCH_SIZE) {
      const batch = validRows.slice(i, i + BATCH_SIZE);
      
      // Build batch insert query
      const placeholders: string[] = [];
      const values: any[] = [];
      let paramIndex = 1;
      
      for (const r of batch) {
        const status = r.direction === 'IN' ? 'OPEN' : 'ORPHAN_OPEN';
        
        // Create parameter placeholders for this row
        const rowPlaceholders = [];
        for (let j = 0; j < 14; j++) {
          rowPlaceholders.push(`$${paramIndex++}`);
        }
        placeholders.push(`(${rowPlaceholders.join(',')})`);
        
        // Add values
        values.push(
          r.ts,
          r.zone,
          r.direction,
          r.plate_raw,
          r.plate_norm,
          r.plate_norm_fuzzy,
          r.state_raw || null,
          r.state_norm || null,
          r.camera_id || null,
          uploadId,
          r.quality || 0,
          r.dupe_key,
          JSON.stringify(r.raw || {}),
          status
        );
      }
      
      const insertQuery = `
        INSERT INTO events(ts,zone,direction,plate_raw,plate_norm,plate_norm_fuzzy,
                          state_raw,state_norm,camera_id,upload_id,quality,
                          dupe_key,raw,status)
        VALUES ${placeholders.join(',')}
        ON CONFLICT (zone, dupe_key) DO NOTHING
        RETURNING id, direction
      `;
      
      try {
        const result = await client.query(insertQuery, values);
        totalInserted += result.rows.length;
        
        // Queue OUT events for pairing (but don't await to speed up)
        const outEvents = result.rows.filter(r => r.direction === 'OUT');
        for (const out of outEvents) {
          pairQ.add('pair-out', { outId: out.id }, {
            removeOnComplete: true,
            removeOnFail: true,
          }).catch(console.error);  // Don't await, just log errors
        }
        
        // Update progress every 10 batches (1000 rows)
        if ((i / BATCH_SIZE) % 10 === 0) {
          console.log(`Progress: ${i + batch.length}/${validRows.length} rows processed, ${totalInserted} inserted`);
          
          // Update upload progress (don't await)
          pool.query(
            'UPDATE uploads SET rows_loaded=$1 WHERE id=$2',
            [totalInserted, uploadId]
          ).catch(console.error);
        }
        
      } catch (batchError: any) {
        console.error(`Error in batch ${Math.floor(i/BATCH_SIZE)}: ${batchError.message}`);
        // Continue with next batch
        continue;
      }
    }
    
    await client.query('COMMIT');
    
    // Final update
    await pool.query(
      'UPDATE uploads SET status=$1, rows_loaded=$2, completed_at=NOW() WHERE id=$3',
      ['COMPLETED', totalInserted, uploadId]
    );
    
    // Queue fuzzy matching for affected zones
    const zones = Array.from(new Set(validRows.map(r => r.zone)));
    for (const zone of zones) {
      await fuzzyQ.add('sweep-zone', { zone }, {
        delay: 5000,
        removeOnComplete: true,
        removeOnFail: true,
      });
    }
    
    console.log(`✅ Upload ${uploadId} completed: ${totalInserted} events inserted out of ${validRows.length} rows`);
    
    return { uploadId, eventsInserted: totalInserted, totalRows: validRows.length };
    
  } catch (error: any) {
    await client.query('ROLLBACK');
    await pool.query(
      'UPDATE uploads SET status=$1, error_log=$2, completed_at=NOW() WHERE id=$3',
      ['ERROR', error.message || 'Unknown error', uploadId]
    );
    console.error('Upload processing error:', error);
    throw error;
  } finally {
    client.release();
  }
}, {
  connection,
  concurrency: 1,
  limiter: {
    max: 1,
    duration: 1000
  }
});