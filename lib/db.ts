// src/db.ts
import { Pool } from 'pg';
export const pool = new Pool({ connectionString: process.env.DATABASE_URL });

export async function copyIntoEvents(csvPath: string, uploadId: string) {
// Use pg-copy-streams or psql COPY via shell in prod; here is a placeholder
}

export async function pairOut(outId: number, zone: string, plate: string, ts: string) {
const sql = 'SELECT pair_out_event($1,$2,$3,$4)';
await pool.query(sql, [outId, zone, plate, ts]);
}