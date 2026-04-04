/**
 * EntoAIProactiveChecker — Headless component that checks for urgent items
 * Sets the proactive suggestion badge on the sidebar button
 */
import { useEffect, useRef } from 'react'
import { tasksApi, meetingsApi, automationsApi } from '../../services/api'

const CHECK_INTERVAL = 10 * 60 * 1000 // 10 minutes

export default function EntoAIProactiveChecker({ onProactiveChange }) {
  const timerRef = useRef(null)

  useEffect(() => {
    async function check() {
      try {
        const [tasksRes, meetingsRes] = await Promise.allSettled([
          tasksApi.list({ limit: 50 }),
          meetingsApi.list({ limit: 10, sort: 'date', order: 'asc' }),
        ])

        let hasUrgent = false

        // Check overdue tasks
        if (tasksRes.status === 'fulfilled') {
          const tasks = tasksRes.value?.data?.tasks || tasksRes.value?.data || []
          const now = new Date()
          const overdue = tasks.filter(t =>
            t.status !== 'completed' && t.status !== 'cancelled' &&
            t.dueDate && new Date(t.dueDate) < now
          )
          if (overdue.length > 0) hasUrgent = true
        }

        // Check upcoming meetings within 1 hour
        if (!hasUrgent && meetingsRes.status === 'fulfilled') {
          const meetings = meetingsRes.value?.data?.meetings || meetingsRes.value?.data || []
          const now = new Date()
          const soonMs = 60 * 60 * 1000
          const upcoming = meetings.filter(m => {
            const mDate = new Date(m.date || m.scheduled_at)
            return mDate > now && (mDate - now) < soonMs
          })
          if (upcoming.length > 0) hasUrgent = true
        }

        onProactiveChange(hasUrgent)
      } catch {
        // Silently fail — badge not critical
      }
    }

    check()
    timerRef.current = setInterval(check, CHECK_INTERVAL)

    return () => clearInterval(timerRef.current)
  }, [onProactiveChange])

  return null // headless
}
