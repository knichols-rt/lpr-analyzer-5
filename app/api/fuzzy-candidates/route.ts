import { NextRequest, NextResponse } from 'next/server'

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const from = searchParams.get('from')
    const to = searchParams.get('to')
    const zones = searchParams.get('zones')?.split(',').filter(Boolean) || []
    const minScore = parseFloat(searchParams.get('minScore') || '0.8')

    // OCR confusion patterns for realistic mock data
    const ocrConfusions = [
      { from: 'O', to: '0' }, { from: '0', to: 'O' },
      { from: 'I', to: '1' }, { from: '1', to: 'I' },
      { from: 'S', to: '5' }, { from: '5', to: 'S' },
      { from: 'B', to: '8' }, { from: '8', to: 'B' },
      { from: 'D', to: '0' }, { from: '0', to: 'D' },
      { from: 'G', to: '6' }, { from: '6', to: 'G' }
    ]

    const generateFuzzyPlate = (original: string) => {
      const chars = original.split('')
      const confusionIndex = Math.floor(Math.random() * chars.length)
      const confusion = ocrConfusions[Math.floor(Math.random() * ocrConfusions.length)]
      
      if (chars[confusionIndex] === confusion.from) {
        chars[confusionIndex] = confusion.to
      }
      
      return chars.join('')
    }

    // Generate mock fuzzy candidates data
    const mockCandidates = Array.from({ length: 200 }, (_, i) => {
      const entryPlate = `ABC${String(i + 500).padStart(3, '0')}`
      const exitPlate = Math.random() > 0.3 ? generateFuzzyPlate(entryPlate) : entryPlate
      const timeDelta = Math.floor(Math.random() * 300) + 15 // 15 minutes to 5 hours
      const score = Math.random() * 0.2 + 0.8 // 0.8 to 1.0
      
      const reasons = [
        `${entryPlate[2]} → ${exitPlate[2]} (O/0 confusion)`,
        `${entryPlate[1]} → ${exitPlate[1]} (I/1 confusion)`,
        `${entryPlate[4]} → ${exitPlate[4]} (S/5 confusion)`,
        'Character spacing variation',
        'Image quality difference',
        'Lighting angle change'
      ]

      return {
        id: `fuzzy-${i + 1}`,
        entryPlate,
        exitPlate,
        score,
        reason: reasons[Math.floor(Math.random() * reasons.length)],
        timeDelta,
        autoUnique: score > 0.95,
        zone: `ZONE_${String.fromCharCode(65 + (i % 3))}`,
        entryTime: new Date(Date.now() - timeDelta * 60 * 1000 - Math.random() * 24 * 60 * 60 * 1000).toISOString(),
        exitTime: new Date(Date.now() - Math.random() * 24 * 60 * 60 * 1000).toISOString()
      }
    })

    // Apply filters
    let filteredCandidates = mockCandidates

    // Filter by minimum score
    filteredCandidates = filteredCandidates.filter(candidate => 
      candidate.score >= minScore
    )

    if (zones.length > 0) {
      filteredCandidates = filteredCandidates.filter(candidate => 
        zones.includes(candidate.zone)
      )
    }

    // Sort by score (highest first)
    filteredCandidates.sort((a, b) => b.score - a.score)

    const response = {
      data: filteredCandidates,
      meta: {
        from,
        to,
        zones,
        minScore,
        total: filteredCandidates.length,
        generatedAt: new Date().toISOString()
      }
    }

    return NextResponse.json(response)
  } catch (error) {
    console.error('Error in fuzzy candidates API:', error)
    return NextResponse.json(
      { error: 'Failed to fetch fuzzy candidates' },
      { status: 500 }
    )
  }
}