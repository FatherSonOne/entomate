import { describe, expect, test } from 'vitest'
import { EMPTY_RANGES, parseTypedComparison, proposeComparison, rangeDates, readComparisonRanges, validComparisonRanges } from '../services/askDateRanges'

const octoberNovember = {
  previous: { startDate: '2026-10-28', endDate: '2026-10-31' },
  current: { startDate: '2026-11-12', endDate: '2026-11-27' },
}

describe('typed Ask comparison', () => {
  test.each([
    'Compare 2026-10-28 to 2026-10-31 with 2026-11-12 through 2026-11-27.',
    '2026-10-28–2026-10-31 vs. 2026-11-12–2026-11-27',
    'What changed about the rollout between Oct 28–31, 2026 and Nov 12–27, 2026?',
    'Compare October 28, 2026 to October 31, 2026 with Nov. 12th through Nov. 27th, 2026.',
    'Compare November 12–27, 2026 against October 28–31, 2026.',
    'What changed from Oct. 28 to 31, 2026 to November 12–27, 2026?',
  ])('resolves the explicit periods in "%s"', (question) => {
    expect(parseTypedComparison(question)).toEqual(octoberNovember)
    expect(readComparisonRanges(rangeDates(octoberNovember).join(','))).toEqual(octoberNovember)
  })

  test('supports written ranges that span months or years', () => {
    expect(parseTypedComparison('Compare December 30, 2026–January 2, 2027 with January 30–February 2, 2027.')).toEqual({
      previous: { startDate: '2026-12-30', endDate: '2027-01-02' },
      current: { startDate: '2027-01-30', endDate: '2027-02-02' },
    })
  })

  test.each([
    ['October 28–31', EMPTY_RANGES.previous],
    ['Oct 28–31, 26', EMPTY_RANGES.previous],
    ['10/11 to 10/13', EMPTY_RANGES.previous],
    ['Feb 29–Mar 1, 2026', { startDate: '', endDate: '2026-03-01' }],
    ['2026-02-30 to 2026-03-01', { startDate: '', endDate: '2026-03-01' }],
  ])('leaves unresolved dates blank and preserves the other range for "%s"', (earlier, previous) => {
    const draft = parseTypedComparison('Compare ' + earlier + ' with Nov 12–27, 2026.')
    expect(draft).not.toBeNull()
    expect(draft).toEqual({ previous, current: octoberNovember.current })
    expect(draft && validComparisonRanges(draft)).toBe(false)
  })

  test('retains the later range when the earlier range is unfinished', () => {
    expect(parseTypedComparison('Compare Oct 28, 2026 with Nov 12–27, 2026.')).toEqual({
      previous: EMPTY_RANGES.previous, current: octoberNovember.current,
    })
  })

  test.each([
    'Compare Oct 28–Nov 12, 2026 with Nov 12–27, 2026.',
    'Compare October 31–28, 2026 with November 12–27, 2026.',
  ])('shows the typed dates but rejects an invalid order or overlap for "%s"', (question) => {
    const draft = parseTypedComparison(question)
    expect(draft && rangeDates(draft).every(Boolean)).toBe(true)
    expect(draft && validComparisonRanges(draft)).toBe(false)
  })

  test('does not select two periods out of three', () => {
    expect(parseTypedComparison('Compare Oct 28–31, 2026 vs Nov 12–27, 2026 vs Dec 10–15, 2026.')).toEqual(EMPTY_RANGES)
  })

  test.each([
    'Compare this month to date with all of last month',
    'What changed this month?',
    'Who owned the rollout on October 28, 2026?',
    'What was decided between October 28 and October 31, 2026?',
    'Compare the design and engineering decisions from October 28, 2026.',
    'Compare the decisions from the design and engineering teams.',
  ])('leaves existing Ask behavior alone for "%s"', (question) => {
    expect(parseTypedComparison(question)).toBeNull()
  })
})

describe('relative Ask comparison', () => {
  const timeZone = 'America/New_York'
  const asOf = new Date('2026-11-28T04:59:00Z')
  const periods = (earlierStart: string, earlierEnd: string, laterStart: string, laterEnd: string) => ({
    previous: { startDate: earlierStart, endDate: earlierEnd },
    current: { startDate: laterStart, endDate: laterEnd },
  })

  test.each([
    'The last 30 days vs. the previous 30',
    'Compare the last 30 completed days with the previous 30 days.',
    'What changed between the previous 30 days and the last 30 days?',
    'Compare the last 30 days vs the previous 30 for the rollout',
  ])('proposes two adjacent periods for "%s"', (question) => {
    expect(proposeComparison(question, timeZone, asOf)).toEqual({
      ranges: periods('2026-09-28', '2026-10-27', '2026-10-28', '2026-11-26'),
      relative: 'completed-days',
    })
  })

  test('uses the local date and advances the suggestion at local midnight', () => {
    const question = 'Last 30 days vs. previous 30.'
    const nextMinute = new Date('2026-11-28T05:00:00Z')
    const expected = periods('2026-09-29', '2026-10-28', '2026-10-29', '2026-11-27')
    expect(proposeComparison(question, 'UTC', asOf)?.ranges).toEqual(expected)
    expect(proposeComparison(question, timeZone, nextMinute)?.ranges).toEqual(expected)
    expect(proposeComparison(question, timeZone, asOf)?.ranges).not.toEqual(expected)
  })

  test.each([
    ['2026-03-10T04:30:00Z', periods('2026-03-06', '2026-03-07', '2026-03-08', '2026-03-09')],
    ['2026-11-03T05:30:00Z', periods('2026-10-30', '2026-10-31', '2026-11-01', '2026-11-02')],
    ['2024-03-02T05:10:00Z', periods('2024-02-27', '2024-02-28', '2024-02-29', '2024-03-01')],
    ['2027-01-02T05:01:00Z', periods('2026-12-29', '2026-12-30', '2026-12-31', '2027-01-01')],
  ])('subtracts calendar days across boundaries at %s', (instant, expected) => {
    expect(proposeComparison('Last 2 days vs previous 2 days', timeZone, new Date(instant))?.ranges).toEqual(expected)
  })

  test('supports single-day periods', () => {
    expect(proposeComparison('Last 1 day vs previous 1', timeZone, asOf)?.ranges)
      .toEqual(periods('2026-11-25', '2026-11-25', '2026-11-26', '2026-11-26'))
  })

  test.each(['0', '-1', '2.5', '9007199254740992', '1000000'])('asks for corrections for an invalid count of %s', (count) => {
    expect(proposeComparison('Compare last ' + count + ' days vs previous ' + count, timeZone, asOf))
      .toEqual({ ranges: EMPTY_RANGES, relative: 'invalid-day-count' })
  })

  test('asks for corrections when the counts differ', () => {
    expect(proposeComparison('Compare last 30 days vs previous 15', timeZone, asOf))
      .toEqual({ ranges: EMPTY_RANGES, relative: 'invalid-day-count' })
  })

  test.each([
    'What happened in the last 30 days?',
    'Compare this month to date with all of last month',
    'Compare last 2 weeks with the previous 2 weeks',
    'Compare what happened in the last 30 days vs the previous 30 tasks.',
  ])('keeps ordinary Ask behavior for "%s"', (question) => {
    expect(proposeComparison(question, timeZone, asOf)).toBeNull()
  })
})
