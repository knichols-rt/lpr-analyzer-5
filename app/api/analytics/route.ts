import { NextResponse } from 'next/server';
import { pool } from '@/lib/db';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const days = parseInt(searchParams.get('days') || '7');
    const zone = searchParams.get('zone');
    
    // Get daily stats
    let dailyQuery = `
      SELECT 
        day,
        zone,
        exact_sessions,
        state_mismatch_sessions,
        overnight_sessions,
        multiday_sessions,
        fuzzy_sessions,
        total_sessions
      FROM mv_daily_zone
      WHERE day >= CURRENT_DATE - INTERVAL '${days} days'
    `;
    
    const params: any[] = [];
    if (zone && zone !== 'all') {
      dailyQuery += ` AND zone = $1`;
      params.push(zone);
    }
    
    dailyQuery += ` ORDER BY day DESC`;
    
    const dailyResult = await pool.query(dailyQuery, params);
    
    // Get summary stats
    const summaryResult = await pool.query(`
      SELECT 
        COUNT(*) as total_sessions,
        AVG(duration_minutes) as avg_duration,
        SUM(billing_amount) as total_revenue,
        COUNT(*) FILTER (WHERE match_type = 'EXACT') as exact_matches,
        COUNT(*) FILTER (WHERE match_type = 'STATE_MISMATCH') as state_mismatches,
        COUNT(*) FILTER (WHERE match_type = 'FUZZY_ACCEPTED') as fuzzy_matches
      FROM sessions
      WHERE entry_ts >= CURRENT_DATE - INTERVAL '${days} days'
      ${zone ? `AND zone = $1` : ''}
    `, zone ? [zone] : []);
    
    // Get current active vehicles (IN events without matching OUT)
    const activeResult = await pool.query(`
      SELECT COUNT(*) as active_vehicles
      FROM events
      WHERE direction = 'IN' 
        AND status = 'OPEN'
        ${zone ? `AND zone = $1` : ''}
    `, zone ? [zone] : []);
    
    return NextResponse.json({
      daily: dailyResult.rows,
      summary: {
        ...summaryResult.rows[0],
        active_vehicles: activeResult.rows[0].active_vehicles
      }
    });
  } catch (error) {
    console.error('Error fetching analytics:', error);
    return NextResponse.json(
      { error: 'Failed to fetch analytics' },
      { status: 500 }
    );
  }
}