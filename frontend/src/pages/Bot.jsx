/**
 * Bot (Tools › Bot) — send the meeting bot and watch it while it's in the
 * call. Desktop direction B from the bot Slate pass: the live display beside
 * readouts, the send form when nothing is running, last runs in the context
 * column. When the call ends the app moves to the meeting page, which is the
 * debrief. On phone this page is only the send form: a launch, a live bot and
 * a finished one all open the meeting page (direction A).
 *
 * Replaces the old Bot Launcher (session ids, Recall ids, curl and webhook
 * copy are gone; the bot's name is the workspace default).
 */

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useOrgSafe } from '../contexts/OrgContext'
import { botsApi } from '../services/api'
import {
  TitleRule, Section, Key, Signal, Grid, Cell, Readout, useMediaQuery, PHONE_QUERY,
} from '../components/bench'
import SendBotForm from '../components/bot/SendBotForm'
import BotLive from '../components/bot/BotLive'
import {
  BOT_LAUNCHED_EVENT, isActive, markSeen, meetingPath, phaseSignal, runTitle,
} from '../services/botView'

const ADMIN_ROLES = ['owner', 'admin']

function storage() {
  try { return window.localStorage } catch { return null }
}

const when = (iso) => {
  if (!iso) return ''
  const d = new Date(iso)
  const today = new Date().toDateString() === d.toDateString()
  return today
    ? d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false })
    : d.toLocaleDateString('en-US', { weekday: 'short', day: 'numeric', month: 'short' })
}

export default function Bot() {
  const navigate = useNavigate()
  const isPhone = useMediaQuery(PHONE_QUERY)
  const orgCtx = useOrgSafe()
  const orgId = orgCtx?.org?.id
  const canSend = ADMIN_ROLES.includes(orgCtx?.myRole)

  const [sessions, setSessions] = useState(null)
  const [error, setError] = useState(null)
  const [stopping, setStopping] = useState(false)
  const [stopError, setStopError] = useState(null)
  const watchedRef = useRef(null) // the live run this page is showing

  const load = useCallback(async () => {
    if (!orgId || !canSend) return
    try {
      const res = await botsApi.recent(orgId, 8)
      setSessions(Array.isArray(res?.sessions) ? res.sessions : [])
      setError(null)
    } catch {
      setError('Bot runs could not be loaded. Check your connection.')
      setSessions((s) => s || [])
    }
  }, [orgId, canSend])

  useEffect(() => { load() }, [load])
  useEffect(() => {
    const onLaunch = () => load()
    window.addEventListener(BOT_LAUNCHED_EVENT, onLaunch)
    return () => window.removeEventListener(BOT_LAUNCHED_EVENT, onLaunch)
  }, [load])

  const live = useMemo(() => (sessions || []).find((s) => isActive(s.phase) || (s.phase === 'scheduled' && Date.parse(s.joinAt) - Date.now() < 10 * 60 * 1000)) || null, [sessions])
  const hasActive = Boolean(live)
  useEffect(() => {
    if (!hasActive) return undefined
    const t = window.setInterval(load, 4000)
    return () => window.clearInterval(t)
  }, [hasActive, load])

  // The run we were showing left the call: move to its meeting, which is the debrief.
  useEffect(() => {
    if (live) { watchedRef.current = live.sessionId; return }
    const was = watchedRef.current && (sessions || []).find((s) => s.sessionId === watchedRef.current)
    if (was && (was.phase === 'processing' || was.phase === 'ready')) {
      markSeen(storage(), was.sessionId)
      navigate(meetingPath(was.meetingId))
    }
    watchedRef.current = null
  }, [live, sessions, navigate])

  // Phone is direction A: a live bot lives on its meeting page.
  useEffect(() => {
    if (isPhone && live && isActive(live.phase)) navigate(`/meetings/${live.meetingId}`, { replace: true })
  }, [isPhone, live, navigate])

  const onLaunched = ({ meetingId }) => {
    if (isPhone) navigate(`/meetings/${meetingId}`)
    else load()
  }

  const stop = async () => {
    if (!live) return
    setStopping(true)
    setStopError(null)
    try {
      await botsApi.stop(live.sessionId, 'manual_stop_from_bot_page')
      await load()
    } catch {
      setStopError('The bot could not be stopped. Try again, or remove it from the call.')
    } finally {
      setStopping(false)
    }
  }

  const sig = live ? phaseSignal(live.phase) : null
  const meta = (
    <>
      <b>Tools</b> / Bot · {live ? sig.word.toLowerCase() : 'ready'}
    </>
  )
  const actions = canSend && (
    <Key onClick={() => navigate('/settings', { state: { section: 'auto-join' } })}>Auto-join</Key>
  )
  const past = (sessions || []).filter((s) => s.sessionId !== live?.sessionId)

  return (
    <div className="bs-bot">
      <TitleRule title="Bot" meta={meta} actions={actions} />
      {!canSend ? (
        <div className="bs-cell">
          <p className="bs-h3">Only owners and admins can send the bot.</p>
          <p className="bs-bot-note">Bot meetings still show up in <Link to="/meetings">Meetings</Link> for everyone in the workspace.</p>
        </div>
      ) : (
        <Grid>
          <Cell span={8}>
            {live ? (
              <>
                <BotLive view={live} canControl onStop={stop} stopping={stopping} />
                {stopError && <p className="bs-bot-note bs-bot-err" role="alert">{stopError}</p>}
                <p className="bs-bot-note bs-bot-after">
                  When the bot leaves, this opens the meeting with what it caught.{' '}
                  <Link to={`/meetings/${live.meetingId}`}>Open the meeting now</Link>
                </p>
              </>
            ) : (
              <>
                <Section title="Send the bot" level={3} />
                <SendBotForm onLaunched={onLaunched} autoFocus={!isPhone} />
              </>
            )}
          </Cell>
          <Cell span={4} rule>
            {live ? (
              <>
                <Readout label="Status" value={<Signal tone={sig.tone}>{sig.word}</Signal>} context={live.autoJoin ? 'Sent by your calendar' : 'Sent by hand'} />
                <Readout label="Joined" value={live.startedAt ? when(live.startedAt) : '—'} />
              </>
            ) : null}
            <Section title="Last runs" level={3} />
            {error && <p className="bs-bot-note bs-bot-err">{error}</p>}
            {sessions == null ? (
              <p className="bs-bot-note">Loading…</p>
            ) : past.length === 0 ? (
              <p className="bs-bot-note">No bot runs yet. Send one, or switch on Auto-join for your calendar.</p>
            ) : (
              <ul className="bs-bot-runs">
                {past.map((s) => {
                  const ps = phaseSignal(s.phase)
                  const open = s.phase === 'ready' || s.phase === 'processing' || isActive(s.phase)
                  return (
                    <li key={s.sessionId}>
                      <span className="bs-bot-run-when">{when(s.endedAt || s.joinAt || s.startedAt)}</span>
                      <span className="bs-bot-run-main">
                        {open ? <Link to={`/meetings/${s.meetingId}`}>{runTitle(s)}</Link> : <span>{runTitle(s)}</span>}
                        <Signal tone={ps.tone}>{ps.word}</Signal>
                        {s.phase === 'failed' && s.failure && <span className="bs-bot-run-why">{s.failure}</span>}
                      </span>
                    </li>
                  )
                })}
              </ul>
            )}
          </Cell>
        </Grid>
      )}
    </div>
  )
}
