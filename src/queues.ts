// src/queues.ts
import { Queue, JobsOptions, QueueOptions } from 'bullmq';
import IORedis from 'ioredis';
const connection = new IORedis(process.env.REDIS_URL!, { maxRetriesPerRequest: null });

// Rate limiting configuration
const pairQueueOpts: QueueOptions = {
  connection,
  defaultJobOptions: {
    removeOnComplete: 100,
    removeOnFail: 50,
  },
};

const fuzzyQueueOpts: QueueOptions = {
  connection,
  defaultJobOptions: {
    removeOnComplete: 100,
    removeOnFail: 50,
  },
};

export const ingestQ = new Queue('ingest', { connection });
export const pairQ   = new Queue('pair', pairQueueOpts);
export const fuzzyQ  = new Queue('fuzzy', fuzzyQueueOpts);
export const analyticsQ = new Queue('analytics', { connection });

export const DEFAULT_OPTS: JobsOptions = {
  attempts: 3,
  backoff: { type: 'exponential', delay: 1000 },
  removeOnComplete: { age: 3600, count: 1000 },
  removeOnFail: { age: 24*3600 }
};

// Rate limiting options for different queue types
export const PAIR_RATE_LIMIT = {
  max: 100,  // 100 operations per second
  duration: 1000  // 1 second window
};

export const FUZZY_RATE_LIMIT = {
  max: 20,   // 20 operations per second  
  duration: 1000  // 1 second window
};

// Concurrency settings per zone (2-4 workers/zone as per spec)
export const CONCURRENCY_SETTINGS = {
  pair: { concurrency: 4 },    // up to 4 workers per zone
  fuzzy: { concurrency: 2 },   // up to 2 workers per zone
  ingest: { concurrency: 1 }   // single worker for ingest
};