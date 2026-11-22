import React, { useState, useEffect, useMemo, useRef } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { Search, Loader2 } from 'lucide-react'
import MeetingRecorder from '../components/meetings/MeetingRecorder'
import { meetingsApi, settingsApi } from '../services/api'
import { useConfirm } from '../components/vc/ConfirmDialog'
import { useToast } from '../components/vc/ToastProvider'
import {
  TitleRule, Section, Key, Switch, Signal, Tape, RuledTable, DateStamp, TextInput,
} from '../components/bench'
import { toSegments } from '../services/meetingTranscriptService'
import {
  asList, attendeeLine, decisionMarkers, formatLength, groupByTime, matchesFilter,
  meetingDate, meetingLengthMs, meetingStatus, speechDensity,
} from '../services/meetingView'

const PAGE_SIZE = 20

const FILTERS = [
  { value: 'all', label: 'All' },
  { value: 'live', label: 'Live' },
  { value: 'ready', label: 'Ready' },
  { value: 'attention', label: 'Attention' },
]

const isThisWeek = (d) => {
  const now = new Date()
  const start = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  start.setDate(start.getDate() - ((start.getDay() + 6) % 7))
  return d.getTime() >= start.getTime()
}

export default function Meetings() {
  const confirm = useConfirm()
  const toast = useToast()
  const navigate = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()
  const [meetings, setMeetings] = useState([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(true)
  const [loadingMore, setLoadingMore] = useState(false)
  const [hasMore, setHasMore] = useState(false)
  const [error, setError] = useState(null)
  const [searchQuery, setSearchQuery] = useState('')
  const [filter, setFilter] = useState('all')
  const [showRecorder, setShowRecorder] = useState(searchParams.get('new') === 'true')
  const [audioInputDeviceId, setAudioInputDeviceId] = useState('')
  const [selectionMode, setSelectionMode] = useState(false)
  const [selectedIds, setSelectedIds] = useState(new Set())
  const [bulkDeleting, setBulkDeleting] = useState(false)

  const searchTimer = useRef(null)
  const recorderRef = useRef(null)

  useEffect(() => {
    // Load user's preferred audio device
    settingsApi.getUser().then(res => {
      const deviceId = res?.settings?.meetings_json?.audioInputDeviceId
      if (deviceId) setAudioInputDeviceId(deviceId)
    }).catch(() => {})
  }, [])

  // The rail's record key (and the phone dock) land here with ?new=true.
  useEffect(() => {
    if (searchParams.get('new') !== 'true') return
    setShowRecorder(true)
    const next = new URLSearchParams(searchParams)
    next.delete('new')
    setSearchParams(next, { replace: true })
    requestAnimationFrame(() => recorderRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }))
  }, [searchParams, setSearchParams])

  // Debounced server-side search (also the first load)
  useEffect(() => {
    if (searchTimer.current) clearTimeout(searchTimer.current)
    searchTimer.current = setTimeout(() => {
      loadMeetings(searchQuery)
    }, searchQuery ? 300 : 0)
    return () => clearTimeout(searchTimer.current)
  }, [searchQuery])

  const loadMeetings = async (search = '') => {
    try {
      setLoading(true)
      setError(null)
      const params = { limit: PAGE_SIZE, offset: 0 }
      if (search.trim()) params.search = search.trim()
      const data = await meetingsApi.list(params)
      setMeetings(data.meetings || [])
      setTotal(data.count || (data.meetings || []).length)
      setHasMore(data.hasMore || false)
    } catch (err) {
      console.error('Failed to load meetings:', err)
      setError('The meetings could not be loaded.')
    } finally {
      setLoading(false)
    }
  }

  const loadMoreMeetings = async () => {
    try {
      setLoadingMore(true)
      const params = { limit: PAGE_SIZE, offset: meetings.length }
      if (searchQuery.trim()) params.search = searchQuery.trim()
      const data = await meetingsApi.list(params)
      setMeetings(prev => [...prev, ...(data.meetings || [])])
      setHasMore(data.hasMore || false)
    } catch (err) {
      console.error('Failed to load more meetings:', err)
      toast.error('Error', 'More meetings could not be loaded')
    } finally {
      setLoadingMore(false)
    }
  }

  const handleMeetingProcessed = () => {
    loadMeetings(searchQuery)
  }

  const handleDelete = async (meeting) => {
    const ok = await confirm({ title: 'Delete meeting', message: `Delete "${meeting.title}"? Its transcript, notes and action items go too.`, confirmLabel: 'Delete', variant: 'danger' })
    if (!ok) return

    try {
      await meetingsApi.delete(meeting.id)
      setMeetings(prev => prev.filter(m => m.id !== meeting.id))
      setTotal(t => Math.max(0, t - 1))
      toast.success('Deleted', 'Meeting removed')
    } catch (err) {
      console.error('Failed to delete meeting:', err)
      toast.error('Error', 'The meeting could not be deleted')
    }
  }

  const toggleSelect = (id) => {
    setSelectedIds(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const visible = useMemo(() => meetings.filter(m => matchesFilter(m, filter)), [meetings, filter])
  const groups = useMemo(() => groupByTime(visible), [visible])

  const allSelected = visible.length > 0 && visible.every(m => selectedIds.has(m.id))
  const toggleSelectAll = () => {
    setSelectedIds(allSelected ? new Set() : new Set(visible.map(m => m.id)))
  }

  const exitSelectionMode = () => {
    setSelectionMode(false)
    setSelectedIds(new Set())
  }

  const handleBulkDelete = async () => {
    if (selectedIds.size === 0) return

    const ok = await confirm({
      title: 'Delete selected',
      message: `Delete ${selectedIds.size} meeting(s)? Their transcripts, notes and action items go too.`,
      confirmLabel: 'Delete all',
      variant: 'danger'
    })
    if (!ok) return

    try {
      setBulkDeleting(true)
      await Promise.all([...selectedIds].map(id => meetingsApi.delete(id)))
      setMeetings(prev => prev.filter(m => !selectedIds.has(m.id)))
      setTotal(t => Math.max(0, t - selectedIds.size))
      toast.success('Deleted', `${selectedIds.size} meeting(s) removed`)
      exitSelectionMode()
    } catch (err) {
      toast.error('Error', 'Some meetings could not be deleted')
      loadMeetings(searchQuery)
    } finally {
      setBulkDeleting(false)
    }
  }

  const handleBulkExport = () => {
    const selected = meetings.filter(m => selectedIds.has(m.id))
    const markdown = selected.map(m => {
      let md = `# ${m.title}\n`
      md += `**Date:** ${new Date(m.created_at).toLocaleDateString()}\n`
      if (m.duration_minutes) md += `**Duration:** ${m.duration_minutes} min\n`
      if (m.attendees?.length) md += `**Attendees:** ${m.attendees.join(', ')}\n`
      md += `**Sentiment:** ${m.sentiment_label || 'Unknown'}\n\n`
      if (m.summary) md += `## Summary\n${m.summary}\n\n`
      if (m.key_points?.length) {
        md += `## Key Points\n${m.key_points.map(p => `- ${p}`).join('\n')}\n\n`
      }
      if (m.decisions?.length) {
        md += `## Decisions\n${m.decisions.map(d => `- ${d}`).join('\n')}\n\n`
      }
      return md
    }).join('\n---\n\n')

    const blob = new Blob([markdown], { type: 'text/markdown' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `meetings-export-${new Date().toISOString().split('T')[0]}.md`
    a.click()
    URL.revokeObjectURL(url)
    toast.success('Exported', `${selected.length} meeting(s) exported`)
  }

  // Title meta: totals from the server, this week's figures from the loaded rows.
  const week = meetings.filter(m => isThisWeek(meetingDate(m)))
  const weekMs = week.reduce((n, m) => n + meetingLengthMs(m), 0)
  const weekDecisions = week.reduce((n, m) => n + asList(m.decisions).length, 0)

  const columns = [
    ...(selectionMode ? [{
      key: 'sel',
      header: <span className="bs-sr">Selected</span>,
      className: 'bs-mtg-sel',
      render: (m) => (
        <input
          type="checkbox"
          className="bs-check"
          checked={selectedIds.has(m.id)}
          onChange={() => toggleSelect(m.id)}
          aria-label={`Select ${m.title}`}
        />
      ),
    }] : []),
    {
      key: 'date',
      header: 'Date',
      className: 'bs-mtg-date',
      render: (m) => <DateStamp date={meetingDate(m)} />,
    },
    {
      key: 'meeting',
      header: 'Meeting',
      render: (m) => {
        const people = attendeeLine(m)
        const time = meetingDate(m).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false })
        return (
          <div className="bs-mtg-name">
            <Link to={`/meetings/${m.id}`} className="bs-h3 bs-mtg-link">{m.title || 'Untitled meeting'}</Link>
            <div className="bs-mtg-sub">
              <span className="bs-mono">{time}</span>
              {people && <> · {people}</>}
            </div>
          </div>
        )
      },
    },
    {
      key: 'tape',
      header: 'Tape · decisions',
      secondary: true,
      className: 'bs-mtg-tape',
      render: (m) => {
        // Only meetings with timed lines have a tape: the meter is real speech, the ticks real moments.
        const segments = toSegments(m.transcript_segments)
        const length = meetingLengthMs(m, segments)
        if (!segments || !length) return <span className="bs-mut">—</span>
        const marks = decisionMarkers(m)
        return (
          <Tape
            durationMs={length}
            density={speechDensity(segments, length, 56)}
            decisions={marks}
            label={`${marks.length} decisions on a ${formatLength(length)} tape`}
          />
        )
      },
    },
    {
      key: 'len',
      header: 'Length',
      secondary: true,
      align: 'right',
      className: 'bs-num',
      render: (m) => formatLength(meetingLengthMs(m)),
    },
    {
      key: 'dec',
      header: 'Dec.',
      secondary: true,
      align: 'right',
      className: 'bs-num',
      render: (m) => asList(m.decisions).length || <span className="bs-mut">—</span>,
    },
    {
      key: 'status',
      header: 'Status',
      className: 'bs-mtg-status',
      render: (m) => {
        const s = meetingStatus(m)
        return <Signal tone={s.tone}>{s.word}</Signal>
      },
    },
    ...(!selectionMode ? [{
      key: 'del',
      header: <span className="bs-sr">Delete</span>,
      secondary: true,
      className: 'bs-mtg-del',
      render: (m) => (
        <Key size="sm" onClick={() => handleDelete(m)} aria-label={`Delete ${m.title}`}>Delete</Key>
      ),
    }] : []),
  ]

  const actions = selectionMode ? (
    <>
      <Key onClick={toggleSelectAll}>{allSelected ? 'Clear all' : 'Select all'}</Key>
      <Key onClick={handleBulkExport} disabled={selectedIds.size === 0}>Export {selectedIds.size}</Key>
      <Key variant="primary" onClick={handleBulkDelete} disabled={selectedIds.size === 0 || bulkDeleting}>
        {bulkDeleting && <Loader2 className="animate-spin" aria-hidden="true" />}
        Delete {selectedIds.size}
      </Key>
      <Key onClick={exitSelectionMode}>Done</Key>
    </>
  ) : (
    <>
      <Switch label="Filter meetings" options={FILTERS} value={filter} onChange={setFilter} />
      <div className="bs-title-keys">
        {meetings.length > 0 && <Key onClick={() => setSelectionMode(true)}>Select</Key>}
        <Key onClick={() => navigate('/bot-launcher')}>Send a bot</Key>
        {/* While the recorder is open its Start key is the view's one primary key. */}
        <Key variant={showRecorder ? 'plain' : 'primary'} onClick={() => setShowRecorder(v => !v)} aria-expanded={showRecorder}>
          {showRecorder ? 'Close recorder' : 'New meeting'}
        </Key>
      </div>
    </>
  )

  return (
    <div className="bs-mtg">
      <TitleRule
        title="Meetings"
        meta={<><b>{total} meetings</b> · {week.length} this week · {formatLength(weekMs)} recorded · {weekDecisions} decisions</>}
        actions={actions}
      />

      {showRecorder && (
        // The panel stays open after recording: it offers the video download and a link to the meeting.
        <section ref={recorderRef} className="bs-mtg-recorder" aria-label="New meeting">
          <Section title="New meeting" level={3} aside={<Signal tone="off">In this browser · no bot</Signal>} />
          <div className="bs-skin">
            <MeetingRecorder onRecorded={handleMeetingProcessed} audioInputDeviceId={audioInputDeviceId} />
          </div>
        </section>
      )}

      <div className="bs-mtg-search">
        <TextInput
          type="search"
          icon={<Search />}
          placeholder="Search titles, summaries and transcripts"
          aria-label="Search meetings"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
        />
        {searchQuery && <Key onClick={() => setSearchQuery('')}>Clear</Key>}
      </div>

      <div className="bs-mtg-list" aria-busy={loading || undefined}>
        {loading ? (
          <div className="bs-mtg-empty">
            <Signal tone="brand">Loading meetings</Signal>
          </div>
        ) : error ? (
          <div className="bs-mtg-empty">
            <Signal tone="brand">Error</Signal>
            <p className="bs-h3">{error}</p>
            <Key onClick={() => loadMeetings(searchQuery)}>Try again</Key>
          </div>
        ) : visible.length === 0 ? (
          <div className="bs-mtg-empty">
            <Signal tone="off">{searchQuery || filter !== 'all' ? 'No matches' : 'No meetings yet'}</Signal>
            <p className="bs-h3">
              {searchQuery
                ? 'Nothing matches that search.'
                : filter !== 'all'
                  ? 'No loaded meeting has this status.'
                  : 'Record one in this browser, or send a bot to a call.'}
            </p>
            {!searchQuery && filter === 'all' && (
              <div className="bs-title-keys">
                <Key onClick={() => navigate('/bot-launcher')}>Send a bot</Key>
                <Key onClick={() => setShowRecorder(true)}>Record now</Key>
              </div>
            )}
          </div>
        ) : (
          <>
            <RuledTable
              caption="Meetings"
              columns={columns}
              groups={groups.map(g => ({ key: g.key, label: g.label, count: g.rows.length, rows: g.rows }))}
              rowKey={(m) => m.id}
              onRowClick={(m) => (selectionMode ? toggleSelect(m.id) : navigate(`/meetings/${m.id}`))}
            />
            <div className="bs-mtg-more">
              <span className="bs-lbl">{meetings.length} of {total} loaded</span>
              {hasMore && (
                <Key onClick={loadMoreMeetings} disabled={loadingMore}>
                  {loadingMore && <Loader2 className="animate-spin" aria-hidden="true" />}
                  {loadingMore ? 'Loading' : 'Load more'}
                </Key>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  )
}
