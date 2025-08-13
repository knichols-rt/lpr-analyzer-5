import { NextRequest, NextResponse } from 'next/server'
import { pool } from '../../../../lib/db'

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const from = searchParams.get('from')
    const to = searchParams.get('to')
    const zones = searchParams.get('zones')?.split(',').filter(Boolean) || []

    // Query the database for actual metrics
    const eventsCountResult = await pool.query(`
      SELECT COUNT(*) as total_events 
      FROM events 
      WHERE ts >= $1 AND ts <= $2
      ${zones.length > 0 ? 'AND zone = ANY($3)' : ''}
    `, zones.length > 0 ? [from, to, zones] : [from, to])

    const sessionsCountResult = await pool.query(`
      SELECT COUNT(*) as total_sessions 
      FROM sessions 
      WHERE entry_ts >= $1 AND entry_ts <= $2
      ${zones.length > 0 ? 'AND zone = ANY($3)' : ''}
    `, zones.length > 0 ? [from, to, zones] : [from, to])

    const sessionTypesResult = await pool.query(`
      SELECT 
        match_type,
        COUNT(*) as count
      FROM sessions 
      WHERE entry_ts >= $1 AND entry_ts <= $2
      ${zones.length > 0 ? 'AND zone = ANY($3)' : ''}
      GROUP BY match_type
    `, zones.length > 0 ? [from, to, zones] : [from, to])

    const orphansResult = await pool.query(`
      SELECT 
        direction,
        CASE 
          WHEN ts < NOW() - INTERVAL '12 hours' THEN 'expired'
          ELSE 'open'
        END as status,
        COUNT(*) as count
      FROM orphans 
      WHERE ts >= $1 AND ts <= $2
      ${zones.length > 0 ? 'AND zone = ANY($3)' : ''}
      GROUP BY direction, CASE 
        WHEN ts < NOW() - INTERVAL '12 hours' THEN 'expired'
        ELSE 'open'
      END
    `, zones.length > 0 ? [from, to, zones] : [from, to])

    // Process results
    const totalEvents = parseInt(eventsCountResult.rows[0]?.total_events || '0')
    const totalSessions = parseInt(sessionsCountResult.rows[0]?.total_sessions || '0')

    const sessionTypes = {
      exact: 0,
      stateMismatch: 0,
      overnight: 0,
      multiday: 0,
      fuzzyAccepted: 0
    }

    sessionTypesResult.rows.forEach(row => {
      switch (row.match_type) {
        case 'EXACT':
          sessionTypes.exact = parseInt(row.count)
          break
        case 'STATE_MISMATCH':
          sessionTypes.stateMismatch = parseInt(row.count)
          break
        case 'FUZZY_ACCEPTED':
          sessionTypes.fuzzyAccepted = parseInt(row.count)
          break
      }
    })

    const orphans = {
      openIn: 0,
      openOut: 0,
      expired: 0
    }

    orphansResult.rows.forEach(row => {
      if (row.direction === 'IN' && row.status === 'open') {
        orphans.openIn = parseInt(row.count)
      } else if (row.direction === 'OUT' && row.status === 'open') {
        orphans.openOut = parseInt(row.count)
      } else if (row.status === 'expired') {
        orphans.expired = parseInt(row.count)
      }
    })

    const data = {
      totalEvents,
      totalSessions,
      sessionTypes,
      orphans,
      meta: {
        from,
        to,
        zones,
        generatedAt: new Date().toISOString()
      }
    }

    return NextResponse.json(data)
  } catch (error) {
    console.error('Error in metrics summary API:', error)
    return NextResponse.json(
      { error: 'Failed to fetch metrics summary' },
      { status: 500 }
    )
  }
}