import { describe, expect, it, vi } from 'vitest'

vi.mock('../services/supabaseClient', () => ({ supabase: {} }))
import {
  countdown, daysLeft, endsLabel, filterCounts, linkCandidates, owners, projectDecisions, projectSignal, projectTape,
  projectWork, readUrl, shownProjects, timeline, workCounts, writeUrl,
  type ProjectDetailRow, type ProjectRow, type Rollup,
} from '../services/projectsView'

// Sunday 22 Nov 2026, 10:00 local
const NOW = new Date(2026, 10, 22, 10, 0, 0)

const roll = (over: Partial<Rollup> = {}): Rollup => ({
  total: 0, done: 0, open: 0, late: 0, fromMeetings: 0, decisions: 0, meetings: 0, lastMeeting: null, nextMeeting: null, ...over,
})
const proj = (over: Partial<ProjectRow>): ProjectRow => ({ id: Math.random().toString(36).slice(2), name: 'P', status: 'active', ...over })

describe('projectsView', () => {
  it('reads the end date as days left and a countdown', () => {
    expect(daysLeft('2026-12-01', NOW)).toBe(9)
    expect(daysLeft(null, NOW)).toBeNull()
    expect(endsLabel('2026-11-22', NOW)).toBe('Ends today')
    expect(endsLabel('2026-11-19', NOW)).toBe('Ended 3 days ago')
    expect(countdown('2026-12-01', NOW)).toBe('9d 14:00')
    expect(countdown('2026-11-20', NOW)).toBeNull()
  })

  it('gives each project one signal: slipping when late work meets a near end date', () => {
    expect(projectSignal(proj({ end_date: '2026-12-01', rollup: roll({ open: 7, late: 3 }) }), NOW)).toEqual({ tone: 'brand', word: 'Slipping' })
    expect(projectSignal(proj({ end_date: '2027-01-15', rollup: roll({ open: 18, late: 2 }) }), NOW)).toEqual({ tone: 'live', word: 'On track' })
    expect(projectSignal(proj({ end_date: '2026-11-10', rollup: roll({ open: 1 }) }), NOW).word).toBe('Overdue')
    expect(projectSignal(proj({ status: 'planning' }), NOW).word).toBe('Planning')
    expect(projectSignal(proj({ status: 'completed' }), NOW)).toEqual({ tone: 'mint', word: 'Done' })
  })

  it('filters and orders the list: active first, nearest end date first', () => {
    const list = [
      proj({ name: 'Portal', status: 'planning', end_date: '2027-03-30' }),
      proj({ name: 'Website', end_date: '2026-12-12' }),
      proj({ name: 'Migration', status: 'completed' }),
      proj({ name: 'Northwind', end_date: '2026-12-01', description: 'seats rollout' }),
    ]
    expect(shownProjects(list, 'all').map((p) => p.name)).toEqual(['Northwind', 'Website', 'Portal', 'Migration'])
    expect(shownProjects(list, 'done').map((p) => p.name)).toEqual(['Migration'])
    expect(shownProjects(list, 'all', 'seats').map((p) => p.name)).toEqual(['Northwind'])
    expect(filterCounts(list)).toEqual({ active: 2, planning: 1, done: 1, all: 4 })
  })

  it('lays live projects on a timeline with a NOW line', () => {
    const tl = timeline([
      proj({ name: 'A', start_date: '2026-11-01', end_date: '2026-12-31', rollup: roll({ total: 4, done: 2, late: 1 }) }),
      proj({ name: 'Done', status: 'completed', end_date: '2026-11-10' }),
      proj({ name: 'No date' }),
    ], NOW)!
    expect(tl.rows).toHaveLength(1)
    expect(tl.months.map((m) => m.label)).toEqual(['NOV', 'DEC'])
    expect(tl.rows[0]).toMatchObject({ name: 'A', startPct: 0, donePct: 50, late: 1 })
    expect(tl.rows[0]!.endPct).toBeGreaterThan(95)
    expect(tl.nowPct).toBeGreaterThan(30)
    expect(tl.nowPct).toBeLessThan(40)
    expect(timeline([proj({ status: 'planning' })], NOW)).toBeNull()
  })

  const detail: ProjectDetailRow = {
    id: 'p1',
    name: 'Northwind rollout',
    status: 'active',
    start_date: '2026-10-28',
    end_date: '2026-12-01',
    tasks: [
      { id: 't1', title: 'Import seats', status: 'todo', due_date: '2026-11-20', assigned_to: 'Priya' },
      { id: 't2', title: 'Staging tenant', status: 'completed', assigned_to: 'Jon' },
      { id: 't3', title: 'Sub', status: 'open', parent_task_id: 't1' },
    ],
    meetings: [
      { id: 'm1', title: 'Check-in', start_time: '2026-11-21T10:00:00', decisions: ['Training before go-live'], summary_moments: { decisions: [700000] } },
      { id: 'm2', title: 'Pricing call', start_time: '2026-11-12T10:00:00', decisions: ['Floor stays at $40', 'Annual on top'] },
      { id: 'm3', title: 'Handoff', start_time: '2026-11-26T14:00:00', decisions: [] },
    ],
    actionItems: [
      { id: 'a1', task_description: 'Follow up with legal', status: 'open', due_date: '2026-11-17', meeting_id: 'm2', meetings: { title: 'Pricing call' } },
      { id: 'a2', task_description: 'Send pricing', status: 'open', due_date: '2026-11-25', assigned_to_name: 'Frankie', meeting_id: 'm1' },
    ],
  }

  it('folds tasks and meeting action items into the project work', () => {
    const work = projectWork(detail)
    expect(work.map((w) => w.key).sort()).toEqual(['action:a1', 'action:a2', 'task:t1', 'task:t2'])
    expect(work.every((w) => w.projectId === 'p1')).toBe(true)
    expect(workCounts(work, NOW)).toEqual({ total: 4, done: 1, open: 3, late: 2, unowned: 1 })
    expect(owners(work, NOW)).toEqual([
      { name: null, open: 1, late: 1 },
      { name: 'Priya', open: 1, late: 1 },
      { name: 'Frankie', open: 1, late: 0 },
    ])
  })

  it('lists decisions newest meeting first with their timecodes, and skips meetings not held yet', () => {
    const d = projectDecisions(detail, NOW)
    expect(d.map((x) => x.text)).toEqual(['Training before go-live', 'Floor stays at $40', 'Annual on top'])
    expect(d[0]).toMatchObject({ meetingId: 'm1', atMs: 700000 })
    expect(d[1]!.atMs).toBeNull()
  })

  it('draws the tape from kickoff to the end date', () => {
    const t = projectTape(detail, NOW)!
    expect(t.marks.map((m) => m.label)).toEqual(['Pricing call', 'Check-in'])
    expect(t.upcoming.map((m) => m.label)).toEqual(['Handoff'])
    expect(t.marks[0]!.decisions).toBe(2)
    expect([...t.marks, ...t.upcoming].map((m) => m.labelled)).toEqual([true, true, false])
    expect(t.nowPct).toBeGreaterThan(70)
    expect(t.nowPct).toBeLessThan(80)
    expect(projectTape({ ...detail, end_date: null }, NOW)).toBeNull()
  })

  it('ranks meetings to link by how often they mention the project', () => {
    const c = linkCandidates('p1', 'Northwind rollout', [
      { id: 'x1', title: 'Weekly ops', created_at: '2026-11-20T09:00:00Z' },
      { id: 'x2', title: 'Pulse handoff', summary: 'Northwind wants the rollout before the window. Northwind IT is ready.', created_at: '2026-11-17T09:00:00Z' },
      { id: 'm1', title: 'Already linked', project_id: 'p1' },
    ])
    expect(c.map((x) => x.id)).toEqual(['x2', 'x1'])
    expect(c[0]!.mentions).toBe(3)
  })

  it('keeps only non-default state in the URL', () => {
    const s = readUrl(new URLSearchParams('show=active&item=task:t1&dr=link&layout=lanes'))
    expect(s).toEqual({ show: 'active', item: 'task:t1', drawer: 'link', layout: 'lanes' })
    expect(writeUrl(s)).toEqual({ show: 'active', item: 'task:t1', dr: 'link', layout: 'lanes' })
    expect(writeUrl(readUrl(new URLSearchParams('show=bogus&dr=x')))).toEqual({})
  })
})
