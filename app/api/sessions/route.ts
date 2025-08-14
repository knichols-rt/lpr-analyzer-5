import { NextResponse } from 'next/server';
import { pool } from '@/lib/db';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const limit = parseInt(searchParams.get('limit') || '100');
    const offset = parseInt(searchParams.get('offset') || '0');
    const zone = searchParams.get('zone');
    const plate = searchParams.get('plate');
    
    let query = `
      SELECT 
        s.id,
        s.zone,
        s.entry_event_id,
        s.exit_event_id,
        s.plate_norm,
        s.state_entry,
        s.state_exit,
        s.entry_ts,
        s.exit_ts,
        s.duration_minutes,
        s.match_type,
        s.match_method,
        s.confidence_score,
        s.billing_amount,
        s.flags
      FROM sessions s
      WHERE 1=1
    `;
    
    const params: any[] = [];
    let paramCount = 0;
    
    if (zone) {
      query += ` AND s.zone = $${++paramCount}`;
      params.push(zone);
    }
    
    if (plate) {
      query += ` AND s.plate_norm LIKE $${++paramCount}`;
      params.push(`%${plate.toUpperCase()}%`);
    }
    
    query += ` ORDER BY s.entry_ts DESC`;
    query += ` LIMIT $${++paramCount} OFFSET $${++paramCount}`;
    params.push(limit, offset);
    
    const result = await pool.query(query, params);
    
    // Get total count for pagination
    let countQuery = `SELECT COUNT(*) FROM sessions s WHERE 1=1`;
    const countParams: any[] = [];
    paramCount = 0;
    
    if (zone) {
      countQuery += ` AND s.zone = $${++paramCount}`;
      countParams.push(zone);
    }
    
    if (plate) {
      countQuery += ` AND s.plate_norm LIKE $${++paramCount}`;
      countParams.push(`%${plate.toUpperCase()}%`);
    }
    
    const countResult = await pool.query(countQuery, countParams);
    const total = parseInt(countResult.rows[0].count);
    
    return NextResponse.json({
      sessions: result.rows,
      pagination: {
        total,
        limit,
        offset,
        hasMore: offset + limit < total
      }
    });
  } catch (error) {
    console.error('Error fetching sessions:', error);
    return NextResponse.json(
      { error: 'Failed to fetch sessions' },
      { status: 500 }
    );
  }
}