// src/jobs/ingest.ts
import { Worker } from 'bullmq';
import { pool } from '../db';
import { pairQ, fuzzyQ } from '../queues';
import IORedis from 'ioredis';

const connection = new IORedis(process.env.REDIS_URL!, { maxRetriesPerRequest: null });

const BATCH_SIZE = 1000; // use COPY in production for max throughput

function parseCSV(csvData: string): any[] {
  const lines = csvData.trim().split('\n');
  const headers = lines[0].split(',').map(h => h.trim());
  
  return lines.slice(1).map(line => {
    const values = line.split(',').map(v => v.trim());
    const row: any = {};
    
    headers.forEach((header, index) => {
      const value = values[index] || '';
      
      // Map common CSV headers to expected fields
      switch (header.toLowerCase()) {
        case 'timestamp':
        case 'ts':
        case 'time':
          row.ts = value;
          break;
        case 'zone':
        case 'location':
          row.zone = value;
          break;
        case 'direction':
        case 'dir':
          row.direction = value.toUpperCase();
          break;
        case 'plate':
        case 'license_plate':
        case 'plate_raw':
          row.plate_raw = value;
          row.plate_norm = value.replace(/[^A-Z0-9]/g, '').toUpperCase();
          row.plate_norm_fuzzy = row.plate_norm.replace(/[O0IL1S5]/g, (m) => 
            ({O:'0', '0':'0', I:'1', L:'1', '1':'1', S:'5', '5':'5'})[m]
          );
          break;
        case 'state':
        case 'state_raw':
          row.state_raw = value;
          row.state_norm = value.toUpperCase();
          break;
        case 'camera':
        case 'camera_id':
          row.camera_id = value;
          break;
        case 'quality':
          row.quality = parseFloat(value) || 0;
          break;
        default:
          row[header] = value;
      }
    });
    
    // Set default values if missing
    row.dupe_key = `${row.zone}_${row.ts}_${row.plate_norm}_${row.direction}`;
    row.raw = row.raw || {};
    
    return row;
  });
}

export default new Worker('ingest', async job => {
  let { uploadId, rows, csvData } = job.data as { uploadId: string, rows?: any[], csvData?: string };
  
  // If CSV data is provided, parse it first
  if (csvData && !rows) {
    rows = parseCSV(csvData);
  }
  
  if (!rows || rows.length === 0) {
    throw new Error('No data provided for ingestion');
  }

  // Filter out rows with invalid timestamps early
  const validRows = rows.filter(r => {
    if (!r.ts || r.ts.trim() === '') {
      console.warn('Skipping row with missing timestamp:', r);
      return false;
    }
    
    const date = new Date(r.ts);
    if (isNaN(date.getTime())) {
      console.warn('Skipping row with invalid timestamp:', r.ts, 'in row:', r);
      return false;
    }
    
    return true;
  });

  if (validRows.length === 0) {
    throw new Error('No valid data rows with timestamps found');
  }

  console.log(`Processing ${validRows.length} valid rows out of ${rows.length} total rows`);

  // 1) Ensure partitions for months in file
  const months = new Set<string>();
  for (const r of validRows) {
    months.add(new Date(r.ts).toISOString().slice(0,7)+'-01T00:00:00Z');
  }
  for (const m of Array.from(months)) await pool.query('SELECT ensure_events_partition($1::timestamptz);', [m]);

  // 2) Batched inserts with proper status values (placeholder for COPY)
  for (let i = 0; i < validRows.length; i += BATCH_SIZE) {
    const batch = validRows.slice(i, i + BATCH_SIZE);
    const text = `INSERT INTO events(ts,zone,direction,plate_raw,plate_norm,plate_norm_fuzzy,state_raw,state_norm,camera_id,upload_id,quality,dupe_key,raw,status)
                  VALUES ${batch.map((_, j) => `($${j*14+1},$${j*14+2},$${j*14+3},$${j*14+4},$${j*14+5},$${j*14+6},$${j*14+7},$${j*14+8},$${j*14+9},$${j*14+10},$${j*14+11},$${j*14+12},$${j*14+13},$${j*14+14})`).join(',')}
                  ON CONFLICT (zone, dupe_key) DO NOTHING
                  RETURNING id, ts, zone, direction, plate_norm, plate_norm_fuzzy, state_norm, status;`;
    const values: any[] = [];
    for (const r of batch) {
      const status = r.direction === 'IN' ? 'OPEN' : 'ORPHAN_OPEN';
      values.push(r.ts, r.zone, r.direction, r.plate_raw, r.plate_norm, r.plate_norm_fuzzy, r.state_raw, r.state_norm, r.camera_id, uploadId, r.quality, r.dupe_key, r.raw ?? {}, status);
    }
    const res = await pool.query(text, values);

    // 3) Queue each OUT for individual pairing using pair_out_event_v2
    const outs = res.rows.filter((r: any) => r.direction === 'OUT');
    for (const out of outs) {
      await pairQ.add('pair-out-event', { outId: out.id }, {
        removeOnComplete: true,
        removeOnFail: true,
      });
    }

    // 4) Seed open_entries for INs (include plate_norm_fuzzy for fuzzy prefiltering)
    const ins = res.rows.filter((r: any) => r.direction === 'IN');
    if (ins.length) {
      const text2 = `INSERT INTO open_entries(entry_event_id,zone,plate_norm,state_norm,ts,plate_norm_fuzzy)
                     VALUES ${ins.map((_, k) => `($${k*6+1},$${k*6+2},$${k*6+3},$${k*6+4},$${k*6+5},$${k*6+6})`).join(',')}
                     ON CONFLICT DO NOTHING;`;
      const vals2: any[] = [];
      for (const r of ins) vals2.push(r.id, r.zone, r.plate_norm, r.state_norm, r.ts, r.plate_norm_fuzzy);
      await pool.query(text2, vals2);
    }
  }

  // 5) After ingest: enqueue delayed sweep for orphans in affected zones
  const zones = Array.from(new Set(rows.map((r: any) => r.zone)));
  for (let i = 0; i < zones.length; i++) {
    const zone = zones[i];
    await fuzzyQ.add('sweep-orphans', { zone, maxPairs: 1000 }, {
      delay: 5000,            // start 5s later
      removeOnComplete: true,
      removeOnFail: true,
    });
  }
}, {
  connection,
  concurrency: 1  // single worker for ingest
});