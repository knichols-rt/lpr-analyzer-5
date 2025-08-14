// Re-queue all OUT events for pairing
import { pool } from '../src/db';
import { pairQ } from '../src/queues';

async function main() {
  // Get all OUT events that haven't been paired
  const result = await pool.query(`
    SELECT id FROM events 
    WHERE direction = 'OUT' 
    AND status = 'ORPHAN_OPEN'
    ORDER BY ts ASC
  `);
  
  console.log(`Found ${result.rows.length} OUT events to re-queue for pairing`);
  
  // Add them to the queue in batches
  const batchSize = 1000;
  for (let i = 0; i < result.rows.length; i += batchSize) {
    const batch = result.rows.slice(i, i + batchSize);
    const jobs = batch.map(row => ({
      name: 'pair-out',
      data: { outId: row.id },
      opts: { removeOnComplete: true, removeOnFail: true }
    }));
    
    await pairQ.addBulk(jobs);
    console.log(`Queued batch ${Math.floor(i/batchSize) + 1}/${Math.ceil(result.rows.length/batchSize)}`);
  }
  
  await pool.end();
  console.log('Done re-queuing!');
}

main().catch(console.error).then(() => process.exit(0));