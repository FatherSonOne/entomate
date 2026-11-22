import { describe, expect, it, vi } from 'vitest'

vi.mock('../services/supabaseClient', () => ({ supabase: {} }))
import {
  agentCalls, agentWhy, callSummary, decisionsThisWeek, describeCall, dueBucket, dueSummary,
  groupActionItems, hms, nextEvent, calendarEvents, parseDay, todaySchedule, type ActionItemRow,
} from '../services/todayView'

// Saturday 21 Nov 2026, 14:00 local
const NOW = new Date(2026, 10, 21, 14, 0, 0)

const item = (over: Partial<ActionItemRow>): ActionItemRow => ({ id: Math.random().toString(36).slice(2), task_description: 'Task', status: 'open', ...over })

describe('todayView', () => {
  it('reads date-only due dates as local days', () => {
    expect(parseDay('2026-11-21')?.getDate()).toBe(21)
    expect(dueBucket(item({ due_date: '2026-11-21' }), NOW)).toBe('today')
    expect(dueBucket(item({ due_date: '2026-11-19' }), NOW)).toBe('overdue')
    expect(dueBucket(item({ due_date: '2026-11-25' }), NOW)).toBe('week')
    expect(dueBucket(item({ due_date: '2026-12-20' }), NOW)).toBe('later')
    expect(dueBucket(item({}), NOW)).toBe('none')
  })

  it('groups open items, soonest first, High before Medium, capped', () => {
    const items = [
      item({ id: 'a', due_date: '2026-11-25', priority: 'medium' }),
      item({ id: 'b', due_date: '2026-11-25', priority: 'high' }),
      item({ id: 'c', due_date: '2026-11-19' }),
      item({ id: 'd', status: 'done', due_date: '2026-11-19' }),
      item({ id: 'e' }),
    ]
    const g = groupActionItems(items, NOW, 3)
    expect(g.map((x) => x.key)).toEqual(['overdue', 'week'])
    expect(g[1]!.rows.map((r) => r.id)).toEqual(['b', 'a'])
    expect(g.reduce((n, x) => n + x.rows.length, 0)).toBe(3)
    expect(dueSummary(items, NOW)).toEqual({ dueToday: 0, overdue: 1, open: 4 })
  })

  it('turns agent notes into calls and reasons', () => {
    const it1 = item({
      id: 'x',
      task_description: 'Send revised pricing to Northwind',
      meeting_id: 'm1',
      agent_notes: {
        reviewed_at: new Date(2026, 10, 21, 9, 41).toISOString(),
        priority: { recommended: 'high', reason: 'Promised on the call', confidence: 0.88, applied: true },
        assignment: { recommended: 'Ana R.', reason: 'Owns pricing', confidence: 0.6, applied: false },
      },
    })
    expect(agentWhy(it1)).toMatchObject({ kind: 'priority', reason: 'Promised on the call', confidence: 88 })
    const calls = agentCalls([it1, item({ agent_notes: null })])
    expect(calls).toHaveLength(2)
    expect(describeCall(calls.find((c) => c.kind === 'priority')!, NOW)).toBe('Set “Send revised pricing to Northwind” to High')
    expect(describeCall(calls.find((c) => c.kind === 'assignment')!, NOW)).toBe('Suggests Ana R. for “Send revised pricing to Northwind”')
    expect(callSummary(calls, NOW)).toEqual({ today: 2, suggested: 1 })
  })

  it('collects this week’s decisions with their timecodes', () => {
    const d = decisionsThisWeek([
      { id: 'm1', title: 'Roadmap', created_at: new Date(2026, 10, 19).toISOString(), decisions: ['Ship ingestion'], summary_moments: { decisions: [740000] } },
      { id: 'm0', title: 'Old', created_at: new Date(2026, 10, 10).toISOString(), decisions: ['Old call'] },
    ], NOW)
    expect(d).toHaveLength(1)
    expect(d[0]).toMatchObject({ text: 'Ship ingestion', meetingId: 'm1', atMs: 740000 })
  })

  it('builds today’s schedule and finds the next meeting', () => {
    const events = calendarEvents([
      { type: 'calendar', id: 'e1', title: 'Q4 roadmap review', date: new Date(2026, 10, 21, 15, 0).toISOString() },
      { type: 'action_item', id: 'a1', title: 'Not a meeting', date: new Date(2026, 10, 21, 16, 0).toISOString() },
    ])
    expect(events).toHaveLength(1)
    expect(nextEvent(events, NOW)?.id).toBe('e1')
    const s = todaySchedule([{ id: 'm1', title: 'Northwind', created_at: new Date(2026, 10, 21, 9, 0).toISOString(), summary: 'x' }], events, NOW)
    expect(s.map((e) => [e.title, e.word, e.past])).toEqual([['Northwind', 'Ready', true], ['Q4 roadmap review', 'Scheduled', false]])
  })

  it('formats countdowns', () => {
    expect(hms(2 * 3600_000 + 18 * 60_000 + 40_000)).toBe('02:18:40')
    expect(hms(-5)).toBe('00:00:00')
  })
})
