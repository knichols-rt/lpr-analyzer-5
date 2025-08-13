// CSV Field Mappings for different data sources
// Based on Appendix U.9 - Preset Mapping for Omaha March 1-15 CSV

export interface CSVMapping {
  name: string;
  description: string;
  headers: string[];
  fieldMapping: {
    ts: string;
    direction: string;
    plate_raw: string;
    state_raw: string;
    zone: string;
    camera_id: string;
    quality?: string;
  };
  transforms: {
    timestamp?: {
      format: string;
      timezone?: string;
    };
    direction?: {
      mapping: Record<string, string>;
    };
  };
}

// Omaha CSV Mapping (lines 1543-1592 of spec)
export const OMAHA_MAPPING: CSVMapping = {
  name: 'omaha-march-2025',
  description: 'Omaha March 1-15 CSV format',
  headers: [
    'License Plate',
    'Country', 
    'State',
    'Zone',
    'Utc Time',
    'Camera Id',
    'Lane Type'
  ],
  fieldMapping: {
    ts: 'Utc Time',           // Parse as UTC timestamp
    direction: 'Lane Type',    // In|Out → IN|OUT
    plate_raw: 'License Plate',
    state_raw: 'State',
    zone: 'Zone',             // Cast to TEXT
    camera_id: 'Camera Id',
    quality: undefined        // Absent → NULL
  },
  transforms: {
    timestamp: {
      format: 'FMMM/FMDD/YYYY FMHH24:MI', // PostgreSQL format for '3/15/2025 23:58'
      timezone: 'UTC'
    },
    direction: {
      mapping: {
        'in': 'IN',
        'In': 'IN', 
        'IN': 'IN',
        'out': 'OUT',
        'Out': 'OUT',
        'OUT': 'OUT'
      }
    }
  }
};

// SQL template for Omaha CSV ingest (from spec lines 1559-1588)
export const OMAHA_INGEST_SQL = `
INSERT INTO events (
  ts, zone, direction,
  plate_raw, plate_norm, plate_norm_fuzzy,
  state_raw, state_norm, camera_id,
  upload_id, quality, dupe_key, raw
)
SELECT
  -- Parse '3/15/2025 23:58' as UTC
  to_timestamp(s."Utc Time", 'FMMM/FMDD/YYYY FMHH24:MI') AT TIME ZONE 'UTC' AS ts,
  s."Zone"::text AS zone,
  CASE WHEN lower(s."Lane Type") = 'in' THEN 'IN' ELSE 'OUT' END AS direction,
  s."License Plate" AS plate_raw,
  normalize_plate(s."License Plate") AS plate_norm,
  normalize_plate_fuzzy(s."License Plate") AS plate_norm_fuzzy,
  s."State" AS state_raw,
  normalize_state(s."State") AS state_norm,
  s."Camera Id"::text AS camera_id,
  $1::uuid AS upload_id,
  NULL::int AS quality,
  encode(digest(
    concat_ws('|', s."Zone"::text, s."Camera Id"::text,
                    CASE WHEN lower(s."Lane Type")='in' THEN 'IN' ELSE 'OUT' END,
                    to_char(to_timestamp(s."Utc Time", 'FMMM/FMDD/YYYY FMHH24:MI') AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI') ,
                    s."License Plate", s."State"), 'sha256'), 'hex') AS dupe_key,
  to_jsonb(s.*) AS raw
FROM staging_omaha s
ON CONFLICT (zone, dupe_key) DO NOTHING;
`;

// Generic CSV mapping interface
export interface GenericCSVMapping {
  uploadId: string;
  mapping: CSVMapping;
  zone?: string;
  timezone?: string;
}

// CSV Mapping registry
export const CSV_MAPPINGS: Record<string, CSVMapping> = {
  'omaha-march-2025': OMAHA_MAPPING
};

// Helper functions for CSV processing
export class CSVMappingService {
  
  static detectMapping(headers: string[]): CSVMapping | null {
    // Try to detect mapping based on headers
    for (const mapping of Object.values(CSV_MAPPINGS)) {
      const headerSet = new Set(headers.map(h => h.trim()));
      const expectedSet = new Set(mapping.headers);
      
      // Check if all expected headers are present
      const hasAllHeaders = mapping.headers.every(header => headerSet.has(header));
      
      if (hasAllHeaders) {
        return mapping;
      }
    }
    
    return null;
  }

  static validateHeaders(headers: string[], mapping: CSVMapping): string[] {
    const errors: string[] = [];
    const headerSet = new Set(headers.map(h => h.trim()));
    
    for (const requiredHeader of mapping.headers) {
      if (!headerSet.has(requiredHeader)) {
        errors.push(`Missing required header: ${requiredHeader}`);
      }
    }
    
    return errors;
  }

  static createStagingTableSQL(mapping: CSVMapping, uploadId: string): string {
    // Create unlogged staging table for this specific upload
    const tableName = `staging_${mapping.name.replace(/[^a-z0-9_]/g, '_')}_${uploadId.replace(/-/g, '_')}`;
    
    const columns = mapping.headers.map(header => 
      `"${header}" TEXT`
    ).join(',\n  ');
    
    return `
      CREATE UNLOGGED TABLE ${tableName} (
        ${columns}
      );
    `;
  }

  static getIngestSQL(mapping: CSVMapping, uploadId: string): string {
    if (mapping.name === 'omaha-march-2025') {
      return OMAHA_INGEST_SQL.replace('staging_omaha', 
        `staging_${mapping.name.replace(/[^a-z0-9_]/g, '_')}_${uploadId.replace(/-/g, '_')}`);
    }
    
    // For other mappings, generate generic SQL
    throw new Error(`Ingest SQL not implemented for mapping: ${mapping.name}`);
  }

  static cleanupStagingTable(mapping: CSVMapping, uploadId: string): string {
    const tableName = `staging_${mapping.name.replace(/[^a-z0-9_]/g, '_')}_${uploadId.replace(/-/g, '_')}`;
    return `DROP TABLE IF EXISTS ${tableName};`;
  }
}

export default CSV_MAPPINGS;