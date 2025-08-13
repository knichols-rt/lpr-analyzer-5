#!/bin/bash

# LPR Analyzer Database Setup Script
# This script sets up the complete PostgreSQL database for the LPR Analyzer project
# following the Status-as-Source-of-Truth design from Appendix S

set -e

# Configuration
DB_NAME="lpr_analyzer"
DB_USER="lpr_user"
DB_PASSWORD="lpr_password"
POSTGRES_USER="postgres"
POSTGRES_PASSWORD="postgres"
DB_HOST="localhost"
DB_PORT="5432"

echo "🚀 LPR Analyzer Database Setup - Status as Source-of-Truth Implementation"
echo "========================================================================"
echo ""

# Check if PostgreSQL is running
echo "📋 Checking PostgreSQL availability..."
if ! pg_isready -h $DB_HOST -p $DB_PORT > /dev/null 2>&1; then
    echo "❌ PostgreSQL is not running on $DB_HOST:$DB_PORT"
    echo "Please start PostgreSQL and try again."
    exit 1
fi
echo "✅ PostgreSQL is running"

# Test postgres user connection
echo "📋 Testing PostgreSQL connection..."
if ! PGPASSWORD=$POSTGRES_PASSWORD psql -h $DB_HOST -U $POSTGRES_USER -d postgres -c '\q' > /dev/null 2>&1; then
    echo "❌ Cannot connect as postgres user"
    echo "Please ensure PostgreSQL is properly configured with user 'postgres' and password '$POSTGRES_PASSWORD'"
    echo "Or modify the POSTGRES_USER and POSTGRES_PASSWORD variables in this script"
    exit 1
fi
echo "✅ PostgreSQL connection successful"

# Drop and recreate database
echo "🗑️  Dropping existing database (if any)..."
PGPASSWORD=$POSTGRES_PASSWORD psql -h $DB_HOST -U $POSTGRES_USER -d postgres -c "DROP DATABASE IF EXISTS $DB_NAME;" > /dev/null 2>&1 || true

echo "🏗️  Creating database..."
PGPASSWORD=$POSTGRES_PASSWORD psql -h $DB_HOST -U $POSTGRES_USER -d postgres -c "CREATE DATABASE $DB_NAME;"

# Drop and recreate user
echo "👤 Setting up database user..."
PGPASSWORD=$POSTGRES_PASSWORD psql -h $DB_HOST -U $POSTGRES_USER -d postgres -c "DROP USER IF EXISTS $DB_USER;" > /dev/null 2>&1 || true
PGPASSWORD=$POSTGRES_PASSWORD psql -h $DB_HOST -U $POSTGRES_USER -d postgres -c "CREATE USER $DB_USER WITH ENCRYPTED PASSWORD '$DB_PASSWORD';"
PGPASSWORD=$POSTGRES_PASSWORD psql -h $DB_HOST -U $POSTGRES_USER -d postgres -c "GRANT ALL PRIVILEGES ON DATABASE $DB_NAME TO $DB_USER;"

# Grant schema privileges
echo "🔐 Granting schema privileges..."
PGPASSWORD=$POSTGRES_PASSWORD psql -h $DB_HOST -U $POSTGRES_USER -d $DB_NAME -c "GRANT ALL ON SCHEMA public TO $DB_USER;"
PGPASSWORD=$POSTGRES_PASSWORD psql -h $DB_HOST -U $POSTGRES_USER -d $DB_NAME -c "GRANT CREATE ON SCHEMA public TO $DB_USER;"
PGPASSWORD=$POSTGRES_PASSWORD psql -h $DB_HOST -U $POSTGRES_USER -d $DB_NAME -c "ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO $DB_USER;"
PGPASSWORD=$POSTGRES_PASSWORD psql -h $DB_HOST -U $POSTGRES_USER -d $DB_NAME -c "ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON SEQUENCES TO $DB_USER;"
PGPASSWORD=$POSTGRES_PASSWORD psql -h $DB_HOST -U $POSTGRES_USER -d $DB_NAME -c "ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON FUNCTIONS TO $DB_USER;"

# Load the schema
echo "📄 Loading database schema..."
if PGPASSWORD=$POSTGRES_PASSWORD psql -h $DB_HOST -U $POSTGRES_USER -d $DB_NAME -f schema.sql > /dev/null; then
    echo "✅ Schema loaded successfully"
else
    echo "❌ Error loading schema"
    exit 1
fi

# Grant permissions on created objects
echo "🔐 Granting permissions on created objects..."
PGPASSWORD=$POSTGRES_PASSWORD psql -h $DB_HOST -U $POSTGRES_USER -d $DB_NAME -c "GRANT ALL ON ALL TABLES IN SCHEMA public TO $DB_USER;" > /dev/null
PGPASSWORD=$POSTGRES_PASSWORD psql -h $DB_HOST -U $POSTGRES_USER -d $DB_NAME -c "GRANT USAGE ON ALL SEQUENCES IN SCHEMA public TO $DB_USER;" > /dev/null

# Update .env file
echo "⚙️  Updating .env configuration..."
cat > .env << EOF
# PostgreSQL Database Configuration - LPR Analyzer
# Status as Source-of-Truth Implementation (Appendix S)
DATABASE_URL=postgresql://$DB_USER:$DB_PASSWORD@$DB_HOST:$DB_PORT/$DB_NAME
DB_HOST=$DB_HOST
DB_PORT=$DB_PORT
DB_NAME=$DB_NAME
DB_USER=$DB_USER
DB_PASSWORD=$DB_PASSWORD

# Application Configuration
NODE_ENV=development
PORT=3000

# Redis Configuration (for future worker queues)
REDIS_URL=redis://localhost:6379
EOF

# Verify installation
echo "🔍 Verifying installation..."
TABLE_COUNT=\$(PGPASSWORD=$DB_PASSWORD psql -h $DB_HOST -U $DB_USER -d $DB_NAME -t -c "SELECT COUNT(*) FROM information_schema.tables WHERE table_schema = 'public';" | xargs)
FUNCTION_COUNT=\$(PGPASSWORD=$DB_PASSWORD psql -h $DB_HOST -U $DB_USER -d $DB_NAME -t -c "SELECT COUNT(*) FROM information_schema.routines WHERE routine_schema = 'public' AND routine_name NOT LIKE '%trgm%' AND routine_name NOT LIKE 'similarity%' AND routine_name NOT LIKE 'show_%' AND routine_name NOT LIKE 'set_%' AND routine_name NOT LIKE '%word%' AND routine_name NOT LIKE 'gtrgm%' AND routine_name NOT LIKE 'gin_%';" | xargs)
TRIGGER_COUNT=\$(PGPASSWORD=$DB_PASSWORD psql -h $DB_HOST -U $DB_USER -d $DB_NAME -t -c "SELECT COUNT(*) FROM information_schema.triggers WHERE trigger_schema = 'public';" | xargs)

echo "📊 Database verification results:"
echo "   • Tables created: \$TABLE_COUNT (expected: 7)"
echo "   • Functions created: \$FUNCTION_COUNT (expected: ~12)"
echo "   • Triggers created: \$TRIGGER_COUNT (expected: 7)"

# List main objects created
echo ""
echo "🏗️  Main database objects created:"
echo "   Tables: zone_config, uploads, events (partitioned), open_entries, sessions, orphans, ocr_patterns"
echo "   Key Functions: pair_out_event_v2, expire_open_ins_v2, generate_test_events"
echo "   Materialized Views: mv_daily_zone, mv_events_daily"
echo "   Consistency Triggers: Data integrity verification triggers on all state tables"

echo ""
echo "✅ LPR Analyzer database setup completed successfully!"
echo ""
echo "🔗 Connection details:"
echo "   Database: $DB_NAME"
echo "   User: $DB_USER"
echo "   Host: $DB_HOST:$DB_PORT"
echo "   Connection String: postgresql://$DB_USER:$DB_PASSWORD@$DB_HOST:$DB_PORT/$DB_NAME"
echo ""
echo "🧪 To test the installation:"
echo "   node scripts/test-connection.js"
echo "   node scripts/test-schema.js"
echo ""
echo "📚 Next steps:"
echo "   1. Test the schema with sample data: SELECT generate_test_events('ZONE1', 100);"
echo "   2. Set up worker queues (see Appendix B in specification)"
echo "   3. Implement front-end dashboard (see Front-End Scope in specification)"