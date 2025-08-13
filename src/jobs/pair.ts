// src/jobs/pair.ts
import { Worker } from 'bullmq';
import { pool } from '../db';
import IORedis from 'ioredis';

const connection = new IORedis(process.env.REDIS_URL!, { maxRetriesPerRequest: null });

export default new Worker('pair', async job => {
  const { outId } = job.data as { outId: number };
  await pool.query('SELECT pair_out_event_v2($1);', [outId]);
}, {
  connection,
  concurrency: 4,  // up to 4 workers per zone as per spec line 1343
  limiter: {
    max: 100,      // 100 operations per second
    duration: 1000 // 1 second window
  }
});