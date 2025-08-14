import { Queue } from 'bullmq';
import IORedis from 'ioredis';

const connection = new IORedis(process.env.REDIS_URL || 'redis://localhost:6379', { 
  maxRetriesPerRequest: null 
});

// TypeScript interfaces for job data
export interface IngestJobData {
  uploadId: string;
  csvData?: string;
}

export interface PairJobData {
  outId: number;
}

export interface FuzzyJobData {
  zone: string;
  minScore?: number;
}

export interface ExpireJobData {
  // No specific data needed for expire jobs
}

// Queue instances
export const ingestQ = new Queue('ingest', { connection });
export const pairQ = new Queue('pair', { connection });
export const fuzzyQ = new Queue('fuzzy', { connection });
export const expireQ = new Queue('expire', { connection });
export const analyticsQ = new Queue('analytics', { connection });

export { connection };