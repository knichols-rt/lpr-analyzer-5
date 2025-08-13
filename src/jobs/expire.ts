// src/jobs/expire.ts
import { Worker } from 'bullmq';
import { pool } from '../db';
import IORedis from 'ioredis';

const connection = new IORedis(process.env.REDIS_URL!, { maxRetriesPerRequest: null });

export default new Worker('analytics', async () => {
  await pool.query('SELECT expire_open_ins_v2();');
  await pool.query('SELECT refresh_analytics();');
}, { connection });