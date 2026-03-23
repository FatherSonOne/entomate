import React, { useState, useEffect, useCallback } from 'react'
import { Link } from 'react-router-dom'
import {
  Plus, Search, Filter, Clock, Users, Mic, ChevronDown, ChevronRight,
  ChevronLeft, Sparkles, Trash2, Calendar, List, AlignLeft
} from 'lucide-react'
import MeetingRecorder from '../components/MeetingRecorder'
import { meetingsApi } from '../services/api'
import { VCButton, VCBadge, VCIconBox } from '../components/vc'

/* ── Helpers ─────────────────────────────────────────────────── */
const DAYS   = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa']
const MONTHS = ['January','February','March','April','May','June',
                'July','August','September','October','November','December']

function fmtDate(iso) {
  if (!iso) return ''
  const d = new Date(iso)
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

function isoDay(date) {
  // Returns YYYY-MM-DD for a Date object
  return date.toISOString().slice(0, 10)
}

function getSentimentColor(sentiment) {
  if (sentiment === 'Positive') return 'mint'
  if (sentiment === 'Negative') return 'crimson'
  return 'neutral'
}

function getMeetingStatus(meeting) {
  if (meeting.is_recording) return { label: 'Live', color: 'crimson', live: true }
  if (meeting.processing)   return { label: 'Processing', color: 'amber', live: false }
  if (meeting.summary)      return { label: 'Analyzed', color: 'mint', live: false }
  return { label: 'Recorded', color: 'neutral', live: false }
}

/* ── Mini Calendar ───────────────────────────────────────────── */
function MiniCalendar({ selectedDate, onSelect, meetingDays = new Set() }) {
  const [cursor, setCursor] = useState(() => {
    const d = selectedDate ? new Date(selectedDate) : new Date()
    return new Date(d.getFullYear(), d.getMonth(), 1)
  })

  const year  = cursor.getFullYear()
  const month = cursor.getMonth()
  const today = isoDay(new Date())

  // Build grid
  const firstDow = new Date(year, month, 1).getDay()
  const daysInMonth = new Date(year, month + 1, 0).getDate()
  const cells = []
  for (let i = 0; i < firstDow; i++) cells.push(null)
  for (let d = 1; d <= daysInMonth; d++) cells.push(d)

  const nav = (dir) => setCursor(new Date(year, month + dir, 1))

  return (
    <div className="mtg-cal">
      {/* Month nav */}
      <div className="mtg-cal-nav">
        <button className="mtg-cal-nav-btn" onClick={() => nav(-1)}>
          <ChevronLeft className="w-3 h-3" />
        </button>
        <span className="mtg-cal-month">{MONTHS[month]} {year}</span>
        <button className="mtg-cal-nav-btn" onClick={() => nav(1)}>
          <ChevronRight className="w-3 h-3" />
        </button>
      </div>

      {/* Day-of-week headers */}
      <div className="mtg-cal-grid">
        {DAYS.map(d => (
          <div key={d} className="mtg-cal-dow">{d}</div>
        ))}
        {cells.map((day, i) => {
          if (!day) return <div key={`e${i}`} />
          const dateStr = `${year}-${String(month + 1).padStart(2,'0')}-${String(day).padStart(2,'0')}`
          const isToday    = dateStr === today
          const isSelected = dateStr === selectedDate
          const hasMtgs    = meetingDays.has(dateStr)
          return (
            <button
              key={dateStr}
              className={[
                'mtg-cal-day',
                isSelected ? 'mtg-cal-day--sel' : '',
                isToday && !isSelected ? 'mtg-cal-day--today' : '',
              ].join(' ').trim()}
              onClick={() => onSelect(isSelected ? null : dateStr)}
            >
              {day}
              {hasMtgs && !isSelected && <span className="mtg-cal-dot" />}
            </button>
          )
        })}
      </div>

      {selectedDate && (
        <button
          className="mtg-cal-clear"
          onClick={() => onSelect(null)}
        >
          Show all dates
        </button>
      )}
    </div>
  )
}

/* ── Recording Ring ──────────────────────────────────────────── */
function RecordingRing() {
  return (
    <div className="mtg-rec-ring" aria-label="Recording">
      <Mic className="w-3 h-3" style={{ color: 'var(--c)' }} />
    </div>
  )
}

/* ── Transcript Preview ──────────────────────────────────────── */
function TranscriptPreview({ transcript }) {
  const [open, setOpen] = useState(false)
  if (!transcript) return null
  const preview = transcript.slice(0, 300)

  return (
    <div className="mtg-transcript">
      <button
        className="mtg-transcript-toggle"
        onClick={(e) => { e.preventDefault(); setOpen(v => !v) }}
      >
        <AlignLeft className="w-3 h-3" />
        Transcript
        {open ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
      </button>
      {open && (
        <p className="mtg-transcript-body">
          {preview}{transcript.length > 300 ? '…' : ''}
        </p>
      )}
    </div>
  )
}

/* ── Meeting Row ─────────────────────────────────────────────── */
function MeetingRow({ meeting, onDelete }) {
  const status  = getMeetingStatus(meeting)
  const sentColor = getSentimentColor(meeting.sentiment_label)

  return (
    <div className="mtg-row">
      <Link to={`/meetings/${meeting.id}`} className="mtg-row-link">
        {/* Left: recording indicator */}
        <div className="mtg-row-indicator">
          {meeting.is_recording
            ? <RecordingRing />
            : (
              <VCIconBox color="crimson" size="sm">
                <Mic className="w-3 h-3" />
              </VCIconBox>
            )
          }
        </div>

        {/* Body */}
        <div className="mtg-row-body">
          {/* Title row */}
          <div className="mtg-row-title-row">
            <span className="mtg-row-title">{meeting.title}</span>
            <div className="mtg-row-chips">
              <VCBadge color={status.color} live={status.live}>{status.label}</VCBadge>
              {meeting.sentiment_label && (
                <VCBadge color={sentColor}>{meeting.sentiment_label}</VCBadge>
              )}
              {meeting.key_points?.length > 0 && (
                <VCBadge color="neutral">{meeting.key_points.length} key pts</VCBadge>
              )}
            </div>
          </div>

          {/* Inline AI summary */}
          {meeting.summary && (
            <div className="mtg-row-ai-summary">
              <Sparkles className="w-3 h-3 mtg-ai-icon" />
              <span>{meeting.summary}</span>
            </div>
          )}

          {/* Meta row */}
          <div className="mtg-row-meta">
            <span className="mtg-row-meta-item">
              <Clock className="w-3 h-3" />
              {fmtDate(meeting.created_at)}
            </span>
            {meeting.duration_minutes && (
              <span className="mtg-row-meta-item">
                {meeting.duration_minutes} min
              </span>
            )}
            {meeting.attendees?.length > 0 && (
              <span className="mtg-row-meta-item">
                <Users className="w-3 h-3" />
                {meeting.attendees.length}
              </span>
            )}
          </div>

          {/* Transcript preview */}
          <TranscriptPreview transcript={meeting.transcript} />
        </div>
      </Link>

      {/* Delete */}
      <VCButton
        variant="ghost"
        size="sm"
        className="mtg-row-delete"
        title="Delete meeting"
        onClick={(e) => { e.preventDefault(); onDelete(meeting.id, e) }}
      >
        <Trash2 className="w-4 h-4" />
      </VCButton>
    </div>
  )
}

/* ── Main Page ───────────────────────────────────────────────── */
export default function Meetings() {
  const [meetings, setMeetings]       = useState([])
  const [loading, setLoading]         = useState(true)
  const [searchQuery, setSearchQuery] = useState('')
  const [showRecorder, setShowRecorder] = useState(false)
  const [viewMode, setViewMode]       = useState('calendar') // 'calendar' | 'list'
  const [selectedDate, setSelectedDate] = useState(null)

  useEffect(() => { loadMeetings() }, [])

  const loadMeetings = async () => {
    try {
      setLoading(true)
      const data = await meetingsApi.list({ limit: 100 })
      setMeetings(data.meetings || [])
    } catch (err) {
      console.error('Failed to load meetings:', err)
    } finally {
      setLoading(false)
    }
  }

  const handleMeetingProcessed = () => { setShowRecorder(false); loadMeetings() }

  const handleDelete = useCallback(async (id, e) => {
    e.preventDefault()
    e.stopPropagation()
    if (!confirm('Delete this meeting?')) return
    try {
      await meetingsApi.delete(id)
      setMeetings(prev => prev.filter(m => m.id !== id))
    } catch (err) {
      console.error('Failed to delete meeting:', err)
    }
  }, [])

  // Build set of days that have meetings (for calendar dots)
  const meetingDays = new Set(
    meetings.map(m => m.created_at?.slice(0, 10)).filter(Boolean)
  )

  // Filter by search + selected calendar date
  const filtered = meetings.filter(m => {
    const matchSearch =
      !searchQuery ||
      m.title?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      m.summary?.toLowerCase().includes(searchQuery.toLowerCase())
    const matchDate =
      !selectedDate || m.created_at?.startsWith(selectedDate)
    return matchSearch && matchDate
  })

  return (
    <div className="meetings-page">
      {/* ── Header ── */}
      <div className="meetings-header">
        <div>
          <h1 className="meetings-title">Meetings</h1>
          <p className="meetings-sub">
            {loading ? 'Loading…' : `${meetings.length} recordings`}
          </p>
        </div>
        <div className="meetings-header-actions">
          {/* View toggle */}
          <div className="view-toggle">
            <button
              className={`view-toggle-btn ${viewMode === 'calendar' ? 'active' : ''}`}
              onClick={() => setViewMode('calendar')}
              title="Calendar view"
            >
              <Calendar className="w-4 h-4" />
            </button>
            <button
              className={`view-toggle-btn ${viewMode === 'list' ? 'active' : ''}`}
              onClick={() => setViewMode('list')}
              title="List view"
            >
              <List className="w-4 h-4" />
            </button>
          </div>
          <VCButton variant="primary" onClick={() => setShowRecorder(v => !v)}>
            <Plus className="w-4 h-4" />
            New Meeting
          </VCButton>
        </div>
      </div>

      {/* ── Recorder ── */}
      {showRecorder && (
        <div className="vc" style={{ padding: 0, marginBottom: 12 }}>
          <MeetingRecorder onMeetingProcessed={handleMeetingProcessed} />
        </div>
      )}

      {/* ── Search ── */}
      <div className="meetings-search-row">
        <div className="meetings-search">
          <Search className="meetings-search-icon" />
          <input
            type="text"
            placeholder="Search meetings…"
            className="vinput"
            style={{ paddingLeft: 36 }}
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
          />
        </div>
        <VCButton variant="secondary" size="sm">
          <Filter className="w-4 h-4" />
          Filter
        </VCButton>
      </div>

      {/* ── Body: calendar hybrid or list ── */}
      <div className={viewMode === 'calendar' ? 'meetings-body--cal' : 'meetings-body--list'}>

        {/* Calendar panel (only in calendar view) */}
        {viewMode === 'calendar' && (
          <aside className="meetings-aside">
            <MiniCalendar
              selectedDate={selectedDate}
              onSelect={setSelectedDate}
              meetingDays={meetingDays}
            />

            {/* Stat pills */}
            <div className="meetings-aside-stats">
              <div className="meetings-stat">
                <span className="meetings-stat-val">{meetings.length}</span>
                <span className="meetings-stat-lbl">Total</span>
              </div>
              <div className="meetings-stat">
                <span className="meetings-stat-val" style={{ color: 'var(--m)' }}>
                  {meetings.filter(m => m.summary).length}
                </span>
                <span className="meetings-stat-lbl">Analyzed</span>
              </div>
              <div className="meetings-stat">
                <span className="meetings-stat-val" style={{ color: 'var(--a)' }}>
                  {meetings.filter(m => m.processing).length}
                </span>
                <span className="meetings-stat-lbl">Processing</span>
              </div>
            </div>
          </aside>
        )}

        {/* Meeting list */}
        <div className="vc meetings-list">
          {loading ? (
            <div className="meetings-empty">
              <div className="spinner" />
              <p style={{ color: 'var(--t1)', marginTop: 12 }}>Loading meetings…</p>
            </div>
          ) : filtered.length === 0 ? (
            <div className="meetings-empty">
              <VCIconBox color="neutral" size="lg">
                <Mic className="w-6 h-6" />
              </VCIconBox>
              <p style={{ color: 'var(--t0)', fontWeight: 600, marginTop: 12 }}>No meetings found</p>
              <p style={{ color: 'var(--t1)', fontSize: 13 }}>
                {searchQuery
                  ? 'Try a different search term'
                  : selectedDate
                  ? 'No meetings on this day'
                  : 'Record your first meeting to get started'}
              </p>
            </div>
          ) : (
            <div className="meetings-list-inner">
              {/* Date group header when calendar date selected */}
              {selectedDate && (
                <div className="meetings-date-header">
                  <Calendar className="w-3.5 h-3.5" />
                  {new Date(selectedDate + 'T00:00:00').toLocaleDateString('en-US', {
                    weekday: 'long', month: 'long', day: 'numeric'
                  })}
                  <VCBadge color="neutral">{filtered.length}</VCBadge>
                </div>
              )}
              {filtered.map(meeting => (
                <MeetingRow key={meeting.id} meeting={meeting} onDelete={handleDelete} />
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
