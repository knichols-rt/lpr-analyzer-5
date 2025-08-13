import { NextRequest, NextResponse } from 'next/server'
import { pool } from '../../../lib/db'

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const from = searchParams.get('from')
    const to = searchParams.get('to')
    const zones = searchParams.get('zones')?.split(',').filter(Boolean) || []
    const direction = searchParams.get('direction')
    const search = searchParams.get('search')
    const sort = searchParams.get('sort') || 'time'
    const page = parseInt(searchParams.get('page') || '1')
    const pageSize = parseInt(searchParams.get('pageSize') || '100')

    // Build the query
    let whereConditions = []
    let queryParams = []
    let paramIndex = 1

    // Date filtering
    if (from) {
      whereConditions.push(`ts >= $${paramIndex}`)
      queryParams.push(from)
      paramIndex++
    }
    if (to) {
      whereConditions.push(`ts <= $${paramIndex}`)
      queryParams.push(to)
      paramIndex++
    }

    // Zone filtering
    if (zones.length > 0) {
      whereConditions.push(`zone = ANY($${paramIndex})`)
      queryParams.push(zones)
      paramIndex++
    }

    // Direction filtering
    if (direction) {
      whereConditions.push(`direction = $${paramIndex}`)
      queryParams.push(direction)
      paramIndex++
    }

    // Search filtering
    if (search) {
      whereConditions.push(`(plate ILIKE $${paramIndex} OR state ILIKE $${paramIndex} OR camera ILIKE $${paramIndex})`)
      queryParams.push(`%${search}%`)
      paramIndex++
    }

    const whereClause = whereConditions.length > 0 ? `WHERE ${whereConditions.join(' AND ')}` : ''

    // Get total count
    const countQuery = `SELECT COUNT(*) as total FROM events ${whereClause}`
    const countResult = await pool.query(countQuery, queryParams)
    const total = parseInt(countResult.rows[0]?.total || '0')

    // Get paginated data
    const offset = (page - 1) * pageSize
    const dataQuery = `
      SELECT id, plate, state, zone, ts as time, direction, camera, quality, upload_id as "uploadId"
      FROM events 
      ${whereClause}
      ORDER BY ts DESC
      LIMIT $${paramIndex} OFFSET $${paramIndex + 1}
    `
    queryParams.push(pageSize, offset)

    const eventsResult = await pool.query(dataQuery, queryParams)
    const events = eventsResult.rows.map(row => ({
      ...row,
      time: row.time.toISOString()
    }))

    // Pagination info
    const totalPages = Math.ceil(total / pageSize)

    const response = {
      data: paginatedEvents,
      pagination: {
        page,
        pageSize,
        total,
        totalPages: Math.ceil(total / pageSize)
      },
      meta: {
        from,
        to,
        zones,
        direction,
        search,
        sort,
        generatedAt: new Date().toISOString()
      }
    }

    return NextResponse.json(response)
  } catch (error) {
    console.error('Error in events API:', error)
    return NextResponse.json(
      { error: 'Failed to fetch events' },
      { status: 500 }
    )
  }
}