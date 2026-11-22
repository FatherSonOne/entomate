/**
 * Meeting-page parts for bot meetings.
 *
 * BotDebrief: the band at the top of a bot meeting after the call: the
 * pipeline display, the figures, and where each piece went. It shows when
 * the app moved here after a call (?debrief=1) or for a day after the call
 * until dismissed.
 *
 * BotMeetingPending: the meeting page before the meeting exists (the bot is
 * still in the call, or the minutes are being written). It polls and hands
 * over to the real meeting the moment it's saved.
 */

import React, { useCallback, useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { botsApi } from '../../services/api'
import { Breadcrumbs, Key, Signal, TitleRule } from '../bench'
import { BotPipelineDisplay } from './BotDisplays'
import TimecodeButton from '../meetings/TimecodeButton'
import BotLive from './BotLive'
import DebriefLoader from './DebriefLoader'
import { formatElapsed, isActive, markSeen, phaseSignal, runTitle } from '../../services/botView'

const DAY_MS = 24 * 60 * 60 * 1000
const dismissKey = (meetingId) => `entomate.bot.debriefDismissed.${meetingId}`

function storage() {
  try { return window.localStorage } catch { return null }
}

/** The session behind a meeting, re-read every `everyMs` while `poll` says so. */
export function useBotSession(meetingId, { poll } = {}) {
  const [state, setState] = useState({ view: null, canControl: false, loaded: false })
  const load = useCallback(async () => {
    try {
      const res = await botsApi.forMeeting(meetingId)
      setState({ view: res?.session || null, canControl: Boolean(res?.canControl), loaded: true })
    } catch {
      setState((s) => ({ ...s, loaded: true }))
    }
  }, [meetingId])
  useEffect(() => { load() }, [load])
  const everyMs = poll ? poll(state.view) : 0
  useEffect(() => {
    if (!everyMs) return undefined
    const t = window.setInterval(load, everyMs)
    return () => window.clearInterval(t)
  }, [everyMs, load])
  return { ...state, reload: load }
}

export function BotDebrief({ meetingId, forced, onOpenTab, onMinutesReady, onJump, plays = false }) {
  const { view } = useBotSession(meetingId, {
    poll: (v) => (v && v.phase === 'processing' ? 5000 : 0),
  })
  const [dismissed, setDismissed] = useState(() => storage()?.getItem(dismissKey(meetingId)) === '1')

  useEffect(() => {
    if (view?.sessionId) markSeen(storage(), view.sessionId)
  }, [view?.sessionId])

  // The page loaded while the summary was still writing: re-read it once it lands.
  const [sawProcessing, setSawProcessing] = useState(false)
  useEffect(() => {
    if (view?.phase === 'processing') setSawProcessing(true)
    else if (view?.phase === 'ready' && sawProcessing) { setSawProcessing(false); onMinutesReady?.() }
  }, [view?.phase, sawProcessing, onMinutesReady])

  if (!view?.debrief || dismissed) return null
  const recent = view.endedAt && Date.now() - Date.parse(view.endedAt) < DAY_MS
  if (!forced && !recent) return null

  const d = view.debrief
  const dismiss = () => {
    try { storage()?.setItem(dismissKey(meetingId), '1') } catch { /* fine */ }
    setDismissed(true)
  }
  const audio = d.steps.find((s) => s.key === 'audio')
  return (
    <section className="bs-bot-debrief" aria-label="Bot debrief">
      {view.phase === 'processing'
        ? <DebriefLoader view={view} plain />
        : <BotPipelineDisplay view={view} onDismiss={dismiss} plain />}
      <dl className="bs-bot-figs">
        <div><dt className="bs-lbl">Duration</dt><dd>{formatElapsed(d.durationMs)}</dd></div>
        <div><dt className="bs-lbl">Speakers</dt><dd>{d.speakers}</dd></div>
        <div><dt className="bs-lbl">Decisions</dt><dd>{d.decisions}</dd></div>
        <div><dt className="bs-lbl">Action items</dt><dd>{d.actionItems}</dd></div>
        {d.invitees.total > 0 && <div><dt className="bs-lbl">Invitees told</dt><dd>{d.invitees.told}/{d.invitees.total}</dd></div>}
      </dl>
      <ul className="bs-bot-went" aria-label="Where it went">
        <li><span className="bs-lbl">Meeting</span><span>Saved here, in <Link to="/meetings">Meetings</Link></span></li>
        <li>
          <span className="bs-lbl">Audio</span>
          <span>{d.audioSaved ? `${formatElapsed(d.durationMs)} · plays on the tape` : audio?.state === 'done' ? 'Plays on the tape' : 'Saving'}</span>
        </li>
        <li>
          <span className="bs-lbl">Tasks</span>
          <span>
            {d.actionItems > 0
              ? <><button type="button" className="bs-linkbtn" onClick={() => onOpenTab?.('actions')}>{d.actionItems} action {d.actionItems === 1 ? 'item' : 'items'}</button> in the minutes and in <Link to="/tasks">Tasks</Link></>
              : 'No action items in this call'}
          </span>
        </li>
        {d.invitees.total > 0 && (
          <li>
            <span className="bs-lbl">Invitees</span>
            <span>{d.invitees.told} of {d.invitees.total} told{d.invitees.optedOut > 0 && ` · ${d.invitees.optedOut} opted out, left out of the transcript`}</span>
          </li>
        )}
      </ul>
      {view.marks?.length > 0 && (
        <div className="bs-bot-marks">
          <span className="bs-lbl">Marked in the call · {view.marks.length}</span>
          <ul>
            {view.marks.map((m) => (
              <li key={m.id}>
                <span className="bs-bot-mark-main">
                  {m.quote ? <>“{m.quote}”</> : m.note || 'Marked moment'}
                  {m.speaker && <span className="bs-bot-mark-who">{m.speaker}</span>}
                </span>
                {onJump && m.atMs != null && <TimecodeButton atMs={m.atMs} onJump={onJump} plays={plays} label={`Play the marked moment`} />}
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  )
}

/** The meeting page while there is no meeting yet: live, writing, or what went wrong. */
export function BotMeetingPending({ meetingId, onReady, notFound }) {
  const navigate = useNavigate()
  const { view, canControl, loaded, reload } = useBotSession(meetingId, {
    poll: (v) => (!v ? 0 : isActive(v.phase) ? 4000 : v.phase === 'processing' || v.phase === 'scheduled' ? 5000 : 0),
  })
  const [stopping, setStopping] = useState(false)
  const [stopError, setStopError] = useState(null)

  useEffect(() => {
    if (view?.meetingReady) onReady()
  }, [view?.meetingReady, onReady])

  if (!loaded) {
    return <div className="bs-mtg-empty" aria-busy="true"><Signal tone="brand">Loading meeting</Signal></div>
  }
  if (!view) return notFound

  const stop = async () => {
    setStopping(true)
    setStopError(null)
    try {
      await botsApi.stop(view.sessionId, 'manual_stop_from_meeting_page')
      await reload()
    } catch {
      setStopError('The bot could not be stopped. Try again, or remove it from the call.')
    } finally {
      setStopping(false)
    }
  }

  const sig = phaseSignal(view.phase)
  const meta = (
    <>
      <Signal tone={sig.tone}>{sig.word}</Signal>
    </>
  )
  return (
    <div className="bs-mtg bs-mtg-detail">
      <TitleRule title={runTitle(view)} crumbs={<Breadcrumbs current={runTitle(view)} />} meta={meta} />
      <div className="bs-cell">
        {isActive(view.phase) || view.phase === 'scheduled'
          ? <BotLive view={view} canControl={canControl} onStop={stop} stopping={stopping} />
          : view.phase === 'processing'
            ? <DebriefLoader view={view} />
            : (
              <div className="bs-bot-ended">
                <p className="bs-h3">{view.phase === 'failed' ? view.failure : 'The bot left without anything to write up.'}</p>
                <p className="bs-bot-note">
                  {view.phase === 'failed'
                    ? 'Nothing was recorded. Send the bot again once the meeting is open.'
                    : 'Nobody spoke while it was in the call, or it was stopped before the meeting began.'}
                </p>
                {canControl && <Key variant="primary" onClick={() => navigate('/bot')}>Send the bot again</Key>}
              </div>
            )}
        {stopError && <p className="bs-bot-note bs-bot-err" role="alert">{stopError}</p>}
      </div>
      {isActive(view.phase) && (
        <div className="bs-cell bs-bot-pending">
          <p className="bs-h3">Minutes write themselves when the call ends.</p>
          <p className="bs-bot-note">The transcript, summary, decisions and action items arrive about a minute after the bot leaves. This page turns into the meeting on its own.</p>
        </div>
      )}
    </div>
  )
}
