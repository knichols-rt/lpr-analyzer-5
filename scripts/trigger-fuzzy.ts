import IORedis from 'ioredis';
import { Queue } from 'bullmq';
import { pool } from '../src/db';

const redis = new IORedis(process.env.REDIS_URL || 'redis://localhost:6379', { maxRetriesPerRequest: null });
const fuzzyQ = new Queue('fuzzy', { connection: redis });

async function triggerFuzzyMatching() {
  // Get distinct zones with orphans
  const result = await pool.query(`
    SELECT DISTINCT zone, 
           COUNT(*) FILTER (WHERE status = 'ORPHAN_OPEN') as orphan_out,
           COUNT(*) FILTER (WHERE status = 'OPEN') as open_in
    FROM events 
    WHERE status IN ('ORPHAN_OPEN', 'OPEN')
    AND zone IS NOT NULL
    GROUP BY zone
  `);
  
  console.log(`Found ${result.rows.length} zones with orphans/opens:`);
  
  for (const row of result.rows) {
    console.log(`Zone ${row.zone}: ${row.orphan_out} orphan OUTs, ${row.open_in} open INs`);
    
    const job = await fuzzyQ.add('fuzzy-match', { 
      zone: row.zone,
      minScore: 0.85 
    });
    console.log(`Created fuzzy job ${job.id} for zone ${row.zone}`);
  }
  
  // Check queue status
  const waiting = await fuzzyQ.getWaitingCount();
  const active = await fuzzyQ.getActiveCount();
  console.log(`\nFuzzy queue status: ${waiting} waiting, ${active} active`);
  
  await pool.end();
  await redis.quit();
  process.exit(0);
}

triggerFuzzyMatching().catch(err => {
  console.error('Error:', err);
  process.exit(1);
});