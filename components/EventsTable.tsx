'use client'

import { useState, useEffect, useMemo } from 'react'
import { FixedSizeList as List } from 'react-window'
import { Download, ArrowUpDown, ArrowDown, ArrowUp } from 'lucide-react'
import { FilterState } from './GlobalFilters'

interface Event {
  id: string
  plate: string
  state: string
  zone: string
  time: string
  direction: 'IN' | 'OUT'
  camera: string
  quality: number
  uploadId: string
}

interface EventsTableProps {
  filters: FilterState
  onPlateClick?: (plate: string) => void
}

const ITEM_HEIGHT = 48

export default function EventsTable({ filters, onPlateClick }: EventsTableProps) {
  const [events, setEvents] = useState<Event[]>([])
  const [loading, setLoading] = useState(true)
  const [sortConfig, setSortConfig] = useState<{
    key: keyof Event
    direction: 'asc' | 'desc'
  }>({ key: 'time', direction: 'desc' })

  // Mock data for development
  const mockEvents: Event[] = Array.from({ length: 2000 }, (_, i) => ({
    id: `event-${i + 1}`,
    plate: `ABC${String(i + 100).padStart(3, '0')}`,
    state: Math.random() > 0.8 ? 'NY' : 'CA',
    zone: `ZONE_${String.fromCharCode(65 + (i % 3))}`,
    time: new Date(Date.now() - Math.random() * 7 * 24 * 60 * 60 * 1000).toISOString(),
    direction: Math.random() > 0.5 ? 'IN' : 'OUT',
    camera: `CAM_${(i % 10) + 1}_${Math.random() > 0.5 ? 'IN' : 'OUT'}`,
    quality: Math.random() * 0.4 + 0.6, // 0.6 to 1.0
    uploadId: `upload-${String(i % 100).padStart(3, '0')}`
  }))

  useEffect(() => {
    const fetchEvents = async () => {
      setLoading(true)
      try {
        // In a real app, this would fetch from the API
        // const response = await fetch('/api/events?' + searchParams)
        // const data = await response.json()
        
        // For now, use mock data
        setEvents(mockEvents)
      } catch (error) {
        console.error('Failed to fetch events:', error)
        setEvents(mockEvents)
      }
      setLoading(false)
    }

    fetchEvents()
  }, [filters])

  const sortedEvents = useMemo(() => {
    if (!sortConfig) return events

    return [...events].sort((a, b) => {
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
  }, [events, sortConfig])

  const handleSort = (key: keyof Event) => {
    setSortConfig(current => ({
      key,
      direction: current.key === key && current.direction === 'asc' ? 'desc' : 'asc'
    }))
  }

  const getDirectionIcon = (direction: 'IN' | 'OUT') => {
    if (direction === 'IN') {
      return <ArrowDown className="h-3 w-3 text-green-400" />
    }
    return <ArrowUp className="h-3 w-3 text-red-400" />
  }

  const getQualityBadge = (quality: number) => {
    if (quality >= 0.9) return 'bg-green-900 text-green-100'
    if (quality >= 0.7) return 'bg-yellow-900 text-yellow-100'
    return 'bg-red-900 text-red-100'
  }

  const exportToCSV = () => {
    const headers = [
      'Plate',
      'State',
      'Zone',
      'Time',
      'Direction',
      'Camera',
      'Quality',
      'Upload ID'
    ]

    const csvContent = [
      headers.join(','),
      ...sortedEvents.map(event => [
        event.plate,
        event.state,
        event.zone,
        event.time,
        event.direction,
        event.camera,
        event.quality.toFixed(3),
        event.uploadId
      ].join(','))
    ].join('\n')

    const blob = new Blob([csvContent], { type: 'text/csv' })
    const url = window.URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `events-${new Date().toISOString().split('T')[0]}.csv`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    window.URL.revokeObjectURL(url)
  }

  const Row = ({ index, style }: { index: number; style: React.CSSProperties }) => {
    const event = sortedEvents[index]
    if (!event) return null

    return (
      <div style={style} className="table-row flex items-center px-4 text-sm">
        <div className="w-32 table-cell">
          <button
            onClick={() => onPlateClick?.(event.plate)}
            className="text-primary hover:underline font-mono"
          >
            {event.plate}
          </button>
        </div>
        <div className="w-16 table-cell">{event.state}</div>
        <div className="w-20 table-cell">{event.zone}</div>
        <div className="w-40 table-cell text-xs">
          {new Date(event.time).toLocaleString()}
        </div>
        <div className="w-20 table-cell">
          <div className="flex items-center gap-2">
            {getDirectionIcon(event.direction)}
            <span className={event.direction === 'IN' ? 'text-green-400' : 'text-red-400'}>
              {event.direction}
            </span>
          </div>
        </div>
        <div className="w-32 table-cell text-xs">{event.camera}</div>
        <div className="w-20 table-cell">
          <span className={`badge ${getQualityBadge(event.quality)}`}>
            {(event.quality * 100).toFixed(1)}%
          </span>
        </div>
        <div className="w-24 table-cell text-xs">{event.uploadId}</div>
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
    sortKey?: keyof Event
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
        <p className="text-muted-foreground">Loading events...</p>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-semibold">
          Events ({sortedEvents.length.toLocaleString()})
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
          <HeaderCell width="w-32" sortKey="plate">Plate/State</HeaderCell>
          <HeaderCell width="w-16" sortKey="state">State</HeaderCell>
          <HeaderCell width="w-20" sortKey="zone">Zone</HeaderCell>
          <HeaderCell width="w-40" sortKey="time">Time</HeaderCell>
          <HeaderCell width="w-20" sortKey="direction">Direction</HeaderCell>
          <HeaderCell width="w-32" sortKey="camera">Camera</HeaderCell>
          <HeaderCell width="w-20" sortKey="quality">Quality</HeaderCell>
          <HeaderCell width="w-24">Upload ID</HeaderCell>
        </div>

        {/* Virtualized List */}
        <List
          height={600}
          width="100%"
          itemCount={sortedEvents.length}
          itemSize={ITEM_HEIGHT}
          itemData={sortedEvents}
        >
          {Row}
        </List>
      </div>

      {/* Legend */}
      <div className="bg-card border border-border rounded-lg p-4 text-sm">
        <h4 className="font-medium mb-2">Legend</h4>
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-1">
            <ArrowDown className="h-3 w-3 text-green-400" />
            <span className="text-green-400">IN</span>
            <span className="text-muted-foreground">- Vehicle entering</span>
          </div>
          <div className="flex items-center gap-1">
            <ArrowUp className="h-3 w-3 text-red-400" />
            <span className="text-red-400">OUT</span>
            <span className="text-muted-foreground">- Vehicle exiting</span>
          </div>
        </div>
      </div>
    </div>
  )
}