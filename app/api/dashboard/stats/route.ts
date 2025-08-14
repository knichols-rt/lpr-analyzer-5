import { NextResponse } from 'next/server';
import { pool } from '@/lib/db';

export async function GET() {
  try {
    // Get all dashboard stats in one query
    const result = await pool.query(`
      WITH stats AS (
        SELECT 
          (SELECT COUNT(*) FROM sessions WHERE entry_ts >= CURRENT_DATE) as today_sessions,
          (SELECT COUNT(*) FROM sessions) as total_sessions,
          (SELECT AVG(duration_minutes) FROM sessions) as avg_duration,
          (SELECT COUNT(*) FROM events WHERE direction='IN' AND status='OPEN') as active_vehicles,
          (SELECT SUM(billing_amount) FROM sessions WHERE entry_ts >= CURRENT_DATE) as today_revenue,
          (SELECT SUM(billing_amount) FROM sessions) as total_revenue
      )
      SELECT * FROM stats
    `);
    
    const stats = result.rows[0];
    
    // Get recent sessions for the dashboard
    const recentResult = await pool.query(`
      SELECT 
        s.id,
        s.plate_norm,
        s.entry_ts,
        s.exit_ts,
        s.duration_minutes,
        s.billing_amount,
        s.zone
      FROM sessions s
      ORDER BY s.exit_ts DESC
      LIMIT 10
    `);
    
    return NextResponse.json({
      stats: {
        totalSessions: parseInt(stats.total_sessions),
        todaySessions: parseInt(stats.today_sessions),
        avgDuration: Math.round(parseFloat(stats.avg_duration || '0')),
        activeVehicles: parseInt(stats.active_vehicles),
        revenue: parseFloat(stats.total_revenue || '0'),
        todayRevenue: parseFloat(stats.today_revenue || '0')
      },
      recentSessions: recentResult.rows
    });
  } catch (error) {
    console.error('Error fetching dashboard stats:', error);
    return NextResponse.json(
      { error: 'Failed to fetch dashboard stats' },
      { status: 500 }
    );
  }
}