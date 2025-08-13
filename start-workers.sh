#!/bin/bash

echo "🚀 Starting LPR Workers..."

# Compile TypeScript
echo "Compiling TypeScript..."
npx tsc src/jobs/*.ts --outDir dist --module commonjs --target ES2020 --esModuleInterop true

# Check if Redis is running
if ! redis-cli ping > /dev/null 2>&1; then
  echo "❌ Redis is not running. Starting Redis..."
  redis-server --daemonize yes
fi

# Start the workers
echo "Starting workers..."
node -r dotenv/config dist/jobs/ingest.js &
node -r dotenv/config dist/jobs/pair.js &
node -r dotenv/config dist/jobs/fuzzy.js &
node -r dotenv/config dist/jobs/expire.js &

echo "✅ Workers started!"
echo "Check logs with: tail -f *.log"
echo "Stop with: pkill -f 'node.*dist/jobs'"