const { pool } = require('./db-config.js');

async function checkDatabase() {
  try {
    // Get all tables
    const tablesResult = await pool.query(`
      SELECT table_name, table_type 
      FROM information_schema.tables 
      WHERE table_schema = 'public'
      ORDER BY table_name;
    `);
    
    console.log('=== ALL TABLES ===');
    tablesResult.rows.forEach(row => {
      console.log(`${row.table_name} (${row.table_type})`);
    });
    
    console.log('\n=== RECORD COUNTS ===');
    
    // Check each table for record counts
    for (const table of tablesResult.rows) {
      if (table.table_type === 'BASE TABLE') {
        try {
          const countResult = await pool.query(`SELECT COUNT(*) FROM ${table.table_name}`);
          console.log(`${table.table_name}: ${countResult.rows[0].count} records`);
        } catch (e) {
          console.log(`${table.table_name}: ERROR - ${e.message}`);
        }
      }
    }
    
    // Check for views
    const viewsResult = await pool.query(`
      SELECT table_name, view_definition
      FROM information_schema.views 
      WHERE table_schema = 'public';
    `);
    
    if (viewsResult.rows.length > 0) {
      console.log('\n=== VIEWS ===');
      viewsResult.rows.forEach(row => {
        console.log(`${row.table_name}`);
      });
    }
    
    // Check for materialized views
    try {
      const matViewsResult = await pool.query(`
        SELECT matviewname, definition
        FROM pg_matviews 
        WHERE schemaname = 'public';
      `);
      
      if (matViewsResult.rows.length > 0) {
        console.log('\n=== MATERIALIZED VIEWS ===');
        matViewsResult.rows.forEach(row => {
          console.log(`${row.matviewname}`);
        });
      }
    } catch (e) {
      console.log('Materialized views check failed:', e.message);
    }
    
  } catch (error) {
    console.error('Error:', error.message);
  } finally {
    await pool.end();
  }
}

checkDatabase();