import { NextRequest, NextResponse } from 'next/server'

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const from = searchParams.get('from')
    const to = searchParams.get('to')
    const zones = searchParams.get('zones')?.split(',').filter(Boolean) || []
    const grain = searchParams.get('grain') || 'day'

    // Generate mock timeseries data
    const mockData = {
      grain,
      series: [
        {
          zone: 'ZONE_A',
          data: Array.from({ length: 7 }, (_, i) => ({
            timestamp: new Date(Date.now() - i * 24 * 60 * 60 * 1000).toISOString(),
            events: Math.floor(Math.random() * 500) + 100,
            sessions: Math.floor(Math.random() * 250) + 50
          })).reverse()
        },
        {
          zone: 'ZONE_B', 
          data: Array.from({ length: 7 }, (_, i) => ({
            timestamp: new Date(Date.now() - i * 24 * 60 * 60 * 1000).toISOString(),
            events: Math.floor(Math.random() * 400) + 80,
            sessions: Math.floor(Math.random() * 200) + 40
          })).reverse()
        }
      ],
      meta: {
        from,
        to,
        zones,
        grain,
        generatedAt: new Date().toISOString()
      }
    }

    return NextResponse.json(mockData)
  } catch (error) {
    console.error('Error in metrics timeseries API:', error)
    return NextResponse.json(
      { error: 'Failed to fetch timeseries data' },
      { status: 500 }
    )
  }
}