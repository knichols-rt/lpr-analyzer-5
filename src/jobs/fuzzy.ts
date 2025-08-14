// src/jobs/fuzzy.ts
import { Worker } from 'bullmq';
import { pool } from '../db';
import { FuzzyJobData } from '../queues';
import IORedis from 'ioredis';

const connection = new IORedis(process.env.REDIS_URL!, { maxRetriesPerRequest: null });

function score(inPlate: string, outPlate: string): number {
  // TODO: OCR confusions, position weights, etc.
  return 0.9;
}

const prefilterSQL = `
-- Zone-scoped, horizon-bounded candidate pairs for scoring in code
WITH ins AS (
  SELECT id AS in_id, plate_norm, plate_norm_fuzzy, ts
  FROM events
  WHERE direction='IN' AND status='OPEN' AND zone=$1
), outs AS (
  SELECT id AS out_id, plate_norm, plate_norm_fuzzy, ts
  FROM events
  WHERE direction='OUT' AND status='ORPHAN_OPEN' AND zone=$1
)
SELECT i.in_id, o.out_id, i.plate_norm AS in_plate, o.plate_norm AS out_plate, i.ts AS in_ts, o.ts AS out_ts
FROM ins i
JOIN outs o
  ON o.ts > i.ts
 AND o.ts - i.ts <= INTERVAL '8 days'
WHERE i.plate_norm_fuzzy % o.plate_norm_fuzzy
ORDER BY i.ts
LIMIT 5000;
`;

export default new Worker('fuzzy', async job => {
  const { zone, minScore = 0.95 } = job.data as FuzzyJobData;
  console.log(`Processing fuzzy matching job ${job.id} for zone ${zone} with minScore ${minScore}`);
  const { rows: pairs } = await pool.query(prefilterSQL, [zone]);

  // group by IN and OUT to enforce uniqueness among high-scorers
  const byIn = new Map<number, { outId: number; s: number }[]>();
  const byOut = new Map<number, { inId: number; s: number }[]>();

  for (const p of pairs) {
    const s = score(p.in_plate, p.out_plate);
    if (s < minScore) continue;
    (byIn.get(p.in_id)  ?? byIn.set(p.in_id,  []).get(p.in_id)!)  .push({ outId: p.out_id, s });
    (byOut.get(p.out_id) ?? byOut.set(p.out_id, []).get(p.out_id)!).push({ inId:  p.in_id, s });
  }

  for (const entry of Array.from(byIn.entries())) {
    const [inId, outs] = entry;
    if (outs.length !== 1) continue;
    const { outId } = outs[0];
    const insForOut = byOut.get(outId) || [];
    if (insForOut.length !== 1) continue; // unique both ways
    await pool.query('SELECT pair_out_event_v2($1);', [outId]);
  }
}, {
  connection,
  concurrency: 2,  // up to 2 workers per zone as per spec line 1343
  limiter: {
    max: 20,       // 20 operations per second
    duration: 1000 // 1 second window
  }
});