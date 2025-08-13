'use client'

import { useState, useEffect, useMemo } from 'react'
import { FixedSizeList as List } from 'react-window'
import { Download, ArrowUpDown, ExternalLink } from 'lucide-react'
import { FilterState } from './GlobalFilters'

interface Session {
  id: string
  plate: string
  entryState: string
  exitState: string
  zone: string
  entryTime: string
  exitTime: string
  duration: number
  matchType: 'EXACT' | 'STATE_MISMATCH' | 'FUZZY_ACCEPTED'
  flags: string[]
  confidence: number
  billingAmount: number
  entryCamera: string
  exitCamera: string
  uploadId: string
}

interface SessionsTableProps {
  filters: FilterState
  onPlateClick?: (plate: string) => void
}

const ITEM_HEIGHT = 48

export default function SessionsTable({ filters, onPlateClick }: SessionsTableProps) {
  const [sessions, setSessions] = useState<Session[]>([])
  const [loading, setLoading] = useState(true)
  const [sortConfig, setSortConfig] = useState<{
    key: keyof Session
    direction: 'asc' | 'desc'
  }>({ key: 'entryTime', direction: 'desc' })

  // Mock data for development
  const mockSessions: Session[] = Array.from({ length: 1000 }, (_, i) => ({
    id: `session-${i + 1}`,
    plate: `ABC${String(i + 100).padStart(3, '0')}`,
    entryState: Math.random() > 0.8 ? 'NY' : 'CA',
    exitState: Math.random() > 0.9 ? 'NY' : 'CA',
    zone: `ZONE_${String.fromCharCode(65 + (i % 3))}`,
    entryTime: new Date(Date.now() - Math.random() * 7 * 24 * 60 * 60 * 1000).toISOString(),
    exitTime: new Date(Date.now() - Math.random() * 6 * 24 * 60 * 60 * 1000).toISOString(),
    duration: Math.floor(Math.random() * 480) + 30, // 30 minutes to 8 hours
    matchType: ['EXACT', 'STATE_MISMATCH', 'FUZZY_ACCEPTED'][Math.floor(Math.random() * 3)] as any,
    flags: Math.random() > 0.8 ? ['OVERNIGHT'] : Math.random() > 0.9 ? ['MULTIDAY'] : [],
    confidence: Math.random() * 0.3 + 0.7, // 0.7 to 1.0
    billingAmount: Math.floor(Math.random() * 50) + 5,
    entryCamera: `CAM_${i % 10 + 1}_IN`,
    exitCamera: `CAM_${i % 10 + 1}_OUT`,
    uploadId: `upload-${String(i % 50).padStart(3, '0')}`
  }))

  useEffect(() => {
    const fetchSessions = async () => {
      setLoading(true)
      try {
        // In a real app, this would fetch from the API
        // const response = await fetch('/api/sessions?' + searchParams)
        // const data = await response.json()
        
        // For now, use mock data
        setSessions(mockSessions)
      } catch (error) {
        console.error('Failed to fetch sessions:', error)
        setSessions(mockSessions)
      }
      setLoading(false)
    }

    fetchSessions()
  }, [filters])

  const sortedSessions = useMemo(() => {
    if (!sortConfig) return sessions

    return [...sessions].sort((a, b) => {
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
  }, [sessions, sortConfig])

  const handleSort = (key: keyof Session) => {
    setSortConfig(current => ({
      key,
      direction: current.key === key && current.direction === 'asc' ? 'desc' : 'asc'
    }))
  }

  const formatDuration = (minutes: number) => {
    const hours = Math.floor(minutes / 60)
    const mins = minutes % 60
    if (hours > 0) {
      return `${hours}h ${mins}m`
    }
    return `${mins}m`
  }

  const getMatchTypeBadge = (type: Session['matchType']) => {
    const badges = {
      EXACT: 'badge-exact',
      STATE_MISMATCH: 'badge-state-mismatch',
      FUZZY_ACCEPTED: 'badge-fuzzy'
    }
    return badges[type]
  }

  const exportToCSV = () => {
    const headers = [
      'Plate',
      'Entry State',
      'Exit State', 
      'Zone',
      'Entry Time',
      'Exit Time',
      'Duration (minutes)',
      'Match Type',
      'Flags',
      'Confidence',
      'Billing Amount',
      'Entry Camera',
      'Exit Camera',
      'Upload ID'
    ]

    const csvContent = [
      headers.join(','),
      ...sortedSessions.map(session => [
        session.plate,
        session.entryState,
        session.exitState,
        session.zone,
        session.entryTime,
        session.exitTime,
        session.duration,
        session.matchType,
        session.flags.join(';'),
        session.confidence.toFixed(3),
        session.billingAmount,
        session.entryCamera,
        session.exitCamera,
        session.uploadId
      ].join(','))
    ].join('\n')

    const blob = new Blob([csvContent], { type: 'text/csv' })
    const url = window.URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `sessions-${new Date().toISOString().split('T')[0]}.csv`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    window.URL.revokeObjectURL(url)
  }

  const Row = ({ index, style }: { index: number; style: React.CSSProperties }) => {
    const session = sortedSessions[index]
    if (!session) return null

    const isStateMismatch = session.entryState !== session.exitState

    return (
      <div style={style} className="table-row flex items-center px-4 text-sm">
        <div className="w-24 table-cell">
          <button
            onClick={() => onPlateClick?.(session.plate)}
            className="text-primary hover:underline font-mono"
          >
            {session.plate}
          </button>
        </div>
        <div className="w-20 table-cell">
          <div className="flex items-center gap-1">
            <span>{session.entryState}</span>
            <span className="text-muted-foreground">→</span>
            <span>{session.exitState}</span>
            {isStateMismatch && (
              <span className="badge badge-state-mismatch ml-1">!</span>
            )}
          </div>
        </div>
        <div className="w-16 table-cell">{session.zone}</div>
        <div className="w-32 table-cell text-xs">
          {new Date(session.entryTime).toLocaleString()}
        </div>
        <div className="w-32 table-cell text-xs">
          {new Date(session.exitTime).toLocaleString()}
        </div>
        <div className="w-20 table-cell">{formatDuration(session.duration)}</div>
        <div className="w-24 table-cell">
          <span className={`badge ${getMatchTypeBadge(session.matchType)}`}>
            {session.matchType.replace('_', ' ')}
          </span>
        </div>
        <div className="w-20 table-cell">
          {session.flags.map(flag => (
            <span key={flag} className="badge bg-orange-900 text-orange-100 mr-1 text-xs">
              {flag}
            </span>
          ))}
        </div>
        <div className="w-16 table-cell">{(session.confidence * 100).toFixed(1)}%</div>
        <div className="w-16 table-cell">${session.billingAmount}</div>
        <div className="w-24 table-cell text-xs">{session.entryCamera}</div>
        <div className="w-24 table-cell text-xs">{session.exitCamera}</div>
        <div className="w-20 table-cell text-xs">{session.uploadId}</div>
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
    sortKey?: keyof Session
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

  if (loading) {
    return (
      <div className="table-container p-8 text-center">
        <p className="text-muted-foreground">Loading sessions...</p>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-semibold">
          Sessions ({sortedSessions.length.toLocaleString()})
        </h2>
        <button
          onClick={exportToCSV}
          className="flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground hover:bg-primary/90 rounded transition-colors"
        >
          <Download className="h-4 w-4" />
          Export CSV
        </button>
      </div>

      <div className="table-container">
        {/* Header */}
        <div className="table-header flex items-center px-4 py-3 text-sm border-b border-border">
          <HeaderCell width="w-24" sortKey="plate">Plate</HeaderCell>
          <HeaderCell width="w-20">Entry→Exit State</HeaderCell>
          <HeaderCell width="w-16" sortKey="zone">Zone</HeaderCell>
          <HeaderCell width="w-32" sortKey="entryTime">Entry Time</HeaderCell>
          <HeaderCell width="w-32" sortKey="exitTime">Exit Time</HeaderCell>
          <HeaderCell width="w-20" sortKey="duration">Duration</HeaderCell>
          <HeaderCell width="w-24" sortKey="matchType">Match Type</HeaderCell>
          <HeaderCell width="w-20">Flags</HeaderCell>
          <HeaderCell width="w-16" sortKey="confidence">Confidence</HeaderCell>
          <HeaderCell width="w-16" sortKey="billingAmount">Billing</HeaderCell>
          <HeaderCell width="w-24">Entry Camera</HeaderCell>
          <HeaderCell width="w-24">Exit Camera</HeaderCell>
          <HeaderCell width="w-20">Upload ID</HeaderCell>
        </div>

        {/* Virtualized List */}
        <List
          height={600}
          width="100%"
          itemCount={sortedSessions.length}
          itemSize={ITEM_HEIGHT}
          itemData={sortedSessions}
        >
          {Row}
        </List>
      </div>
    </div>
  )
}