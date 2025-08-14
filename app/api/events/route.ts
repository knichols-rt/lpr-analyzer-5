import { NextResponse } from 'next/server';
import { pool } from '@/lib/db';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const limit = parseInt(searchParams.get('limit') || '100');
    const offset = parseInt(searchParams.get('offset') || '0');
    const direction = searchParams.get('direction');
    const status = searchParams.get('status');
    const zone = searchParams.get('zone');
    
    let query = `
      SELECT 
        id,
        ts,
        zone,
        direction,
        plate_raw,
        plate_norm,
        state_norm,
        camera_id,
        quality,
        status,
        upload_id
      FROM events
      WHERE 1=1
    `;
    
    const params: any[] = [];
    let paramCount = 0;
    
    if (direction) {
      query += ` AND direction = $${++paramCount}`;
      params.push(direction);
    }
    
    if (status) {
      query += ` AND status = $${++paramCount}`;
      params.push(status);
    }
    
    if (zone && zone !== 'all') {
      query += ` AND zone = $${++paramCount}`;
      params.push(zone);
    }
    
    query += ` ORDER BY ts DESC`;
    query += ` LIMIT $${++paramCount} OFFSET $${++paramCount}`;
    params.push(limit, offset);
    
    const result = await pool.query(query, params);
    
    return NextResponse.json({
      events: result.rows,
      pagination: {
        limit,
        offset,
        hasMore: result.rows.length === limit
      }
    });
  } catch (error) {
    console.error('Error fetching events:', error);
    return NextResponse.json(
      { error: 'Failed to fetch events' },
      { status: 500 }
    );
  }
}