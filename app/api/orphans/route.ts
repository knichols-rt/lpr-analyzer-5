import { NextRequest, NextResponse } from 'next/server'

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const from = searchParams.get('from')
    const to = searchParams.get('to')
    const zones = searchParams.get('zones')?.split(',').filter(Boolean) || []
    const status = searchParams.get('status')
    const direction = searchParams.get('direction')
    const search = searchParams.get('search')
    const sort = searchParams.get('sort') || 'time'
    const page = parseInt(searchParams.get('page') || '1')
    const pageSize = parseInt(searchParams.get('pageSize') || '100')

    // Generate mock orphans data
    const mockOrphans = Array.from({ length: 500 }, (_, i) => {
      const age = Math.floor(Math.random() * 2000) + 30 // 30 minutes to ~33 hours
      const orphanStatus = age > 720 ? 'EXPIRED' : 'OPEN' // Expired after 12 hours
      
      return {
        id: `orphan-${i + 1}`,
        plate: `XYZ${String(i + 200).padStart(3, '0')}`,
        state: Math.random() > 0.8 ? 'NY' : 'CA',
        zone: `ZONE_${String.fromCharCode(65 + (i % 3))}`,
        time: new Date(Date.now() - age * 60 * 1000).toISOString(),
        direction: Math.random() > 0.5 ? 'IN' : 'OUT',
        age,
        camera: `CAM_${(i % 10) + 1}_${Math.random() > 0.5 ? 'IN' : 'OUT'}`,
        quality: Math.random() * 0.4 + 0.6,
        status: orphanStatus
      }
    })

    // Apply filters
    let filteredOrphans = mockOrphans

    if (search) {
      filteredOrphans = filteredOrphans.filter(orphan => 
        orphan.plate.toLowerCase().includes(search.toLowerCase()) ||
        orphan.state.toLowerCase().includes(search.toLowerCase()) ||
        orphan.camera.toLowerCase().includes(search.toLowerCase())
      )
    }

    if (status) {
      filteredOrphans = filteredOrphans.filter(orphan => 
        orphan.status === status
      )
    }

    if (direction) {
      filteredOrphans = filteredOrphans.filter(orphan => 
        orphan.direction === direction
      )
    }

    if (zones.length > 0) {
      filteredOrphans = filteredOrphans.filter(orphan => 
        zones.includes(orphan.zone)
      )
    }

    // Sort by time (most recent first)
    filteredOrphans.sort((a, b) => new Date(b.time).getTime() - new Date(a.time).getTime())

    // Pagination
    const total = filteredOrphans.length
    const startIndex = (page - 1) * pageSize
    const endIndex = startIndex + pageSize
    const paginatedOrphans = filteredOrphans.slice(startIndex, endIndex)

    const response = {
      data: paginatedOrphans,
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
        status,
        direction,
        search,
        sort,
        generatedAt: new Date().toISOString()
      }
    }

    return NextResponse.json(response)
  } catch (error) {
    console.error('Error in orphans API:', error)
    return NextResponse.json(
      { error: 'Failed to fetch orphans' },
      { status: 500 }
    )
  }
}