import { NextRequest, NextResponse } from 'next/server'

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const from = searchParams.get('from')
    const to = searchParams.get('to')
    const zones = searchParams.get('zones')?.split(',').filter(Boolean) || []
    const type = searchParams.get('type')
    const flags = searchParams.get('flags')?.split(',').filter(Boolean) || []
    const search = searchParams.get('search')
    const sort = searchParams.get('sort') || 'entryTime'
    const page = parseInt(searchParams.get('page') || '1')
    const pageSize = parseInt(searchParams.get('pageSize') || '100')

    // Generate mock sessions data
    const mockSessions = Array.from({ length: 1000 }, (_, i) => ({
      id: `session-${i + 1}`,
      plate: `ABC${String(i + 100).padStart(3, '0')}`,
      entryState: Math.random() > 0.8 ? 'NY' : 'CA',
      exitState: Math.random() > 0.9 ? 'NY' : 'CA',
      zone: `ZONE_${String.fromCharCode(65 + (i % 3))}`,
      entryTime: new Date(Date.now() - Math.random() * 7 * 24 * 60 * 60 * 1000).toISOString(),
      exitTime: new Date(Date.now() - Math.random() * 6 * 24 * 60 * 60 * 1000).toISOString(),
      duration: Math.floor(Math.random() * 480) + 30,
      matchType: ['EXACT', 'STATE_MISMATCH', 'FUZZY_ACCEPTED'][Math.floor(Math.random() * 3)],
      flags: Math.random() > 0.8 ? ['OVERNIGHT'] : Math.random() > 0.9 ? ['MULTIDAY'] : [],
      confidence: Math.random() * 0.3 + 0.7,
      billingAmount: Math.floor(Math.random() * 50) + 5,
      entryCamera: `CAM_${i % 10 + 1}_IN`,
      exitCamera: `CAM_${i % 10 + 1}_OUT`,
      uploadId: `upload-${String(i % 50).padStart(3, '0')}`
    }))

    // Apply filters
    let filteredSessions = mockSessions

    if (search) {
      filteredSessions = filteredSessions.filter(session => 
        session.plate.toLowerCase().includes(search.toLowerCase())
      )
    }

    if (type) {
      filteredSessions = filteredSessions.filter(session => 
        session.matchType === type
      )
    }

    if (zones.length > 0) {
      filteredSessions = filteredSessions.filter(session => 
        zones.includes(session.zone)
      )
    }

    // Pagination
    const total = filteredSessions.length
    const startIndex = (page - 1) * pageSize
    const endIndex = startIndex + pageSize
    const paginatedSessions = filteredSessions.slice(startIndex, endIndex)

    const response = {
      data: paginatedSessions,
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
        type,
        flags,
        search,
        sort,
        generatedAt: new Date().toISOString()
      }
    }

    return NextResponse.json(response)
  } catch (error) {
    console.error('Error in sessions API:', error)
    return NextResponse.json(
      { error: 'Failed to fetch sessions' },
      { status: 500 }
    )
  }
}