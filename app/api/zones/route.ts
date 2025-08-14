import { NextResponse } from 'next/server';
import { pool } from '@/lib/db';

export async function GET() {
  try {
    const result = await pool.query(`
      SELECT 
        z.*,
        COUNT(DISTINCT s.id) as total_sessions,
        COUNT(DISTINCT e.id) as total_events
      FROM zone_config z
      LEFT JOIN sessions s ON s.zone = z.zone_id
      LEFT JOIN events e ON e.zone = z.zone_id
      GROUP BY z.zone_id
      ORDER BY z.zone_id
    `);
    
    return NextResponse.json(result.rows);
  } catch (error) {
    console.error('Error fetching zones:', error);
    return NextResponse.json(
      { error: 'Failed to fetch zones' },
      { status: 500 }
    );
  }
}