import { NextRequest, NextResponse } from 'next/server'

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const from = searchParams.get('from')
    const to = searchParams.get('to')
    const zones = searchParams.get('zones')?.split(',').filter(Boolean) || []

    // In a real implementation, this would query the database
    // For now, return mock data that matches the interface
    const mockData = {
      totalEvents: 15420,
      totalSessions: 7832,
      sessionTypes: {
        exact: 6890,
        stateMismatch: 412,
        overnight: 234,
        multiday: 156,
        fuzzyAccepted: 140
      },
      orphans: {
        openIn: 89,
        openOut: 76,
        expired: 23
      },
      meta: {
        from,
        to,
        zones,
        generatedAt: new Date().toISOString()
      }
    }

    return NextResponse.json(mockData)
  } catch (error) {
    console.error('Error in metrics summary API:', error)
    return NextResponse.json(
      { error: 'Failed to fetch metrics summary' },
      { status: 500 }
    )
  }
}