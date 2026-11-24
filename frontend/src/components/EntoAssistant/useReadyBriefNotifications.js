import { useEffect } from 'react'
import { entoAiApi } from '../../services/api'
import { useToast } from '../vc/ToastProvider'
import { requestThread } from './threadSignal'

const CHECK_MS = 30_000

function readSeen(key) {
  try {
    const saved = JSON.parse(window.localStorage.getItem(key) || '[]')
    return Array.isArray(saved) ? saved : []
  } catch {
    return []
  }
}

export default function useReadyBriefNotifications({ userId, orgId, openAssistant }) {
  const { show, dismiss } = useToast()

  useEffect(() => {
    if (!userId || !orgId) return undefined
    const key = `entomate.brief-notified:${userId}:${orgId}`
    const announced = new Set()
    const toastIds = new Set()
    let active = true
    let checking = false

    async function check() {
      if (!active || checking || document.hidden) return
      checking = true
      try {
        const { briefs } = await entoAiApi.meetingBriefs.ready(orgId)
        if (!active || document.hidden || !Array.isArray(briefs)) return
        const seen = readSeen(key)
        const next = briefs.find(({ threadId }) => !announced.has(threadId) && !seen.includes(threadId))
        if (!next) return

        const { threadId, title } = next
        const toastId = show({
          title: 'Pre-meeting brief ready',
          message: title,
          color: 'mint',
          duration: 20_000,
          action: {
            label: 'Open brief',
            onClick: () => {
              if (!active) return
              requestThread(threadId)
              openAssistant()
            },
          },
        })
        toastIds.add(toastId)
        announced.add(threadId)
        try { window.localStorage.setItem(key, JSON.stringify([threadId, ...seen].slice(0, 50))) } catch { /* Keep deduplication for this visit. */ }
      } catch {
        // The next check can pick up the same brief after a transient failure.
      } finally {
        checking = false
      }
    }

    void check()
    const timer = window.setInterval(check, CHECK_MS)
    document.addEventListener('visibilitychange', check)
    return () => {
      active = false
      window.clearInterval(timer)
      document.removeEventListener('visibilitychange', check)
      for (const id of toastIds) dismiss(id)
    }
  }, [userId, orgId, openAssistant, show, dismiss])
}
