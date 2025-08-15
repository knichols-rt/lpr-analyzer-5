// src/jobs/ingest.ts - Fixed version that handles duplicates properly
import { Worker } from 'bullmq';
import { pool } from '../db';
import { pairQ, fuzzyQ, IngestJobData } from '../queues';
import IORedis from 'ioredis';

const connection = new IORedis(process.env.REDIS_URL!, { maxRetriesPerRequest: null });

const BATCH_SIZE = 100;

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
        case 'State':
          row.state_raw = value;
          row.state_norm = value.trim().toUpperCase();
          break;
        default:
          row[header] = value;
      }
    });
    
    // Generate dupe key
    row.dupe_key = `${row.zone}_${row.ts}_${row.plate_norm}_${row.direction}`;
    row.raw = {};
    
    // Set default values for unset fields
    row.quality = row.quality || 0;
    
    return row;
  });
}

export default new Worker('ingest', async job => {
  console.log(`Processing job ${job.id} - ${job.name}`);
  
  let { uploadId, csvData } = job.data as IngestJobData;
  
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
  let totalDuplicates = 0;
  let totalErrors = 0;
  const errors: string[] = [];
  
  // DON'T use a transaction - process each batch independently
  // This way successful batches are saved even if others fail
  
  for (let i = 0; i < validRows.length; i += BATCH_SIZE) {
    const batch = validRows.slice(i, i + BATCH_SIZE);
    const batchNum = Math.floor(i / BATCH_SIZE) + 1;
    const totalBatches = Math.ceil(validRows.length / BATCH_SIZE);
    
    try {
      // Process each row individually to handle duplicates properly
      let batchInserted = 0;
      let batchDuplicates = 0;
      
      for (const r of batch) {
        const status = r.direction === 'IN' ? 'OPEN' : 'ORPHAN_OPEN';
        
        try {
          // Insert single row with explicit duplicate check
          const result = await pool.query(`
            INSERT INTO events(ts,zone,direction,plate_raw,plate_norm,plate_norm_fuzzy,
                              state_raw,state_norm,camera_id,upload_id,quality,
                              dupe_key,raw,status)
            VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14)
            ON CONFLICT DO NOTHING
            RETURNING id, direction
          `, [
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
          ]);
          
          if (result.rows.length > 0) {
            batchInserted++;
            totalInserted++;
            
            // Queue OUT events for pairing
            if (result.rows[0].direction === 'OUT') {
              pairQ.add('pair-out', { outId: result.rows[0].id }, {
                removeOnComplete: true,
                removeOnFail: true,
              }).catch(console.error);
            }
          } else {
            // ON CONFLICT triggered - this is a duplicate
            batchDuplicates++;
            totalDuplicates++;
          }
          
        } catch (rowError: any) {
          // Check if it's a duplicate key error
          if (rowError.code === '23505') {
            batchDuplicates++;
            totalDuplicates++;
          } else {
            console.error(`Row error: ${rowError.message}`);
            totalErrors++;
            if (errors.length < 10) {
              errors.push(`Row error: ${rowError.message}`);
            }
          }
        }
      }
      
      // Log batch progress
      if (batchNum % 10 === 0 || batchNum === totalBatches) {
        console.log(`Batch ${batchNum}/${totalBatches}: ${batchInserted} inserted, ${batchDuplicates} duplicates`);
        console.log(`Total progress: ${totalInserted} inserted, ${totalDuplicates} duplicates, ${totalErrors} errors`);
        
        // Update progress in database
        await pool.query(
          'UPDATE uploads SET rows_loaded=$1 WHERE id=$2',
          [totalInserted, uploadId]
        ).catch(console.error);
      }
      
    } catch (batchError: any) {
      console.error(`Fatal error in batch ${batchNum}: ${batchError.message}`);
      totalErrors += batch.length;
      if (errors.length < 10) {
        errors.push(`Batch ${batchNum} error: ${batchError.message}`);
      }
    }
  }
  
  // Final status update
  const finalStatus = totalInserted > 0 ? 'COMPLETED' : 'ERROR';
  const errorLog = errors.length > 0 ? errors.join('; ') : null;
  
  await pool.query(
    `UPDATE uploads 
     SET status=$1, rows_loaded=$2, error_log=$3, completed_at=NOW() 
     WHERE id=$4`,
    [finalStatus, totalInserted, errorLog, uploadId]
  );
  
  // Queue fuzzy matching for affected zones (only if we inserted something)
  if (totalInserted > 0) {
    const zones = Array.from(new Set(validRows.map(r => r.zone)));
    for (const zone of zones) {
      await fuzzyQ.add('sweep-zone', { zone }, {
        delay: 5000,
        removeOnComplete: true,
        removeOnFail: true,
      });
    }
  }
  
  console.log(`
    ✅ Upload ${uploadId} processing complete:
    - Total rows processed: ${validRows.length}
    - Successfully inserted: ${totalInserted}
    - Duplicates skipped: ${totalDuplicates}
    - Errors: ${totalErrors}
    - Success rate: ${((totalInserted / validRows.length) * 100).toFixed(2)}%
  `);
  
  return { 
    uploadId, 
    eventsInserted: totalInserted, 
    duplicatesSkipped: totalDuplicates,
    errors: totalErrors,
    totalRows: validRows.length 
  };
  
}, {
  connection,
  concurrency: 1
});