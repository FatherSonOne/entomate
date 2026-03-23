import { useState, useEffect } from 'react'
import { useSearchParams } from 'react-router-dom'
import { useToast } from '../components/vc/ToastProvider'
import { useConfirm } from '../components/vc/ConfirmDialog'
import {
  Calendar as CalendarIcon, ChevronLeft, ChevronRight,
  Plus, RefreshCw, Link2, Unlink, CheckSquare,
  Target, Video, Clock, AlertCircle, ExternalLink,
  Loader2
} from 'lucide-react'
import { calendarApi } from '../services/api'
import { VCButton, VCBadge } from '../components/vc'
import ErrorState from '../components/vc/ErrorState'

export default function Calendar() {
  const toast = useToast()
  const confirm = useConfirm()
  const [searchParams] = useSearchParams()
  const [status, setStatus] = useState({ configured: false, connected: false })
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [events, setEvents] = useState([])
  const [upcoming, setUpcoming] = useState([])
  const [currentDate, setCurrentDate] = useState(new Date())
  const [selectedDate, setSelectedDate] = useState(null)
  const [showEventModal, setShowEventModal] = useState(false)
  const [syncing, setSyncing] = useState(false)

  useEffect(() => {
    checkStatus()

    // Check for OAuth callback
    if (searchParams.get('connected') === 'true') {
      loadCalendarData()
    }
    if (searchParams.get('error')) {
      console.error('Calendar auth error:', searchParams.get('error'))
    }
  }, [searchParams])

  const checkStatus = async () => {
    try {
      setError(null)
      setLoading(true)
      const res = await calendarApi.getStatus()
      setStatus(res)

      if (res.connected) {
        await loadCalendarData()
      }
    } catch (err) {
      console.error('Failed to check calendar status:', err)
      setError(err.message || 'Failed to load calendar')
    } finally {
      setLoading(false)
    }
  }

  const loadCalendarData = async () => {
    try {
      const [eventsRes, upcomingRes] = await Promise.all([
        calendarApi.getEvents({ days: 30 }).catch(() => ({ events: [] })),
        calendarApi.getUpcoming(14).catch(() => ({ upcoming: [] }))
      ])
      setEvents(eventsRes.events || [])
      setUpcoming(upcomingRes.upcoming || [])
      setStatus(prev => ({ ...prev, connected: true }))
    } catch (error) {
      console.error('Failed to load calendar data:', error)
    }
  }

  const handleConnect = async () => {
    try {
      const res = await calendarApi.getAuthUrl('/calendar')
      if (res.authUrl) {
        window.location.href = res.authUrl
      }
    } catch (error) {
      console.error('Failed to get auth URL:', error)
      toast.error('Error', 'Failed to connect to Google Calendar. Make sure the backend is configured.')
    }
  }

  const handleDisconnect = async () => {
    const ok = await confirm({ title: 'Disconnect?', message: 'Disconnect Google Calendar?', confirmLabel: 'Disconnect', variant: 'danger' })
    if (!ok) return
    try {
      await calendarApi.disconnect()
      setStatus({ configured: true, connected: false })
      setEvents([])
      setUpcoming([])
    } catch (error) {
      console.error('Failed to disconnect:', error)
    }
  }

  const handleSyncAll = async () => {
    setSyncing(true)
    try {
      const result = await calendarApi.syncAllActionItems()
      toast.success('Success', `Synced ${result.synced} action items to calendar`)
      await loadCalendarData()
    } catch (error) {
      console.error('Failed to sync:', error)
      toast.error('Error', 'Failed to sync action items')
    } finally {
      setSyncing(false)
    }
  }

  // Calendar navigation
  const prevMonth = () => {
    setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() - 1))
  }

  const nextMonth = () => {
    setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() + 1))
  }

  const goToToday = () => {
    setCurrentDate(new Date())
    setSelectedDate(new Date())
  }

  // Get calendar grid data
  const getCalendarDays = () => {
    const year = currentDate.getFullYear()
    const month = currentDate.getMonth()

    const firstDay = new Date(year, month, 1)
    const lastDay = new Date(year, month + 1, 0)

    const startDate = new Date(firstDay)
    startDate.setDate(startDate.getDate() - firstDay.getDay())

    const days = []
    const current = new Date(startDate)

    for (let i = 0; i < 42; i++) {
      days.push(new Date(current))
      current.setDate(current.getDate() + 1)
    }

    return days
  }

  const getEventsForDate = (date) => {
    const dateStr = date.toISOString().split('T')[0]
    return events.filter(e => {
      const eventDate = new Date(e.start).toISOString().split('T')[0]
      return eventDate === dateStr
    })
  }

  const getUpcomingForDate = (date) => {
    const dateStr = date.toISOString().split('T')[0]
    return upcoming.filter(item => {
      const itemDate = new Date(item.date).toISOString().split('T')[0]
      return itemDate === dateStr
    })
  }

  const formatDate = (date) => {
    return new Date(date).toLocaleDateString('en-US', {
      weekday: 'short',
      month: 'short',
      day: 'numeric'
    })
  }

  const getItemIcon = (type) => {
    switch (type) {
      case 'action_item':
        return <CheckSquare className="h-3 w-3" />
      case 'goal':
        return <Target className="h-3 w-3" />
      case 'calendar':
        return <CalendarIcon className="h-3 w-3" />
      default:
        return <Clock className="h-3 w-3" />
    }
  }

  const getItemColor = (item) => {
    if (item.type === 'action_item') {
      if (item.priority === 'high') return 'bg-semantic-error-dim text-semantic-error border-semantic-error'
      if (item.priority === 'medium') return 'vc-bg-warning-dim vc-text-warning vc-border-warning'
      return 'bg-semantic-success-dim text-semantic-success border-semantic-success'
    }
    if (item.type === 'goal') {
      return 'bg-accent-tertiary-dim text-accent-tertiary border-accent-tertiary'
    }
    return 'bg-semantic-info-dim text-semantic-info border-semantic-info'
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 animate-spin" style={{ color: 'var(--accent-primary)' }} />
      </div>
    )
  }

  if (error) return (
    <div className="space-y-6">
      <ErrorState message={error} onRetry={checkStatus} />
    </div>
  )

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2" style={{ color: 'var(--text-primary)', fontFamily: 'var(--font-display)' }}>
            <CalendarIcon className="h-7 w-7" style={{ color: 'var(--accent-primary)' }} />
            Calendar
          </h1>
          <p className="mt-1" style={{ color: 'var(--text-tertiary)' }}>
            View deadlines, events, and sync with Google Calendar
          </p>
        </div>
        <div className="flex items-center gap-2">
          {status.connected ? (
            <>
              <VCButton
                variant="secondary"
                onClick={handleSyncAll}
                disabled={syncing}
              >
                {syncing ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <RefreshCw className="h-4 w-4" />
                )}
                Sync Tasks
              </VCButton>
              <VCButton
                variant="ghost"
                onClick={handleDisconnect}
                style={{ color: 'var(--accent-primary)' }}
              >
                <Unlink className="h-4 w-4" />
                Disconnect
              </VCButton>
            </>
          ) : status.configured ? (
            <VCButton variant="primary" onClick={handleConnect}>
              <Link2 className="h-4 w-4" />
              Connect Google Calendar
            </VCButton>
          ) : (
            <div className="text-sm px-3 py-2 rounded-lg" style={{ color: 'var(--text-tertiary)', background: 'var(--bg-elevated)', border: '1px solid rgba(248,240,242,.08)' }}>
              Add GOOGLE_CLIENT_ID to enable
            </div>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Calendar Grid */}
        <div className="lg:col-span-2">
          <div className="vc">
            {/* Calendar Header */}
            <div className="p-4 flex items-center justify-between" style={{ borderBottom: '1px solid rgba(248,240,242,.08)' }}>
              <div className="flex items-center gap-4">
                <VCButton variant="ghost" size="sm" onClick={prevMonth} aria-label="Previous month">
                  <ChevronLeft className="h-5 w-5" />
                </VCButton>
                <h2 className="text-lg font-semibold" style={{ color: 'var(--text-primary)' }}>
                  {currentDate.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
                </h2>
                <VCButton variant="ghost" size="sm" onClick={nextMonth} aria-label="Next month">
                  <ChevronRight className="h-5 w-5" />
                </VCButton>
              </div>
              <VCButton variant="secondary" size="sm" onClick={goToToday}>
                Today
              </VCButton>
            </div>

            {/* Calendar Grid */}
            <div className="p-4">
              {/* Weekday headers */}
              <div className="grid grid-cols-7 gap-1 mb-2">
                {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(day => (
                  <div key={day} className="text-center text-sm font-medium py-2" style={{ color: 'var(--text-tertiary)' }}>
                    {day}
                  </div>
                ))}
              </div>

              {/* Days grid */}
              <div className="grid grid-cols-7 gap-1">
                {getCalendarDays().map((day, index) => {
                  const isCurrentMonth = day.getMonth() === currentDate.getMonth()
                  const isToday = day.toDateString() === new Date().toDateString()
                  const isSelected = selectedDate?.toDateString() === day.toDateString()
                  const dayEvents = getEventsForDate(day)
                  const dayItems = getUpcomingForDate(day)
                  const hasItems = dayEvents.length > 0 || dayItems.length > 0

                  return (
                    <button
                      key={index}
                      onClick={() => setSelectedDate(day)}
                      className="min-h-[80px] p-1 text-left rounded-lg border transition-colors"
                      style={{
                        background: isCurrentMonth ? 'var(--bg-elevated)' : 'rgba(16,16,16,.5)',
                        borderColor: isToday
                          ? 'var(--accent-primary)'
                          : isSelected
                          ? 'rgba(255,45,107,.5)'
                          : 'rgba(248,240,242,.06)',
                        boxShadow: isSelected ? '0 0 0 2px rgba(255,45,107,.3)' : 'none'
                      }}
                    >
                      <div
                        className="text-sm font-medium mb-1"
                        style={{
                          color: isToday
                            ? 'var(--accent-primary)'
                            : isCurrentMonth
                            ? 'var(--text-primary)'
                            : 'var(--text-tertiary)'
                        }}
                      >
                        {day.getDate()}
                      </div>
                      <div className="space-y-0.5">
                        {[...dayEvents, ...dayItems].slice(0, 3).map((item, i) => (
                          <div
                            key={i}
                            className="text-xs truncate"
                            style={{
                              background: 'rgba(255,45,107,.15)',
                              color: 'var(--accent-primary)',
                              borderRadius: 4,
                              fontSize: 11,
                              padding: '2px 6px'
                            }}
                          >
                            {item.title}
                          </div>
                        ))}
                        {hasItems && dayEvents.length + dayItems.length > 3 && (
                          <div className="text-xs px-1" style={{ color: 'var(--text-tertiary)' }}>
                            +{dayEvents.length + dayItems.length - 3} more
                          </div>
                        )}
                      </div>
                    </button>
                  )
                })}
              </div>
            </div>
          </div>
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          {/* Selected Date Details */}
          {selectedDate && (
            <div className="vc p-4">
              <h3 className="font-semibold mb-3" style={{ color: 'var(--text-primary)' }}>
                {formatDate(selectedDate)}
              </h3>
              <div className="space-y-2">
                {[...getEventsForDate(selectedDate), ...getUpcomingForDate(selectedDate)].map((item, i) => (
                  <div
                    key={i}
                    className="p-3 rounded-lg border"
                    style={{ background: 'var(--bg-elevated)', borderColor: 'rgba(248,240,242,.08)' }}
                  >
                    <div className="flex items-start gap-2">
                      <span style={{ color: 'var(--accent-primary)' }}>{getItemIcon(item.type)}</span>
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-sm truncate" style={{ color: 'var(--text-primary)' }}>{item.title}</p>
                        <p className="text-xs opacity-75 capitalize" style={{ color: 'var(--text-tertiary)' }}>
                          {item.type?.replace('_', ' ')}
                          {item.priority && ` • ${item.priority}`}
                        </p>
                      </div>
                      {item.htmlLink && (
                        <a
                          href={item.htmlLink}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="opacity-50 hover:opacity-100"
                          style={{ color: 'var(--text-secondary)' }}
                        >
                          <ExternalLink className="h-4 w-4" />
                        </a>
                      )}
                    </div>
                  </div>
                ))}
                {getEventsForDate(selectedDate).length === 0 &&
                  getUpcomingForDate(selectedDate).length === 0 && (
                    <p className="text-sm text-center py-4" style={{ color: 'var(--text-tertiary)' }}>
                      No events on this day
                    </p>
                  )}
              </div>
            </div>
          )}

          {/* Upcoming Items */}
          <div className="vc p-4">
            <h3 className="font-semibold mb-3 flex items-center gap-2" style={{ color: 'var(--text-primary)' }}>
              <Clock className="h-4 w-4" style={{ color: 'var(--text-tertiary)' }} />
              Upcoming (14 days)
            </h3>
            <div className="space-y-2 max-h-[400px] overflow-y-auto">
              {upcoming.length > 0 ? (
                upcoming.slice(0, 10).map((item, i) => (
                  <div
                    key={i}
                    className="p-3 rounded-lg"
                    style={{ background: 'var(--bg-elevated)', border: '1px solid rgba(248,240,242,.08)' }}
                  >
                    <div className="flex items-start gap-2">
                      <span style={{ color: 'var(--accent-primary)' }}>{getItemIcon(item.type)}</span>
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-sm truncate" style={{ color: 'var(--text-primary)' }}>{item.title}</p>
                        <p className="text-xs opacity-75" style={{ color: 'var(--text-tertiary)' }}>
                          {formatDate(item.date)}
                        </p>
                      </div>
                    </div>
                  </div>
                ))
              ) : (
                <p className="text-sm text-center py-4" style={{ color: 'var(--text-tertiary)' }}>
                  No upcoming items
                </p>
              )}
            </div>
          </div>

          {/* Quick Stats */}
          <div className="vc p-4">
            <h3 className="font-semibold mb-3" style={{ color: 'var(--text-primary)' }}>Quick Stats</h3>
            <div className="grid grid-cols-2 gap-3">
              <div className="text-center p-3 rounded-lg" style={{ background: 'rgba(0,245,212,.08)', border: '1px solid rgba(0,245,212,.15)' }}>
                <p className="text-2xl font-bold" style={{ color: 'var(--accent-secondary)' }}>{events.length}</p>
                <p className="text-xs" style={{ color: 'var(--text-tertiary)' }}>Calendar Events</p>
              </div>
              <div className="text-center p-3 rounded-lg" style={{ background: 'rgba(255,184,0,.08)', border: '1px solid rgba(255,184,0,.15)' }}>
                <p className="text-2xl font-bold" style={{ color: 'var(--accent-tertiary)' }}>
                  {upcoming.filter(u => u.type === 'action_item').length}
                </p>
                <p className="text-xs" style={{ color: 'var(--text-tertiary)' }}>Due Tasks</p>
              </div>
              <div className="text-center p-3 rounded-lg" style={{ background: 'rgba(160,255,50,.08)', border: '1px solid rgba(160,255,50,.15)' }}>
                <p className="text-2xl font-bold" style={{ color: 'var(--accent-phosphor)' }}>
                  {upcoming.filter(u => u.type === 'goal').length}
                </p>
                <p className="text-xs" style={{ color: 'var(--text-tertiary)' }}>Goal Deadlines</p>
              </div>
              <div className="text-center p-3 rounded-lg" style={{ background: 'rgba(255,45,107,.08)', border: '1px solid rgba(255,45,107,.15)' }}>
                <p className="text-2xl font-bold" style={{ color: 'var(--accent-primary)' }}>
                  {upcoming.filter(u => new Date(u.date) < new Date()).length}
                </p>
                <p className="text-xs" style={{ color: 'var(--text-tertiary)' }}>Overdue</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Connection Status */}
      {!status.connected && (
        <div className="rounded-lg p-4" style={{ background: 'rgba(0,245,212,.08)', border: '1px solid rgba(0,245,212,.2)' }}>
          <div className="flex items-start gap-3">
            <AlertCircle className="h-5 w-5 mt-0.5" style={{ color: 'var(--accent-secondary)' }} />
            <div>
              <h3 className="font-medium" style={{ color: 'var(--accent-secondary)' }}>Connect Google Calendar</h3>
              <p className="text-sm mt-1" style={{ color: 'var(--text-secondary)' }}>
                Connect your Google Calendar to sync action items, goal deadlines, and meeting schedules.
                Events will appear in your calendar with reminders.
              </p>
              {status.configured && (
                <VCButton variant="primary" onClick={handleConnect} className="mt-3">
                  Connect Now
                </VCButton>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
