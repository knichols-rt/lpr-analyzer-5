// src/jobs/ingest.ts - Optimized version with COPY
import { Worker } from 'bullmq';
import { pool } from '../db';
import { pairQ, fuzzyQ } from '../queues';
import IORedis from 'ioredis';
import { Readable } from 'stream';
import { pipeline } from 'stream/promises';
const copyFrom = require('pg-copy-streams').from;

const connection = new IORedis(process.env.REDIS_URL!, { maxRetriesPerRequest: null });

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
  
  // Filter out invalid rows
  const validRows = rows.filter(r => {
    if (!r.ts || !r.direction || !r.plate_raw) {
      console.warn('Skipping invalid row - missing required fields');
      return false;
    }
    
    const date = new Date(r.ts);
    if (isNaN(date.getTime())) {
      console.warn('Invalid timestamp:', r.ts);
      return false;
    }
    
    if (r.direction !== 'IN' && r.direction !== 'OUT') {
      console.warn('Invalid direction:', r.direction);
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
  
  const client = await pool.connect();
  
  try {
    console.log('Starting COPY operation...');
    
    // Use COPY for super fast insertion
    const copyQuery = `
      COPY events(ts,zone,direction,plate_raw,plate_norm,plate_norm_fuzzy,
                  state_raw,state_norm,camera_id,upload_id,quality,
                  dupe_key,raw,status)
      FROM STDIN WITH (FORMAT csv, DELIMITER '|', QUOTE '"', NULL '\\N')
    `;
    
    const stream = client.query(copyFrom(copyQuery));
    
    let processedCount = 0;
    
    // Process in chunks to avoid memory issues
    const CHUNK_SIZE = 10000;
    
    for (let i = 0; i < validRows.length; i += CHUNK_SIZE) {
      const chunk = validRows.slice(i, Math.min(i + CHUNK_SIZE, validRows.length));
      
      for (const r of chunk) {
        const status = r.direction === 'IN' ? 'OPEN' : 'ORPHAN_OPEN';
        const line = [
          r.ts,
          r.zone,
          r.direction,
          r.plate_raw,
          r.plate_norm,
          r.plate_norm_fuzzy,
          r.state_raw || '\\N',
          r.state_norm || '\\N',
          r.camera_id || '\\N',
          uploadId,
          r.quality || 0,
          r.dupe_key,
          JSON.stringify(r.raw).replace(/\|/g, '\\|'),
          status
        ].join('|') + '\n';
        
        stream.write(line);
      }
      
      processedCount += chunk.length;
      
      if (processedCount % 50000 === 0) {
        console.log(`Processed ${processedCount}/${validRows.length} rows...`);
        
        // Update progress
        await pool.query(
          'UPDATE uploads SET rows_loaded=$1 WHERE id=$2',
          [processedCount, uploadId]
        );
      }
    }
    
    // End the stream
    stream.end();
    
    // Wait for stream to finish
    await new Promise((resolve, reject) => {
      stream.on('finish', resolve);
      stream.on('error', reject);
    });
    
    console.log('COPY operation completed');
    
    // Get actual count
    const result = await client.query(
      'SELECT COUNT(*) as count FROM events WHERE upload_id = $1',
      [uploadId]
    );
    
    const totalInserted = parseInt(result.rows[0].count);
    console.log(`Actually inserted: ${totalInserted} events`);
    
    // Update upload status
    await client.query(
      'UPDATE uploads SET status=$1, rows_loaded=$2, completed_at=NOW() WHERE id=$3',
      ['COMPLETED', totalInserted, uploadId]
    );
    
    // Queue OUT events for pairing
    console.log('Queuing OUT events for pairing...');
    const outEvents = await client.query(
      'SELECT id FROM events WHERE upload_id=$1 AND direction=$2',
      [uploadId, 'OUT']
    );
    
    console.log(`Found ${outEvents.rows.length} OUT events to pair`);
    
    for (const out of outEvents.rows) {
      await pairQ.add('pair-out', { outId: out.id }, {
        removeOnComplete: true,
        removeOnFail: true,
      });
    }
    
    // Queue fuzzy matching for the zones
    const zones = Array.from(new Set(validRows.map(r => r.zone)));
    for (const zone of zones) {
      await fuzzyQ.add('sweep-zone', { zone }, {
        delay: 5000,
        removeOnComplete: true,
        removeOnFail: true,
      });
    }
    
    console.log(`✅ Upload ${uploadId} completed: ${totalInserted} events inserted`);
    
    return { uploadId, eventsInserted: totalInserted };
    
  } catch (error: any) {
    console.error('Error during COPY:', error);
    await client.query(
      'UPDATE uploads SET status=$1, error_log=$2 WHERE id=$3',
      ['ERROR', error.message, uploadId]
    );
    throw error;
  } finally {
    client.release();
  }
}, {
  connection,
  concurrency: 1
});