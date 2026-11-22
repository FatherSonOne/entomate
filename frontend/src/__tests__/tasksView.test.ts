import { describe, expect, it, vi } from 'vitest'

vi.mock('../services/supabaseClient', () => ({ supabase: {} }))
import {
  filterItems, fromActionItem, fromTask, groupByUrgency, lanes, meetingHref, normalizePriority,
  normalizeStatus, readUrl, sortItems, summarize, taskSource, timecode, toWorkItems, writeUrl,
  type TaskActionRow, type TaskRow,
} from '../services/tasksView'

// Saturday 21 Nov 2026, 14:00 local
const NOW = new Date(2026, 10, 21, 14, 0, 0)

const task = (over: Partial<TaskRow>): TaskRow => ({ id: Math.random().toString(36).slice(2), title: 'Task', status: 'open', ...over })
const action = (over: Partial<TaskActionRow>): TaskActionRow => ({ id: Math.random().toString(36).slice(2), task_description: 'Action', status: 'open', ...over })

describe('tasksView', () => {
  it('reads legacy and action-item statuses', () => {
    expect(normalizeStatus('todo')).toBe('open')
    expect(normalizeStatus('completed')).toBe('done')
    expect(normalizeStatus('complete')).toBe('done')
    expect(normalizeStatus('blocked')).toBe('blocked')
    expect(normalizeStatus(null)).toBe('open')
    expect(normalizePriority('critical')).toBe('high')
    expect(normalizePriority(undefined)).toBe('medium')
  })

  it('links action items and tasks to their meeting', () => {
    const a = fromActionItem(action({ meeting_id: 'm1', meetings: { title: 'Q4 roadmap review' }, transcript_at_ms: 724_000 }))
    expect(a.kind).toBe('action')
    expect(a.source).toEqual({ meetingId: 'm1', title: 'Q4 roadmap review', atMs: 724_000 })
    expect(meetingHref(a.source!)).toBe('/meetings/m1?t=724000')
    expect(timecode(724_000)).toBe('12:04')
    expect(timecode(3_729_000)).toBe('1:02:09')

    const t = fromTask(task({ custom_fields: { source: { meeting_id: 'm2', at_ms: 1000 } } }))
    expect(t.source).toEqual({ meetingId: 'm2', title: null, atMs: 1000 })
    expect(taskSource(task({ custom_fields: { source: 'nope' } }))).toBeNull()
    expect(taskSource(task({ custom_fields: null }))).toBeNull()
    expect(meetingHref({ meetingId: 'm3', title: null, atMs: null })).toBe('/meetings/m3')
  })

  it('merges sources and leaves subtasks inside their parent', () => {
    const items = toWorkItems([task({ id: 'p' }), task({ id: 's', parent_task_id: 'p' })], [action({ id: 'a' })])
    expect(items.map((i) => i.key)).toEqual(['task:p', 'action:a'])
  })

  it('reads tags only when they are strings', () => {
    expect(fromTask(task({ tags: ['a', 3, ' b ', ''] })).tags).toEqual(['a', 'b'])
    expect(fromTask(task({ tags: 'a,b' })).tags).toEqual([])
  })

  it('groups by urgency with done last', () => {
    const items = toWorkItems(
      [task({ id: 'late', due_date: '2026-11-19' }), task({ id: 'done', status: 'done', due_date: '2026-11-19' }), task({ id: 'none' })],
      [action({ id: 'today', due_date: '2026-11-21' }), action({ id: 'week', due_date: '2026-11-25' })],
    )
    const groups = groupByUrgency(items, NOW)
    expect(groups.map((g) => g.key)).toEqual(['overdue', 'today', 'week', 'none', 'done'])
    expect(groups[0]?.items[0]?.id).toBe('late')
    const s = summarize(items, NOW)
    expect(s).toEqual({ open: 4, overdue: 1, fromMeetings: 0, agentCalls: 0 })
  })

  it('filters by show, tag and search', () => {
    const items = toWorkItems(
      [task({ id: 't1', title: 'Write spec', tags: ['backend'] }), task({ id: 't2', status: 'completed' })],
      [action({ id: 'a1', task_description: 'Send pricing', meeting_id: 'm', meetings: { title: 'Northwind check-in' } })],
    )
    expect(filterItems(items, { show: 'open' }).map((i) => i.id)).toEqual(['t1', 'a1'])
    expect(filterItems(items, { show: 'done' }).map((i) => i.id)).toEqual(['t2'])
    expect(filterItems(items, { show: 'meetings' }).map((i) => i.id)).toEqual(['a1'])
    expect(filterItems(items, { show: 'all', tag: 'backend' }).map((i) => i.id)).toEqual(['t1'])
    expect(filterItems(items, { show: 'all', search: 'northwind' }).map((i) => i.id)).toEqual(['a1'])
  })

  it('sorts by due date, undated last, High first on the same day', () => {
    const items = toWorkItems(
      [task({ id: 'x' }), task({ id: 'b', due_date: '2026-11-25', priority: 'low' }), task({ id: 'a', due_date: '2026-11-25', priority: 'high' }), task({ id: 'c', due_date: '2026-11-22' })],
      [],
    )
    expect(sortItems(items, 'due').map((i) => i.id)).toEqual(['c', 'a', 'b', 'x'])
    expect(sortItems(items, 'priority').map((i) => i.id)[0]).toBe('a')
  })

  it('puts every item in one lane', () => {
    const l = lanes(toWorkItems([task({ status: 'review' }), task({ status: 'todo' })], [action({ status: 'in_progress' })]))
    expect([l.open.length, l.in_progress.length, l.review.length, l.blocked.length, l.done.length]).toEqual([1, 1, 1, 0, 0])
  })

  it('round-trips URL state, dropping defaults', () => {
    const s = readUrl(new URLSearchParams('view=lanes&show=done&sort=bogus&item=task:1&lane=review'))
    expect(s).toEqual({ layout: 'lanes', show: 'done', sort: 'due', tag: null, item: 'task:1', lane: 'review' })
    expect(writeUrl(s)).toEqual({ view: 'lanes', show: 'done', item: 'task:1', lane: 'review' })
    expect(writeUrl(readUrl(new URLSearchParams('')))).toEqual({})
  })
})
