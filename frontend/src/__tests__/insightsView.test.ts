import { describe, it, expect } from 'vitest'
import {
  findOwner, isBehind, meterBars, ownerKey, ownerLabel, rateLabel, readUrlState,
  shortDay, titleMeta, weekLabel, writeUrlState, type InsightsData, type WeekRow,
} from '../services/insightsView'

const week = (start: string, end: string, onTimeRate: number | null, due = 4): WeekRow => ({
  start, end, current: false, meetings: 2, decisions: 3, items: 5, done: 3, due, onTimeRate,
})

describe('labels', () => {
  it('formats rates, owners and days', () => {
    expect(rateLabel(null)).toBe('—')
    expect(rateLabel(71)).toBe('71%')
    expect(ownerLabel(null)).toBe('No owner')
    expect(ownerKey(null)).toBe('__none__')
    expect(shortDay('2026-11-24')).toBe('24 Nov')
  })

  it('labels weeks within and across months', () => {
    expect(weekLabel('2026-11-16', '2026-11-22')).toBe('16–22 Nov')
    expect(weekLabel('2026-10-26', '2026-11-01')).toBe('26 Oct–1 Nov')
  })

  it('marks below 70% as behind', () => {
    expect(isBehind(69)).toBe(true)
    expect(isBehind(70)).toBe(false)
    expect(isBehind(null)).toBe(false)
  })
})

describe('meterBars', () => {
  it('runs oldest to newest with tones and a stub for empty weeks', () => {
    const bars = meterBars([week('2026-11-16', '2026-11-22', 64), week('2026-11-09', '2026-11-15', null, 0), week('2026-11-02', '2026-11-08', 80)])
    expect(bars.map((b) => b.label)).toEqual(['02', '09', '16'])
    expect(bars.map((b) => b.tone)).toEqual(['live', 'off', 'brand'])
    expect(bars[1]?.height).toBe(6)
    expect(bars[2]?.title).toContain('64% done on time')
  })
})

describe('findOwner', () => {
  it('finds by key, including No owner', () => {
    const owners = [
      { name: 'Priya S.', open: 1, overdue: 0, done: 0, onTimeRate: null, items: [] },
      { name: null, open: 2, overdue: 1, done: 0, onTimeRate: null, items: [] },
    ]
    expect(findOwner(owners, '__none__')?.open).toBe(2)
    expect(findOwner(owners, 'Priya S.')?.open).toBe(1)
    expect(findOwner(owners, 'Nobody')).toBeNull()
    expect(findOwner(owners, null)).toBeNull()
  })
})

describe('titleMeta', () => {
  it('reads period, meetings and overdue', () => {
    const data = { meetings: 1, overdue: 5 } as InsightsData
    expect(titleMeta(data, '30')).toBe('Last 30 days · 1 meeting · 5 overdue')
    expect(titleMeta(null, '7')).toBe('Last 7 days')
  })
})

describe('URL state', () => {
  it('defaults to 30 days with nothing open', () => {
    expect(readUrlState(new URLSearchParams())).toEqual({ period: '30', owner: null, exportKind: null })
  })

  it('reads period, owner and export, and drops unknown exports to an open drawer', () => {
    expect(readUrlState(new URLSearchParams('per=90&owner=Jon&export=weekly-pdf'))).toEqual({ period: '90', owner: 'Jon', exportKind: 'weekly-pdf' })
    expect(readUrlState(new URLSearchParams('per=12&export=goals-csv'))).toEqual({ period: '30', owner: null, exportKind: '' })
  })

  it('writes only what changed and omits defaults', () => {
    const p = writeUrlState(new URLSearchParams('owner=Jon'), { period: '7', exportKind: '' })
    expect(p.toString()).toBe('owner=Jon&per=7&export=')
    expect(writeUrlState(p, { period: '30', owner: null, exportKind: null }).toString()).toBe('')
  })
})
