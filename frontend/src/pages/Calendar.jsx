import { useState, useEffect } from 'react'
import { useSearchParams } from 'react-router-dom'
import {
  Calendar as CalendarIcon, ChevronLeft, ChevronRight,
  Plus, RefreshCw, Link2, Unlink, CheckSquare,
  Target, Video, Clock, AlertCircle, ExternalLink,
  Loader2
} from 'lucide-react'
import { calendarApi } from '../services/api'

export default function Calendar() {
  const [searchParams] = useSearchParams()
  const [status, setStatus] = useState({ configured: false, connected: false })
  const [loading, setLoading] = useState(true)
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
      setLoading(true)
      const res = await calendarApi.getStatus()
      setStatus(res)

      if (res.connected) {
        await loadCalendarData()
      }
    } catch (error) {
      console.error('Failed to check calendar status:', error)
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
      alert('Failed to connect to Google Calendar. Make sure the backend is configured.')
    }
  }

  const handleDisconnect = async () => {
    if (!confirm('Disconnect Google Calendar?')) return
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
      alert(`Synced ${result.synced} action items to calendar`)
      await loadCalendarData()
    } catch (error) {
      console.error('Failed to sync:', error)
      alert('Failed to sync action items')
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
      if (item.priority === 'high') return 'bg-red-100 text-red-700 border-red-200'
      if (item.priority === 'medium') return 'bg-yellow-100 text-yellow-700 border-yellow-200'
      return 'bg-green-100 text-green-700 border-green-200'
    }
    if (item.type === 'goal') {
      return 'bg-purple-100 text-purple-700 border-purple-200'
    }
    return 'bg-blue-100 text-blue-700 border-blue-200'
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 animate-spin text-primary-600" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <CalendarIcon className="h-7 w-7 text-primary-600" />
            Calendar
          </h1>
          <p className="text-gray-500 mt-1">
            View deadlines, events, and sync with Google Calendar
          </p>
        </div>
        <div className="flex items-center gap-2">
          {status.connected ? (
            <>
              <button
                onClick={handleSyncAll}
                disabled={syncing}
                className="btn btn-secondary flex items-center gap-2"
              >
                {syncing ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <RefreshCw className="h-4 w-4" />
                )}
                Sync Tasks
              </button>
              <button
                onClick={handleDisconnect}
                className="btn btn-secondary flex items-center gap-2 text-red-600"
              >
                <Unlink className="h-4 w-4" />
                Disconnect
              </button>
            </>
          ) : status.configured ? (
            <button
              onClick={handleConnect}
              className="btn btn-primary flex items-center gap-2"
            >
              <Link2 className="h-4 w-4" />
              Connect Google Calendar
            </button>
          ) : (
            <div className="text-sm text-gray-500 bg-gray-100 px-3 py-2 rounded-lg">
              Add GOOGLE_CLIENT_ID to enable
            </div>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Calendar Grid */}
        <div className="lg:col-span-2">
          <div className="card">
            {/* Calendar Header */}
            <div className="p-4 border-b border-gray-200 flex items-center justify-between">
              <div className="flex items-center gap-4">
                <button onClick={prevMonth} className="p-2 hover:bg-gray-100 rounded-lg">
                  <ChevronLeft className="h-5 w-5" />
                </button>
                <h2 className="text-lg font-semibold">
                  {currentDate.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
                </h2>
                <button onClick={nextMonth} className="p-2 hover:bg-gray-100 rounded-lg">
                  <ChevronRight className="h-5 w-5" />
                </button>
              </div>
              <button onClick={goToToday} className="btn btn-secondary text-sm">
                Today
              </button>
            </div>

            {/* Calendar Grid */}
            <div className="p-4">
              {/* Weekday headers */}
              <div className="grid grid-cols-7 gap-1 mb-2">
                {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(day => (
                  <div key={day} className="text-center text-sm font-medium text-gray-500 py-2">
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
                      className={`
                        min-h-[80px] p-1 text-left rounded-lg border transition-colors
                        ${isCurrentMonth ? 'bg-white' : 'bg-gray-50'}
                        ${isToday ? 'border-primary-500' : 'border-gray-100'}
                        ${isSelected ? 'ring-2 ring-primary-500' : ''}
                        hover:bg-gray-50
                      `}
                    >
                      <div className={`
                        text-sm font-medium mb-1
                        ${isToday ? 'text-primary-600' : isCurrentMonth ? 'text-gray-900' : 'text-gray-400'}
                      `}>
                        {day.getDate()}
                      </div>
                      <div className="space-y-0.5">
                        {[...dayEvents, ...dayItems].slice(0, 3).map((item, i) => (
                          <div
                            key={i}
                            className={`text-xs px-1 py-0.5 rounded truncate ${getItemColor(item)}`}
                          >
                            {item.title}
                          </div>
                        ))}
                        {hasItems && dayEvents.length + dayItems.length > 3 && (
                          <div className="text-xs text-gray-400 px-1">
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
            <div className="card p-4">
              <h3 className="font-semibold text-gray-900 mb-3">
                {formatDate(selectedDate)}
              </h3>
              <div className="space-y-2">
                {[...getEventsForDate(selectedDate), ...getUpcomingForDate(selectedDate)].map((item, i) => (
                  <div
                    key={i}
                    className={`p-3 rounded-lg border ${getItemColor(item)}`}
                  >
                    <div className="flex items-start gap-2">
                      {getItemIcon(item.type)}
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-sm truncate">{item.title}</p>
                        <p className="text-xs opacity-75 capitalize">
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
                        >
                          <ExternalLink className="h-4 w-4" />
                        </a>
                      )}
                    </div>
                  </div>
                ))}
                {getEventsForDate(selectedDate).length === 0 &&
                  getUpcomingForDate(selectedDate).length === 0 && (
                    <p className="text-sm text-gray-400 text-center py-4">
                      No events on this day
                    </p>
                  )}
              </div>
            </div>
          )}

          {/* Upcoming Items */}
          <div className="card p-4">
            <h3 className="font-semibold text-gray-900 mb-3 flex items-center gap-2">
              <Clock className="h-4 w-4 text-gray-400" />
              Upcoming (14 days)
            </h3>
            <div className="space-y-2 max-h-[400px] overflow-y-auto">
              {upcoming.length > 0 ? (
                upcoming.slice(0, 10).map((item, i) => (
                  <div
                    key={i}
                    className={`p-3 rounded-lg border ${getItemColor(item)}`}
                  >
                    <div className="flex items-start gap-2">
                      {getItemIcon(item.type)}
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-sm truncate">{item.title}</p>
                        <p className="text-xs opacity-75">
                          {formatDate(item.date)}
                        </p>
                      </div>
                    </div>
                  </div>
                ))
              ) : (
                <p className="text-sm text-gray-400 text-center py-4">
                  No upcoming items
                </p>
              )}
            </div>
          </div>

          {/* Quick Stats */}
          <div className="card p-4">
            <h3 className="font-semibold text-gray-900 mb-3">Quick Stats</h3>
            <div className="grid grid-cols-2 gap-3">
              <div className="text-center p-3 bg-blue-50 rounded-lg">
                <p className="text-2xl font-bold text-blue-600">{events.length}</p>
                <p className="text-xs text-gray-500">Calendar Events</p>
              </div>
              <div className="text-center p-3 bg-orange-50 rounded-lg">
                <p className="text-2xl font-bold text-orange-600">
                  {upcoming.filter(u => u.type === 'action_item').length}
                </p>
                <p className="text-xs text-gray-500">Due Tasks</p>
              </div>
              <div className="text-center p-3 bg-purple-50 rounded-lg">
                <p className="text-2xl font-bold text-purple-600">
                  {upcoming.filter(u => u.type === 'goal').length}
                </p>
                <p className="text-xs text-gray-500">Goal Deadlines</p>
              </div>
              <div className="text-center p-3 bg-red-50 rounded-lg">
                <p className="text-2xl font-bold text-red-600">
                  {upcoming.filter(u => new Date(u.date) < new Date()).length}
                </p>
                <p className="text-xs text-gray-500">Overdue</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Connection Status */}
      {!status.connected && (
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
          <div className="flex items-start gap-3">
            <AlertCircle className="h-5 w-5 text-blue-500 mt-0.5" />
            <div>
              <h3 className="font-medium text-blue-900">Connect Google Calendar</h3>
              <p className="text-sm text-blue-700 mt-1">
                Connect your Google Calendar to sync action items, goal deadlines, and meeting schedules.
                Events will appear in your calendar with reminders.
              </p>
              {status.configured && (
                <button
                  onClick={handleConnect}
                  className="btn btn-primary mt-3"
                >
                  Connect Now
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
