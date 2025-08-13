// src/queues.ts
import { Queue, JobsOptions } from 'bullmq';
import IORedis from 'ioredis';
const connection = new IORedis(process.env.REDIS_URL!, { maxRetriesPerRequest: null });

export const ingestQ = new Queue('ingest', { connection });
export const pairQ   = new Queue('pair',   { connection });
export const fuzzyQ  = new Queue('fuzzy',  { connection });
export const analyticsQ = new Queue('analytics', { connection });

export const DEFAULT_OPTS: JobsOptions = {
  attempts: 3,
  backoff: { type: 'exponential', delay: 1000 },
  removeOnComplete: { age: 3600, count: 1000 },
  removeOnFail: { age: 24*3600 }
};