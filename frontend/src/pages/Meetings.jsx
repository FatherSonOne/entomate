import React, { useState, useEffect, useMemo, useRef } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { Search, Loader2 } from 'lucide-react'
import { ExternalLinkIcon } from '../components/icons/ExternalLinkIcon'
import MeetingRecorder from '../components/meetings/MeetingRecorder'
import InlineRename from '../components/meetings/InlineRename'
import MeetingPreview from '../components/meetings/MeetingPreview'
import { useAuth } from '../contexts/AuthContext'
import { meetingsApi, settingsApi } from '../services/api'
import { useToast } from '../components/vc/ToastProvider'
import {
  TitleRule, Section, Key, Switch, Signal, RuledTable, DateStamp, TextInput, Menu,
} from '../components/bench'
import {
  actionCounts, attendeeLine, firstDecision, formatLength, groupByTime, matchesFilter,
  meetingDate, meetingLengthMs, meetingStatus, plural, isAutoTitle } from '../services/meetingView'
import SendBotKey from '../components/bot/SendBotKey'

const PAGE_SIZE = 20
/** How long a delete can be undone before it reaches the server. */
const UNDO_MS = 8000

const meetingsWord = (n) => `${n} ${n === 1 ? 'meeting' : 'meetings'}`

const FILTERS = [
  { value: 'all', label: 'All' },
  { value: 'live', label: 'Live' },
  { value: 'ready', label: 'Ready' },
  { value: 'attention', label: 'Needs you' },
]

const isThisWeek = (d) => {
  const now = new Date()
  const start = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  start.setDate(start.getDate() - ((start.getDay() + 6) % 7))
  return d.getTime() >= start.getTime()
}

export default function Meetings() {
  const toast = useToast()
  const navigate = useNavigate()
  const { user } = useAuth()
  // The meeting whose preview has slid out beside the list.
  const [previewId, setPreviewId] = useState(null)
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
  // Deletes wait UNDO_MS before reaching the server: { rows, timer, toastId }
  const pendingDelete = useRef(null)

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
    // Bring the recorder into view and move focus to it, so the next step
    // (choose what to record, confirm consent, Start recording) is where the user is.
    requestAnimationFrame(() => {
      recorderRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
      recorderRef.current?.focus({ preventScroll: true })
    })
  }, [searchParams, setSearchParams])

  // Debounced server-side search (also the first load)
  useEffect(() => {
    if (searchTimer.current) clearTimeout(searchTimer.current)
    searchTimer.current = setTimeout(() => {
      loadMeetings(searchQuery)
    }, searchQuery ? 300 : 0)
    return () => clearTimeout(searchTimer.current)
  }, [searchQuery, filter])

  const loadMeetings = async (search = '') => {
    try {
      setLoading(true)
      // A delete still in its undo window is on the server until it commits: send it first,
      // or the reload brings the row back and it stays as a ghost after the delete lands.
      await commitDelete()
      setError(null)
      const params = { limit: PAGE_SIZE, offset: 0 }
      if (search.trim()) params.search = search.trim()
      if (filter !== 'all') params.status = filter
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
      // Same reason, and the offset counts only rows the server still has.
      await commitDelete()
      const params = { limit: PAGE_SIZE, offset: meetings.length }
      if (searchQuery.trim()) params.search = searchQuery.trim()
      if (filter !== 'all') params.status = filter
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

  // Send a pending delete to the server now. Failed rows come back with their titles named.
  const commitDelete = async () => {
    const pending = pendingDelete.current
    if (!pending) return
    pendingDelete.current = null
    clearTimeout(pending.timer)
    // Committed early (a second delete, a reload): its Undo no longer applies.
    toast.dismiss(pending.toastId)
    const results = await Promise.allSettled(pending.rows.map(m => meetingsApi.delete(m.id)))
    const failed = pending.rows.filter((_, i) => results[i].status === 'rejected')
    if (failed.length === 0) return
    setMeetings(prev => [...prev, ...failed].sort((a, b) => meetingDate(b) - meetingDate(a)))
    setTotal(t => t + failed.length)
    const names = failed.slice(0, 3).map(m => `"${m.title || 'Untitled meeting'}"`).join(', ')
    toast.error(
      failed.length === 1 ? 'Not deleted' : `${meetingsWord(failed.length)} not deleted`,
      `${names}${failed.length > 3 ? ` and ${failed.length - 3} more` : ''} could not be deleted. They're back in the list.`,
    )
  }

  // Undo only the delete this toast was for, never a later one.
  const undoDelete = (pending) => {
    if (!pending || pendingDelete.current !== pending) return
    pendingDelete.current = null
    clearTimeout(pending.timer)
    toast.dismiss(pending.toastId)
    setMeetings(prev => [...prev, ...pending.rows].sort((a, b) => meetingDate(b) - meetingDate(a)))
    setTotal(t => t + pending.rows.length)
  }

  // Remove rows at once; the server delete waits UNDO_MS so it can be undone.
  const deleteWithUndo = (rows) => {
    if (rows.length === 0) return
    if (pendingDelete.current) commitDelete()
    const ids = new Set(rows.map(m => m.id))
    setMeetings(prev => prev.filter(m => !ids.has(m.id)))
    setTotal(t => Math.max(0, t - rows.length))
    const entry = { rows, toastId: null, timer: null }
    entry.toastId = toast.show({
      title: rows.length === 1 ? 'Meeting deleted' : `${meetingsWord(rows.length)} deleted`,
      message: rows.length === 1
        ? `"${rows[0].title || 'Untitled meeting'}" and its transcript, notes and action items.`
        : 'With their transcripts, notes and action items.',
      color: 'mint',
      duration: UNDO_MS,
      action: { label: 'Undo', onClick: () => undoDelete(entry) },
    })
    entry.timer = setTimeout(commitDelete, UNDO_MS)
    pendingDelete.current = entry
  }

  // Leaving the page sends any delete that is still waiting.
  useEffect(() => () => { if (pendingDelete.current) commitDelete() }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const handleDelete = (meeting) => deleteWithUndo([meeting])

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

  const startSelectionMode = () => {
    setPreviewId(null)
    setSelectionMode(true)
  }

  const exitSelectionMode = () => {
    setSelectionMode(false)
    setSelectedIds(new Set())
  }

  const handleBulkDelete = () => {
    if (selectedIds.size === 0) return
    deleteWithUndo(meetings.filter(m => selectedIds.has(m.id)))
    exitSelectionMode()
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
    toast.success('Exported', `${meetingsWord(selected.length)} exported`)
  }

  // Title meta: totals from the server, this week's figures from the loaded rows.
  const week = meetings.filter(m => isThisWeek(meetingDate(m)))
  const weekMs = week.reduce((n, m) => n + meetingLengthMs(m), 0)

  const renameMeeting = async (id, title) => {
    await meetingsApi.update(id, { title })
    setMeetings(prev => prev.map(m => (m.id === id ? { ...m, title } : m)))
  }

  const previewRow = previewId ? meetings.find(m => m.id === previewId) || null : null

  // Keyboard: ↓/j and ↑/k move through the list with the preview following, Enter opens
  // the previewed meeting, Esc (handled by the panel) closes it. Ignored while typing,
  // inside a menu, or with a modifier held.
  const order = useMemo(() => groups.flatMap(g => g.rows), [groups])
  useEffect(() => {
    if (selectionMode) return undefined
    const onKey = (e) => {
      if (e.defaultPrevented || e.metaKey || e.ctrlKey || e.altKey) return
      const t = e.target
      if (t instanceof HTMLElement && (t.isContentEditable || t.closest('input, textarea, select, [role="menu"], [role="dialog"]'))) return
      const down = e.key === 'ArrowDown' || e.key === 'j'
      const up = e.key === 'ArrowUp' || e.key === 'k'
      if (down || up) {
        if (!order.length) return
        e.preventDefault()
        const at = order.findIndex(m => m.id === previewId)
        const next = at === -1 ? (down ? 0 : order.length - 1) : Math.min(order.length - 1, Math.max(0, at + (down ? 1 : -1)))
        setPreviewId(order[next].id)
        requestAnimationFrame(() => document.querySelector('tr[aria-selected="true"]')?.scrollIntoView({ block: 'nearest' }))
        return
      }
      if (e.key === 'Enter' && previewId && !(t instanceof HTMLElement && t.closest('a, button, tr'))) {
        e.preventDefault()
        navigate(`/meetings/${previewId}`)
      }
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [order, previewId, selectionMode, navigate])

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
      header: 'Meeting · first decision',
      render: (m) => {
        const people = attendeeLine(m)
        const time = meetingDate(m).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false })
        const dec = firstDecision(m)
        const { mine } = actionCounts(m)
        const status = meetingStatus(m)
        return (
          <div className="bs-mtg-name">
            <div className="bs-mtg-titlerow">
              <Link to={`/meetings/${m.id}`} className="bs-h3 bs-mtg-link">{m.title || 'Untitled meeting'}</Link>
              {!selectionMode && isAutoTitle(m.title) && (
                <InlineRename title={m.title || 'Untitled meeting'} onSave={(t) => renameMeeting(m.id, t)} />
              )}
            </div>
            <div className="bs-mtg-sub">
              <span className="bs-mono">{time}</span>
              {people && <> · {people}</>}
            </div>
            {dec ? (
              <p className="bs-mtg-dec">
                <span className="bs-tick" aria-hidden="true" />
                <span>{dec.text}{dec.more > 0 && <span className="bs-mtg-dec-more"> +{dec.more} more</span>}</span>
              </p>
            ) : status.key === 'ready' || status.key === 'posted' ? (
              <p className="bs-mtg-dec bs-mut">No decisions recorded.</p>
            ) : null}
            {mine > 0 && <p className="bs-mtg-mine bs-ph-only">{mine} on you</p>}
          </div>
        )
      },
    },
    {
      key: 'actions',
      header: 'Actions',
      secondary: true,
      className: 'bs-mtg-acts',
      render: (m) => {
        const { total, open, mine } = actionCounts(m)
        if (!total) return <span className="bs-mut">—</span>
        return (
          <>
            <span>{open ? `${open} open` : plural(total, 'action')}</span>
            {mine > 0 && <span className="bs-mtg-acts-mine">{mine} on you</span>}
          </>
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
      key: 'status',
      header: 'Status',
      className: 'bs-mtg-status',
      render: (m) => {
        const s = meetingStatus(m)
        return <Signal tone={s.tone}>{s.word}</Signal>
      },
    },
    ...(!selectionMode ? [{
      key: 'more',
      header: <span className="bs-sr">More</span>,
      className: 'bs-mtg-more-col',
      render: (m) => (
        <span className="bs-mtg-rowkeys">
        <Link
          to={`/meetings/${m.id}`}
          className="bs-key sm bs-mtg-open"
          aria-label={`Open ${m.title || 'this meeting'}`}
          title="Open meeting"
        >
          <ExternalLinkIcon size={15} aria-hidden="true" />
        </Link>
        <Menu
          label={`More for ${m.title || 'this meeting'}`}
          entries={[
            { key: 'open', label: 'Open meeting', onSelect: () => navigate(`/meetings/${m.id}`) },
            { key: 'share', label: 'Share recap', onSelect: () => navigate(`/meetings/${m.id}?share=1`) },
            { key: 'del', label: 'Delete', hint: 'Undo for 8s', danger: true, onSelect: () => { if (previewId === m.id) setPreviewId(null); handleDelete(m) } },
          ]}
        />
        </span>
      ),
    }] : []),
  ]

  const actions = selectionMode ? (
    <>
      <Key onClick={toggleSelectAll}>{allSelected ? 'Clear all' : 'Select all'}</Key>
      <Key onClick={handleBulkExport} disabled={selectedIds.size === 0}>Export {selectedIds.size}</Key>
      <Key variant="danger" onClick={handleBulkDelete} disabled={selectedIds.size === 0}>
        Delete {selectedIds.size}
      </Key>
      <Key onClick={exitSelectionMode}>Done</Key>
    </>
  ) : (
    <>
      <Switch label="Filter meetings" options={FILTERS} value={filter} onChange={setFilter} />
      <div className="bs-title-keys">
        {meetings.length > 0 && <Key onClick={startSelectionMode}>Select</Key>}
        {/* Sending the bot is the main way in; while the recorder is open its Start key is the one primary key. */}
        <SendBotKey variant={showRecorder ? 'plain' : 'primary'} />
        <Key onClick={() => setShowRecorder(v => !v)} aria-expanded={showRecorder}>
          {showRecorder ? 'Close recorder' : 'Record'}
        </Key>
      </div>
    </>
  )

  return (
    <div className="bs-mtg">
      <TitleRule
        title="Meetings"
        meta={<><b>{total} meetings</b> · {week.length} this week · {formatLength(weekMs)} recorded</>}
        actions={actions}
      />

      {showRecorder && (
        // The panel stays open after recording: it offers the video download and a link to the meeting.
        <section ref={recorderRef} tabIndex={-1} className="bs-mtg-recorder" aria-label="New meeting">
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
                  ? 'No meeting has this status.'
                  : 'Record one in this browser, or send a bot to a call.'}
            </p>
            {!searchQuery && filter === 'all' && (
              <div className="bs-title-keys">
                <SendBotKey />
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
              selectedKey={selectionMode ? null : previewId}
              onRowClick={(m) => (selectionMode ? toggleSelect(m.id) : setPreviewId(m.id))}
            />
            <div className="bs-mtg-more">
              <span className="bs-lbl">{meetings.length} of {total} loaded<span className="bs-mtg-keyhint"> · ↑ ↓ to preview · Enter to open</span></span>
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
      <MeetingPreview meeting={previewRow} onClose={() => setPreviewId(null)} myEmail={user?.email} />
    </div>
  )
}
