import React, { useCallback, useEffect, useMemo, useState } from 'react'
import { Link, useNavigate, useOutletContext } from 'react-router-dom'
import IntelligenceDashboard from '../components/intelligence/IntelligenceDashboard'
import CarryForward from '../components/meetings/CarryForward'
import { meetingsApi, tasksApi, dashboardApi, calendarApi, learningApi } from '../services/api'
import { useKeyboardShortcuts } from '../hooks/useKeyboardShortcuts'
import { useToast } from '../components/vc/ToastProvider'
import {
  TitleRule, Grid, Cell, Section, Key, Signal, Led, Tag, Display, Readout, RuledTable, Drawer,
} from '../components/bench'
import { formatClock } from '../services/meetingTranscriptService'
import { asList, formatLength, meetingDate, meetingLengthMs, meetingStatus } from '../services/meetingView'
import {
  AGENT_NAMES, agentCalls, agentWhy, calendarEvents, callSummary, clock, dayLabel, decisionsThisWeek,
  describeCall, dueSummary, groupActionItems, hms, itemTitle, liveMeeting, nextEvent, parseDay,
  priorityConfidence, priorityTone, recordingStartedAt, startOfDay, todaySchedule,
} from '../services/todayView'
import SendBotKey from '../components/bot/SendBotKey'

/**
 * 01 Today (Bench Swiss, direction A "Bench"): what's live or next, the action items
 * your meetings produced, the calls agents made on them, this week's decisions and
 * today's schedule. Meeting prep, deal risks and relationship briefs open in a drawer.
 */

const ITEM_ROWS = 8
const CALL_ROWS = 6
const DECISION_ROWS = 6

/** A clock that ticks once a second, only while something on the page counts. */
function useNow(ticking) {
  const [now, setNow] = useState(() => new Date())
  useEffect(() => {
    if (!ticking) return undefined
    const id = setInterval(() => setNow(new Date()), 1000)
    return () => clearInterval(id)
  }, [ticking])
  return now
}

export default function Today() {
  const navigate = useNavigate()
  const toast = useToast()
  // The bench shell passes openAssistant; the legacy shells pass nothing.
  const outlet = useOutletContext()
  const openAssistant = outlet?.openAssistant

  const [meetings, setMeetings] = useState([])
  const [meetingTotal, setMeetingTotal] = useState(0)
  const [items, setItems] = useState([])
  const [taskCount, setTaskCount] = useState(0)
  const [upcoming, setUpcoming] = useState([])
  const [calendarOn, setCalendarOn] = useState(null)
  const [learning, setLearning] = useState(null)
  const [loading, setLoading] = useState(true)
  const [completing, setCompleting] = useState(() => new Set())
  const [briefOpen, setBriefOpen] = useState(false)
  const [keysOpen, setKeysOpen] = useState(false)

  const loadData = useCallback(async () => {
    setLoading(true)
    // Each region degrades on its own; say which ones failed instead of showing empty data as real.
    const failed = []
    const track = (label, fallback) => (err) => {
      failed.push(label)
      console.warn(`Today: ${label} failed to load`, err)
      return fallback
    }
    const [mtgs, actions, tasks, status, next] = await Promise.all([
      meetingsApi.list({ limit: 20 }).catch(track('meetings', { meetings: [], count: 0 })),
      dashboardApi.getActionItems({ status: 'all', sort: 'due_date', limit: 100 }).catch(track('action items', { actionItems: [] })),
      tasksApi.list({ limit: 1, status: 'open' }).catch(track('tasks', { count: 0 })),
      calendarApi.getStatus().catch(() => null),
      calendarApi.getUpcoming(2).catch(() => ({ upcoming: [] })),
    ])
    if (failed.length) toast.info('Some regions are out of date', `Couldn't refresh: ${failed.join(', ')}.`)

    setMeetings(mtgs.meetings || [])
    setMeetingTotal(mtgs.count || (mtgs.meetings || []).length)
    setItems(actions.actionItems || actions.data?.actionItems || [])
    setTaskCount(tasks.count || 0)
    setCalendarOn(status ? Boolean(status.connected) : null)
    setUpcoming(next.upcoming || next.data?.upcoming || [])
    setLoading(false)

    try {
      const res = await learningApi.getInsights()
      const ld = res?.data ?? res
      if (ld?.success) setLearning(ld.insights)
    } catch { /* learning insights are optional */ }
  }, [toast])

  useEffect(() => { loadData() }, [loadData])

  const startRecording = () => navigate('/meetings?new=true')

  useKeyboardShortcuts({
    r: { callback: () => { toast.info('Refreshing Today'); loadData() }, requireMod: false },
    n: { callback: startRecording, requireMod: false },
    t: { callback: () => navigate('/tasks'), requireMod: false },
    '?': { callback: () => setKeysOpen((v) => !v), requireMod: false },
  })

  // ── Derived view ────────────────────────────────────────────
  const events = useMemo(() => calendarEvents(upcoming), [upcoming])
  const live = useMemo(() => liveMeeting(meetings), [meetings])
  const next = useMemo(() => nextEvent(events), [events])

  // Google sign-in for the calendar, back to Today afterwards (the Calendar page is off the sidebar).
  const connectCalendar = useCallback(async () => {
    try {
      const res = await calendarApi.getAuthUrl('/dashboard')
      if (res?.authUrl) window.location.href = res.authUrl
      else toast.error('Calendar', 'Google Calendar is not set up on the server.')
    } catch {
      toast.error('Calendar', 'Could not start Google sign-in. Try again in a moment.')
    }
  }, [toast])

  // Before the next meeting: what was promised last time these people (or this series) met.
  // Without a calendar there is no next meeting, so the latest meeting anchors it instead:
  // what is still open from it and from earlier meetings with the same people or series
  // (surface audit 2026-11-22: carry-forward should not depend on a connected calendar).
  const [carryForward, setCarryForward] = useState(null)
  const latestWithPeople = useMemo(() => meetings.find((m) => m.summary) || null, [meetings])
  const anchor = useMemo(() => {
    if (next) return { key: `next|${next.id}|${next.at.getTime()}`, title: next.title, attendees: (next.attendees || []).map((a) => ({ name: a.name || null, email: a.email || null })), startsAt: next.at.toISOString(), label: `Before ${next.title}` }
    if (!latestWithPeople) return null
    const attendees = (Array.isArray(latestWithPeople.attendees) ? latestWithPeople.attendees : [])
      .map((a) => (typeof a === 'string' ? a.slice(0, 320) : a && typeof a === 'object' ? { name: a.name || a.displayName || null, email: a.email || null } : null))
      .filter(Boolean)
      .slice(0, 200)
    return { key: `latest|${latestWithPeople.id}`, title: latestWithPeople.title || '', attendees, startsAt: new Date().toISOString(), label: `Still open from ${latestWithPeople.title || 'your last meeting'}` }
  }, [next, latestWithPeople])
  const anchorKey = anchor?.key || ''
  useEffect(() => {
    if (!anchor) { setCarryForward(null); return undefined }
    let cancelled = false
    meetingsApi.carryForwardPreview({ title: anchor.title, attendees: anchor.attendees, startsAt: anchor.startsAt })
      .then((data) => { if (!cancelled) setCarryForward(data) })
      .catch(() => { if (!cancelled) setCarryForward(null) })
    return () => { cancelled = true }
  }, [anchorKey]) // keyed on the anchor, not the object
  const now = useNow(Boolean(live || next))

  // Cheap to derive; recomputed each tick so buckets roll over at midnight.
  const groups = groupActionItems(items, now, ITEM_ROWS)
  const due = useMemo(() => dueSummary(items), [items])
  const calls = useMemo(() => agentCalls(items), [items])
  const callsToday = useMemo(() => callSummary(calls), [calls])
  const decisions = useMemo(() => decisionsThisWeek(meetings), [meetings])
  const schedule = todaySchedule(meetings, events, now)
  const todayCount = schedule.length
  const latest = meetings.find((m) => m.summary) || null

  const completeItem = async (item) => {
    setCompleting((s) => new Set(s).add(item.id))
    try {
      await dashboardApi.updateActionItemStatus(item.id, 'done')
      setItems((list) => list.map((i) => (i.id === item.id ? { ...i, status: 'done' } : i)))
      toast.success('Marked done', itemTitle(item))
    } catch (err) {
      console.error('Failed to complete action item:', err)
      toast.error('Could not mark it done', err.message || 'Please try again.')
    } finally {
      setCompleting((s) => { const n = new Set(s); n.delete(item.id); return n })
    }
  }

  // ── Title rule ──────────────────────────────────────────────
  const dateWord = now.toLocaleDateString('en-US', { weekday: 'short', day: 'numeric', month: 'short' })
  const meta = (
    <>
      <b>{dateWord}</b> · {todayCount} {todayCount === 1 ? 'meeting' : 'meetings'} today · {due.open} open {due.open === 1 ? 'action' : 'actions'}
    </>
  )
  const actions = (
    <div className="bs-title-keys">
      <Key onClick={() => setBriefOpen(true)} aria-haspopup="dialog">Briefings</Key>
      {openAssistant && <Key onClick={openAssistant}>Ask Entomate</Key>}
      <Key variant="primary" onClick={startRecording}>New recording</Key>
    </div>
  )

  // ── Top row: display (live or next) or the latest outcome ──
  const renderTop = () => {
    if (live) {
      const s = meetingStatus(live)
      const started = recordingStartedAt(live)
      const recording = s.key === 'recording'
      return (
        <Display className="bs-today-disp">
          <div className="bs-today-disp-head">
            <Signal tone={recording ? 'live' : 'brand'}>{recording ? 'Live · recording' : 'Writing minutes'}</Signal>
            <span className="bs-lbl">{started ? `Started ${clock(started)}` : 'This browser'}</span>
          </div>
          <div className="bs-today-disp-main">
            <div className={`bs-disp-big ${recording ? 'bs-today-live' : ''}`}>
              {recording && started ? hms(now.getTime() - started.getTime()) : formatLength(meetingLengthMs(live))}
            </div>
            <div className="bs-today-disp-title">{live.title || 'Untitled meeting'}</div>
            <div className="bs-lbl">{recording ? 'Minutes write when you stop' : 'Summary, decisions and action items are on the way'}</div>
          </div>
          <div className="bs-today-disp-keys">
            <Key size="sm" onDisplay onClick={() => navigate(`/meetings/${live.id}`)}>Open meeting</Key>
          </div>
        </Display>
      )
    }
    if (next) {
      return (
        <Display className="bs-today-disp">
          <div className="bs-today-disp-head">
            <Signal tone="off">Next · {dayLabel(next.at, now)} {clock(next.at)}</Signal>
            <span className="bs-lbl">Google Calendar</span>
          </div>
          <div className="bs-today-disp-main">
            <div className="bs-disp-big">{hms(next.at.getTime() - now.getTime())}</div>
            <div className="bs-today-disp-title">{next.title}</div>
            <div className="bs-lbl">Starts in</div>
          </div>
          <div className="bs-today-disp-keys">
            <SendBotKey size="sm" onDisplay />
            <Key size="sm" onDisplay onClick={startRecording}>Record here</Key>
          </div>
        </Display>
      )
    }
    // Nothing live or coming up: the newest meeting's outcome, in plain type (no display).
    if (latest) {
      const d = asList(latest.decisions)
      return (
        <div className="bs-today-latest">
          <span className="bs-lbl">Latest meeting · {dayLabel(meetingDate(latest), now)} {clock(meetingDate(latest))}</span>
          <Link to={`/meetings/${latest.id}`} className="bs-h2 bs-today-latest-title">{latest.title || 'Untitled meeting'}</Link>
          <p className="bs-today-latest-sum">{latest.summary}</p>
          <div className="bs-today-latest-foot">
            <span className="bs-lbl">{d.length} {d.length === 1 ? 'decision' : 'decisions'} · {formatLength(meetingLengthMs(latest))}</span>
            <Key size="sm" onClick={() => navigate(`/meetings/${latest.id}`)}>Open minutes</Key>
          </div>
        </div>
      )
    }
    return (
      <div className="bs-today-latest">
        <Signal tone="off">{loading ? 'Loading' : 'Nothing recorded yet'}</Signal>
        <p className="bs-h3">Record a meeting in this browser, or send a bot to a call. Its decisions and action items land here.</p>
        <div className="bs-title-keys">
          <SendBotKey />
        </div>
      </div>
    )
  }

  // ── Readouts ────────────────────────────────────────────────
  const weekMeetings = meetings.filter((m) => meetingDate(m).getTime() >= startOfDay(now).getTime() - ((now.getDay() + 6) % 7) * 86_400_000)
  const readouts = [
    live && next
      ? <Readout key="next" label={`Next · ${clock(next.at)}`} value={hms(next.at.getTime() - now.getTime())} context={next.title} />
      : <Readout key="week" label="Meetings this week" value={weekMeetings.length} context={`${decisions.length} ${decisions.length === 1 ? 'decision' : 'decisions'} · ${meetingTotal} in all`} />,
    <Readout
      key="due"
      label="Due today"
      value={due.dueToday}
      context={due.overdue > 0 ? <Signal tone="brand">{due.overdue} overdue</Signal> : 'Nothing overdue'}
    />,
    <Readout
      key="calls"
      label="Agent calls today"
      value={callsToday.today}
      context={callsToday.suggested > 0
        ? <Signal tone="ai">{callsToday.suggested} need your OK</Signal>
        : <span>{taskCount} open {taskCount === 1 ? 'task' : 'tasks'} · <Link to="/tasks" className="bs-today-link">Tasks</Link></span>}
    />,
  ]

  // ── Action items table ──────────────────────────────────────
  const columns = [
    {
      key: 'done',
      header: <span className="bs-sr">Done</span>,
      className: 'bs-today-check',
      render: (item) => (
        <input
          type="checkbox"
          className="bs-check"
          checked={false}
          disabled={completing.has(item.id)}
          onChange={() => completeItem(item)}
          aria-label={`Mark "${itemTitle(item)}" done`}
        />
      ),
    },
    {
      key: 'item',
      header: 'Item',
      render: (item) => {
        const why = agentWhy(item)
        return (
          <div className="bs-today-item">
            <div className="bs-today-item-title">{itemTitle(item)}</div>
            {why && <div className="bs-why"><Led tone="ai" />{why.reason}</div>}
            {item.meetings?.title && <div className="bs-today-item-src">{item.meetings.title}</div>}
          </div>
        )
      },
    },
    { key: 'owner', header: 'Owner', secondary: true, render: (item) => item.assigned_to_name || <span className="bs-mut">—</span> },
    {
      key: 'due',
      header: 'Due',
      className: 'bs-mono bs-today-due',
      render: (item) => {
        const d = parseDay(item.due_date)
        return d ? dayLabel(d, now) : <span className="bs-mut">—</span>
      },
    },
    {
      key: 'pri',
      header: 'Priority',
      render: (item) => {
        const p = priorityTone(item.priority)
        return <Signal tone={p.tone}>{p.word}</Signal>
      },
    },
    {
      key: 'agent',
      header: 'Agent',
      secondary: true,
      align: 'right',
      render: (item) => {
        const c = priorityConfidence(item)
        return c != null ? <Tag tone="ai">AI {c}%</Tag> : <span className="bs-mut">—</span>
      },
    },
  ]
  const openItems = groups.reduce((n, g) => n + g.total, 0)

  const pendingPatterns = learning?.pendingApprovals || 0

  return (
    <div className="bs-today">
      <TitleRule title="Today" meta={meta} actions={actions} />

      <Grid>
        <Cell span={8}>{renderTop()}</Cell>
        <Cell span={4} className="bs-today-ro">{readouts}</Cell>

        {anchor && carryForward && (carryForward.openCount > 0 || carryForward.doneCount > 0) && (
          <Cell span={8}>
            <CarryForward data={carryForward} title={anchor.label} limit={4} />
          </Cell>
        )}

        <Cell span={8}>
          <Section number="01" title="Action items" aside={openItems > ITEM_ROWS ? `${ITEM_ROWS} of ${openItems} open` : 'From your meetings'} />
          <RuledTable
            caption="Open action items from your meetings"
            columns={columns}
            groups={groups.map((g) => ({ key: g.key, label: g.label, count: g.total, rows: g.rows }))}
            rowKey={(item) => item.id}
            onRowClick={(item) => item.meeting_id && navigate(`/meetings/${item.meeting_id}`)}
            empty={loading ? 'Loading action items' : 'No open action items. New ones arrive after each meeting.'}
          />
          <div className="bs-today-foot">
            <Key size="sm" onClick={() => navigate('/tasks')}>All work</Key>
          </div>
        </Cell>

        <Cell span={4} rule>
          <Section number="02" title="Agents" aside="Latest calls" />
          {calls.length === 0 && pendingPatterns === 0 ? (
            <p className="bs-today-empty">{loading ? 'Loading' : 'No agent calls yet. After a meeting, agents set each item’s priority, due date and owner, and say why.'}</p>
          ) : (
            <ul className="bs-rows">
              {calls.slice(0, CALL_ROWS).map((c) => (
                <li key={c.key} className="bs-row bs-today-call">
                  <Led tone="ai" />
                  <div className="bs-row-text">
                    <div className="bs-today-call-head">
                      <span className="bs-h3">{AGENT_NAMES[c.kind]}</span>
                      <span className="bs-lbl">{c.applied ? 'Applied' : 'Needs your OK'}</span>
                    </div>
                    {c.meetingId
                      ? <Link to={`/meetings/${c.meetingId}`} className="bs-today-call-what">{describeCall(c, now)}</Link>
                      : <span className="bs-today-call-what">{describeCall(c, now)}</span>}
                  </div>
                  <div className="bs-today-call-side">
                    <span className="bs-mono bs-mut">{dayLabel(c.at, now) === 'Today' ? clock(c.at) : dayLabel(c.at, now)}</span>
                    {c.confidence != null && <Tag tone="ai">{c.confidence}%</Tag>}
                  </div>
                </li>
              ))}
              {pendingPatterns > 0 && (
                <li className="bs-row bs-today-call">
                  <Led tone="ai" />
                  <div className="bs-row-text">
                    <div className="bs-today-call-head"><span className="bs-h3">Learning</span><span className="bs-lbl">Needs your OK</span></div>
                    <span className="bs-today-call-what">{pendingPatterns} {pendingPatterns === 1 ? 'pattern' : 'patterns'} learned from your overrides</span>
                  </div>
                  <Key size="sm" onClick={() => navigate('/settings', { state: { section: 'ai-learning' } })}>Review</Key>
                </li>
              )}
            </ul>
          )}
        </Cell>

        <Cell span={8}>
          <Section number="03" title="Decided this week" aside={`${decisions.length} ${decisions.length === 1 ? 'decision' : 'decisions'}`} />
          {decisions.length === 0 ? (
            <p className="bs-today-empty">{loading ? 'Loading' : 'No decisions recorded since Monday.'}</p>
          ) : (
            <ul className="bs-rows">
              {decisions.slice(0, DECISION_ROWS).map((d) => (
                <li key={d.key} className="bs-row bs-row-dec">
                  <span className="bs-tick" aria-hidden="true" />
                  <div className="bs-row-text">
                    <div>{d.text}</div>
                    <Link to={`/meetings/${d.meetingId}`} className="bs-today-dec-src">{d.meetingTitle} · {dayLabel(d.date, now)}</Link>
                  </div>
                  {d.atMs != null ? (
                    <Key size="tc" onClick={() => navigate(`/meetings/${d.meetingId}?t=${d.atMs}`)} aria-label={`Play "${d.text}" at ${formatClock(d.atMs)}`}>
                      ▶ {formatClock(d.atMs)}
                    </Key>
                  ) : <span />}
                </li>
              ))}
            </ul>
          )}
        </Cell>

        <Cell span={4} rule>
          <Section number="04" title="Schedule" aside={calendarOn ? <a href="https://calendar.google.com" target="_blank" rel="noopener noreferrer" className="bs-today-link">Google Calendar</a> : 'Recorded today'} />
          <ScheduleRows schedule={schedule} now={now} />
          {calendarOn === false && (
            <div className="bs-today-cal">
              <span className="bs-today-empty">Connect a calendar to see what’s coming up and count down to it.</span>
              <Key size="sm" onClick={connectCalendar}>Connect calendar</Key>
            </div>
          )}
          <button type="button" className="bs-today-keyhint bs-lbl" onClick={() => setKeysOpen(true)}>
            Press ? for shortcuts
          </button>
        </Cell>

      </Grid>

      <Drawer open={briefOpen} onClose={() => setBriefOpen(false)} label="Briefings">
        <p className="bs-today-empty">Meeting prep, deal risks and relationship notes, written by Entomate’s intelligence agents.</p>
        <div className="bs-skin bs-today-brief">
          {briefOpen && <IntelligenceDashboard />}
        </div>
      </Drawer>

      <Drawer open={keysOpen} onClose={() => setKeysOpen(false)} label="Keyboard shortcuts">
        <dl className="bs-today-keys">
          {[['R', 'Refresh Today'], ['N', 'New recording'], ['T', 'Open Tasks'], ['⌘K', 'Search'], ['?', 'Show these shortcuts']].map(([k, label]) => (
            <div key={k} className="bs-field">
              <dt><span className="bs-k">{k}</span></dt>
              <dd>{label}</dd>
            </div>
          ))}
        </dl>
      </Drawer>
    </div>
  )
}

/** Today's schedule: recorded meetings and calendar events in time order, with a NOW rule. */
function ScheduleRows({ schedule, now }) {
  if (schedule.length === 0) {
    return <p className="bs-today-empty">Nothing on today’s schedule.</p>
  }
  const nowIndex = schedule.findIndex((e) => e.at && e.at.getTime() > now.getTime())
  const rows = []
  schedule.forEach((e, i) => {
    if (i === nowIndex) rows.push(<li key="now" className="bs-today-now" aria-label={`Now, ${clock(now)}`}><span>Now</span><i /></li>)
    rows.push(
      <li key={e.key} className="bs-row bs-today-sched">
        <span className="bs-mono bs-mut">{e.at ? clock(e.at) : 'All day'}</span>
        <div className="bs-row-text">
          {e.meetingId ? <Link to={`/meetings/${e.meetingId}`} className="bs-today-link">{e.title}</Link> : e.title}
        </div>
        <Signal tone={e.tone}>{e.word}</Signal>
      </li>
    )
  })
  if (nowIndex === -1) rows.push(<li key="now" className="bs-today-now" aria-label={`Now, ${clock(now)}`}><span>Now</span><i /></li>)
  return <ul className="bs-rows">{rows}</ul>
}
