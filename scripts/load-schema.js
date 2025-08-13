const { Client } = require('pg');
const fs = require('fs');
const path = require('path');

async function loadSchema() {
  const dbConfig = {
    host: 'localhost',
    port: 5432,
    user: 'lpr_user',
    password: 'lpr_password',
    database: 'lpr_analyzer'
  };

  const client = new Client(dbConfig);
  
  try {
    await client.connect();
    console.log('Connected to database successfully!');

    const schemaPath = path.join(__dirname, '..', 'schema.sql');
    const schemaSql = fs.readFileSync(schemaPath, 'utf8');
    
    // Clean up the SQL by removing comments and empty lines
    const cleanedSql = schemaSql
      .split('\n')
      .filter(line => {
        const trimmed = line.trim();
        return trimmed.length > 0 && 
               !trimmed.startsWith('--') && 
               !trimmed.match(/^=+$/) &&
               !trimmed.match(/^SECTION \d+:/);
      })
      .join('\n');
    
    console.log('Executing complete schema...');
    await client.query(cleanedSql);
    console.log('Schema loaded successfully!');

    // Test the schema
    const result = await client.query('SELECT COUNT(*) as table_count FROM information_schema.tables WHERE table_schema = \'public\'');
    console.log(`Schema created with ${result.rows[0].table_count} tables`);

    // List all tables
    const tables = await client.query('SELECT table_name FROM information_schema.tables WHERE table_schema = \'public\' ORDER BY table_name');
    console.log('Tables created:', tables.rows.map(row => row.table_name).join(', '));

    // List all functions
    const functions = await client.query(`
      SELECT routine_name 
      FROM information_schema.routines 
      WHERE routine_schema = 'public' 
      ORDER BY routine_name
    `);
    console.log('Functions created:', functions.rows.map(row => row.routine_name).join(', '));

    await client.end();
    console.log('✅ Schema loading completed successfully!');
    
  } catch (error) {
    console.error('Error loading schema:', error);
    
    if (error.position) {
      console.error('Error position:', error.position);
      const lines = schemaSql.split('\n');
      let pos = 0;
      for (let i = 0; i < lines.length; i++) {
        if (pos + lines[i].length + 1 >= error.position) {
          console.error(`Error around line ${i + 1}:`, lines[i]);
          break;
        }
        pos += lines[i].length + 1;
      }
    }
    
    throw error;
  }
}

loadSchema().catch(console.error);