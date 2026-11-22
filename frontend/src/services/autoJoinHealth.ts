/**
 * Auto-join's health in the app: when it last checked the calendar, and meetings
 * its bot did not join (backend services/calendarAutoJoin.js, auto_join_health).
 */

import { calendarApi } from './api'

export interface MissedBot {
  key: string
  title: string
  start: string
  reason: 'no_bot' | 'failed'
}

export interface AutoJoinHealth {
  enabled: boolean
  lastRunAt: string | null
  missed: MissedBot[]
}

/** Missed meetings are worth an alert while the call may still be going. */
export const ALERT_WINDOW_MS = 2 * 60 * 60 * 1000

export function toHealth(raw: unknown): AutoJoinHealth {
  const r = raw && typeof raw === 'object' ? (raw as Record<string, unknown>) : {}
  const missed = (Array.isArray(r.missed) ? r.missed : [])
    .map((m) => (m && typeof m === 'object' ? (m as Record<string, unknown>) : null))
    .filter((m): m is Record<string, unknown> => !!m && typeof m.key === 'string' && typeof m.start === 'string')
    .map((m) => ({
      key: m.key as string,
      title: typeof m.title === 'string' && m.title ? m.title : 'Untitled event',
      start: m.start as string,
      reason: m.reason === 'failed' ? ('failed' as const) : ('no_bot' as const),
    }))
  return { enabled: r.enabled === true, lastRunAt: typeof r.lastRunAt === 'string' ? r.lastRunAt : null, missed }
}

/** The missed meetings to alert about now, newest first. */
export function alertsFor(health: AutoJoinHealth, now = Date.now()): MissedBot[] {
  return health.missed
    .filter((m) => now - Date.parse(m.start) < ALERT_WINDOW_MS)
    .sort((a, b) => Date.parse(b.start) - Date.parse(a.start))
}

/** "3 min ago" style label for the last check, or null when it has never run. */
export function lastCheckedLabel(lastRunAt: string | null, now = Date.now()): string | null {
  if (!lastRunAt) return null
  const mins = Math.max(0, Math.round((now - Date.parse(lastRunAt)) / 60000))
  if (!Number.isFinite(mins)) return null
  if (mins < 1) return 'just now'
  if (mins < 60) return `${mins} min ago`
  const hours = Math.round(mins / 60)
  return hours < 24 ? `${hours} h ago` : `${Math.round(hours / 24)} d ago`
}

export async function syncAutoJoin(): Promise<AutoJoinHealth | null> {
  try {
    return toHealth(await calendarApi.syncAutoJoin())
  } catch {
    return null
  }
}

export async function dismissMissedBot(key: string): Promise<void> {
  await calendarApi.dismissMissedBot(key)
}
