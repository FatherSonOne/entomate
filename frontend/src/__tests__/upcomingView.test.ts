import { describe, it, expect } from 'vitest'
import {
  botPlan, dayKey, dotsByDay, durationLabel, groupByDay, monthGrid, normalizeUpcoming, peopleLine,
  weekBlocks, weekStart, withOverride, type UpcomingEvent,
} from '../services/upcomingView'

const ev = (o: Partial<UpcomingEvent> = {}): UpcomingEvent => ({
  id: 'e1', key: 'e1@2026-11-24T20:00:00.000Z', title: 'Northwind check-in',
  start: '2026-11-24T15:00:00', end: '2026-11-24T15:30:00', allDay: false, platform: 'meet',
  join: true, reason: null, override: null, canJoin: true, organizer: 'you',
  attendees: [{ name: 'Dana Ruiz', email: 'dana@x.test', self: false }, { name: null, email: 'me@x.test', self: true }],
  botStatus: null, htmlLink: null, ...o,
})

describe('normalizeUpcoming', () => {
  it('survives an empty or partial reply and sorts by start', () => {
    expect(normalizeUpcoming(undefined)).toMatchObject({ connected: false, events: [], autoJoin: { enabled: false, scope: 'organized' } })
    const out = normalizeUpcoming({ connected: true, autoJoin: { enabled: true }, events: [ev({ id: 'b', start: '2026-11-25T09:00:00' }), { nope: 1 }, ev({ id: 'a' })] })
    expect(out.events.map((e) => e.id)).toEqual(['a', 'b'])
  })
})

describe('botPlan', () => {
  it('a meeting you organize: Bot joins, Skip saves skip', () => {
    expect(botPlan(ev(), true)).toMatchObject({ tone: 'brand', word: 'Bot joins', why: 'You organize it', key: { label: 'Skip', decision: 'skip' }, goes: true })
  })
  it('a skipped one offers Join, which clears the skip', () => {
    expect(botPlan(ev({ join: false, reason: 'skipped', override: 'skip' }), true)).toMatchObject({ word: 'Skipped', key: { label: 'Join', decision: null }, goes: false })
  })
  it("someone else's meeting offers Join; no link offers nothing", () => {
    expect(botPlan(ev({ join: false, reason: 'not_organizer', organizer: 'Lee Halden' }), true)).toMatchObject({ word: 'Not yours', why: 'Lee Halden organizes it', key: { decision: 'join' } })
    expect(botPlan(ev({ join: false, reason: 'no_link', canJoin: false, platform: null }), true).key).toBeNull()
  })
  it('auto-join off and all-day events have no key; a bot in the call is live', () => {
    expect(botPlan(ev(), false)).toMatchObject({ word: 'Auto-join off', key: null })
    expect(botPlan(ev({ allDay: true }), true)).toMatchObject({ word: 'No bot', key: null })
    expect(botPlan(ev({ botStatus: 'in_call' }), true).tone).toBe('live')
    expect(botPlan(ev({ botStatus: 'pending' }), true).word).toBe('Bot booked')
  })
  it('withOverride mirrors the server', () => {
    expect(withOverride(ev(), 'skip')).toMatchObject({ join: false, reason: 'skipped', override: 'skip' })
    expect(withOverride(ev({ join: false, reason: 'skipped', override: 'skip' }), null)).toMatchObject({ join: true, override: null })
  })
})

describe('days and calendars', () => {
  const events = [ev(), ev({ id: 'x', start: '2026-11-24T10:00:00', end: '2026-11-24T11:00:00', join: false, reason: 'skipped' }), ev({ id: 'h', start: '2026-11-26', end: '2026-11-27', allDay: true })]
  it('groups by local day from a given day', () => {
    const g = groupByDay(events)
    expect(g.map((d) => [d.key, d.events.length])).toEqual([['2026-11-24', 2], ['2026-11-26', 1]])
    expect(groupByDay(events, '2026-11-25').map((d) => d.key)).toEqual(['2026-11-26'])
  })
  it('dots: filled when the bot goes, hollow when not', () => {
    expect(dotsByDay(events, true).get('2026-11-24')).toEqual([true, false])
  })
  it('month grid is six Monday-first weeks', () => {
    const g = monthGrid(2026, 10)
    expect(g).toHaveLength(42)
    expect(g[0]?.key).toBe('2026-10-26')
    expect(g.find((c) => c.key === '2026-11-22')?.inMonth).toBe(true)
  })
  it('week blocks sit on the hour grid', () => {
    const mon = weekStart(new Date('2026-11-24T12:00:00'))
    expect(dayKey(mon)).toBe('2026-11-23')
    const w = weekBlocks(events, mon)
    expect(w.hours).toEqual([8, 18])
    const b = w.blocks.find((x) => x.event.id === 'e1')
    expect(b?.day).toBe(1)
    expect(b?.top).toBeCloseTo(0.7)
    expect(w.allDay[0]?.day).toBe(3)
  })
  it('labels', () => {
    expect(durationLabel(30)).toBe('30m')
    expect(durationLabel(90)).toBe('1h 30m')
    expect(peopleLine(ev())).toBe('You, Dana Ruiz')
  })
})
