const { Client } = require('pg');
const fs = require('fs');
const path = require('path');

async function setupDatabase() {
  console.log('Setting up LPR Analyzer database...');
  
  // Database configuration
  const dbConfig = {
    host: 'localhost',
    port: 5432,
    user: 'lpr_user',
    password: 'lpr_password',
    database: 'lpr_analyzer'
  };
  
  // First, connect to postgres database to create our database and user
  const adminClient = new Client({
    host: 'localhost',
    port: 5432,
    user: 'postgres',
    password: 'postgres',
    database: 'postgres'
  });

  try {
    console.log('Connecting to PostgreSQL as admin user...');
    await adminClient.connect();
    console.log('Connected to PostgreSQL successfully!');

    // Create database and user
    console.log('Creating database and user...');
    
    try {
      await adminClient.query(`DROP DATABASE IF EXISTS ${dbConfig.database}`);
      console.log('Dropped existing database (if any)');
    } catch (err) {
      // Database might not exist, continue
    }
    
    try {
      await adminClient.query(`DROP USER IF EXISTS ${dbConfig.user}`);
      console.log('Dropped existing user (if any)');
    } catch (err) {
      // User might not exist, continue
    }
    
    await adminClient.query(`CREATE DATABASE ${dbConfig.database}`);
    console.log(`Database '${dbConfig.database}' created successfully`);
    
    await adminClient.query(`CREATE USER ${dbConfig.user} WITH ENCRYPTED PASSWORD '${dbConfig.password}'`);
    console.log(`User '${dbConfig.user}' created successfully`);
    
    await adminClient.query(`GRANT ALL PRIVILEGES ON DATABASE ${dbConfig.database} TO ${dbConfig.user}`);
    console.log('Privileges granted to user');
    
    await adminClient.end();
    console.log('Admin connection closed');

    // Now connect to the new database and load schema
    console.log('Connecting to new database...');
    const dbClient = new Client(dbConfig);
    await dbClient.connect();
    console.log('Connected to lpr_analyzer database');

    // Grant additional privileges on schema
    await dbClient.query(`GRANT ALL ON SCHEMA public TO ${dbConfig.user}`);
    await dbClient.query(`ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO ${dbConfig.user}`);
    await dbClient.query(`ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON SEQUENCES TO ${dbConfig.user}`);
    await dbClient.query(`ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON FUNCTIONS TO ${dbConfig.user}`);
    console.log('Schema privileges granted');

    // Load the schema by executing it in parts to handle complex statements
    console.log('Loading database schema...');
    const schemaPath = path.join(__dirname, '..', 'schema.sql');
    const schemaSql = fs.readFileSync(schemaPath, 'utf8');
    
    // Split the schema into individual statements and execute them one by one
    const statements = schemaSql
      .split(';')
      .map(stmt => stmt.trim())
      .filter(stmt => stmt.length > 0 && !stmt.startsWith('--') && stmt !== '-- =============================================================================');
    
    console.log(`Executing ${statements.length} SQL statements...`);
    
    for (let i = 0; i < statements.length; i++) {
      const statement = statements[i];
      
      // Skip empty statements and comments
      if (!statement || statement.startsWith('--') || statement.match(/^[\s\-=]*$/)) {
        continue;
      }
      
      try {
        await dbClient.query(statement + ';');
        console.log(`✓ Statement ${i + 1}/${statements.length} executed successfully`);
      } catch (error) {
        console.error(`✗ Error in statement ${i + 1}:`, error.message);
        console.error('Statement:', statement.substring(0, 200) + '...');
        
        // Continue with other statements unless it's a critical error
        if (error.code === '42P07' || error.code === '42P06') {
          // Object already exists, continue
          console.log('  (Object already exists, continuing...)');
          continue;
        }
        throw error;
      }
    }
    
    console.log('Schema loaded successfully!');

    // Test the schema by running a simple query
    console.log('Testing schema...');
    const result = await dbClient.query('SELECT COUNT(*) as table_count FROM information_schema.tables WHERE table_schema = \'public\'');
    console.log(`Schema created with ${result.rows[0].table_count} tables`);

    // List all tables created
    const tables = await dbClient.query('SELECT table_name FROM information_schema.tables WHERE table_schema = \'public\' ORDER BY table_name');
    console.log('Tables created:', tables.rows.map(row => row.table_name).join(', '));

    await dbClient.end();
    console.log('Database connection closed');

    // Update .env file
    console.log('Updating .env file...');
    const envContent = `# PostgreSQL Database Configuration
DATABASE_URL=postgresql://${dbConfig.user}:${dbConfig.password}@${dbConfig.host}:${dbConfig.port}/${dbConfig.database}
DB_HOST=${dbConfig.host}
DB_PORT=${dbConfig.port}
DB_NAME=${dbConfig.database}
DB_USER=${dbConfig.user}
DB_PASSWORD=${dbConfig.password}

# Application Configuration
NODE_ENV=development
PORT=3000

# Redis Configuration (for future worker queues)
REDIS_URL=redis://localhost:6379
`;

    fs.writeFileSync(path.join(__dirname, '..', '.env'), envContent);
    console.log('.env file updated');

    console.log('\n✅ Database setup completed successfully!');
    console.log(`Connection string: postgresql://${dbConfig.user}:${dbConfig.password}@${dbConfig.host}:${dbConfig.port}/${dbConfig.database}`);
    
  } catch (error) {
    console.error('Error setting up database:', error);
    
    if (error.code === 'ECONNREFUSED') {
      console.log('\n📋 Manual setup required:');
      console.log('It appears PostgreSQL is not accessible with the default credentials.');
      console.log('Please set up the database manually:');
      console.log('');
      console.log('1. Connect to PostgreSQL as superuser:');
      console.log('   sudo -u postgres psql');
      console.log('');
      console.log('2. Run these commands:');
      console.log(`   CREATE DATABASE ${dbConfig.database};`);
      console.log(`   CREATE USER ${dbConfig.user} WITH ENCRYPTED PASSWORD '${dbConfig.password}';`);
      console.log(`   GRANT ALL PRIVILEGES ON DATABASE ${dbConfig.database} TO ${dbConfig.user};`);
      console.log('');
      console.log('3. Connect to the new database:');
      console.log(`   \\c ${dbConfig.database}`);
      console.log('');
      console.log('4. Load the schema:');
      console.log('   \\i schema.sql');
      console.log('');
      console.log('5. Grant schema privileges:');
      console.log(`   GRANT ALL ON SCHEMA public TO ${dbConfig.user};`);
      console.log(`   ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO ${dbConfig.user};`);
      console.log(`   ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON SEQUENCES TO ${dbConfig.user};`);
    }
    
    process.exit(1);
  }
}

// Run the setup
setupDatabase().catch(console.error);