import * as dotenv from 'dotenv';
dotenv.config();

import ingestWorker from '../jobs/ingest';
import pairWorker from '../jobs/pair';
import fuzzyWorker from '../jobs/fuzzy';
import expireWorker from '../jobs/expire';

console.log('🚀 Starting LPR Analyzer Workers...');

// Graceful shutdown
process.on('SIGTERM', async () => {
  console.log('SIGTERM received, closing workers...');
  await Promise.all([
    ingestWorker.close(),
    pairWorker.close(),
    fuzzyWorker.close(),
    expireWorker.close(),
  ]);
  process.exit(0);
});