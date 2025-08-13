// src/index.ts
import 'dotenv/config';
import './jobs/ingest';
import './jobs/pair';
import './jobs/fuzzy';
import './jobs/expire';
console.log('Workers online: ingest, pair, fuzzy, expire');