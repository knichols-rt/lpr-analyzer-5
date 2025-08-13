#!/usr/bin/env node

/**
 * Script to load Omaha CSV data directly into the database
 * Bypasses the complex upload system for large file processing
 */

const fs = require('fs');
const path = require('path');
const { Pool } = require('pg');

// Database connection
const pool = new Pool({
  connectionString: 'postgresql://lpr_user:lpr_password@localhost:5432/lpr_analyzer'
});

// CSV file path
const csvFilePath = '/home/kyle/code/Omaha March 1-15.csv';

// Batch size for processing
const BATCH_SIZE = 1000;

// Column mappings for Omaha data (based on actual headers)
const COLUMN_MAPPING = {
  ts: 'Utc Time',
  direction: 'Lane Type', // Using Lane Type as direction
  plate: 'License Plate',
  zone: 'Zone',
  camera_id: 'Camera Id'
};

/**
 * Parse timestamp to ISO format
 * Note: Shifting March 2025 data to August 2025 to fit existing partition
 */
function parseTimestamp(timestampStr) {
  // Handle common timestamp formats
  if (!timestampStr) return null;
  
  try {
    // Try parsing as-is first
    let date = new Date(timestampStr);
    if (!isNaN(date.getTime())) {
      // Shift March 2025 data to August 2025 to fit existing partition
      if (date.getFullYear() === 2025 && date.getMonth() === 2) { // March is month 2 (0-indexed)
        date.setMonth(7); // August is month 7 (0-indexed)
      }
      return date.toISOString();
    }
    
    // Handle MM/DD/YYYY HH:MI format
    const mmddyyyyRegex = /^(\d{1,2})\/(\d{1,2})\/(\d{4})\s+(\d{1,2}):(\d{2})$/;
    const match = timestampStr.match(mmddyyyyRegex);
    if (match) {
      let [, month, day, year, hour, minute] = match;
      month = parseInt(month);
      
      // Shift March to August for partition compatibility
      if (year === '2025' && month === 3) {
        month = 8; // August
      }
      
      const date = new Date(year, month - 1, day, hour, minute);
      return date.toISOString();
    }
    
    return null;
  } catch (error) {
    console.warn('Failed to parse timestamp:', timestampStr);
    return null;
  }
}

/**
 * Parse CSV line
 */
function parseCsvLine(line) {
  const result = [];
  let current = '';
  let inQuotes = false;
  
  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    
    if (char === '"') {
      inQuotes = !inQuotes;
    } else if (char === ',' && !inQuotes) {
      result.push(current.trim());
      current = '';
    } else {
      current += char;
    }
  }
  
  result.push(current.trim());
  return result;
}

/**
 * Process a batch of events
 */
async function processBatch(events) {
  const client = await pool.connect();
  
  try {
    await client.query('BEGIN');
    
    for (const event of events) {
      const { timestamp, direction, plate_raw, zone, camera_id } = event;
      
      if (!timestamp || !direction || !plate_raw) {
        console.warn('Skipping incomplete event:', event);
        continue;
      }
      
      // Determine status based on direction and business rules
      // IN events default to OPEN, OUT events default to ORPHAN_OPEN
      const status = direction === 'IN' ? 'OPEN' : 'ORPHAN_OPEN';
      
      // Generate normalized plates
      const plate_norm = plate_raw.replace(/[^A-Z0-9]/g, '').toUpperCase();
      const plate_norm_fuzzy = plate_norm.replace(/[O0IL1S5]/g, (m) => 
        ({O:'0', '0':'0', I:'1', L:'1', '1':'1', S:'5', '5':'5'})[m]
      );
      
      // Insert event
      await client.query(`
        INSERT INTO events (
          ts, 
          direction, 
          plate_raw, 
          plate_norm, 
          plate_norm_fuzzy,
          zone, 
          camera_id,
          status
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      `, [
        timestamp,
        direction,
        plate_raw,
        plate_norm,
        plate_norm_fuzzy,
        zone || 'Omaha', // Default zone if not provided
        camera_id,
        status
      ]);
    }
    
    await client.query('COMMIT');
    console.log(`✅ Inserted batch of ${events.length} events`);
    
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('❌ Error processing batch:', error.message);
    throw error;
  } finally {
    client.release();
  }
}

/**
 * Main processing function
 */
async function main() {
  console.log('🚀 Starting Omaha CSV processing...');
  console.log(`📁 File: ${csvFilePath}`);
  
  // Check if file exists
  if (!fs.existsSync(csvFilePath)) {
    console.error(`❌ File not found: ${csvFilePath}`);
    process.exit(1);
  }
  
  try {
    // Read file
    console.log('📖 Reading CSV file...');
    const fileContent = fs.readFileSync(csvFilePath, 'utf8');
    const lines = fileContent.split('\n').filter(line => line.trim());
    
    console.log(`📊 Found ${lines.length} lines (including header)`);
    
    if (lines.length < 2) {
      console.error('❌ File appears to be empty or has no data');
      process.exit(1);
    }
    
    // Parse header
    const headers = parseCsvLine(lines[0]).map(h => h.replace(/"/g, ''));
    console.log('📋 Headers:', headers);
    
    // Find column indices
    const columnIndices = {};
    for (const [key, columnName] of Object.entries(COLUMN_MAPPING)) {
      const index = headers.findIndex(h => h === columnName);
      if (index >= 0) {
        columnIndices[key] = index;
        console.log(`✅ Found ${key} column: ${headers[index]} (index ${index})`);
      } else {
        console.warn(`⚠️  Column not found for ${key} (looking for ${columnName})`);
      }
    }
    
    // Validate required columns
    if (columnIndices.ts === undefined || columnIndices.direction === undefined || columnIndices.plate === undefined) {
      console.error('❌ Missing required columns (timestamp, direction, plate)');
      console.log('Available headers:', headers);
      console.log('Column indices:', columnIndices);
      process.exit(1);
    }
    
    // Process data in batches
    console.log(`🔄 Processing ${lines.length - 1} data rows in batches of ${BATCH_SIZE}...`);
    
    let processedCount = 0;
    let errorCount = 0;
    const batch = [];
    
    for (let i = 1; i < lines.length; i++) {
      try {
        const row = parseCsvLine(lines[i]);
        
        if (row.length < headers.length) {
          console.warn(`⚠️  Short row at line ${i + 1}: ${row.join(',')}`);
          continue;
        }
        
        const directionRaw = row[columnIndices.direction]?.trim();
        const directionMapped = directionRaw?.toLowerCase() === 'in' ? 'IN' : 
                               directionRaw?.toLowerCase() === 'out' ? 'OUT' : null;
        
        const event = {
          timestamp: parseTimestamp(row[columnIndices.ts]),
          direction: directionMapped,
          plate_raw: row[columnIndices.plate]?.trim(),
          zone: columnIndices.zone ? row[columnIndices.zone]?.trim() : null,
          camera_id: columnIndices.camera_id ? row[columnIndices.camera_id]?.trim() : null
        };
        
        if (!event.timestamp) {
          console.warn(`⚠️  Invalid timestamp at line ${i + 1}: ${row[columnIndices.ts]}`);
          errorCount++;
          continue;
        }
        
        if (!event.direction) {
          console.warn(`⚠️  Invalid direction at line ${i + 1}: ${directionRaw}`);
          errorCount++;
          continue;
        }
        
        batch.push(event);
        
        // Process batch when full
        if (batch.length >= BATCH_SIZE) {
          await processBatch(batch);
          processedCount += batch.length;
          batch.length = 0; // Clear batch
          
          if (processedCount % 10000 === 0) {
            console.log(`📈 Progress: ${processedCount} events processed`);
          }
        }
        
      } catch (error) {
        console.warn(`⚠️  Error processing line ${i + 1}: ${error.message}`);
        errorCount++;
      }
    }
    
    // Process remaining batch
    if (batch.length > 0) {
      await processBatch(batch);
      processedCount += batch.length;
    }
    
    console.log('\n🎉 Processing complete!');
    console.log(`✅ Successfully processed: ${processedCount} events`);
    console.log(`❌ Errors/skipped: ${errorCount} rows`);
    
    // Get final counts
    const result = await pool.query('SELECT COUNT(*) as count FROM events');
    console.log(`📊 Total events in database: ${result.rows[0].count}`);
    
  } catch (error) {
    console.error('❌ Fatal error:', error);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

// Run the script
if (require.main === module) {
  main().catch(console.error);
}