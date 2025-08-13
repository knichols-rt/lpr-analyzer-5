const { pool } = require('./db-config.js');

async function checkMaterializedViews() {
  try {
    // Check mv_daily_zone
    console.log('=== MATERIALIZED VIEW: mv_daily_zone ===');
    try {
      const countResult = await pool.query('SELECT COUNT(*) FROM mv_daily_zone');
      console.log(`mv_daily_zone: ${countResult.rows[0].count} records`);
      
      if (countResult.rows[0].count > 0) {
        const sampleResult = await pool.query('SELECT * FROM mv_daily_zone LIMIT 5');
        console.log('Sample records:');
        console.log(JSON.stringify(sampleResult.rows, null, 2));
      }
    } catch (e) {
      console.log(`mv_daily_zone: ERROR - ${e.message}`);
    }
    
    // Check mv_events_daily
    console.log('\n=== MATERIALIZED VIEW: mv_events_daily ===');
    try {
      const countResult = await pool.query('SELECT COUNT(*) FROM mv_events_daily');
      console.log(`mv_events_daily: ${countResult.rows[0].count} records`);
      
      if (countResult.rows[0].count > 0) {
        const sampleResult = await pool.query('SELECT * FROM mv_events_daily LIMIT 5');
        console.log('Sample records:');
        console.log(JSON.stringify(sampleResult.rows, null, 2));
      }
    } catch (e) {
      console.log(`mv_events_daily: ERROR - ${e.message}`);
    }
    
    // Let's also check the structure of these views
    console.log('\n=== MATERIALIZED VIEW DEFINITIONS ===');
    const viewDefsResult = await pool.query(`
      SELECT matviewname, definition
      FROM pg_matviews 
      WHERE schemaname = 'public';
    `);
    
    viewDefsResult.rows.forEach(row => {
      console.log(`\n${row.matviewname}:`);
      console.log(row.definition);
    });
    
  } catch (error) {
    console.error('Error:', error.message);
  } finally {
    await pool.end();
  }
}

checkMaterializedViews();