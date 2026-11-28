import { describe, expect, test } from 'vitest'
import { EMPTY_RANGES, eventComparisonRanges, parseTypedComparison, proposeComparison, rangeDates, readComparisonRanges, validComparisonRanges } from '../services/askDateRanges'

test.each([
  ['Compare the two weeks before and after Security Review. What changed?', 'Security Review'],
  ['The 2 weeks before Security Review vs. the 2 weeks after', 'Security Review'],
  ['Compare the two weeks before and after “Security Review v2.1”.', 'Security Review v2.1'],
])('opens confirmation for a named milestone in %s', (question, milestoneName) => {
  expect(proposeComparison(question, 'America/New_York')).toEqual({ ranges: EMPTY_RANGES, eventBased: true, milestoneName })
})

const octoberNovember = {
  previous: { startDate: '2026-10-28', endDate: '2026-10-31' },
  current: { startDate: '2026-11-12', endDate: '2026-11-27' },
}

test.each([
  ['30 days before Security Review vs. 7 days after', 'Security Review'],
  ['30 days before “Security Review v2.1” versus 7 days after. What changed?', 'Security Review v2.1'],
])('previews unequal day windows for %s', (question, milestoneName) => {
  const proposal = proposeComparison(question, 'America/New_York')
  expect(proposal).toEqual({
    ranges: EMPTY_RANGES, eventBased: true, milestoneName,
    eventWindow: { before: { count: 30, unit: 'day' }, after: { count: 7, unit: 'day' } },
  })
  expect(eventComparisonRanges('2026-07-15', proposal?.eventWindow)).toEqual({
    previous: { startDate: '2026-06-15', endDate: '2026-07-14' },
    current: { startDate: '2026-07-16', endDate: '2026-07-22' },
  })
})

test.each([
  '2 weeks before Security Review vs. 1 month after',
  'two weeks before Security Review vs. one month after',
  'two weeks before Security Review vs. 1 month after',
])('resolves the mixed windows in %s', (question) => {
  const proposal = proposeComparison(question, 'America/New_York')
  expect(proposal).toEqual({
    ranges: EMPTY_RANGES, eventBased: true, milestoneName: 'Security Review',
    eventWindow: { before: { count: 2, unit: 'week' }, after: { count: 1, unit: 'month' } },
  })
  expect(eventComparisonRanges('2026-07-15', proposal?.eventWindow)).toEqual({
    previous: { startDate: '2026-07-01', endDate: '2026-07-14' },
    current: { startDate: '2026-07-16', endDate: '2026-08-15' },
  })
})

test('parses hyphenated and space-separated counts before applying the unit', () => {
  const proposal = proposeComparison('twenty-one days before Security Review vs. NINETY NINE days after', 'America/New_York')
  expect(proposal?.eventWindow).toEqual({ before: { count: 21, unit: 'day' }, after: { count: 99, unit: 'day' } })
})

test.each([
  'a week before Security Review vs. a month after',
  'A WEEK before Security Review vs. 1 month after',
  'one week before Security Review vs. a month after',
])('resolves single-unit windows in %s', (question) => {
  const proposal = proposeComparison(question, 'America/New_York')
  expect(proposal).toEqual({
    ranges: EMPTY_RANGES, eventBased: true, milestoneName: 'Security Review',
    eventWindow: { before: { count: 1, unit: 'week' }, after: { count: 1, unit: 'month' } },
  })
  expect(eventComparisonRanges('2026-07-15', proposal?.eventWindow)).toEqual({
    previous: { startDate: '2026-07-08', endDate: '2026-07-14' },
    current: { startDate: '2026-07-16', endDate: '2026-08-15' },
  })
})

test('supports a single day and clamps an implied month to the last day of the target month', () => {
  const proposal = proposeComparison('a day before Security Review vs. a month after', 'America/New_York')
  expect(eventComparisonRanges('2026-01-31', proposal?.eventWindow)).toEqual({
    previous: { startDate: '2026-01-30', endDate: '2026-01-30' },
    current: { startDate: '2026-02-01', endDate: '2026-02-28' },
  })
})

test('asks for an exact count for a few weeks while keeping the later month', () => {
  const proposal = proposeComparison('a few weeks before Security Review vs. a month after', 'America/New_York')
  expect(proposal).toEqual({
    ranges: EMPTY_RANGES, eventBased: true, milestoneName: 'Security Review',
    eventWindow: { before: { count: null, unit: 'week' }, after: { count: 1, unit: 'month' } },
  })
  expect(eventComparisonRanges('2026-07-15', proposal?.eventWindow)).toEqual(EMPTY_RANGES)
  expect(eventComparisonRanges('2026-07-15', proposal?.eventWindow, { before: 0 })).toEqual(EMPTY_RANGES)
  expect(eventComparisonRanges('2026-07-15', proposal?.eventWindow, { before: 2.5 })).toEqual(EMPTY_RANGES)
  expect(eventComparisonRanges('2026-07-15', proposal?.eventWindow, { before: 3 })).toEqual({
    previous: { startDate: '2026-06-24', endDate: '2026-07-14' },
    current: { startDate: '2026-07-16', endDate: '2026-08-15' },
  })
})

test('keeps a known earlier count when the later count needs clarification', () => {
  const proposal = proposeComparison('a day before Security Review vs. a few days after', 'America/New_York')
  expect(eventComparisonRanges('2026-07-15', proposal?.eventWindow, { after: 4 })).toEqual({
    previous: { startDate: '2026-07-14', endDate: '2026-07-14' },
    current: { startDate: '2026-07-16', endDate: '2026-07-19' },
  })
})

test('requires both counts for a few weeks before and several days after', () => {
  const proposal = proposeComparison('a few weeks before Security Review vs. several days after', 'America/New_York')
  expect(proposal).toEqual({
    ranges: EMPTY_RANGES, eventBased: true, milestoneName: 'Security Review',
    eventWindow: { before: { count: null, unit: 'week' }, after: { count: null, unit: 'day' } },
  })
  expect(eventComparisonRanges('2026-07-15', proposal?.eventWindow, { before: 3 })).toEqual(EMPTY_RANGES)
  expect(eventComparisonRanges('2026-07-15', proposal?.eventWindow, { after: 5 })).toEqual(EMPTY_RANGES)
  expect(eventComparisonRanges('2026-07-15', proposal?.eventWindow, { before: 3, after: 5 })).toEqual({
    previous: { startDate: '2026-06-24', endDate: '2026-07-14' },
    current: { startDate: '2026-07-16', endDate: '2026-07-20' },
  })
})

test('suggests an editable count for a couple of weeks and waits for the few days', () => {
  const proposal = proposeComparison('a couple of weeks before Security Review vs. a few days after', 'America/New_York')
  expect(proposal).toEqual({
    ranges: EMPTY_RANGES, eventBased: true, milestoneName: 'Security Review',
    eventWindow: { before: { count: 2, unit: 'week', editable: true }, after: { count: null, unit: 'day' } },
  })
  expect(eventComparisonRanges('2026-07-15', proposal?.eventWindow)).toEqual(EMPTY_RANGES)
  expect(eventComparisonRanges('2026-07-15', proposal?.eventWindow, { after: 5 })).toEqual({
    previous: { startDate: '2026-07-01', endDate: '2026-07-14' },
    current: { startDate: '2026-07-16', endDate: '2026-07-20' },
  })
  expect(eventComparisonRanges('2026-07-15', proposal?.eventWindow, { before: null, after: 5 })).toEqual(EMPTY_RANGES)
  expect(eventComparisonRanges('2026-07-15', proposal?.eventWindow, { before: 2.5, after: 5 })).toEqual(EMPTY_RANGES)
  expect(eventComparisonRanges('2026-07-15', proposal?.eventWindow, { before: 3, after: 5 })).toEqual({
    previous: { startDate: '2026-06-24', endDate: '2026-07-14' },
    current: { startDate: '2026-07-16', endDate: '2026-07-20' },
  })
})

test('can suggest an editable later count and use calendar months for the window', () => {
  const proposal = proposeComparison('a day before Security Review vs. a couple of months after', 'America/New_York')
  expect(eventComparisonRanges('2026-12-31', proposal?.eventWindow)).toEqual({
    previous: { startDate: '2026-12-30', endDate: '2026-12-30' },
    current: { startDate: '2027-01-01', endDate: '2027-02-28' },
  })
})

test('uses the entire spelled-out count when it ends in a legacy two-week window', () => {
  const proposal = proposeComparison('twenty two weeks before Security Review vs. two weeks after', 'America/New_York')
  expect(proposal?.eventWindow).toEqual({ before: { count: 22, unit: 'week' }, after: { count: 2, unit: 'week' } })
})

test.each([
  ['2026-01-31', '2026-02-28'],
  ['2024-01-31', '2024-02-29'],
])('uses the last day of February for a calendar month after %s', (milestoneDate, endDate) => {
  const proposal = proposeComparison('one day before “Security Review v2.1” vs. one MONTH after', 'America/New_York')
  expect(proposal).toMatchObject({ milestoneName: 'Security Review v2.1' })
  expect(eventComparisonRanges(milestoneDate, proposal?.eventWindow).current)
    .toEqual({ startDate: milestoneDate.slice(0, 4) + '-02-01', endDate })
})

test('clamps a month before the milestone and keeps the original day for a multi-month offset', () => {
  const proposal = proposeComparison('1 month before Security Review vs. 2 months after', 'America/New_York')
  expect(eventComparisonRanges('2024-03-31', proposal?.eventWindow)).toEqual({
    previous: { startDate: '2024-02-29', endDate: '2024-03-30' },
    current: { startDate: '2024-04-01', endDate: '2024-05-31' },
  })
})

test.each(['0 days before Security Review vs. 7 days after',
  '-30 days before Security Review vs. 7 days after',
  '30 days before Security Review vs. 1.5 days after',
  '-2 weeks before Security Review vs. 2 weeks after',
  '2 weeks before Security Review vs. 1.5 months after',
  'minus two weeks before Security Review vs. two weeks after',
  'one hundred and two weeks before Security Review vs. two weeks after',
  'two weeks before Security Review vs. one hundred months after',
  'two weeks before Security Review vs. half a month after',
  'two weeks before Security Review vs. zero months after',
  'a weeks before Security Review vs. a month after',
  'a week before Security Review vs. a months after',
])('requires a correction for %s', (question) => {
  const proposal = proposeComparison(question, 'America/New_York')
  expect(proposal?.eventWindow).toBe('invalid')
  expect(eventComparisonRanges('2026-07-15', proposal?.eventWindow)).toEqual(EMPTY_RANGES)
})

test('leaves an ordinary milestone question available to Ask', () => {
  expect(proposeComparison('What did we discuss two weeks before Security Review?', 'America/New_York')).toBeNull()
})

test('resolves single-day windows at a year boundary and rejects dates beyond the supported calendar', () => {
  const proposal = proposeComparison('1 day before Security Review vs. 1 day after', 'America/New_York')
  expect(eventComparisonRanges('2027-01-01', proposal?.eventWindow)).toEqual({
    previous: { startDate: '2026-12-31', endDate: '2026-12-31' },
    current: { startDate: '2027-01-02', endDate: '2027-01-02' },
  })
  expect(eventComparisonRanges('0001-01-01', proposal?.eventWindow)).toEqual(EMPTY_RANGES)
})

test('opens launch confirmation and resolves 14 calendar days on each side of the selected date', () => {
  expect(proposeComparison('The two weeks before launch vs. the two weeks after', 'America/New_York'))
    .toEqual({ ranges: EMPTY_RANGES, eventBased: true })
  expect(proposeComparison('2 weeks before launch vs. 2 weeks after', 'America/New_York'))
    .toEqual({ ranges: EMPTY_RANGES, eventBased: true })
  expect(eventComparisonRanges('2026-11-12')).toEqual({
    previous: { startDate: '2026-10-29', endDate: '2026-11-11' },
    current: { startDate: '2026-11-13', endDate: '2026-11-26' },
  })
  expect(eventComparisonRanges('2026-02-30')).toEqual(EMPTY_RANGES)
})

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

  test.each([
    'Last week vs. the previous week',
    'Compare the last completed week with the previous completed week.',
    'What changed between the previous week and the last week?',
    'Compare the last 1 week with the previous 1.',
  ])('resolves completed Monday–Sunday weeks for "%s"', (question) => {
    expect(proposeComparison(question, timeZone, new Date('2026-11-28T15:00:00Z'))).toEqual({
      ranges: periods('2026-11-09', '2026-11-15', '2026-11-16', '2026-11-22'),
      relative: 'completed-weeks',
    })
  })

  test.each([
    'Compare the last 2 weeks with the previous 2.',
    'The previous 2 weeks compared with the last 2 weeks',
  ])('resolves adjacent multiweek periods for "%s"', (question) => {
    expect(proposeComparison(question, timeZone, new Date('2026-11-28T15:00:00Z'))?.ranges)
      .toEqual(periods('2026-10-26', '2026-11-08', '2026-11-09', '2026-11-22'))
  })

  test.each([
    ['2026-11-30T04:59:59Z', periods('2026-11-09', '2026-11-15', '2026-11-16', '2026-11-22')],
    ['2026-11-30T05:00:00Z', periods('2026-11-16', '2026-11-22', '2026-11-23', '2026-11-29')],
    ['2026-03-09T04:05:00Z', periods('2026-02-23', '2026-03-01', '2026-03-02', '2026-03-08')],
    ['2026-11-02T05:05:00Z', periods('2026-10-19', '2026-10-25', '2026-10-26', '2026-11-01')],
    ['2027-01-04T05:05:00Z', periods('2026-12-21', '2026-12-27', '2026-12-28', '2027-01-03')],
  ])('uses the local Monday boundary at %s', (instant, expected) => {
    expect(proposeComparison('Last week vs the previous week', timeZone, new Date(instant))?.ranges).toEqual(expected)
  })

  test.each([
    'The last 3 months vs. the previous 3',
    'Compare the last 3 completed months with the previous 3 months.',
    'What changed between the previous 3 months and the last 3 months?',
  ])('resolves completed calendar months for "%s"', (question) => {
    expect(proposeComparison(question, timeZone, asOf)).toEqual({
      ranges: periods('2026-05-01', '2026-07-31', '2026-08-01', '2026-10-31'),
      relative: 'completed-months',
    })
  })

  test.each([
    ['2026-12-01T04:59:59Z', 3, periods('2026-05-01', '2026-07-31', '2026-08-01', '2026-10-31')],
    ['2026-12-01T05:00:00Z', 3, periods('2026-06-01', '2026-08-31', '2026-09-01', '2026-11-30')],
    ['2027-01-31T15:00:00Z', 3, periods('2026-07-01', '2026-09-30', '2026-10-01', '2026-12-31')],
    ['2024-03-31T15:00:00Z', 1, periods('2024-01-01', '2024-01-31', '2024-02-01', '2024-02-29')],
    ['2026-03-31T15:00:00Z', 1, periods('2026-01-01', '2026-01-31', '2026-02-01', '2026-02-28')],
  ])('uses exact month boundaries at %s', (instant, count, expected) => {
    const question = 'Last ' + count + ' months vs previous ' + count
    expect(proposeComparison(question, timeZone, new Date(instant))?.ranges).toEqual(expected)
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
    'Last 0 weeks vs previous 0',
    'Last 1.5 weeks vs previous 1.5',
    'Last 2 weeks vs previous 3 weeks',
  ])('asks for corrections for invalid weekly periods in "%s"', (question) => {
    expect(proposeComparison(question, timeZone, asOf)).toEqual({ ranges: EMPTY_RANGES, relative: 'invalid-week-count' })
  })

  test.each([
    'Last 0 months vs previous 0',
    'Last 1.5 months vs previous 1.5',
    'Last 3 months vs previous 2 months',
  ])('asks for corrections for invalid monthly periods in "%s"', (question) => {
    expect(proposeComparison(question, timeZone, asOf)).toEqual({ ranges: EMPTY_RANGES, relative: 'invalid-month-count' })
  })

  test.each([
    'What happened in the last 30 days?',
    'Compare this month to date with all of last month',
    'What happened in the last week?',
    'What happened in the last 3 months?',
    'Compare last 2 weeks with the previous 2 days',
    'Compare what happened in the last 30 days vs the previous 30 tasks.',
  ])('keeps ordinary Ask behavior for "%s"', (question) => {
    expect(proposeComparison(question, timeZone, asOf)).toBeNull()
  })
})
