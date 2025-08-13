'use client'

import { useState, useEffect } from 'react'
import KPICard from '@/components/KPICard'
import GlobalFilters, { FilterState } from '@/components/GlobalFilters'
import SessionsTable from '@/components/SessionsTable'
import EventsTable from '@/components/EventsTable'
import OrphansTable from '@/components/OrphansTable'
import FuzzyAnalysisTable from '@/components/FuzzyAnalysisTable'
import PlateHistory from '@/components/PlateHistory'

interface MetricsSummary {
  totalEvents: number
  totalSessions: number
  sessionTypes: {
    exact: number
    stateMismatch: number
    overnight: number
    multiday: number
    fuzzyAccepted: number
  }
  orphans: {
    openIn: number
    openOut: number
    expired: number
  }
}

export default function Dashboard() {
  const [activeView, setActiveView] = useState<'dashboard' | 'sessions' | 'events' | 'orphans' | 'fuzzy'>('dashboard')
  const [selectedPlate, setSelectedPlate] = useState<string | null>(null)
  const [filters, setFilters] = useState<FilterState>({
    dateRange: {
      from: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
      to: new Date().toISOString().split('T')[0]
    },
    zones: [],
    timeGranularity: 'day',
    includeFuzzy: true,
    includeExpiredOrphans: false,
    search: {
      plate: '',
      state: '',
      camera: ''
    }
  })

  const [metrics, setMetrics] = useState<MetricsSummary>({
    totalEvents: 0,
    totalSessions: 0,
    sessionTypes: {
      exact: 0,
      stateMismatch: 0,
      overnight: 0,
      multiday: 0,
      fuzzyAccepted: 0
    },
    orphans: {
      openIn: 0,
      openOut: 0,
      expired: 0
    }
  })

  const [loading, setLoading] = useState(true)

  // Fetch metrics based on current filters
  useEffect(() => {
    const fetchMetrics = async () => {
      setLoading(true)
      try {
        const params = new URLSearchParams({
          from: filters.dateRange.from,
          to: filters.dateRange.to,
          ...(filters.zones.length > 0 && { zones: filters.zones.join(',') })
        })

        const response = await fetch(`/api/metrics/summary?${params}`)
        if (response.ok) {
          const data = await response.json()
          setMetrics(data)
        } else {
          console.error('Failed to fetch metrics data')
          // Initialize with zeros if API fails
          setMetrics({
            totalEvents: 0,
            totalSessions: 0,
            sessionTypes: {
              exact: 0,
              stateMismatch: 0,
              overnight: 0,
              multiday: 0,
              fuzzyAccepted: 0
            },
            orphans: {
              openIn: 0,
              openOut: 0,
              expired: 0
            }
          })
        }
      } catch (error) {
        console.error('Failed to fetch metrics:', error)
        // Initialize with zeros if error occurs
        setMetrics({
          totalEvents: 0,
          totalSessions: 0,
          sessionTypes: {
            exact: 0,
            stateMismatch: 0,
            overnight: 0,
            multiday: 0,
            fuzzyAccepted: 0
          },
          orphans: {
            openIn: 0,
            openOut: 0,
            expired: 0
          }
        })
      }
      setLoading(false)
    }

    fetchMetrics()
  }, [filters])

  const handleExport = () => {
    // TODO: Implement export functionality
    console.log('Export functionality to be implemented')
  }

  const handlePlateClick = (plate: string) => {
    setSelectedPlate(plate)
  }

  const renderDashboard = () => (
    <div className="space-y-6">
      {/* KPI Row - Exactly as specified */}
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-8 gap-4">
        {/* Total Events */}
        <KPICard
          title="Total Events"
          value={loading ? '...' : metrics.totalEvents.toLocaleString()}
          onClick={() => setActiveView('events')}
          tooltip="Click to view Events table"
        />

        {/* Total Sessions */}
        <KPICard
          title="Total Sessions"
          value={loading ? '...' : metrics.totalSessions.toLocaleString()}
          onClick={() => setActiveView('sessions')}
          tooltip="Click to view Sessions table"
        />

        {/* Session Types */}
        <KPICard
          title="Exact"
          value={loading ? '...' : metrics.sessionTypes.exact.toLocaleString()}
          onClick={() => setActiveView('sessions')}
          tooltip="Exact matches - click to view filtered Sessions table"
        />

        <KPICard
          title="State Mismatch"
          value={loading ? '...' : metrics.sessionTypes.stateMismatch.toLocaleString()}
          onClick={() => setActiveView('sessions')}
          tooltip="State mismatch sessions - click to view filtered Sessions table"
        />

        <KPICard
          title="Overnight"
          value={loading ? '...' : metrics.sessionTypes.overnight.toLocaleString()}
          onClick={() => setActiveView('sessions')}
          tooltip="Overnight sessions - click to view filtered Sessions table"
        />

        <KPICard
          title="Multiday"
          value={loading ? '...' : metrics.sessionTypes.multiday.toLocaleString()}
          onClick={() => setActiveView('sessions')}
          tooltip="Multiday sessions - click to view filtered Sessions table"
        />

        <KPICard
          title="Fuzzy Accepted"
          value={loading ? '...' : metrics.sessionTypes.fuzzyAccepted.toLocaleString()}
          onClick={() => setActiveView('fuzzy')}
          tooltip="Fuzzy accepted sessions - click to view Fuzzy Analysis table"
        />

        {/* Orphans */}
        <KPICard
          title="Open IN"
          value={loading ? '...' : metrics.orphans.openIn.toLocaleString()}
          onClick={() => setActiveView('orphans')}
          tooltip="Open IN orphans - click to view filtered Orphans table"
        />
      </div>

      {/* Second row for remaining orphan types */}
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-8 gap-4">
        <div></div> {/* Empty spacer */}
        <div></div> {/* Empty spacer */}
        <div></div> {/* Empty spacer */}
        <div></div> {/* Empty spacer */}
        <div></div> {/* Empty spacer */}
        <div></div> {/* Empty spacer */}        
        <KPICard
          title="Open OUT"
          value={loading ? '...' : metrics.orphans.openOut.toLocaleString()}
          onClick={() => setActiveView('orphans')}
          tooltip="Open OUT orphans - click to view filtered Orphans table"
        />
        
        <KPICard
          title="Expired"
          value={loading ? '...' : metrics.orphans.expired.toLocaleString()}
          onClick={() => setActiveView('orphans')}
          tooltip="Expired orphans - click to view filtered Orphans table"
        />
      </div>

      {/* Additional Info with tooltips */}
      <div className="bg-card border border-border rounded-lg p-4">
        <h3 className="text-lg font-semibold mb-2">Dashboard Overview</h3>
        <div className="text-sm text-muted-foreground space-y-1">
          <p>• <strong>Total Events:</strong> Raw LPR events (IN/OUT) across all zones</p>
          <p>• <strong>Total Sessions:</strong> Matched pairs of IN→OUT events</p>
          <p>• <strong>Session Types:</strong> Classification of matched sessions</p>
          <p>• <strong>Orphans:</strong> Unmatched events (either missing IN or OUT)</p>
        </div>
        <div className="mt-3 pt-3 border-t border-border text-xs space-y-1">
          <p><strong>Overnight:</strong> Sessions spanning multiple calendar days</p>
          <p><strong>Multiday:</strong> Sessions lasting longer than 24 hours</p>
          <p><strong>Fuzzy:</strong> Sessions matched using approximate plate matching (OCR error correction)</p>
        </div>
      </div>
    </div>
  )

  return (
    <div className="space-y-6">
      <GlobalFilters 
        filters={filters} 
        onFiltersChange={setFilters}
        onExport={handleExport}
      />
      
      {activeView === 'dashboard' && renderDashboard()}
      {activeView === 'sessions' && (
        <div className="space-y-4">
          <button
            onClick={() => setActiveView('dashboard')}
            className="px-4 py-2 text-sm bg-secondary hover:bg-accent rounded transition-colors"
          >
            ← Back to Dashboard
          </button>
          <SessionsTable filters={filters} onPlateClick={handlePlateClick} />
        </div>
      )}
      {activeView === 'events' && (
        <div className="space-y-4">
          <button
            onClick={() => setActiveView('dashboard')}
            className="px-4 py-2 text-sm bg-secondary hover:bg-accent rounded transition-colors"
          >
            ← Back to Dashboard
          </button>
          <EventsTable filters={filters} onPlateClick={handlePlateClick} />
        </div>
      )}
      {activeView === 'orphans' && (
        <div className="space-y-4">
          <button
            onClick={() => setActiveView('dashboard')}
            className="px-4 py-2 text-sm bg-secondary hover:bg-accent rounded transition-colors"
          >
            ← Back to Dashboard
          </button>
          <OrphansTable filters={filters} onPlateClick={handlePlateClick} />
        </div>
      )}
      {activeView === 'fuzzy' && (
        <div className="space-y-4">
          <button
            onClick={() => setActiveView('dashboard')}
            className="px-4 py-2 text-sm bg-secondary hover:bg-accent rounded transition-colors"
          >
            ← Back to Dashboard
          </button>
          <FuzzyAnalysisTable filters={filters} onPlateClick={handlePlateClick} />
        </div>
      )}

      {/* Plate History Modal */}
      {selectedPlate && (
        <PlateHistory 
          plate={selectedPlate} 
          onClose={() => setSelectedPlate(null)} 
        />
      )}
    </div>
  )
}