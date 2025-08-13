const { Client } = require('pg');
const fs = require('fs');
const path = require('path');

async function createDatabase() {
  console.log('Creating LPR Analyzer database...');
  
  const dbConfig = {
    user: 'lpr_user',
    password: 'lpr_password',
    database: 'lpr_analyzer'
  };
  
  // Connect to postgres database as admin to create our database and user
  const adminClient = new Client({
    host: 'localhost',
    port: 5432,
    user: 'postgres',
    password: 'postgres',
    database: 'postgres'
  });

  try {
    await adminClient.connect();
    console.log('Connected to PostgreSQL as admin');

    // Drop and recreate database and user
    try {
      await adminClient.query(`DROP DATABASE IF EXISTS ${dbConfig.database}`);
      console.log('Dropped existing database');
    } catch (err) {
      console.log('No existing database to drop');
    }
    
    try {
      await adminClient.query(`DROP USER IF EXISTS ${dbConfig.user}`);
      console.log('Dropped existing user');
    } catch (err) {
      console.log('No existing user to drop');
    }
    
    await adminClient.query(`CREATE DATABASE ${dbConfig.database}`);
    console.log(`Database '${dbConfig.database}' created`);
    
    await adminClient.query(`CREATE USER ${dbConfig.user} WITH ENCRYPTED PASSWORD '${dbConfig.password}'`);
    console.log(`User '${dbConfig.user}' created`);
    
    await adminClient.query(`GRANT ALL PRIVILEGES ON DATABASE ${dbConfig.database} TO ${dbConfig.user}`);
    console.log('Privileges granted');
    
    await adminClient.end();

    // Connect to new database to grant schema privileges
    const dbClient = new Client({
      host: 'localhost',
      port: 5432,
      ...dbConfig
    });
    
    await dbClient.connect();
    console.log('Connected to new database');
    
    await dbClient.query(`GRANT ALL ON SCHEMA public TO ${dbConfig.user}`);
    await dbClient.query(`ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO ${dbConfig.user}`);
    await dbClient.query(`ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON SEQUENCES TO ${dbConfig.user}`);
    await dbClient.query(`ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON FUNCTIONS TO ${dbConfig.user}`);
    
    console.log('Schema privileges granted');
    await dbClient.end();

    // Update .env file
    const envContent = `# PostgreSQL Database Configuration
DATABASE_URL=postgresql://${dbConfig.user}:${dbConfig.password}@localhost:5432/${dbConfig.database}
DB_HOST=localhost
DB_PORT=5432
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

    console.log('✅ Database created successfully!');
    console.log(`Connection string: postgresql://${dbConfig.user}:${dbConfig.password}@localhost:5432/${dbConfig.database}`);
    
  } catch (error) {
    console.error('Error creating database:', error);
    
    if (error.code === 'ECONNREFUSED' || error.code === '28P01') {
      console.log('\n📋 Manual setup required:');
      console.log('PostgreSQL connection failed. Please set up manually:');
      console.log('');
      console.log('1. Connect as postgres user: sudo -u postgres psql');
      console.log('2. Create database: CREATE DATABASE lpr_analyzer;');
      console.log('3. Create user: CREATE USER lpr_user WITH ENCRYPTED PASSWORD \'lpr_password\';');
      console.log('4. Grant privileges: GRANT ALL PRIVILEGES ON DATABASE lpr_analyzer TO lpr_user;');
      console.log('5. Connect: \\c lpr_analyzer');
      console.log('6. Grant schema privileges: GRANT ALL ON SCHEMA public TO lpr_user;');
      console.log('7. Then run: node scripts/load-schema.js');
    }
    
    throw error;
  }
}

createDatabase().catch(console.error);