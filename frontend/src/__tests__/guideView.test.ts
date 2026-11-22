import { describe, it, expect } from 'vitest'
import {
  buildContents, changedSince, eyebrow, findEntry, highlight, prevNext, readUrlState, searchGuide,
  shortDate, versionDate, writeUrlState,
} from '../services/guideView'
import type { GuideCategory, GuideChange, GuideSection } from '../components/UsersGuide/guideData'
import { CATEGORIES, GUIDE_CHANGES, SHORTCUTS, guideSections } from '../components/UsersGuide/guideData'

const sections: GuideSection[] = [
  { id: 'introduction', title: 'Introduction', summary: 'What Entomate is.', steps: ['Records meetings.'] },
  {
    id: 'tasks', title: 'Tasks', summary: 'One work list.', steps: ['Tick the box.'],
    subsections: [{ id: 'task-bulk', title: 'Select and bulk changes', steps: ['Pick items, then Mark done.'] }],
    tips: ['The box completes.'],
  },
  { id: 'troubleshooting', title: 'Troubleshooting', summary: 'Fixes.', useCases: [{ id: 'uc1', title: 'Can I export?', scenario: 's', steps: ['Open Insights and press Export.'] }] },
]
const cats: GuideCategory[] = [
  { label: 'Start', ids: ['introduction', 'missing'] },
  { label: 'Work', ids: ['tasks'] },
  { label: 'Settings & help', ids: ['troubleshooting'] },
]

describe('contents', () => {
  const groups = buildContents(cats, sections)

  it('groups sections in nav order, numbers modules and skips unknown ids', () => {
    expect(groups.map((g) => g.label)).toEqual(['Start', 'Work', 'Settings & help'])
    expect(groups[0]?.entries.map((e) => e.id)).toEqual(['introduction'])
    const tasks = findEntry(groups, 'tasks')
    expect(tasks?.number).toBe('03')
    expect(tasks && eyebrow(tasks)).toBe('Work · 03')
    expect(findEntry(groups, 'introduction')?.number).toBeNull()
    expect(findEntry(groups, null)).toBeNull()
  })

  it('finds previous and next across groups', () => {
    const pn = prevNext(groups, 'tasks')
    expect(pn.prev?.id).toBe('introduction')
    expect(pn.next?.id).toBe('troubleshooting')
    expect(prevNext(groups, 'introduction').prev).toBeNull()
    expect(prevNext(groups, 'nope')).toEqual({ prev: null, next: null })
  })
})

describe('search', () => {
  const groups = buildContents(cats, sections)

  it('returns matching lines with the subsection to scroll to', () => {
    const hits = searchGuide(groups, 'BULK')
    expect(hits.map((h) => h.entry.id)).toEqual(['tasks'])
    expect(hits[0]?.snippets[0]).toEqual({ kind: 'topic', text: 'Select and bulk changes', anchor: 'task-bulk' })
  })

  it('searches questions and titles, and ignores blank queries', () => {
    expect(searchGuide(groups, 'export')[0]?.snippets[0]?.anchor).toBe('q-uc1')
    expect(searchGuide(groups, 'introduction').map((h) => h.entry.id)).toEqual(['introduction'])
    expect(searchGuide(groups, '   ')).toEqual([])
  })

  it('caps snippets at two per section', () => {
    expect(searchGuide(groups, 'the')[0]?.snippets.length).toBeLessThanOrEqual(2)
  })

  it('highlights every match, case-insensitively', () => {
    expect(highlight('Box and box', 'BOX')).toEqual([
      { text: 'Box', hit: true }, { text: ' and ', hit: false }, { text: 'box', hit: true },
    ])
    expect(highlight('plain', '')).toEqual([{ text: 'plain', hit: false }])
  })
})

describe("what's new", () => {
  const changes: GuideChange[] = [
    { date: '2026-11-22', section: 'tasks', text: 'a' },
    { date: '2026-11-21', section: 'meetings', text: 'b' },
    { date: '2026-10-01', section: 'billing', text: 'c' },
  ]

  it('marks nothing when the reader has seen this version', () => {
    expect(changedSince(changes, '2026-11-22e', '2026-11-22e', '2026-11-22').size).toBe(0)
  })

  it('marks changes on or after the version the reader last saw', () => {
    expect([...changedSince(changes, '2026-11-22d', '2026-11-22e', '2026-11-22')]).toEqual(['tasks'])
    expect([...changedSince(changes, '2026-11-21a', '2026-11-22e', '2026-11-22')]).toEqual(['tasks', 'meetings'])
  })

  it('marks the last 14 days for a first visit', () => {
    expect([...changedSince(changes, null, '2026-11-22e', '2026-11-22')].sort()).toEqual(['meetings', 'tasks'])
  })

  it('formats dates', () => {
    expect(versionDate('2026-11-22e')).toBe('2026-11-22')
    expect(versionDate('junk')).toBeNull()
    expect(shortDate('2026-11-02')).toBe('2 NOV')
  })
})

describe('url state', () => {
  it('reads and writes section, query, news and highlight', () => {
    const st = readUrlState(new URLSearchParams('s=tasks&q=bulk&new=1&hl=bulk'))
    expect(st).toEqual({ section: 'tasks', query: 'bulk', news: true, mark: 'bulk' })
    const out = writeUrlState(new URLSearchParams('s=tasks&q=bulk&x=1'), { query: '', news: false, section: 'search' })
    expect(out.toString()).toBe('s=search&x=1')
  })
})

describe('guide content', () => {
  it('every contents id, change and section exists exactly once', () => {
    const ids = new Set(guideSections.map((s) => s.id))
    expect(ids.size).toBe(guideSections.length)
    const listed = CATEGORIES.flatMap((c) => c.ids)
    expect(listed.filter((id) => !ids.has(id))).toEqual([])
    expect([...ids].filter((id) => !listed.includes(id))).toEqual([])
    expect(GUIDE_CHANGES.filter((c) => !ids.has(c.section))).toEqual([])
  })

  it('has no em dashes and documents only registered shortcuts', () => {
    expect(JSON.stringify(guideSections)).not.toMatch(/—/)
    const keys = SHORTCUTS.map((s) => s.keys.join(' '))
    expect(keys).not.toContain('⌘ P')
    expect(keys).not.toContain('⌘ T')
    expect(SHORTCUTS.filter((s) => s.top).length).toBe(5)
  })
})
