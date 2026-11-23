/**
 * EntoAIProactiveChecker — headless. Reads the server's signals (EAI-06,
 * GET /api/ento-ai/signals: overdue tasks and action items, meetings in the next hour)
 * for the launcher's "N waiting" badge and the panel's "Needs attention" list.
 *
 * Before EAI-06 it listed tasks and meetings itself every 10 minutes and checked fields
 * those rows do not have (`dueDate`, status `completed`, `date` / `scheduled_at`), so the
 * badge never came on. The server now decides what counts; this asks on mount, when the
 * tab comes back, when the panel opens or closes (`refreshKey`) and every 10 minutes.
 */
import { useEffect } from 'react'
import { entoAiApi } from '../../services/api'

const CHECK_INTERVAL = 10 * 60 * 1000 // 10 minutes

export default function EntoAIProactiveChecker({ onSignals, refreshKey }) {
  useEffect(() => {
    let cancelled = false
    async function check() {
      if (document.visibilityState === 'hidden') return
      try {
        const res = await entoAiApi.signals()
        if (!cancelled) onSignals({ signals: Array.isArray(res?.signals) ? res.signals : [], total: res?.total || 0 })
      } catch {
        // Keep the last result: a failed read must not read as "nothing waiting".
      }
    }
    const onVisible = () => { if (document.visibilityState === 'visible') check() }

    check()
    const timer = setInterval(check, CHECK_INTERVAL)
    document.addEventListener('visibilitychange', onVisible)
    return () => {
      cancelled = true
      clearInterval(timer)
      document.removeEventListener('visibilitychange', onVisible)
    }
  }, [onSignals, refreshKey])

  return null // headless
}
