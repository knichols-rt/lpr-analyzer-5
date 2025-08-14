// src/jobs/expire.ts
import { Worker } from 'bullmq';
import { pool } from '../db';
import { ExpireJobData } from '../queues';
import IORedis from 'ioredis';

const connection = new IORedis(process.env.REDIS_URL!, { maxRetriesPerRequest: null });

export default new Worker('expire', async job => {
  console.log(`Processing expire job ${job.id}`);
  
  try {
    // Expire open IN events that are too old
    const expireResult = await pool.query('SELECT expire_open_ins_v2();');
    console.log('Expired open IN events');
    
    // Refresh analytics materialized views
    const refreshResult = await pool.query('SELECT refresh_analytics();');
    console.log('Refreshed analytics views');
    
    return { 
      expireResult: expireResult.rows[0], 
      refreshResult: refreshResult.rows[0] 
    };
  } catch (error) {
    console.error('Error in expire job:', error);
    throw error;
  }
}, { 
  connection,
  concurrency: 1 // Only one expire job should run at a time
});