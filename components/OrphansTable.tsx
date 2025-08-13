'use client'

import { useState, useEffect, useMemo } from 'react'
import { FixedSizeList as List } from 'react-window'
import { Download, ArrowUpDown, ArrowDown, ArrowUp, Clock } from 'lucide-react'
import { FilterState } from './GlobalFilters'

interface Orphan {
  id: string
  plate: string
  state: string
  zone: string
  time: string
  direction: 'IN' | 'OUT'
  age: number // in minutes
  camera: string
  quality: number
  status: 'OPEN' | 'EXPIRED'
}

interface OrphansTableProps {
  filters: FilterState
  onPlateClick?: (plate: string) => void
}

const ITEM_HEIGHT = 48

export default function OrphansTable({ filters, onPlateClick }: OrphansTableProps) {
  const [orphans, setOrphans] = useState<Orphan[]>([])
  const [loading, setLoading] = useState(true)
  const [sortConfig, setSortConfig] = useState<{
    key: keyof Orphan
    direction: 'asc' | 'desc'
  }>({ key: 'time', direction: 'desc' })

  // Mock data for development
  const mockOrphans: Orphan[] = Array.from({ length: 500 }, (_, i) => {
    const age = Math.floor(Math.random() * 2000) + 30 // 30 minutes to ~33 hours
    const status = age > 720 ? 'EXPIRED' : 'OPEN' // Expired after 12 hours
    
    return {
      id: `orphan-${i + 1}`,
      plate: `XYZ${String(i + 200).padStart(3, '0')}`,
      state: Math.random() > 0.8 ? 'NY' : 'CA',
      zone: `ZONE_${String.fromCharCode(65 + (i % 3))}`,
      time: new Date(Date.now() - age * 60 * 1000).toISOString(),
      direction: Math.random() > 0.5 ? 'IN' : 'OUT',
      age,
      camera: `CAM_${(i % 10) + 1}_${Math.random() > 0.5 ? 'IN' : 'OUT'}`,
      quality: Math.random() * 0.4 + 0.6, // 0.6 to 1.0
      status
    }
  })

  useEffect(() => {
    const fetchOrphans = async () => {
      setLoading(true)
      try {
        // In a real app, this would fetch from the API
        // const response = await fetch('/api/orphans?' + searchParams)
        // const data = await response.json()
        
        // For now, use mock data
        setOrphans(mockOrphans)
      } catch (error) {
        console.error('Failed to fetch orphans:', error)
        setOrphans(mockOrphans)
      }
      setLoading(false)
    }

    fetchOrphans()
  }, [filters])

  const filteredOrphans = useMemo(() => {
    return orphans.filter(orphan => {
      if (!filters.includeExpiredOrphans && orphan.status === 'EXPIRED') {
        return false
      }
      return true
    })
  }, [orphans, filters.includeExpiredOrphans])

  const sortedOrphans = useMemo(() => {
    if (!sortConfig) return filteredOrphans

    return [...filteredOrphans].sort((a, b) => {
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
  }, [filteredOrphans, sortConfig])

  const handleSort = (key: keyof Orphan) => {
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

  const getStatusBadge = (status: 'OPEN' | 'EXPIRED') => {
    return status === 'OPEN' ? 'badge-open' : 'badge-expired'
  }

  const formatAge = (minutes: number) => {
    const hours = Math.floor(minutes / 60)
    const mins = minutes % 60
    const days = Math.floor(hours / 24)
    
    if (days > 0) {
      return `${days}d ${hours % 24}h`
    } else if (hours > 0) {
      return `${hours}h ${mins}m`
    }
    return `${mins}m`
  }

  const exportToCSV = () => {
    const headers = [
      'Plate',
      'State',
      'Zone',
      'Time',
      'Direction',
      'Age (minutes)',
      'Camera',
      'Quality',
      'Status'
    ]

    const csvContent = [
      headers.join(','),
      ...sortedOrphans.map(orphan => [
        orphan.plate,
        orphan.state,
        orphan.zone,
        orphan.time,
        orphan.direction,
        orphan.age,
        orphan.camera,
        orphan.quality.toFixed(3),
        orphan.status
      ].join(','))
    ].join('\n')

    const blob = new Blob([csvContent], { type: 'text/csv' })
    const url = window.URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `orphans-${new Date().toISOString().split('T')[0]}.csv`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    window.URL.revokeObjectURL(url)
  }

  const Row = ({ index, style }: { index: number; style: React.CSSProperties }) => {
    const orphan = sortedOrphans[index]
    if (!orphan) return null

    return (
      <div style={style} className="table-row flex items-center px-4 text-sm">
        <div className="w-32 table-cell">
          <button
            onClick={() => onPlateClick?.(orphan.plate)}
            className="text-primary hover:underline font-mono"
          >
            {orphan.plate}
          </button>
        </div>
        <div className="w-16 table-cell">{orphan.state}</div>
        <div className="w-20 table-cell">{orphan.zone}</div>
        <div className="w-40 table-cell text-xs">
          {new Date(orphan.time).toLocaleString()}
        </div>
        <div className="w-20 table-cell">
          <div className="flex items-center gap-2">
            {getDirectionIcon(orphan.direction)}
            <span className={orphan.direction === 'IN' ? 'text-green-400' : 'text-red-400'}>
              {orphan.direction}
            </span>
          </div>
        </div>
        <div className="w-24 table-cell">
          <div className="flex items-center gap-1">
            <Clock className="h-3 w-3 text-muted-foreground" />
            <span className={orphan.status === 'EXPIRED' ? 'text-red-400' : 'text-yellow-400'}>
              {formatAge(orphan.age)}
            </span>
          </div>
        </div>
        <div className="w-32 table-cell text-xs">{orphan.camera}</div>
        <div className="w-20 table-cell">
          <span className={`badge ${getQualityBadge(orphan.quality)}`}>
            {(orphan.quality * 100).toFixed(1)}%
          </span>
        </div>
        <div className="w-20 table-cell">
          <span className={`badge ${getStatusBadge(orphan.status)}`}>
            {orphan.status}
          </span>
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
    sortKey?: keyof Orphan
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

  const openCount = sortedOrphans.filter(o => o.status === 'OPEN').length
  const expiredCount = sortedOrphans.filter(o => o.status === 'EXPIRED').length

  if (loading) {
    return (
      <div className="table-container p-8 text-center">
        <p className="text-muted-foreground">Loading orphans...</p>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-semibold">
          Orphans ({sortedOrphans.length.toLocaleString()}) 
          <span className="text-sm text-muted-foreground ml-2">
            {openCount} open, {expiredCount} expired
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

      <div className="table-container">
        {/* Header */}
        <div className="table-header flex items-center px-4 py-3 text-sm border-b border-border">
          <HeaderCell width="w-32" sortKey="plate">Plate/State</HeaderCell>
          <HeaderCell width="w-16" sortKey="state">State</HeaderCell>
          <HeaderCell width="w-20" sortKey="zone">Zone</HeaderCell>
          <HeaderCell width="w-40" sortKey="time">Time</HeaderCell>
          <HeaderCell width="w-20" sortKey="direction">Direction</HeaderCell>
          <HeaderCell width="w-24" sortKey="age">Age</HeaderCell>
          <HeaderCell width="w-32" sortKey="camera">Camera</HeaderCell>
          <HeaderCell width="w-20" sortKey="quality">Quality</HeaderCell>
          <HeaderCell width="w-20" sortKey="status">Status</HeaderCell>
        </div>

        {/* Virtualized List */}
        <List
          height={600}
          width="100%"
          itemCount={sortedOrphans.length}
          itemSize={ITEM_HEIGHT}
          itemData={sortedOrphans}
        >
          {Row}
        </List>
      </div>

      {/* Info Panel */}
      <div className="bg-card border border-border rounded-lg p-4 text-sm">
        <h4 className="font-medium mb-2">Orphan Events</h4>
        <div className="space-y-1 text-muted-foreground">
          <p>• <strong>Orphans</strong> are events that haven't been matched into complete sessions</p>
          <p>• <strong>Open IN:</strong> Entry events without corresponding exit events</p>
          <p>• <strong>Open OUT:</strong> Exit events without corresponding entry events</p>
          <p>• <strong>Expired:</strong> Orphans that have exceeded the maximum stay duration for their zone</p>
          <p>• <strong>Age:</strong> Time elapsed since the orphan event was recorded</p>
        </div>
      </div>
    </div>
  )
}