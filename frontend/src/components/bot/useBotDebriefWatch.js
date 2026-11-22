/**
 * "The debrief takes focus." Mounted once in the shell for owners and admins.
 *
 * - On load: if a bot run this person sent ended in the last 12 hours and its
 *   debrief hasn't been shown, open it once (the app was closed when the call ended).
 * - While a bot is in a call, due to join, or just launched: poll every 10 s, and
 *   when the call ends move the app to that meeting, which is the debrief.
 */

import { useCallback, useEffect, useRef, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { botsApi } from '../../services/api'
import { BOT_LAUNCHED_EVENT, debriefToOpen, isActive, markSeen, meetingPath, readSeen } from '../../services/botView'

const POLL_MS = 10_000

function storage() {
  try { return window.localStorage } catch { return null }
}

export default function useBotDebriefWatch({ orgId, userId, enabled }) {
  const navigate = useNavigate()
  const location = useLocation()
  const pathRef = useRef(location.pathname)
  pathRef.current = location.pathname
  const activeRef = useRef(new Set()) // runs seen live this visit
  const [polling, setPolling] = useState(false)

  const open = useCallback((run) => {
    markSeen(storage(), run.sessionId)
    // Already on that meeting (its live view hands over by itself).
    if (pathRef.current === `/meetings/${run.meetingId}`) return
    navigate(meetingPath(run.meetingId))
  }, [navigate])

  const check = useCallback(async (first) => {
    if (!enabled || !orgId) return
    let sessions
    try {
      const res = await botsApi.recent(orgId, 6)
      sessions = Array.isArray(res?.sessions) ? res.sessions : []
    } catch {
      return
    }
    const seen = readSeen(storage())
    const ended = sessions.find((s) => activeRef.current.has(s.sessionId) && !isActive(s.phase) && !seen.includes(s.sessionId))
    activeRef.current = new Set(sessions.filter((s) => isActive(s.phase)).map((s) => s.sessionId))
    // Also watch a calendar bot due within 15 minutes, so its call is caught too.
    const soon = sessions.some((s) => s.phase === 'scheduled' && s.joinAt && Date.parse(s.joinAt) - Date.now() < 15 * 60 * 1000)
    setPolling(activeRef.current.size > 0 || soon)
    if (ended && (ended.phase === 'processing' || ended.phase === 'ready')) {
      open(ended)
      return
    }
    if (first) {
      const missed = debriefToOpen(sessions, { userId, seen })
      if (missed) open(missed)
    }
  }, [enabled, orgId, userId, open])

  useEffect(() => { check(true) }, [check])

  useEffect(() => {
    if (!polling) return undefined
    const t = window.setInterval(() => check(false), POLL_MS)
    return () => window.clearInterval(t)
  }, [polling, check])

  useEffect(() => {
    // A launch: start watching straight away (the bot shows up as joining).
    const onLaunch = () => { window.setTimeout(() => check(false), 1500) }
    window.addEventListener(BOT_LAUNCHED_EVENT, onLaunch)
    return () => window.removeEventListener(BOT_LAUNCHED_EVENT, onLaunch)
  }, [check])
}
