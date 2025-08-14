import * as dotenv from 'dotenv';
dotenv.config();

import ingestWorker from '../jobs/ingest';
import pairWorker from '../jobs/pair';
import fuzzyWorker from '../jobs/fuzzy';
import expireWorker from '../jobs/expire';

console.log('🚀 Starting LPR Analyzer Workers...');
console.log('Workers initialized:');
console.log('- Ingest worker (queue: ingest)');
console.log('- Pair worker (queue: pair)');
console.log('- Fuzzy worker (queue: fuzzy)'); 
console.log('- Expire worker (queue: expire)');

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

process.on('SIGINT', async () => {
  console.log('SIGINT received, closing workers...');
  await Promise.all([
    ingestWorker.close(),
    pairWorker.close(),
    fuzzyWorker.close(),
    expireWorker.close(),
  ]);
  process.exit(0);
});