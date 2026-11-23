import type { ThreadHistoryRow } from './useThreadHistory'

export interface ThreadGroup {
  key: string
  label: string
  rows: ThreadHistoryRow[]
}

const DAY_MS = 86_400_000

function startOfDay(d: Date): number {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime()
}

/**
 * Groups the history list by when each conversation last had a message: Today, Past 7 days,
 * Earlier this month, then one group per month ("October 2026"). Ported from Logos AI's
 * groupTranscripts without the Pinned group. Rows arrive newest first, so each group keeps
 * that order. A search result is one "Matches" group: grouping by date there hides the best hit.
 */
export function groupThreads(rows: ThreadHistoryRow[], now: Date, searching: boolean): ThreadGroup[] {
  if (searching) return rows.length ? [{ key: 'matches', label: 'Matches', rows }] : []

  const today = startOfDay(now)
  const groups: ThreadGroup[] = []
  const byKey = new Map<string, ThreadGroup>()
  const push = (key: string, label: string, row: ThreadHistoryRow) => {
    let group = byKey.get(key)
    if (!group) {
      group = { key, label, rows: [] }
      byKey.set(key, group)
      groups.push(group)
    }
    group.rows.push(row)
  }

  for (const row of rows) {
    const at = new Date(row.updated_at)
    const day = startOfDay(at)
    if (day >= today) push('today', 'Today', row)
    else if (day > today - 7 * DAY_MS) push('week', 'Past 7 days', row)
    else if (at.getFullYear() === now.getFullYear() && at.getMonth() === now.getMonth()) push('month', 'Earlier this month', row)
    else push(`${at.getFullYear()}-${at.getMonth()}`, at.toLocaleDateString(undefined, { month: 'long', year: 'numeric' }), row)
  }
  return groups
}

/** "Oct 19" this year, "Oct 19, 2025" before it, the time for today. */
export function formatThreadDate(iso: string, now: Date): string {
  const at = new Date(iso)
  if (startOfDay(at) === startOfDay(now)) {
    return at.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })
  }
  return at.toLocaleDateString(undefined, {
    month: 'short', day: 'numeric', ...(at.getFullYear() === now.getFullYear() ? {} : { year: 'numeric' }),
  })
}
