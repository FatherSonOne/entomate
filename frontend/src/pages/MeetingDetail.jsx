import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react'
import { useParams, Link, useSearchParams } from 'react-router-dom'
import { Loader2, Send } from 'lucide-react'
import { meetingsApi, integrationsApi, calendarApi, reportsApi } from '../services/api'
import ActionItemsList from '../components/ActionItemsList'
import ChatChannelSelector from '../components/ChatChannelSelector'
import { useToast } from '../components/vc/ToastProvider'
import EcosystemSyncStatus from '../components/EcosystemSyncStatus'
import MeetingNotesPanel from '../components/meetings/MeetingNotesPanel'
import TranscriptPanel from '../components/meetings/TranscriptPanel'
import TimecodeButton from '../components/meetings/TimecodeButton'
import CarryForward from '../components/meetings/CarryForward'
import RecordingStatus from '../components/meetings/RecordingStatus'
import RecordingPlayer from '../components/meetings/RecordingPlayer'
import CrmSendDrawer from '../components/meetings/CrmSendDrawer'
import { canPlay, toRecordingJob } from '../services/meetingRecorderService'
import cache from '../services/apiCache'
import { clipToNotes } from '../services/searchNotesService'
import { formatClock, toSegments, toSummaryMoments } from '../services/meetingTranscriptService'
import MeetingIntelligencePanel from '../components/intelligence/MeetingIntelligencePanel'
import { BotDebrief, BotMeetingPending } from '../components/bot/BotDebrief'
import {
  TitleRule, Breadcrumbs, Section, Key, Signal, Display, Tape, Grid, Cell, Tabs, TabPanel, Drawer,
  TextInput, TextArea, Menu, useMediaQuery, PHONE_QUERY,
} from '../components/bench'
import { asList, meetingDate, meetingLengthMs, formatLength, speechDensity } from '../services/meetingView'

const TABS_ID = 'meeting'

export default function MeetingDetail() {
  const { id } = useParams()
  const toast = useToast()

  const [meeting, setMeeting] = useState(null)

  // Clip a decision or a transcript line to the Notes column on the Search page.
  const clipToSearchNotes = useCallback(async (note) => {
    try {
      await clipToNotes({ origin: 'meeting', sourceType: 'meeting', sourceId: id, sourceLabel: meeting?.title || 'Meeting', ...note })
      toast.success?.('Clipped to notes', 'Find it in the Notes column on Search.')
    } catch {
      toast.error?.('Could not clip', 'Notes are not available right now.')
    }
  }, [id, meeting?.title, toast])

  // Timed transcript lines; null for pasted or uploaded meetings, which keep the plain view.
  const transcriptSegments = useMemo(() => toSegments(meeting?.transcript_segments), [meeting?.transcript_segments])
  const summaryMoments = useMemo(() => toSummaryMoments(meeting?.summary_moments), [meeting?.summary_moments])
  // Timecodes next to decisions, key points and action items jump the transcript here.
  const [focusAtMs, setFocusAtMs] = useState(null)
  // A browser recording's audio, played under the tape; a pressed timecode or tape mark loads and plays it.
  const playerRef = useRef(null)
  const [playingAtMs, setPlayingAtMs] = useState(null)
  const playable = canPlay(meeting?.recording_job)
  // A browser recording whose minutes are still being written: empty sections say so instead of "none".
  const minutesPending = ['transcribing', 'backup'].includes(toRecordingJob(meeting?.recording_job)?.status)
  const jumpToTranscript = useCallback((atMs) => {
    setFocusAtMs(atMs)
    if (playerRef.current?.isReady()) playerRef.current.playFrom(atMs)
    // The transcript sits beside the content on desktop; on phone it is its own tab.
    if (window.matchMedia(PHONE_QUERY).matches) setTab('transcript')
  }, [])
  // A ▶ timecode or tape mark the user pressed: also loads the recording if needed, then plays from there.
  const playMoment = useCallback((atMs) => {
    if (playable && !playerRef.current?.isReady()) playerRef.current?.playFrom(atMs)
    jumpToTranscript(atMs)
  }, [playable, jumpToTranscript])
  const [tab, setTab] = useState('minutes')
  const isPhone = useMediaQuery(PHONE_QUERY)
  const [showIntel, setShowIntel] = useState(false)
  const [loading, setLoading] = useState(true)
  const [question, setQuestion] = useState('')
  const [askingQuestion, setAskingQuestion] = useState(false)
  const [answer, setAnswer] = useState(null)
  const [showCrm, setShowCrm] = useState(false)
  const [showShareModal, setShowShareModal] = useState(false)
  const [selectedChannel, setSelectedChannel] = useState('')
  const [sharing, setSharing] = useState(false)
  const [shareResult, setShareResult] = useState(null)
  const [calendarSyncing, setCalendarSyncing] = useState(false)

  // Inline edit state
  const [editingTitle, setEditingTitle] = useState(false)
  const [editTitle, setEditTitle] = useState('')
  const [editingSummary, setEditingSummary] = useState(false)
  const [editSummary, setEditSummary] = useState('')
  const [editingKeyPoints, setEditingKeyPoints] = useState(false)
  const [editKeyPoints, setEditKeyPoints] = useState('')
  const [saving, setSaving] = useState(false)

  const loadMeeting = useCallback(async () => {
    try {
      setLoading(true)
      const data = await meetingsApi.get(id)
      setMeeting(data)
    } catch (error) {
      console.error('Failed to load meeting:', error)
    } finally {
      setLoading(false)
    }
  }, [id])

  useEffect(() => {
    loadMeeting()
  }, [loadMeeting])

  // "From last time": commitments from earlier meetings with the same people or series.
  // Re-read when the attendee list changes (speaker rename turns "Speaker 1" into a name).
  const [carryForward, setCarryForward] = useState(null)
  const attendeeKey = JSON.stringify(meeting?.attendees || [])
  useEffect(() => {
    let cancelled = false
    meetingsApi.carryForward(id)
      .then((data) => { if (!cancelled) setCarryForward(data) })
      .catch(() => { if (!cancelled) setCarryForward(null) })
    return () => { cancelled = true }
  }, [id, attendeeKey])

  // ?t=<ms> (from Today's decision timecodes) jumps the transcript once the meeting has loaded.
  const [searchParams, setSearchParams] = useSearchParams()
  const startAtMs = Number(searchParams.get('t'))
  const jumpedRef = useRef(false)
  useEffect(() => {
    if (jumpedRef.current || !transcriptSegments || !Number.isFinite(startAtMs) || startAtMs <= 0) return
    jumpedRef.current = true
    requestAnimationFrame(() => jumpToTranscript(startAtMs))
  }, [transcriptSegments, startAtMs, jumpToTranscript])

  // ?share=1 (list preview, row menu) opens Share recap once the meeting is here.
  useEffect(() => {
    if (!meeting || searchParams.get('share') !== '1') return
    setShowShareModal(true)
    const next = new URLSearchParams(searchParams)
    next.delete('share')
    setSearchParams(next, { replace: true })
  }, [meeting, searchParams, setSearchParams])

  // Browser tab title: "02 Meetings · <title> · Entomate" while the page is open.
  useEffect(() => {
    if (!meeting?.title) return
    const previous = document.title
    document.title = `${meeting.title} · 02 Meetings · Entomate`
    return () => { document.title = previous }
  }, [meeting?.title])

  // A browser recording being transcribed: re-read quietly (no spinner, no cache).
  const refreshMeeting = useCallback(async () => {
    try {
      cache.invalidate(`/meetings/${id}`)
      const data = await meetingsApi.get(id)
      setMeeting(data)
    } catch (error) {
      console.error('Failed to refresh meeting:', error)
    }
  }, [id])

  const handleAskQuestion = async (e) => {
    e.preventDefault()
    if (!question.trim()) return

    try {
      setAskingQuestion(true)
      const result = await meetingsApi.ask(id, question)
      setAnswer({ ...result, question: question.trim() })
      setQuestion('')
    } catch (error) {
      console.error('Failed to ask question:', error)
      toast.error('Error', 'That question could not be answered. Try again.')
    } finally {
      setAskingQuestion(false)
    }
  }

  // Send to CRM opens a drawer that shows exactly what goes before anything leaves.
  const handleSyncToCRM = () => {
    if (!meeting.actionItems?.length) {
      toast.info('Nothing to send', 'This meeting has no action items')
      return
    }
    setShowCrm(true)
  }

  // Summary templates per meeting type (audit rec 7). Rewriting replaces the
  // summary, key points and decisions, so it only runs from the explicit key.
  const [templates, setTemplates] = useState([])
  const [templatePick, setTemplatePick] = useState('')
  const [rewriting, setRewriting] = useState(false)
  useEffect(() => {
    meetingsApi.summaryTemplates?.()
      .then((r) => setTemplates(Array.isArray(r?.templates) ? r.templates : []))
      .catch(() => setTemplates([]))
  }, [])
  useEffect(() => { setTemplatePick(meeting?.summary_template || '') }, [meeting?.summary_template])
  const handleRewriteSummary = async (template = templatePick) => {
    if (!template) return
    setTemplatePick(template)
    setRewriting(true)
    try {
      await meetingsApi.regenerateSummary(id, template)
      cache.invalidate(`/meetings/${id}`)
      setMeeting(await meetingsApi.get(id))
      toast.success('Rewritten', 'The summary was rewritten for this meeting type')
    } catch (err) {
      console.error('Failed to rewrite summary:', err)
      toast.error('Error', 'The summary could not be rewritten')
    } finally {
      setRewriting(false)
    }
  }

  // Recap email and PDF (moved here from the old Reports page, Insights pass 2026-11-22)
  const [recapBusy, setRecapBusy] = useState(null)
  const handleEmailRecap = async () => {
    setRecapBusy('email')
    try {
      const { supabase } = await import('../services/supabaseClient')
      const { data: { session } } = await supabase.auth.getSession()
      const email = session?.user?.email
      if (!email) {
        toast.error('Error', 'Could not find your email address')
        return
      }
      await reportsApi.sendMeetingRecap(id, email)
      toast.success('Sent', `Recap emailed to ${email}`)
    } catch (err) {
      console.error('Failed to email recap:', err)
      toast.error('Error', 'The recap email could not be sent')
    } finally {
      setRecapBusy(null)
    }
  }
  const handleRecapPdf = async () => {
    setRecapBusy('pdf')
    try {
      await reportsApi.downloadMeetingPDF(id)
    } catch (err) {
      console.error('Failed to download recap PDF:', err)
      toast.error('Error', 'The recap PDF could not be made')
    } finally {
      setRecapBusy(null)
    }
  }

  const handlePostToChat = async () => {
    if (!selectedChannel) {
      setShareResult({ success: false, message: 'Choose a channel first.' })
      return
    }

    try {
      setSharing(true)
      setShareResult(null)
      const result = await integrationsApi.chat.postRecap(id, selectedChannel)
      setShareResult({
        success: true,
        message: `Posted to ${result.channelId || 'chat'}`,
        provider: result.provider
      })
      loadMeeting() // Reload to update posted status
      setTimeout(() => {
        setShowShareModal(false)
        setShareResult(null)
      }, 2000)
    } catch (error) {
      console.error('Failed to post to chat:', error)
      setShareResult({
        success: false,
        message: error.message || 'Failed to post recap'
      })
    } finally {
      setSharing(false)
    }
  }

  const openShareModal = () => {
    setShareResult(null)
    setShowShareModal(true)
  }

  // Inline edit handlers
  const startEditTitle = () => {
    setEditTitle(meeting.title || '')
    setEditingTitle(true)
  }

  const saveTitle = async () => {
    if (!editTitle.trim() || editTitle === meeting.title) {
      setEditingTitle(false)
      return
    }
    try {
      setSaving(true)
      await meetingsApi.update(id, { title: editTitle.trim() })
      setMeeting(prev => ({ ...prev, title: editTitle.trim() }))
      setEditingTitle(false)
      toast.success('Saved', 'Title updated')
    } catch (err) {
      toast.error('Error', 'Failed to update title')
    } finally {
      setSaving(false)
    }
  }

  const startEditSummary = () => {
    setEditSummary(meeting.summary || '')
    setEditingSummary(true)
  }

  const saveSummary = async () => {
    if (editSummary === meeting.summary) {
      setEditingSummary(false)
      return
    }
    try {
      setSaving(true)
      await meetingsApi.update(id, { summary: editSummary })
      setMeeting(prev => ({ ...prev, summary: editSummary }))
      setEditingSummary(false)
      toast.success('Saved', 'Summary updated')
    } catch (err) {
      toast.error('Error', 'Failed to update summary')
    } finally {
      setSaving(false)
    }
  }

  const startEditKeyPoints = () => {
    setEditKeyPoints((meeting.key_points || []).join('\n'))
    setEditingKeyPoints(true)
  }

  const saveKeyPoints = async () => {
    const points = editKeyPoints.split('\n').map(p => p.trim()).filter(Boolean)
    try {
      setSaving(true)
      const updated = await meetingsApi.update(id, { key_points: points })
      // The server recomputes transcript timecodes for edited key points.
      setMeeting(prev => ({ ...prev, key_points: points, summary_moments: updated?.summary_moments ?? null }))
      setEditingKeyPoints(false)
      toast.success('Saved', 'Key points updated')
    } catch (err) {
      toast.error('Error', 'Failed to update key points')
    } finally {
      setSaving(false)
    }
  }

  const handleAddToCalendar = async () => {
    try {
      setCalendarSyncing(true)
      await calendarApi.syncMeeting(id)
      toast.success('Synced', 'Meeting added to Google Calendar')
    } catch (err) {
      toast.error('Error', err.message || 'Failed to sync to calendar')
    } finally {
      setCalendarSyncing(false)
    }
  }

  // ── Tape: the meeting's length with its decisions and action items ──
  const lengthMs = meeting ? meetingLengthMs(meeting, transcriptSegments) : 0
  const density = useMemo(() => speechDensity(transcriptSegments, lengthMs), [transcriptSegments, lengthMs])
  const decisions = asList(meeting?.decisions)
  const keyPoints = asList(meeting?.key_points)
  // Extra sections from the meeting-type template; empty ones stay hidden.
  const summarySections = (Array.isArray(meeting?.summary_sections) ? meeting.summary_sections : [])
    .filter((sec) => sec && typeof sec.title === 'string' && Array.isArray(sec.items) && sec.items.length > 0)
  const actionItems = meeting?.actionItems || []
  const decisionMarks = transcriptSegments
    ? decisions.flatMap((label, i) => (summaryMoments.decisions[i] != null ? [{ atMs: summaryMoments.decisions[i], label: `Decision: ${label}` }] : []))
    : []
  const actionMarks = transcriptSegments
    ? actionItems.flatMap((a) => (typeof a.transcript_at_ms === 'number' ? [{ atMs: a.transcript_at_ms, label: `Action: ${a.task_description}` }] : []))
    : []
  const moments = [...decisionMarks, ...actionMarks].map(m => m.atMs).sort((a, b) => a - b)
  const stepMoment = (dir) => {
    if (!moments.length) return
    const at = focusAtMs ?? (dir > 0 ? -1 : Infinity)
    const next = dir > 0 ? moments.find(m => m > at) : [...moments].reverse().find(m => m < at)
    jumpToTranscript(next ?? (dir > 0 ? moments[0] : moments[moments.length - 1]))
  }
  const showTape = Boolean(transcriptSegments && lengthMs > 0)
  // While the recording plays, the tape follows it; otherwise it shows the last jump.
  const tapeAtMs = playable && playingAtMs != null ? playingAtMs : focusAtMs

  if (loading) {
    return (
      <div className="bs-mtg-empty" aria-busy="true">
        <Signal tone="off">Loading meeting</Signal>
      </div>
    )
  }

  if (!meeting) {
    const notFound = (
      <div>
        <TitleRule title="Meeting not found" meta={<Link to="/meetings"><b>Meetings</b></Link>} />
        <div className="bs-mtg-empty">
          <p className="bs-h3">It may have been deleted, or it belongs to another workspace.</p>
          <Link to="/meetings" className="bs-key">Back to meetings</Link>
        </div>
      </div>
    )
    // A bot meeting before its minutes exist: the live view, or the minutes being written.
    return <BotMeetingPending meetingId={id} onReady={refreshMeeting} notFound={notFound} />
  }

  const date = meetingDate(meeting)
  const people = asList(meeting.attendees)
  const meta = (
    <>
      {date.toLocaleDateString('en-US', { weekday: 'short', day: 'numeric', month: 'short', year: date.getFullYear() === new Date().getFullYear() ? undefined : 'numeric' })}
      {' · '}
      {date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false })}
      {lengthMs > 0 && <> · {formatLength(lengthMs)}</>}
      {people.length > 0 && <> · {people.length} {people.length === 1 ? 'person' : 'people'}</>}
      {meeting.sentiment_label && <> · {meeting.sentiment_label}</>}
    </>
  )

  const title = editingTitle ? (
    <form
      className="bs-title-edit"
      onSubmit={(e) => { e.preventDefault(); saveTitle() }}
    >
      <label htmlFor="meeting-title-input" className="bs-sr">Meeting title</label>
      <input
        id="meeting-title-input"
        className="bs-title-input"
        value={editTitle}
        onChange={(e) => setEditTitle(e.target.value)}
        onKeyDown={(e) => { if (e.key === 'Escape') setEditingTitle(false) }}
        maxLength={255}
        autoFocus
        disabled={saving}
      />
    </form>
  ) : meeting.title

  const actions = editingTitle ? (
    <>
      <Key onClick={() => setEditingTitle(false)} disabled={saving}>Cancel</Key>
      <Key variant="primary" onClick={saveTitle} disabled={saving}>
        {saving && <Loader2 className="animate-spin" aria-hidden="true" />}Save title
      </Key>
    </>
  ) : (
    <>
      <Menu
        label="More actions"
        entries={[
          { key: 'rename', label: 'Rename', onSelect: startEditTitle },
          { key: 'cal', label: calendarSyncing ? 'Adding to calendar' : 'Add to calendar', disabled: calendarSyncing, onSelect: handleAddToCalendar },
          ...(meeting.transcript && templates.length > 0 ? [
            { kind: 'label', key: 'rw', label: rewriting ? 'Rewriting the summary' : 'Rewrite the summary as' },
            ...templates.map((t) => ({
              key: `t-${t.id}`,
              label: t.label,
              hint: t.id === (meeting.summary_template || '') ? 'Current' : undefined,
              disabled: rewriting,
              onSelect: () => handleRewriteSummary(t.id),
            })),
          ] : []),
          { kind: 'label', key: 'more', label: 'Setup' },
          { key: 'intel', label: 'Intelligence profile', onSelect: () => setShowIntel(true) },
        ]}
      />
      <Key onClick={handleSyncToCRM}>Send to CRM</Key>
      <Key variant="primary" onClick={openShareModal}>
        Share recap{meeting.chat_posted && <span className="bs-k">Posted</span>}
      </Key>
    </>
  )

  // Actions sit in Minutes beside the decisions; Ask and earlier meetings sit with the transcript.
  // On phone the transcript column becomes its own tab.
  const tabs = [
    { value: 'minutes', label: 'Minutes' },
    ...(isPhone ? [{ value: 'transcript', label: 'Transcript' }] : []),
    { value: 'notes', label: 'Notes' },
  ]
  const activeTab = !isPhone && tab === 'transcript' ? 'minutes' : tab
  // The bot debrief links "action items" here: they now live in Minutes.
  const openTab = (value) => {
    setTab(value === 'actions' ? 'minutes' : value)
    if (value === 'actions') requestAnimationFrame(() => document.getElementById('meeting-actions')?.scrollIntoView({ behavior: 'smooth', block: 'start' }))
  }

  // The context column (a tab on phone): ask, earlier commitments, the transcript, ecosystem sync.
  const context = (
    <div className="bs-mtg-context">
      <section className="bs-mtg-askbox" aria-labelledby="meeting-ask-heading">
        <h3 id="meeting-ask-heading" className="bs-sr">Ask this meeting</h3>
        <form onSubmit={handleAskQuestion} className="bs-mtg-ask">
          <label htmlFor="meeting-ask-input" className="bs-sr">Question</label>
          <TextInput
            id="meeting-ask-input"
            placeholder="Ask this meeting…"
            value={question}
            onChange={(e) => setQuestion(e.target.value)}
            disabled={askingQuestion}
          />
          <Key type="submit" disabled={askingQuestion || !question.trim()}>
            {askingQuestion ? <Loader2 className="animate-spin" aria-hidden="true" /> : <Send aria-hidden="true" />}
            Ask
          </Key>
        </form>
        {answer && (
          <div className="bs-mtg-answer" aria-live="polite">
            {answer.question && <div className="bs-lbl">Q · {answer.question}</div>}
            <p className="bs-para">{answer.answer}</p>
            {typeof answer.confidence === 'number' && (
              <div className="bs-why">
                <Signal tone="ai">Answer · {Math.round(answer.confidence * 100)}% confident</Signal>
              </div>
            )}
          </div>
        )}
      </section>
      <CarryForward data={carryForward} title="From earlier meetings" />
      {/* Transcript and sync stay in view while the minutes scroll (desktop). */}
      <div className="bs-mtg-follow">
      <section id="meeting-transcript" className="bs-mtg-transcript" aria-labelledby="meeting-transcript-heading">
        <Section
          id="meeting-transcript-heading"
          title="Transcript"
          level={3}
          aside={transcriptSegments
            ? <Signal tone={focusAtMs != null ? 'brand' : 'off'}>{focusAtMs != null ? `At ${formatClock(focusAtMs)}` : `${transcriptSegments.length} lines`}</Signal>
            : meeting.transcript ? <Signal tone="off">Plain text</Signal> : undefined}
        />
        {transcriptSegments ? (
          // Timed lines: search and speaker rename.
          <div className="bs-transcript">
            <TranscriptPanel
              meetingId={meeting.id}
              segments={transcriptSegments}
              focusAtMs={focusAtMs}
              playingAtMs={playable ? playingAtMs : null}
              onPlayFrom={playable ? (atMs) => playerRef.current?.playFrom(atMs) : undefined}
              onClip={(line) => clipToSearchNotes({ kind: 'transcript', body: line.speaker ? `${line.speaker}: ${line.text}` : line.text, atMs: line.atMs })}
              suggestions={meeting.recording_job?.speakerSuggestions}
              onRenamed={({ segments, transcript }) => {
                setMeeting(prev => ({ ...prev, transcript_segments: segments, transcript }))
                // The rename also moves attendees and action item owners on the server.
                cache.invalidate(`/meetings/${id}`)
                meetingsApi.get(id).then((fresh) => { if (fresh) setMeeting(fresh) }).catch(() => {})
              }}
            />
          </div>
        ) : (
          <div className="bs-transcript-plain">
            <pre>{meeting.transcript || 'No transcript yet.'}</pre>
          </div>
        )}
      </section>
      <div className="bs-mtg-sync">
        <EcosystemSyncStatus meetingId={id} />
      </div>
      </div>
    </div>
  )

  return (
    <div className="bs-mtg bs-mtg-detail">
      <TitleRule title={title} crumbs={<Breadcrumbs current={meeting.title || 'Untitled meeting'} />} meta={meta} actions={actions} />

      {/* While the minutes are written, RecordingStatus shows the loader with real stages for both engines. */}
      {toRecordingJob(meeting.recording_job)?.status !== 'transcribing' && (searchParams.get('debrief') || meeting.recording_job?.source === 'bot') && (
        <BotDebrief meetingId={meeting.id} forced={Boolean(searchParams.get('debrief'))} onOpenTab={openTab} onMinutesReady={refreshMeeting} onJump={playMoment} plays={playable} />
      )}

      <div className="bs-mtg-status-row">
        <RecordingStatus meetingId={meeting.id} recordingJob={meeting.recording_job} onRefresh={refreshMeeting} hasSummary={!!meeting.summary} title={meeting.title} attendees={meeting.attendees} />
      </div>

      {showTape && (
        <div className="bs-cell">
          <Display className="bs-transport">
            <span className="bs-transport-reel bs-dt" aria-hidden="true" />
            <div className="bs-transport-main">
              <div className="bs-transport-head">
                <span className="bs-lbl">
                  Tape · <span className="bs-transport-key d" aria-hidden="true" /> decision · <span className="bs-transport-key a" aria-hidden="true" /> action item
                </span>
                <span className="bs-transport-clock" aria-live="polite">
                  <b>{formatClock(tapeAtMs ?? 0)}</b> / {formatClock(lengthMs)}
                </span>
              </div>
              <Tape
                durationMs={lengthMs}
                density={density}
                decisions={decisionMarks}
                actions={actionMarks}
                progress={tapeAtMs != null ? Math.min(1, tapeAtMs / lengthMs) : 0}
                playhead={tapeAtMs != null}
                onSeek={playMoment}
                label={`Meeting tape: ${decisionMarks.length} decisions and ${actionMarks.length} action items. Choose one to ${playable ? 'play from it' : 'jump the transcript'}.`}
              />
              {/* Player slot: the synced video/audio player goes here, under the tape. */}
              {playable ? (
                <div className="bs-transport-media" data-slot="player">
                  <RecordingPlayer
                    ref={playerRef}
                    meetingId={meeting.id}
                    durationMs={meeting.recording_job?.durationMs}
                    onTime={setPlayingAtMs}
                    onAudioRemoved={refreshMeeting}
                  />
                </div>
              ) : meeting.audio_file_url && (
                <div className="bs-transport-media" data-slot="player">
                  <audio controls preload="none" src={meeting.audio_file_url}>
                    Your browser does not support the audio element.
                  </audio>
                </div>
              )}
            </div>
            <div className="bs-transport-keys">
              <Key size="sm" onDisplay onClick={() => stepMoment(-1)} disabled={!moments.length} aria-label="Previous moment">◀◀ Prev</Key>
              <Key size="sm" onDisplay onClick={() => stepMoment(1)} disabled={!moments.length} aria-label="Next moment">Next ▶▶</Key>
            </div>
          </Display>
        </div>
      )}

      <Grid>
        <Cell span={8}>
          <Tabs label="Meeting sections" idBase={TABS_ID} items={tabs} value={activeTab} onChange={setTab} />

          {activeTab === 'minutes' && (
            <TabPanel idBase={TABS_ID} value="minutes">
              <div className="bs-mtg-block">
                <Section
                  title="Summary"
                  level={3}
                  aside={!editingSummary && !minutesPending && <Key size="sm" onClick={startEditSummary}>Edit</Key>}
                />
                {editingSummary ? (
                  <div className="bs-mtg-edit">
                    <label htmlFor="meeting-summary-input" className="bs-sr">Summary</label>
                    <TextArea id="meeting-summary-input" rows={6} value={editSummary} onChange={(e) => setEditSummary(e.target.value)} disabled={saving} autoFocus />
                    <div className="bs-mtg-edit-keys">
                      <Key onClick={() => setEditingSummary(false)} disabled={saving}>Cancel</Key>
                      <Key onClick={saveSummary} disabled={saving}>
                        {saving && <Loader2 className="animate-spin" aria-hidden="true" />}Save summary
                      </Key>
                    </div>
                  </div>
                ) : meeting.summary ? (
                  <p className="bs-para">{meeting.summary}</p>
                ) : (
                  <p className="bs-para bs-mut">{minutesPending ? 'Being written. It appears here when it lands.' : 'No summary yet.'}</p>
                )}
                {rewriting && <p className="bs-mtg-none"><Signal tone="ai">Rewriting the summary</Signal></p>}
              </div>

              {summarySections.map((section) => (
                <div className="bs-mtg-block" key={section.title}>
                  <Section title={section.title} level={3} aside={String(section.items.length)} />
                  <ul className="bs-rows">
                    {section.items.map((item, index) => (
                      <li key={index} className="bs-row"><span className="bs-row-text">{item}</span></li>
                    ))}
                  </ul>
                </div>
              ))}

              <div className="bs-mtg-block">
                <Section
                  title="Decisions"
                  level={3}
                  aside={decisions.length > 0 ? `${decisions.length}${decisionMarks.length ? ' · on the tape' : ''}` : undefined}
                />
                {decisions.length === 0 ? (
                  <p className="bs-mtg-none">{minutesPending ? 'Being written.' : 'No decisions were recorded.'}</p>
                ) : (
                  <ul className="bs-rows">
                    {decisions.map((decision, index) => {
                      const at = transcriptSegments ? summaryMoments.decisions[index] : null
                      return (
                        <li key={index} className="bs-row bs-row-dec">
                          <span className="bs-tick" aria-hidden="true" />
                          <span className="bs-row-text">{decision}</span>
                          <TimecodeButton atMs={at} onJump={playMoment} label={decision} plays={playable} active={at != null && at === focusAtMs} />
                          <Key size="sm" className="bs-mtg-clip" onClick={() => clipToSearchNotes({ kind: 'decision', body: String(decision), atMs: at ?? null })} aria-label={`Clip decision to Search notes: ${decision}`}>+ Notes</Key>
                        </li>
                      )
                    })}
                  </ul>
                )}
              </div>

              <section id="meeting-actions" className="bs-mtg-block" aria-labelledby="meeting-actions-heading">
                <Section id="meeting-actions-heading" title="Action items" level={3} aside={actionItems.length ? String(actionItems.length) : undefined} />
                {actionItems.length === 0 ? (
                  <p className="bs-mtg-none">{minutesPending ? 'Being written.' : 'No action items were recorded.'}</p>
                ) : (
                  <ActionItemsList
                    items={actionItems}
                    meetingId={id}
                    onUpdate={refreshMeeting}
                    onJumpToTranscript={transcriptSegments ? playMoment : undefined}
                    timecodesPlay={playable}
                    focusAtMs={focusAtMs}
                  />
                )}
              </section>

              {(keyPoints.length > 0 || editingKeyPoints) && (
                <div className="bs-mtg-block">
                  <Section
                    title="Key points"
                    level={3}
                    aside={!editingKeyPoints && <Key size="sm" onClick={startEditKeyPoints}>Edit</Key>}
                  />
                  {editingKeyPoints ? (
                    <div className="bs-mtg-edit">
                      <label htmlFor="meeting-points-input" className="bs-lbl">One key point per line</label>
                      <TextArea id="meeting-points-input" rows={7} value={editKeyPoints} onChange={(e) => setEditKeyPoints(e.target.value)} disabled={saving} autoFocus />
                      <div className="bs-mtg-edit-keys">
                        <Key onClick={() => setEditingKeyPoints(false)} disabled={saving}>Cancel</Key>
                        <Key onClick={saveKeyPoints} disabled={saving}>
                          {saving && <Loader2 className="animate-spin" aria-hidden="true" />}Save key points
                        </Key>
                      </div>
                    </div>
                  ) : (
                    <ul className="bs-rows">
                      {keyPoints.map((point, index) => {
                        const at = transcriptSegments ? summaryMoments.keyPoints[index] : null
                        return (
                          <li key={index} className="bs-row">
                            <span className="bs-row-dash" aria-hidden="true">—</span>
                            <span className="bs-row-text">{point}</span>
                            <TimecodeButton atMs={at} onJump={playMoment} label={point} plays={playable} active={at != null && at === focusAtMs} />
                          </li>
                        )
                      })}
                    </ul>
                  )}
                </div>
              )}

            </TabPanel>
          )}

          {activeTab === 'transcript' && (
            <TabPanel idBase={TABS_ID} value="transcript">
              {context}
            </TabPanel>
          )}

          {activeTab === 'notes' && (
            <TabPanel idBase={TABS_ID} value="notes">
              <section className="bs-mtg-block" aria-labelledby="meeting-notes-heading">
                <Section id="meeting-notes-heading" title="Notes" level={3} aside="Private unless you share with the team" />
                <div className="bs-skin bs-mtg-notes">
                  <MeetingNotesPanel meetingId={id} />
                </div>
              </section>
            </TabPanel>
          )}

        </Cell>

        <Cell span={4} rule>
          {!isPhone && context}
        </Cell>
      </Grid>

      <CrmSendDrawer
        open={showCrm}
        onClose={() => setShowCrm(false)}
        items={meeting.actionItems || []}
        onSent={refreshMeeting}
      />

      {/* Intelligence profile: set-up for the agents, folded out of the old Context tab */}
      <Drawer open={showIntel} onClose={() => setShowIntel(false)} label="Intelligence profile" className="bs-drawer-wide">
        <div className="bs-mtg-block bs-skin bs-mtg-intel">
          <MeetingIntelligencePanel
            meetingId={meeting.id}
            meetingTitle={meeting.title}
            meetingDescription={meeting.description}
            meetingTags={meeting.tags}
            meetingParticipants={meeting.attendees || meeting.participants}
          />
        </div>
      </Drawer>

      {/* Share recap: a drawer on desktop, a sheet on phone */}
      <Drawer
        open={showShareModal}
        onClose={() => setShowShareModal(false)}
        label="Share recap"
        footer={(
          <>
            <Key onClick={() => setShowShareModal(false)} disabled={sharing}>Cancel</Key>
            <Key variant="primary" onClick={handlePostToChat} disabled={sharing || !selectedChannel}>
              {sharing && <Loader2 className="animate-spin" aria-hidden="true" />}
              {sharing ? 'Posting' : 'Post recap'}
            </Key>
          </>
        )}
      >
        <div className="bs-mtg-share">
          <h2 className="bs-h2">{meeting.title}</h2>
          <p className="bs-sub">Posts the summary, decisions and action items to a team chat channel. Private notes are never included.</p>
          {meeting.chat_posted && (
            <Signal tone="mint">Posted to {meeting.posted_to_channels?.join(', ') || 'chat'}</Signal>
          )}
          <div className="bs-mtg-share-field">
            <span className="bs-lbl">Channel</span>
            <div className="bs-skin">
              <ChatChannelSelector
                selectedChannel={selectedChannel}
                onChannelSelect={setSelectedChannel}
                disabled={sharing}
                showStatus={true}
              />
            </div>
          </div>
          {shareResult && (
            <p role="status">
              <Signal tone={shareResult.success ? 'mint' : 'brand'}>{shareResult.success ? 'Posted' : 'Not posted'}</Signal>{' '}
              <span className="bs-sub">{shareResult.message}</span>
            </p>
          )}
          <div className="bs-mtg-share-field">
            <span className="bs-lbl">Email or PDF</span>
            <div className="bs-mtg-share-keys">
              <Key size="sm" onClick={handleEmailRecap} disabled={recapBusy !== null}>
                {recapBusy === 'email' ? 'Sending' : 'Email me the recap'}
              </Key>
              <Key size="sm" onClick={handleRecapPdf} disabled={recapBusy !== null}>
                {recapBusy === 'pdf' ? 'Preparing' : 'Download PDF'}
              </Key>
            </div>
          </div>
        </div>
      </Drawer>
    </div>
  )
}
