import { useEffect, useRef } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { botsApi } from '../../services/api'
import { BOT_LAUNCHED_EVENT, debriefToNotify, isActive, isDebriefDelayed, markSeen, meetingPath, readSeen } from '../../services/botView'
import { useToast } from '../vc/ToastProvider'

const POLL_MS = 10_000

function storage() {
  try { return window.localStorage } catch { return null }
}

export default function useBotDebriefWatch({ orgId, userId, enabled }) {
  const navigate = useNavigate()
  const { pathname } = useLocation()
  const { show } = useToast()
  const currentPath = useRef(pathname)
  currentPath.current = pathname

  useEffect(() => {
    if (!enabled || !orgId) return undefined
    let active = true
    let checking = false
    let watching = false
    let launched = false
    let timer
    const announced = new Set()

    const check = async () => {
      if (checking || !active) return
      clearTimeout(timer)
      checking = true
      launched = false
      try {
        const res = await botsApi.recent(orgId, 6)
        if (!active) return
        const sessions = Array.isArray(res?.sessions) ? res.sessions : []
        const ready = debriefToNotify(sessions, { userId, seen: [...readSeen(storage()), ...announced] })
        if (ready) {
          announced.add(ready.sessionId)
          markSeen(storage(), ready.sessionId)
          if (currentPath.current !== `/meetings/${ready.meetingId}`) {
            show({
              title: 'Meeting debrief ready',
              message: ready.title || 'Your meeting minutes are available.',
              color: 'mint',
              duration: 15_000,
              action: { label: 'Open debrief', onClick: () => navigate(meetingPath(ready.meetingId)) },
            })
          }
        }

        const now = Date.now()
        watching = sessions.some((run) => {
          const untilJoin = Date.parse(run.joinAt) - now
          return isActive(run.phase)
            || (run.phase === 'scheduled' && untilJoin > 0 && untilJoin < 15 * 60_000)
            || (run.phase === 'processing' && run.endedAt && !isDebriefDelayed(run, now))
        })
      } catch {
        // Retry only while a run is active or a launch just started.
      } finally {
        checking = false
        if (active && (watching || launched)) timer = window.setTimeout(check, POLL_MS)
      }
    }

    const onLaunch = () => {
      launched = true
      watching = true
      void check()
    }
    const onVisible = () => { if (!document.hidden) void check() }
    void check()
    window.addEventListener(BOT_LAUNCHED_EVENT, onLaunch)
    document.addEventListener('visibilitychange', onVisible)
    return () => {
      active = false
      clearTimeout(timer)
      window.removeEventListener(BOT_LAUNCHED_EVENT, onLaunch)
      document.removeEventListener('visibilitychange', onVisible)
    }
  }, [enabled, orgId, userId, navigate, show])
}
