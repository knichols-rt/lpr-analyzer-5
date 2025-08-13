import { NextRequest, NextResponse } from 'next/server'

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

    // Generate mock events data
    const mockEvents = Array.from({ length: 2000 }, (_, i) => ({
      id: `event-${i + 1}`,
      plate: `ABC${String(i + 100).padStart(3, '0')}`,
      state: Math.random() > 0.8 ? 'NY' : 'CA',
      zone: `ZONE_${String.fromCharCode(65 + (i % 3))}`,
      time: new Date(Date.now() - Math.random() * 7 * 24 * 60 * 60 * 1000).toISOString(),
      direction: Math.random() > 0.5 ? 'IN' : 'OUT',
      camera: `CAM_${(i % 10) + 1}_${Math.random() > 0.5 ? 'IN' : 'OUT'}`,
      quality: Math.random() * 0.4 + 0.6,
      uploadId: `upload-${String(i % 100).padStart(3, '0')}`
    }))

    // Apply filters
    let filteredEvents = mockEvents

    if (search) {
      filteredEvents = filteredEvents.filter(event => 
        event.plate.toLowerCase().includes(search.toLowerCase()) ||
        event.state.toLowerCase().includes(search.toLowerCase()) ||
        event.camera.toLowerCase().includes(search.toLowerCase())
      )
    }

    if (direction) {
      filteredEvents = filteredEvents.filter(event => 
        event.direction === direction
      )
    }

    if (zones.length > 0) {
      filteredEvents = filteredEvents.filter(event => 
        zones.includes(event.zone)
      )
    }

    // Sort by time (most recent first)
    filteredEvents.sort((a, b) => new Date(b.time).getTime() - new Date(a.time).getTime())

    // Pagination
    const total = filteredEvents.length
    const startIndex = (page - 1) * pageSize
    const endIndex = startIndex + pageSize
    const paginatedEvents = filteredEvents.slice(startIndex, endIndex)

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