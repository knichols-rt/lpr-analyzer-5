#!/bin/bash

# LPR Analyzer Database Setup Script
# This script sets up the PostgreSQL database for the LPR Analyzer project

set -e

DB_NAME="lpr_analyzer"
DB_USER="lpr_user"
DB_PASSWORD="lpr_password"

echo "Setting up LPR Analyzer database..."

# Create database and user (this will need to be run as postgres user or with appropriate permissions)
echo "Creating database and user..."

# Method 1: Try with existing postgres setup
if psql postgres -c '\q' 2>/dev/null; then
    echo "Using existing PostgreSQL connection..."
    
    # Drop and recreate database
    psql postgres -c "DROP DATABASE IF EXISTS $DB_NAME;"
    psql postgres -c "CREATE DATABASE $DB_NAME;"
    
    # Create user if not exists
    psql postgres -c "DROP USER IF EXISTS $DB_USER;"
    psql postgres -c "CREATE USER $DB_USER WITH ENCRYPTED PASSWORD '$DB_PASSWORD';"
    psql postgres -c "GRANT ALL PRIVILEGES ON DATABASE $DB_NAME TO $DB_USER;"
    
    # Connect to the new database and grant schema privileges
    psql $DB_NAME -c "GRANT ALL ON SCHEMA public TO $DB_USER;"
    psql $DB_NAME -c "GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO $DB_USER;"
    psql $DB_NAME -c "GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public TO $DB_USER;"
    psql $DB_NAME -c "ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO $DB_USER;"
    psql $DB_NAME -c "ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON SEQUENCES TO $DB_USER;"
    
    echo "Database and user created successfully!"
    
else
    echo "Cannot connect to PostgreSQL with current setup."
    echo "Please ensure PostgreSQL is running and you have appropriate permissions."
    echo ""
    echo "Manual setup instructions:"
    echo "1. Connect as postgres user: sudo -u postgres psql"
    echo "2. Create database: CREATE DATABASE $DB_NAME;"
    echo "3. Create user: CREATE USER $DB_USER WITH ENCRYPTED PASSWORD '$DB_PASSWORD';"
    echo "4. Grant privileges: GRANT ALL PRIVILEGES ON DATABASE $DB_NAME TO $DB_USER;"
    echo "5. Connect to database: \\c $DB_NAME"
    echo "6. Grant schema privileges: GRANT ALL ON SCHEMA public TO $DB_USER;"
    echo ""
    exit 1
fi

# Load the schema
echo "Loading database schema..."
if psql $DB_NAME -f schema.sql; then
    echo "Schema loaded successfully!"
else
    echo "Error loading schema. Please check schema.sql for issues."
    exit 1
fi

# Update .env file with correct credentials
echo "Updating .env file with database credentials..."
cat > .env << EOF
# PostgreSQL Database Configuration
DATABASE_URL=postgresql://$DB_USER:$DB_PASSWORD@localhost:5432/$DB_NAME
DB_HOST=localhost
DB_PORT=5432
DB_NAME=$DB_NAME
DB_USER=$DB_USER
DB_PASSWORD=$DB_PASSWORD

# Application Configuration
NODE_ENV=development
PORT=3000

# Redis Configuration (for future worker queues)
REDIS_URL=redis://localhost:6379
EOF

echo "Database setup completed!"
echo "Connection string: postgresql://$DB_USER:$DB_PASSWORD@localhost:5432/$DB_NAME"