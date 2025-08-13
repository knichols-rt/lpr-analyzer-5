'use client'

import { useState } from 'react'
import { Calendar, Search, Filter, Download } from 'lucide-react'

export interface FilterState {
  dateRange: {
    from: string
    to: string
  }
  zones: string[]
  timeGranularity: 'day' | 'hour'
  includeFuzzy: boolean
  includeExpiredOrphans: boolean
  search: {
    plate: string
    state: string
    camera: string
  }
}

interface GlobalFiltersProps {
  filters: FilterState
  onFiltersChange: (filters: FilterState) => void
  onExport?: () => void
}

export default function GlobalFilters({ filters, onFiltersChange, onExport }: GlobalFiltersProps) {
  const [showAdvanced, setShowAdvanced] = useState(false)

  const updateFilters = (updates: Partial<FilterState>) => {
    onFiltersChange({ ...filters, ...updates })
  }

  const quickDateRanges = [
    { label: 'Today', value: 0 },
    { label: 'Yesterday', value: 1 },
    { label: 'Last 7 days', value: 7 },
    { label: 'Last 30 days', value: 30 },
    { label: 'Last 90 days', value: 90 },
  ]

  const setQuickDate = (days: number) => {
    const to = new Date()
    const from = new Date()
    from.setDate(to.getDate() - days)
    
    updateFilters({
      dateRange: {
        from: from.toISOString().split('T')[0],
        to: to.toISOString().split('T')[0]
      }
    })
  }

  return (
    <div className="bg-card border border-border rounded-lg p-4 mb-6">
      <div className="flex flex-wrap gap-4 items-center justify-between">
        {/* Date Range */}
        <div className="flex items-center gap-2">
          <Calendar className="h-4 w-4 text-muted-foreground" />
          <span className="text-sm font-medium">Date Range:</span>
          <div className="flex gap-1">
            {quickDateRanges.map((range) => (
              <button
                key={range.value}
                onClick={() => setQuickDate(range.value)}
                className="px-2 py-1 text-xs bg-secondary hover:bg-accent rounded transition-colors"
              >
                {range.label}
              </button>
            ))}
          </div>
          <input
            type="date"
            value={filters.dateRange.from}
            onChange={(e) => updateFilters({ 
              dateRange: { ...filters.dateRange, from: e.target.value }
            })}
            className="px-2 py-1 text-xs bg-input border border-border rounded"
          />
          <span className="text-xs text-muted-foreground">to</span>
          <input
            type="date"
            value={filters.dateRange.to}
            onChange={(e) => updateFilters({ 
              dateRange: { ...filters.dateRange, to: e.target.value }
            })}
            className="px-2 py-1 text-xs bg-input border border-border rounded"
          />
        </div>

        {/* Time Granularity */}
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium">Granularity:</span>
          <select
            value={filters.timeGranularity}
            onChange={(e) => updateFilters({ timeGranularity: e.target.value as 'day' | 'hour' })}
            className="px-2 py-1 text-xs bg-input border border-border rounded"
          >
            <option value="day">Day</option>
            <option value="hour">Hour</option>
          </select>
        </div>

        {/* Toggles */}
        <div className="flex items-center gap-4">
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={filters.includeFuzzy}
              onChange={(e) => updateFilters({ includeFuzzy: e.target.checked })}
              className="rounded border-border"
            />
            Include Fuzzy
          </label>
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={filters.includeExpiredOrphans}
              onChange={(e) => updateFilters({ includeExpiredOrphans: e.target.checked })}
              className="rounded border-border"
            />
            Include Expired Orphans
          </label>
        </div>

        {/* Controls */}
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowAdvanced(!showAdvanced)}
            className="flex items-center gap-1 px-3 py-1 text-sm bg-secondary hover:bg-accent rounded transition-colors"
          >
            <Filter className="h-3 w-3" />
            Advanced
          </button>
          {onExport && (
            <button
              onClick={onExport}
              className="flex items-center gap-1 px-3 py-1 text-sm bg-primary text-primary-foreground hover:bg-primary/90 rounded transition-colors"
            >
              <Download className="h-3 w-3" />
              Export
            </button>
          )}
        </div>
      </div>

      {/* Advanced Filters */}
      {showAdvanced && (
        <div className="mt-4 pt-4 border-t border-border">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* Zone Multi-Select */}
            <div>
              <label className="block text-sm font-medium mb-1">Zones</label>
              <select
                multiple
                value={filters.zones}
                onChange={(e) => {
                  const zones = Array.from(e.target.selectedOptions, option => option.value)
                  updateFilters({ zones })
                }}
                className="w-full px-2 py-1 text-xs bg-input border border-border rounded h-20"
              >
                <option value="ZONE_A">Zone A</option>
                <option value="ZONE_B">Zone B</option>
                <option value="ZONE_C">Zone C</option>
                <option value="GARAGE_1">Garage 1</option>
                <option value="GARAGE_2">Garage 2</option>
              </select>
            </div>

            {/* Search Filters */}
            <div>
              <label className="block text-sm font-medium mb-1">Plate Search</label>
              <div className="relative">
                <Search className="absolute left-2 top-2 h-3 w-3 text-muted-foreground" />
                <input
                  type="text"
                  placeholder="Exact or contains..."
                  value={filters.search.plate}
                  onChange={(e) => updateFilters({ 
                    search: { ...filters.search, plate: e.target.value }
                  })}
                  className="w-full pl-7 pr-2 py-1 text-xs bg-input border border-border rounded"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium mb-1">State</label>
              <input
                type="text"
                placeholder="State abbreviation..."
                value={filters.search.state}
                onChange={(e) => updateFilters({ 
                  search: { ...filters.search, state: e.target.value }
                })}
                className="w-full px-2 py-1 text-xs bg-input border border-border rounded"
              />
            </div>

            <div>
              <label className="block text-sm font-medium mb-1">Camera</label>
              <input
                type="text"
                placeholder="Camera ID..."
                value={filters.search.camera}
                onChange={(e) => updateFilters({ 
                  search: { ...filters.search, camera: e.target.value }
                })}
                className="w-full px-2 py-1 text-xs bg-input border border-border rounded"
              />
            </div>
          </div>
        </div>
      )}
    </div>
  )
}