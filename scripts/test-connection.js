const { testConnection } = require('../db-config');

async function main() {
  console.log('Testing database connection...');
  const connected = await testConnection();
  
  if (connected) {
    console.log('✅ Database connection successful!');
  } else {
    console.log('❌ Database connection failed!');
    console.log('\nTo set up the database manually:');
    console.log('1. sudo -u postgres psql -f manual-setup.sql');
    console.log('2. psql -U lpr_user -d lpr_analyzer -f schema.sql');
  }
}

main().catch(console.error);