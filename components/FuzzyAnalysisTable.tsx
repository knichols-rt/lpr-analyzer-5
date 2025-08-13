'use client'

import { useState, useEffect, useMemo } from 'react'
import { FixedSizeList as List } from 'react-window'
import { Download, ArrowUpDown, ArrowRight, Info } from 'lucide-react'
import { FilterState } from './GlobalFilters'

interface FuzzyCandidate {
  id: string
  entryPlate: string
  exitPlate: string
  score: number
  reason: string
  timeDelta: number // in minutes
  autoUnique: boolean
  zone: string
  entryTime: string
  exitTime: string
}

interface FuzzyAnalysisTableProps {
  filters: FilterState
  onPlateClick?: (plate: string) => void
}

const ITEM_HEIGHT = 60 // Slightly taller for better readability

export default function FuzzyAnalysisTable({ filters, onPlateClick }: FuzzyAnalysisTableProps) {
  const [candidates, setCandidates] = useState<FuzzyCandidate[]>([])
  const [loading, setLoading] = useState(true)
  const [sortConfig, setSortConfig] = useState<{
    key: keyof FuzzyCandidate
    direction: 'asc' | 'desc'
  }>({ key: 'score', direction: 'desc' })

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

  // Mock data for development
  const mockCandidates: FuzzyCandidate[] = Array.from({ length: 200 }, (_, i) => {
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

  useEffect(() => {
    const fetchCandidates = async () => {
      setLoading(true)
      try {
        // In a real app, this would fetch from the API
        // const response = await fetch('/api/fuzzy-candidates?' + searchParams)
        // const data = await response.json()
        
        // For now, use mock data
        setCandidates(mockCandidates)
      } catch (error) {
        console.error('Failed to fetch fuzzy candidates:', error)
        setCandidates(mockCandidates)
      }
      setLoading(false)
    }

    fetchCandidates()
  }, [filters])

  const sortedCandidates = useMemo(() => {
    if (!sortConfig) return candidates

    return [...candidates].sort((a, b) => {
      const aValue = a[sortConfig.key]
      const bValue = b[sortConfig.key]

      if (aValue < bValue) {
        return sortConfig.direction === 'asc' ? -1 : 1
      }
      if (aValue > bValue) {
        return sortConfig.direction === 'asc' ? 1 : -1
      }
      return 0
    })
  }, [candidates, sortConfig])

  const handleSort = (key: keyof FuzzyCandidate) => {
    setSortConfig(current => ({
      key,
      direction: current.key === key && current.direction === 'asc' ? 'desc' : 'asc'
    }))
  }

  const getScoreBadge = (score: number) => {
    if (score >= 0.95) return 'bg-green-900 text-green-100'
    if (score >= 0.85) return 'bg-yellow-900 text-yellow-100'
    return 'bg-red-900 text-red-100'
  }

  const formatTimeDelta = (minutes: number) => {
    const hours = Math.floor(minutes / 60)
    const mins = minutes % 60
    if (hours > 0) {
      return `${hours}h ${mins}m`
    }
    return `${mins}m`
  }

  const exportToCSV = () => {
    const headers = [
      'Entry Plate',
      'Exit Plate',
      'Score',
      'Reason',
      'Time Delta (minutes)',
      'Auto Unique',
      'Zone',
      'Entry Time',
      'Exit Time'
    ]

    const csvContent = [
      headers.join(','),
      ...sortedCandidates.map(candidate => [
        candidate.entryPlate,
        candidate.exitPlate,
        candidate.score.toFixed(4),
        `"${candidate.reason}"`,
        candidate.timeDelta,
        candidate.autoUnique,
        candidate.zone,
        candidate.entryTime,
        candidate.exitTime
      ].join(','))
    ].join('\n')

    const blob = new Blob([csvContent], { type: 'text/csv' })
    const url = window.URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `fuzzy-analysis-${new Date().toISOString().split('T')[0]}.csv`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    window.URL.revokeObjectURL(url)
  }

  const Row = ({ index, style }: { index: number; style: React.CSSProperties }) => {
    const candidate = sortedCandidates[index]
    if (!candidate) return null

    const platesMatch = candidate.entryPlate === candidate.exitPlate

    return (
      <div style={style} className="table-row flex items-center px-4 text-sm py-2">
        <div className="w-40 table-cell">
          <div className="flex items-center gap-2">
            <button
              onClick={() => onPlateClick?.(candidate.entryPlate)}
              className="text-primary hover:underline font-mono"
            >
              {candidate.entryPlate}
            </button>
            <ArrowRight className="h-3 w-3 text-muted-foreground" />
            <button
              onClick={() => onPlateClick?.(candidate.exitPlate)}
              className={`hover:underline font-mono ${
                platesMatch ? 'text-green-400' : 'text-yellow-400'
              }`}
            >
              {candidate.exitPlate}
            </button>
          </div>
        </div>
        <div className="w-20 table-cell">
          <span className={`badge ${getScoreBadge(candidate.score)}`}>
            {(candidate.score * 100).toFixed(1)}%
          </span>
        </div>
        <div className="w-48 table-cell text-xs">
          <span className="text-muted-foreground" title={candidate.reason}>
            {candidate.reason}
          </span>
        </div>
        <div className="w-20 table-cell">{formatTimeDelta(candidate.timeDelta)}</div>
        <div className="w-20 table-cell">
          {candidate.autoUnique ? (
            <span className="badge bg-blue-900 text-blue-100">AUTO</span>
          ) : (
            <span className="badge bg-gray-900 text-gray-100">MANUAL</span>
          )}
        </div>
        <div className="w-20 table-cell">{candidate.zone}</div>
        <div className="w-32 table-cell text-xs">
          {new Date(candidate.entryTime).toLocaleString()}
        </div>
        <div className="w-32 table-cell text-xs">
          {new Date(candidate.exitTime).toLocaleString()}
        </div>
      </div>
    )
  }

  const HeaderCell = ({ 
    children, 
    sortKey, 
    width, 
    className = '' 
  }: { 
    children: React.ReactNode
    sortKey?: keyof FuzzyCandidate
    width: string
    className?: string
  }) => (
    <div className={`${width} table-cell font-medium ${className}`}>
      {sortKey ? (
        <button
          onClick={() => handleSort(sortKey)}
          className="flex items-center gap-1 hover:text-primary transition-colors"
        >
          {children}
          <ArrowUpDown className="h-3 w-3" />
        </button>
      ) : (
        children
      )}
    </div>
  )

  const autoCount = sortedCandidates.filter(c => c.autoUnique).length
  const manualCount = sortedCandidates.filter(c => !c.autoUnique).length

  if (loading) {
    return (
      <div className="table-container p-8 text-center">
        <p className="text-muted-foreground">Loading fuzzy analysis...</p>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-semibold">
          Fuzzy Analysis ({sortedCandidates.length.toLocaleString()})
          <span className="text-sm text-muted-foreground ml-2">
            {autoCount} auto, {manualCount} manual
          </span>
        </h2>
        <button
          onClick={exportToCSV}
          className="flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground hover:bg-primary/90 rounded transition-colors"
        >
          <Download className="h-4 w-4" />
          Export CSV
        </button>
      </div>

      <div className="bg-yellow-900/20 border border-yellow-900/50 rounded-lg p-3 flex items-start gap-2">
        <Info className="h-4 w-4 text-yellow-400 mt-0.5 flex-shrink-0" />
        <div className="text-sm">
          <p className="text-yellow-400 font-medium">Read-Only Table</p>
          <p className="text-yellow-300">
            This table shows fuzzy matching candidates for analysis purposes only. 
            No approval workflow is available in this mode.
          </p>
        </div>
      </div>

      <div className="table-container">
        {/* Header */}
        <div className="table-header flex items-center px-4 py-3 text-sm border-b border-border">
          <HeaderCell width="w-40">Entry Plate ↔ Exit Plate</HeaderCell>
          <HeaderCell width="w-20" sortKey="score">Score</HeaderCell>
          <HeaderCell width="w-48">Reason (OCR hints)</HeaderCell>
          <HeaderCell width="w-20" sortKey="timeDelta">Time Δ</HeaderCell>
          <HeaderCell width="w-20" sortKey="autoUnique">Auto Unique</HeaderCell>
          <HeaderCell width="w-20" sortKey="zone">Zone</HeaderCell>
          <HeaderCell width="w-32" sortKey="entryTime">Entry Time</HeaderCell>
          <HeaderCell width="w-32" sortKey="exitTime">Exit Time</HeaderCell>
        </div>

        {/* Virtualized List */}
        <List
          height={600}
          width="100%"
          itemCount={sortedCandidates.length}
          itemSize={ITEM_HEIGHT}
          itemData={sortedCandidates}
        >
          {Row}
        </List>
      </div>

      {/* Info Panel */}
      <div className="bg-card border border-border rounded-lg p-4 text-sm">
        <h4 className="font-medium mb-2">Fuzzy Matching Analysis</h4>
        <div className="space-y-1 text-muted-foreground">
          <p>• <strong>Score:</strong> Confidence level of the fuzzy match (higher is better)</p>
          <p>• <strong>Reason:</strong> OCR confusion patterns or other factors causing the mismatch</p>
          <p>• <strong>Time Δ:</strong> Time difference between entry and exit events</p>
          <p>• <strong>Auto Unique:</strong> Matches with high confidence scores that were automatically accepted</p>
          <p>• Common OCR confusions: O↔0, I↔1, S↔5, B↔8, D↔0, G↔6</p>
        </div>
      </div>
    </div>
  )
}