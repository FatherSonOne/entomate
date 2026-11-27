import { describe, expect, test } from 'vitest'
import { EMPTY_RANGES, parseTypedComparison, rangeDates, readComparisonRanges, validComparisonRanges } from '../services/askDateRanges'

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
