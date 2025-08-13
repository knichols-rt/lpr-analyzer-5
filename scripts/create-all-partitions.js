const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

async function createAllPartitions() {
  console.log('Creating partitions from 2024-03 to 2025-12...');
  const client = await pool.connect();
  try {
    for (let year = 2024; year <= 2025; year++) {
      for (let month = 1; month <= 12; month++) {
        if (year === 2024 && month < 3) continue;
        const date = `${year}-${String(month).padStart(2, '0')}-01T00:00:00Z`;
        await client.query('SELECT ensure_events_partition($1::timestamptz)', [date]);
        console.log(`✓ Partition for ${year}-${String(month).padStart(2, '0')}`);
      }
    }
  } finally {
    client.release();
  }
  await pool.end();
}

createAllPartitions().catch(console.error);
