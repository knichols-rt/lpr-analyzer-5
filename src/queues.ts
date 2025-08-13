import { Queue } from 'bullmq';
import IORedis from 'ioredis';

const connection = new IORedis(process.env.REDIS_URL || 'redis://localhost:6379', { 
  maxRetriesPerRequest: null 
});

export const ingestQ = new Queue('ingest', { connection });
export const pairQ = new Queue('pair', { connection });
export const fuzzyQ = new Queue('fuzzy', { connection });
export const analyticsQ = new Queue('analytics', { connection });
export { connection };