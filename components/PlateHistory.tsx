'use client'

import { useState, useEffect } from 'react'
import { X, ArrowDown, ArrowUp, Calendar, MapPin, Camera, Clock } from 'lucide-react'

interface HistoryEvent {
  id: string
  time: string
  direction: 'IN' | 'OUT'
  zone: string
  camera: string
  quality: number
  matched: boolean
  sessionId?: string
  uploadId: string
}

interface HistorySession {
  id: string
  entryTime: string
  exitTime: string
  duration: number
  zone: string
  matchType: 'EXACT' | 'STATE_MISMATCH' | 'FUZZY_ACCEPTED'
  billingAmount: number
  flags: string[]
}

interface PlateHistoryProps {
  plate: string
  onClose: () => void
}

export default function PlateHistory({ plate, onClose }: PlateHistoryProps) {
  const [events, setEvents] = useState<HistoryEvent[]>([])
  const [sessions, setSessions] = useState<HistorySession[]>([])
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState<'timeline' | 'sessions'>('timeline')

  // Mock data for development
  const mockEvents: HistoryEvent[] = Array.from({ length: 15 }, (_, i) => {
    const baseTime = Date.now() - i * 2 * 60 * 60 * 1000 // Every 2 hours going back
    const direction = i % 2 === 0 ? 'IN' : 'OUT'
    
    return {
      id: `event-${plate}-${i}`,
      time: new Date(baseTime).toISOString(),
      direction,
      zone: `ZONE_${String.fromCharCode(65 + (i % 3))}`,
      camera: `CAM_${(i % 5) + 1}_${direction}`,
      quality: Math.random() * 0.3 + 0.7, // 0.7 to 1.0
      matched: Math.random() > 0.2, // 80% matched
      sessionId: Math.random() > 0.2 ? `session-${plate}-${Math.floor(i / 2)}` : undefined,
      uploadId: `upload-${String(i % 10).padStart(3, '0')}`
    }
  })

  const mockSessions: HistorySession[] = Array.from({ length: 6 }, (_, i) => {
    const duration = Math.floor(Math.random() * 360) + 30 // 30 minutes to 6 hours
    const entryTime = Date.now() - i * 8 * 60 * 60 * 1000 // Every 8 hours going back
    
    return {
      id: `session-${plate}-${i}`,
      entryTime: new Date(entryTime).toISOString(),
      exitTime: new Date(entryTime + duration * 60 * 1000).toISOString(),
      duration,
      zone: `ZONE_${String.fromCharCode(65 + (i % 3))}`,
      matchType: ['EXACT', 'STATE_MISMATCH', 'FUZZY_ACCEPTED'][Math.floor(Math.random() * 3)] as any,
      billingAmount: Math.floor(Math.random() * 50) + 5,
      flags: Math.random() > 0.7 ? ['OVERNIGHT'] : Math.random() > 0.9 ? ['MULTIDAY'] : []
    }
  })

  useEffect(() => {
    const fetchPlateHistory = async () => {
      setLoading(true)
      try {
        // In a real app, this would fetch from the API
        // const [eventsRes, sessionsRes] = await Promise.all([
        //   fetch(`/api/events?plate=${encodeURIComponent(plate)}`),
        //   fetch(`/api/sessions?plate=${encodeURIComponent(plate)}`)
        // ])
        
        // For now, use mock data
        setEvents(mockEvents)
        setSessions(mockSessions)
      } catch (error) {
        console.error('Failed to fetch plate history:', error)
        setEvents(mockEvents)
        setSessions(mockSessions)
      }
      setLoading(false)
    }

    fetchPlateHistory()
  }, [plate])

  const getDirectionIcon = (direction: 'IN' | 'OUT') => {
    if (direction === 'IN') {
      return <ArrowDown className="h-4 w-4 text-green-400" />
    }
    return <ArrowUp className="h-4 w-4 text-red-400" />
  }

  const getQualityBadge = (quality: number) => {
    if (quality >= 0.9) return 'bg-green-900 text-green-100'
    if (quality >= 0.7) return 'bg-yellow-900 text-yellow-100'
    return 'bg-red-900 text-red-100'
  }

  const getMatchTypeBadge = (type: HistorySession['matchType']) => {
    const badges = {
      EXACT: 'badge-exact',
      STATE_MISMATCH: 'badge-state-mismatch',
      FUZZY_ACCEPTED: 'badge-fuzzy'
    }
    return badges[type]
  }

  const formatDuration = (minutes: number) => {
    const hours = Math.floor(minutes / 60)
    const mins = minutes % 60
    if (hours > 0) {
      return `${hours}h ${mins}m`
    }
    return `${mins}m`
  }

  if (loading) {
    return (
      <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
        <div className="bg-card border border-border rounded-lg p-8 m-4 max-w-4xl w-full max-h-[90vh] overflow-hidden">
          <div className="text-center">
            <p className="text-muted-foreground">Loading plate history...</p>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-card border border-border rounded-lg p-6 m-4 max-w-6xl w-full max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-xl font-semibold flex items-center gap-2">
              <Calendar className="h-5 w-5" />
              Plate History: <span className="font-mono text-primary">{plate}</span>
            </h2>
            <p className="text-sm text-muted-foreground">
              Complete timeline of events and sessions for this license plate
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-accent rounded transition-colors"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Tab Navigation */}
        <div className="flex gap-1 mb-4">
          <button
            onClick={() => setActiveTab('timeline')}
            className={`px-4 py-2 text-sm rounded transition-colors ${
              activeTab === 'timeline' 
                ? 'bg-primary text-primary-foreground' 
                : 'bg-secondary hover:bg-accent'
            }`}
          >
            Timeline ({events.length})
          </button>
          <button
            onClick={() => setActiveTab('sessions')}
            className={`px-4 py-2 text-sm rounded transition-colors ${
              activeTab === 'sessions' 
                ? 'bg-primary text-primary-foreground' 
                : 'bg-secondary hover:bg-accent'
            }`}
          >
            Sessions ({sessions.length})
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-auto">
          {activeTab === 'timeline' && (
            <div className="space-y-2">
              {events.map((event, index) => (
                <div key={event.id} className="bg-secondary rounded-lg p-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      {getDirectionIcon(event.direction)}
                      <div>
                        <div className="flex items-center gap-2">
                          <span className={event.direction === 'IN' ? 'text-green-400' : 'text-red-400'}>
                            {event.direction}
                          </span>
                          <span className="text-muted-foreground">•</span>
                          <MapPin className="h-3 w-3 text-muted-foreground" />
                          <span>{event.zone}</span>
                          <span className="text-muted-foreground">•</span>
                          <Camera className="h-3 w-3 text-muted-foreground" />
                          <span className="text-xs">{event.camera}</span>
                        </div>
                        <div className="text-xs text-muted-foreground mt-1">
                          {new Date(event.time).toLocaleString()}
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className={`badge ${getQualityBadge(event.quality)}`}>
                        {(event.quality * 100).toFixed(1)}%
                      </span>
                      {event.matched ? (
                        <span className="badge bg-green-900 text-green-100">MATCHED</span>
                      ) : (
                        <span className="badge bg-red-900 text-red-100">ORPHAN</span>
                      )}
                      <span className="text-xs text-muted-foreground">{event.uploadId}</span>
                    </div>
                  </div>
                  {event.sessionId && (
                    <div className="mt-2 text-xs text-muted-foreground">
                      Part of session: {event.sessionId}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}

          {activeTab === 'sessions' && (
            <div className="space-y-3">
              {sessions.map((session) => (
                <div key={session.id} className="bg-secondary rounded-lg p-4">
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <Clock className="h-4 w-4 text-muted-foreground" />
                      <span className="font-medium">Duration: {formatDuration(session.duration)}</span>
                      <span className="text-muted-foreground">•</span>
                      <MapPin className="h-3 w-3 text-muted-foreground" />
                      <span>{session.zone}</span>
                      <span className="text-muted-foreground">•</span>
                      <span className="text-green-400 font-bold">${session.billingAmount}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className={`badge ${getMatchTypeBadge(session.matchType)}`}>
                        {session.matchType.replace('_', ' ')}
                      </span>
                      {session.flags.map(flag => (
                        <span key={flag} className="badge bg-orange-900 text-orange-100">
                          {flag}
                        </span>
                      ))}
                    </div>
                  </div>
                  <div className="text-xs text-muted-foreground">
                    <div>Entry: {new Date(session.entryTime).toLocaleString()}</div>
                    <div>Exit: {new Date(session.exitTime).toLocaleString()}</div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="mt-4 pt-4 border-t border-border text-xs text-muted-foreground">
          <div className="flex justify-between">
            <span>
              {activeTab === 'timeline' 
                ? `${events.filter(e => e.matched).length} matched events, ${events.filter(e => !e.matched).length} orphans`
                : `${sessions.length} total sessions, $${sessions.reduce((sum, s) => sum + s.billingAmount, 0)} total billing`
              }
            </span>
            <span>Last updated: {new Date().toLocaleString()}</span>
          </div>
        </div>
      </div>
    </div>
  )
}