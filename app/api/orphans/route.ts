import { NextResponse } from 'next/server';
import { pool } from '@/lib/db';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const limit = parseInt(searchParams.get('limit') || '100');
    const offset = parseInt(searchParams.get('offset') || '0');
    const type = searchParams.get('type'); // 'expired' or 'open'
    
    let statusFilter = '';
    if (type === 'expired') {
      statusFilter = `AND status = 'ORPHAN_EXPIRED'`;
    } else if (type === 'open') {
      statusFilter = `AND status = 'ORPHAN_OPEN'`;
    } else {
      statusFilter = `AND status IN ('ORPHAN_EXPIRED', 'ORPHAN_OPEN')`;
    }
    
    const query = `
      SELECT 
        id as event_id,
        zone,
        plate_norm,
        state_norm,
        ts,
        direction,
        status,
        camera_id,
        quality
      FROM events
      WHERE 1=1 ${statusFilter}
      ORDER BY ts DESC
      LIMIT $1 OFFSET $2
    `;
    
    const result = await pool.query(query, [limit, offset]);
    
    // Get counts
    const countResult = await pool.query(`
      SELECT 
        COUNT(*) FILTER (WHERE status = 'ORPHAN_EXPIRED') as expired_count,
        COUNT(*) FILTER (WHERE status = 'ORPHAN_OPEN') as open_count
      FROM events
      WHERE status IN ('ORPHAN_EXPIRED', 'ORPHAN_OPEN')
    `);
    
    return NextResponse.json({
      orphans: result.rows,
      counts: {
        expired: parseInt(countResult.rows[0].expired_count),
        open: parseInt(countResult.rows[0].open_count)
      },
      pagination: {
        limit,
        offset,
        hasMore: result.rows.length === limit
      }
    });
  } catch (error) {
    console.error('Error fetching orphans:', error);
    return NextResponse.json(
      { error: 'Failed to fetch orphans' },
      { status: 500 }
    );
  }
}