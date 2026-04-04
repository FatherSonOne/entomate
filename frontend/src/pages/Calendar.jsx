import { useState, useEffect, useCallback } from 'react'
import { useSearchParams, Link } from 'react-router-dom'
import { useToast } from '../components/vc/ToastProvider'
import { useConfirm } from '../components/vc/ConfirmDialog'
import {
  Calendar as CalendarIcon, ChevronLeft, ChevronRight,
  Plus, RefreshCw, Link2, Unlink, CheckSquare,
  Target, Clock, AlertCircle, ExternalLink,
  Loader2, MessageSquare, X
} from 'lucide-react'
import { calendarApi, meetingsApi } from '../services/api'
import { VCButton } from '../components/vc'
import ErrorState from '../components/vc/ErrorState'

export default function Calendar() {
  const toast = useToast()
  const confirm = useConfirm()
  const [searchParams] = useSearchParams()
  const [status, setStatus] = useState({ configured: false, connected: false })
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [events, setEvents] = useState([])
  const [meetings, setMeetings] = useState([])
  const [showMeetings, setShowMeetings] = useState(true)
  const [upcoming, setUpcoming] = useState([])
  const [currentDate, setCurrentDate] = useState(new Date())
  const [selectedDate, setSelectedDate] = useState(null)
  const [syncing, setSyncing] = useState(false)
  const [disconnecting, setDisconnecting] = useState(false)
  const [showNewEvent, setShowNewEvent] = useState(false)
  const [newEvent, setNewEvent] = useState({ title: '', date: '', time: '09:00', duration: 30, description: '', recurrence: 'none' })
  const [creatingEvent, setCreatingEvent] = useState(false)
  const [calendars, setCalendars] = useState([])
  const [selectedCalendar, setSelectedCalendar] = useState('primary')
  const [viewMode, setViewMode] = useState('month') // month | week | day

  useEffect(() => {
    checkStatus()

    // Check for OAuth callback
    if (searchParams.get('connected') === 'true') {
      loadCalendarData()
    }
    if (searchParams.get('error')) {
      toast.error('Calendar Error', decodeURIComponent(searchParams.get('error')))
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
      } else {
        // Load meetings + upcoming items even without Google Calendar
        const [upcomingRes, meetingsRes] = await Promise.all([
          calendarApi.getUpcoming(14).catch(() => ({ upcoming: [] })),
          meetingsApi.list({ limit: 100, offset: 0 }).catch(() => ({ meetings: [] }))
        ])
        setUpcoming(upcomingRes.upcoming || [])
        setMeetings(meetingsRes.meetings || [])
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
      const [eventsRes, upcomingRes, meetingsRes, calendarsRes] = await Promise.all([
        calendarApi.getEvents({ days: 30 }).catch(() => ({ events: [] })),
        calendarApi.getUpcoming(14).catch(() => ({ upcoming: [] })),
        meetingsApi.list({ limit: 100, offset: 0 }).catch(() => ({ meetings: [] })),
        calendarApi.getCalendars().catch(() => ({ calendars: [] }))
      ])
      setEvents(eventsRes.events || [])
      setUpcoming(upcomingRes.upcoming || [])
      if (calendarsRes.calendars?.length > 0) {
        setCalendars(calendarsRes.calendars)
        const primary = calendarsRes.calendars.find(c => c.primary)
        if (primary) setSelectedCalendar(primary.id)
      }
      setMeetings(meetingsRes.meetings || [])
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
      setDisconnecting(true)
      await calendarApi.disconnect()
      setStatus({ configured: true, connected: false })
      setEvents([])
      toast.success('Disconnected', 'Google Calendar disconnected')
    } catch (error) {
      console.error('Failed to disconnect:', error)
      toast.error('Error', 'Failed to disconnect calendar')
    } finally {
      setDisconnecting(false)
    }
  }

  const handleSyncAll = async () => {
    setSyncing(true)
    try {
      const result = await calendarApi.syncAllActionItems(selectedCalendar)
      toast.success('Success', `Synced ${result.synced} action items to calendar`)
      await loadCalendarData()
    } catch (error) {
      console.error('Failed to sync:', error)
      toast.error('Error', 'Failed to sync action items')
    } finally {
      setSyncing(false)
    }
  }

  const handleCreateEvent = async (e) => {
    e.preventDefault()
    if (!newEvent.title || !newEvent.date) {
      toast.warning('Required', 'Title and date are required')
      return
    }
    setCreatingEvent(true)
    try {
      const startDate = new Date(`${newEvent.date}T${newEvent.time}`)
      const endDate = new Date(startDate.getTime() + newEvent.duration * 60000)
      const eventPayload = {
        title: newEvent.title,
        startDate: startDate.toISOString(),
        endDate: endDate.toISOString(),
        description: newEvent.description,
        calendarId: selectedCalendar,
        timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone
      }
      if (newEvent.recurrence !== 'none') {
        eventPayload.recurrence = newEvent.recurrence
      }
      await calendarApi.createEvent(eventPayload)
      toast.success('Created', `"${newEvent.title}" added to calendar`)
      setShowNewEvent(false)
      setNewEvent({ title: '', date: '', time: '09:00', duration: 30, description: '', recurrence: 'none' })
      if (status.connected) await loadCalendarData()
    } catch (err) {
      toast.error('Error', err.message || 'Failed to create event')
    } finally {
      setCreatingEvent(false)
    }
  }

  // Calendar navigation — adapts to viewMode
  const navigate = (direction) => {
    const d = new Date(currentDate)
    if (viewMode === 'month') {
      d.setMonth(d.getMonth() + direction)
    } else if (viewMode === 'week') {
      d.setDate(d.getDate() + direction * 7)
    } else {
      d.setDate(d.getDate() + direction)
    }
    setCurrentDate(d)
  }

  const goToToday = () => {
    setCurrentDate(new Date())
    setSelectedDate(new Date())
  }

  const getHeaderLabel = () => {
    if (viewMode === 'month') {
      return currentDate.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })
    }
    if (viewMode === 'day') {
      return currentDate.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })
    }
    // week
    const start = getWeekStart(currentDate)
    const end = new Date(start)
    end.setDate(end.getDate() + 6)
    const startStr = start.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
    const endStr = end.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
    return `${startStr} – ${endStr}`
  }

  const getWeekStart = (date) => {
    const d = new Date(date)
    d.setDate(d.getDate() - d.getDay())
    d.setHours(0, 0, 0, 0)
    return d
  }

  const getWeekDays = () => {
    const start = getWeekStart(currentDate)
    return Array.from({ length: 7 }, (_, i) => {
      const d = new Date(start)
      d.setDate(d.getDate() + i)
      return d
    })
  }

  const HOURS = Array.from({ length: 24 }, (_, i) => i)

  // N4: Keyboard navigation
  const handleKeyDown = useCallback((e) => {
    // Only handle when not in an input/textarea
    if (['INPUT', 'TEXTAREA', 'SELECT'].includes(e.target.tagName)) return
    if (showNewEvent) return

    const sel = selectedDate || new Date()

    if (e.key === 'ArrowRight') {
      e.preventDefault()
      const next = new Date(sel)
      next.setDate(next.getDate() + 1)
      setSelectedDate(next)
      if (viewMode === 'day') setCurrentDate(next)
    } else if (e.key === 'ArrowLeft') {
      e.preventDefault()
      const prev = new Date(sel)
      prev.setDate(prev.getDate() - 1)
      setSelectedDate(prev)
      if (viewMode === 'day') setCurrentDate(prev)
    } else if (e.key === 'ArrowDown') {
      e.preventDefault()
      const next = new Date(sel)
      next.setDate(next.getDate() + 7)
      setSelectedDate(next)
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      const prev = new Date(sel)
      prev.setDate(prev.getDate() - 7)
      setSelectedDate(prev)
    } else if (e.key === 'Enter') {
      e.preventDefault()
      if (viewMode === 'month') {
        setViewMode('day')
        setCurrentDate(sel)
      }
    } else if (e.key === 'Escape') {
      if (viewMode !== 'month') {
        setViewMode('month')
      } else {
        setSelectedDate(null)
      }
    } else if (e.key === 't' || e.key === 'T') {
      goToToday()
    }
  }, [selectedDate, viewMode, showNewEvent])

  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [handleKeyDown])

  // Get calendar grid data
  const getCalendarDays = () => {
    const year = currentDate.getFullYear()
    const month = currentDate.getMonth()

    const firstDay = new Date(year, month, 1)

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

  const getMeetingsForDate = (date) => {
    if (!showMeetings) return []
    const dateStr = date.toISOString().split('T')[0]
    return meetings.filter(m => {
      const mDate = new Date(m.start_time || m.created_at).toISOString().split('T')[0]
      return mDate === dateStr
    }).map(m => ({
      ...m,
      type: 'meeting',
      date: m.start_time || m.created_at
    }))
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
      case 'meeting':
        return <MessageSquare className="h-3 w-3" />
      default:
        return <Clock className="h-3 w-3" />
    }
  }

  // N5: Color coding by item type/priority
  const getItemBg = (item) => {
    if (item.type === 'meeting') return { bg: 'rgba(0,245,212,.15)', color: 'var(--accent-secondary)' }
    if (item.type === 'goal') return { bg: 'rgba(255,184,0,.15)', color: 'var(--accent-tertiary)' }
    if (item.type === 'action_item') {
      if (item.priority === 'high') return { bg: 'rgba(255,45,107,.18)', color: 'var(--accent-primary)' }
      if (item.priority === 'medium') return { bg: 'rgba(255,184,0,.15)', color: 'var(--accent-tertiary)' }
      return { bg: 'rgba(0,245,212,.12)', color: 'var(--accent-secondary)' }
    }
    // calendar event
    return { bg: 'rgba(160,255,50,.12)', color: 'var(--accent-phosphor)' }
  }

  const getItemHour = (item) => {
    const d = new Date(item.start || item.date)
    return isNaN(d) ? 9 : d.getHours()
  }

  const getAllItemsForDate = (date) => {
    return [...getEventsForDate(date), ...getMeetingsForDate(date), ...getUpcomingForDate(date)]
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
          {status.connected && (
            <VCButton
              variant="primary"
              onClick={() => setShowNewEvent(true)}
            >
              <Plus className="h-4 w-4" />
              New Event
            </VCButton>
          )}
          <VCButton
            variant={showMeetings ? 'primary' : 'secondary'}
            onClick={() => setShowMeetings(!showMeetings)}
          >
            <MessageSquare className="h-4 w-4" />
            Meetings {showMeetings ? 'On' : 'Off'}
          </VCButton>
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
              {calendars.length > 1 && (
                <select
                  className="input text-sm"
                  value={selectedCalendar}
                  onChange={(e) => setSelectedCalendar(e.target.value)}
                  style={{ maxWidth: 180, padding: '6px 8px' }}
                  aria-label="Select calendar"
                >
                  {calendars.map(cal => (
                    <option key={cal.id} value={cal.id}>
                      {cal.summary}{cal.primary ? ' (primary)' : ''}
                    </option>
                  ))}
                </select>
              )}
              <VCButton
                variant="ghost"
                onClick={handleDisconnect}
                disabled={disconnecting}
                style={{ color: 'var(--accent-primary)' }}
              >
                {disconnecting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Unlink className="h-4 w-4" />}
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
                <VCButton variant="ghost" size="sm" onClick={() => navigate(-1)} aria-label="Previous">
                  <ChevronLeft className="h-5 w-5" />
                </VCButton>
                <h2 className="text-lg font-semibold min-w-[200px] text-center" style={{ color: 'var(--text-primary)' }}>
                  {getHeaderLabel()}
                </h2>
                <VCButton variant="ghost" size="sm" onClick={() => navigate(1)} aria-label="Next">
                  <ChevronRight className="h-5 w-5" />
                </VCButton>
              </div>
              <div className="flex items-center gap-2">
                <div className="flex rounded-lg overflow-hidden" style={{ border: '1px solid rgba(248,240,242,.12)' }}>
                  {['month', 'week', 'day'].map(mode => (
                    <button
                      key={mode}
                      onClick={() => setViewMode(mode)}
                      className="px-3 py-1.5 text-xs font-medium capitalize transition-colors"
                      style={{
                        background: viewMode === mode ? 'var(--accent-primary)' : 'transparent',
                        color: viewMode === mode ? '#fff' : 'var(--text-tertiary)'
                      }}
                    >
                      {mode}
                    </button>
                  ))}
                </div>
                <VCButton variant="secondary" size="sm" onClick={goToToday}>
                  Today
                </VCButton>
              </div>
            </div>

            {/* Month View */}
            {viewMode === 'month' && (
              <div className="p-4">
                <div className="grid grid-cols-7 gap-1 mb-2">
                  {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(day => (
                    <div key={day} className="text-center text-sm font-medium py-2" style={{ color: 'var(--text-tertiary)' }}>
                      {day}
                    </div>
                  ))}
                </div>
                <div className="grid grid-cols-7 gap-1">
                  {getCalendarDays().map((day, index) => {
                    const isCurrentMonth = day.getMonth() === currentDate.getMonth()
                    const isToday = day.toDateString() === new Date().toDateString()
                    const isSelected = selectedDate?.toDateString() === day.toDateString()
                    const allItems = getAllItemsForDate(day)

                    return (
                      <button
                        key={index}
                        onClick={() => { setSelectedDate(day); }}
                        onDoubleClick={() => { setSelectedDate(day); setViewMode('day'); setCurrentDate(day); }}
                        className="min-h-[80px] p-1 text-left rounded-lg border transition-colors"
                        style={{
                          background: isCurrentMonth ? 'var(--bg-elevated)' : 'rgba(16,16,16,.5)',
                          borderColor: isToday ? 'var(--accent-primary)' : isSelected ? 'rgba(255,45,107,.5)' : 'rgba(248,240,242,.06)',
                          boxShadow: isSelected ? '0 0 0 2px rgba(255,45,107,.3)' : 'none'
                        }}
                      >
                        <div className="text-sm font-medium mb-1" style={{ color: isToday ? 'var(--accent-primary)' : isCurrentMonth ? 'var(--text-primary)' : 'var(--text-tertiary)' }}>
                          {day.getDate()}
                        </div>
                        <div className="space-y-0.5">
                          {allItems.slice(0, 3).map((item, i) => {
                            const c = getItemBg(item)
                            return (
                              <div key={i} className="text-xs truncate" style={{ background: c.bg, color: c.color, borderRadius: 4, fontSize: 11, padding: '2px 6px' }}>
                                {item.title}
                              </div>
                            )
                          })}
                          {allItems.length > 3 && (
                            <div className="text-xs px-1" style={{ color: 'var(--text-tertiary)' }}>+{allItems.length - 3} more</div>
                          )}
                        </div>
                      </button>
                    )
                  })}
                </div>
              </div>
            )}

            {/* Week View */}
            {viewMode === 'week' && (
              <div className="p-4">
                {/* Day headers */}
                <div className="grid gap-0" style={{ gridTemplateColumns: '56px repeat(7, 1fr)' }}>
                  <div />
                  {getWeekDays().map((day, i) => {
                    const isToday = day.toDateString() === new Date().toDateString()
                    return (
                      <button
                        key={i}
                        onClick={() => { setSelectedDate(day); setViewMode('day'); setCurrentDate(day); }}
                        className="text-center py-2 text-sm font-medium transition-colors rounded"
                        style={{ color: isToday ? 'var(--accent-primary)' : 'var(--text-secondary)' }}
                      >
                        <div className="text-xs" style={{ color: 'var(--text-tertiary)' }}>
                          {day.toLocaleDateString('en-US', { weekday: 'short' })}
                        </div>
                        <div className={`text-lg font-bold ${isToday ? 'rounded-full inline-flex items-center justify-center w-8 h-8' : ''}`}
                          style={isToday ? { background: 'var(--accent-primary)', color: '#fff' } : {}}>
                          {day.getDate()}
                        </div>
                      </button>
                    )
                  })}
                </div>
                {/* Time grid */}
                <div className="max-h-[600px] overflow-y-auto" style={{ borderTop: '1px solid rgba(248,240,242,.08)' }}>
                  {HOURS.filter(h => h >= 6 && h <= 22).map(hour => (
                    <div key={hour} className="grid gap-0" style={{ gridTemplateColumns: '56px repeat(7, 1fr)', minHeight: 48, borderBottom: '1px solid rgba(248,240,242,.06)' }}>
                      <div className="text-xs text-right pr-2 pt-1" style={{ color: 'var(--text-tertiary)' }}>
                        {hour === 0 ? '12 AM' : hour < 12 ? `${hour} AM` : hour === 12 ? '12 PM' : `${hour - 12} PM`}
                      </div>
                      {getWeekDays().map((day, di) => {
                        const dayItems = getAllItemsForDate(day).filter(item => getItemHour(item) === hour)
                        return (
                          <div key={di} className="relative border-l px-1 py-0.5" style={{ borderColor: 'rgba(248,240,242,.06)' }}>
                            {dayItems.map((item, ii) => {
                              const c = getItemBg(item)
                              return (
                                <div key={ii} className="text-xs truncate rounded px-1 py-0.5 mb-0.5 cursor-pointer"
                                  style={{ background: c.bg, color: c.color, fontSize: 10 }}
                                  onClick={() => setSelectedDate(day)}
                                >
                                  {item.title}
                                </div>
                              )
                            })}
                          </div>
                        )
                      })}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Day View */}
            {viewMode === 'day' && (
              <div className="p-4">
                <div className="max-h-[600px] overflow-y-auto">
                  {HOURS.filter(h => h >= 6 && h <= 22).map(hour => {
                    const hourItems = getAllItemsForDate(currentDate).filter(item => getItemHour(item) === hour)
                    return (
                      <div key={hour} className="flex" style={{ minHeight: 56, borderBottom: '1px solid rgba(248,240,242,.06)' }}>
                        <div className="w-16 text-xs text-right pr-3 pt-1 flex-shrink-0" style={{ color: 'var(--text-tertiary)' }}>
                          {hour === 0 ? '12 AM' : hour < 12 ? `${hour} AM` : hour === 12 ? '12 PM' : `${hour - 12} PM`}
                        </div>
                        <div className="flex-1 border-l px-2 py-1" style={{ borderColor: 'rgba(248,240,242,.08)' }}>
                          {hourItems.map((item, i) => {
                            const c = getItemBg(item)
                            return (
                              <div key={i} className="rounded-lg px-3 py-2 mb-1 flex items-center gap-2"
                                style={{ background: c.bg, borderLeft: `3px solid ${c.color}` }}>
                                <span style={{ color: c.color }}>{getItemIcon(item.type)}</span>
                                <div className="flex-1 min-w-0">
                                  <p className="text-sm font-medium truncate" style={{ color: 'var(--text-primary)' }}>{item.title}</p>
                                  <p className="text-xs capitalize" style={{ color: 'var(--text-tertiary)' }}>
                                    {item.type?.replace('_', ' ')}{item.priority ? ` • ${item.priority}` : ''}
                                  </p>
                                </div>
                              </div>
                            )
                          })}
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>
            )}
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
                {[...getEventsForDate(selectedDate), ...getMeetingsForDate(selectedDate), ...getUpcomingForDate(selectedDate)].map((item, i) => {
                  const content = (
                    <div className="flex items-start gap-2">
                      <span style={{ color: item.type === 'meeting' ? 'var(--accent-secondary)' : 'var(--accent-primary)' }}>
                        {getItemIcon(item.type)}
                      </span>
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-sm truncate" style={{ color: 'var(--text-primary)' }}>{item.title}</p>
                        <p className="text-xs opacity-75 capitalize" style={{ color: 'var(--text-tertiary)' }}>
                          {item.type?.replace('_', ' ')}
                          {item.priority && ` • ${item.priority}`}
                          {item.type === 'meeting' && item.duration_minutes && ` • ${item.duration_minutes} min`}
                        </p>
                      </div>
                      {item.htmlLink && (
                        <a
                          href={item.htmlLink}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="opacity-50 hover:opacity-100"
                          style={{ color: 'var(--text-secondary)' }}
                          onClick={(e) => e.stopPropagation()}
                        >
                          <ExternalLink className="h-4 w-4" />
                        </a>
                      )}
                    </div>
                  )

                  return item.type === 'meeting' ? (
                    <Link
                      key={i}
                      to={`/meetings/${item.id}`}
                      className="block p-3 rounded-lg border hover:border-accent-secondary transition-colors"
                      style={{ background: 'var(--bg-elevated)', borderColor: 'rgba(0,245,212,.15)' }}
                    >
                      {content}
                    </Link>
                  ) : (
                    <div
                      key={i}
                      className="p-3 rounded-lg border"
                      style={{ background: 'var(--bg-elevated)', borderColor: 'rgba(248,240,242,.08)' }}
                    >
                      {content}
                    </div>
                  )
                })}
                {getEventsForDate(selectedDate).length === 0 &&
                  getMeetingsForDate(selectedDate).length === 0 &&
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
              {meetings.length > 0 && (
                <div className="text-center p-3 rounded-lg col-span-2" style={{ background: 'rgba(0,245,212,.08)', border: '1px solid rgba(0,245,212,.15)' }}>
                  <p className="text-2xl font-bold" style={{ color: 'var(--accent-secondary)' }}>{meetings.length}</p>
                  <p className="text-xs" style={{ color: 'var(--text-tertiary)' }}>Meetings</p>
                </div>
              )}
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

      {/* New Event Modal */}
      {showNewEvent && (
        <div className="vc-confirm-overlay" onClick={() => setShowNewEvent(false)}>
          <div className="vc rounded-xl shadow-xl max-w-md w-full mx-4 p-6" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold" style={{ fontFamily: 'var(--font-display)', color: 'var(--text-primary)' }}>
                New Calendar Event
              </h3>
              <VCButton variant="ghost" onClick={() => setShowNewEvent(false)} className="p-1" aria-label="Close">
                <X className="w-5 h-5" />
              </VCButton>
            </div>
            <form onSubmit={handleCreateEvent} className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-1" style={{ color: 'var(--text-secondary)' }}>Title</label>
                <input
                  type="text"
                  className="input w-full"
                  value={newEvent.title}
                  onChange={(e) => setNewEvent(prev => ({ ...prev, title: e.target.value }))}
                  placeholder="Event title"
                  required
                  autoFocus
                />
              </div>
              <div className="flex gap-3">
                <div className="flex-1">
                  <label className="block text-sm font-medium mb-1" style={{ color: 'var(--text-secondary)' }}>Date</label>
                  <input
                    type="date"
                    className="input w-full"
                    value={newEvent.date}
                    onChange={(e) => setNewEvent(prev => ({ ...prev, date: e.target.value }))}
                    required
                  />
                </div>
                <div style={{ width: 120 }}>
                  <label className="block text-sm font-medium mb-1" style={{ color: 'var(--text-secondary)' }}>Time</label>
                  <input
                    type="time"
                    className="input w-full"
                    value={newEvent.time}
                    onChange={(e) => setNewEvent(prev => ({ ...prev, time: e.target.value }))}
                  />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium mb-1" style={{ color: 'var(--text-secondary)' }}>Duration</label>
                <div className="flex gap-2">
                  {[15, 30, 45, 60, 90].map(d => (
                    <VCButton
                      key={d}
                      type="button"
                      variant={newEvent.duration === d ? 'primary' : 'ghost'}
                      size="sm"
                      onClick={() => setNewEvent(prev => ({ ...prev, duration: d }))}
                    >
                      {d}m
                    </VCButton>
                  ))}
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium mb-1" style={{ color: 'var(--text-secondary)' }}>Description</label>
                <textarea
                  className="input w-full"
                  rows={2}
                  value={newEvent.description}
                  onChange={(e) => setNewEvent(prev => ({ ...prev, description: e.target.value }))}
                  placeholder="Optional description..."
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1" style={{ color: 'var(--text-secondary)' }}>Repeat</label>
                <select
                  className="input w-full"
                  value={newEvent.recurrence}
                  onChange={(e) => setNewEvent(prev => ({ ...prev, recurrence: e.target.value }))}
                >
                  <option value="none">Does not repeat</option>
                  <option value="RRULE:FREQ=DAILY">Daily</option>
                  <option value="RRULE:FREQ=WEEKLY">Weekly</option>
                  <option value="RRULE:FREQ=WEEKLY;BYDAY=MO,TU,WE,TH,FR">Weekdays</option>
                  <option value="RRULE:FREQ=MONTHLY">Monthly</option>
                  <option value="RRULE:FREQ=YEARLY">Yearly</option>
                </select>
              </div>
              <div className="flex gap-3 justify-end pt-2">
                <VCButton type="button" variant="ghost" onClick={() => setShowNewEvent(false)}>Cancel</VCButton>
                <VCButton type="submit" variant="primary" disabled={creatingEvent}>
                  {creatingEvent ? <><Loader2 className="h-4 w-4 animate-spin" /> Creating...</> : <><Plus className="h-4 w-4" /> Create Event</>}
                </VCButton>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
