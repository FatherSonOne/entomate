export interface DateRange { startDate: string; endDate: string }

export interface ComparisonRanges {
  previous: DateRange
  current: DateRange
}

type RelativeUnit = 'day' | 'week' | 'month'
interface EventWindow { beforeDays: number; afterDays: number }

export interface ComparisonProposal {
  ranges: ComparisonRanges
  relative?: `completed-${RelativeUnit}s` | `invalid-${RelativeUnit}-count`
  eventBased?: true
  milestoneName?: string
  eventWindow?: EventWindow | 'invalid'
}

export interface ComparisonEvent {
  name: string
  date: string
  source: 'manual' | 'scheduled' | 'completed'
  key?: string
}

export const EMPTY_RANGES: ComparisonRanges = {
  previous: { startDate: '', endDate: '' },
  current: { startDate: '', endDate: '' },
}

export const rangeDates = ({ previous, current }: ComparisonRanges) =>
  [previous.startDate, previous.endDate, current.startDate, current.endDate]

export function isCalendarDate(value: string): boolean {
  if (!/^(?!0000)\d{4}-\d{2}-\d{2}$/.test(value)) return false
  const date = new Date(value)
  return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value
}

export function validComparisonRanges(ranges: ComparisonRanges): boolean {
  const { previous, current } = ranges
  return rangeDates(ranges).every(isCalendarDate) && previous.startDate <= previous.endDate
    && previous.endDate < current.startDate && current.startDate <= current.endDate
}

export function readComparisonRanges(value: string | null): ComparisonRanges | null {
  const dates = value?.split(',')
  if (dates?.length !== 4) return null
  const [earlierStart = '', earlierEnd = '', laterStart = '', laterEnd = ''] = dates
  const ranges = {
    previous: { startDate: earlierStart, endDate: earlierEnd },
    current: { startDate: laterStart, endDate: laterEnd },
  }
  return validComparisonRanges(ranges) ? ranges : null
}

const MONTH = String.raw`(?:Jan(?:uary)?|Feb(?:ruary)?|Mar(?:ch)?|Apr(?:il)?|May|Jun(?:e)?|Jul(?:y)?|Aug(?:ust)?|Sep(?:t(?:ember)?)?|Oct(?:ober)?|Nov(?:ember)?|Dec(?:ember)?)\.?`
const ISO = String.raw`\d{4}-\d{2}-\d{2}`
const DAY = String.raw`\d{1,2}(?:st|nd|rd|th)?`
const YEAR = String.raw`(?:\s*,\s*\d{2,4}|\s+\d{4})?`
const NUMERIC = String.raw`\d{1,2}/\d{1,2}(?:/\d{2,4})?`
const FULL_DATE = String.raw`${ISO}|${MONTH}\s+${DAY}${YEAR}|${NUMERIC}`
const PERIOD = new RegExp(String.raw`(?<![\w/])(${FULL_DATE})(?:\s*[-–—]\s*|\s+(?:to|through)\s+)(${FULL_DATE}|${DAY}${YEAR})(?![\w/])`, 'gi')
const DATE_MENTION = new RegExp(String.raw`(?<![\w/])(?:${ISO}|${MONTH}\s+${DAY}|${NUMERIC})(?![\w/])`, 'gi')
const ISO_PARTS = /^(\d{4})-(\d{2})-(\d{2})$/
const WRITTEN_PARTS = new RegExp(String.raw`^(?:(${MONTH})\s+)?(\d{1,2})(?:st|nd|rd|th)?(?:[\s,]+(\d{2,4}))?$`, 'i')
const MONTHS = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec']

function dateParts(token: string) {
  const iso = ISO_PARTS.exec(token)
  if (iso) return { year: iso[1], month: Number(iso[2]), day: Number(iso[3]) }
  const written = WRITTEN_PARTS.exec(token)
  if (!written) return null
  const month = written[1] ? MONTHS.indexOf(written[1].slice(0, 3).toLowerCase()) + 1 : undefined
  return { year: written[3], month, day: Number(written[2]) }
}

function dateString(year: string | undefined, month: number | undefined, day: number): string {
  if (year?.length !== 4 || month === undefined) return ''
  const date = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`
  return isCalendarDate(date) ? date : ''
}

function parsePeriod([, start = '', end = '']: RegExpMatchArray): DateRange {
  const first = dateParts(start)
  const last = dateParts(end)
  return {
    startDate: first ? dateString(first.year ?? last?.year, first.month, first.day) : '',
    endDate: last ? dateString(last.year ?? first?.year, last.month ?? first?.month, last.day) : '',
  }
}

/** Null leaves ordinary Ask alone. Blank fields need clarification before comparing. */
export function parseTypedComparison(question: string): ComparisonRanges | null {
  const comparing = /\b(?:compar(?:e|es|ed|ing|ison)|versus|vs)\b/i.test(question)
  const changeQuestion = /\b(?:between|chang(?:e|ed|es))\b/i.test(question)
  if (!comparing && !changeQuestion) return null

  const periods = [...question.matchAll(PERIOD)]
  if (periods.length > 2) return EMPTY_RANGES
  const [first, second] = periods
  if (!first) return comparing && [...question.matchAll(DATE_MENTION)].length >= 2 ? EMPTY_RANGES : null
  if (!second) {
    const start = first.index ?? 0
    const before = [...question.slice(0, start).matchAll(DATE_MENTION)].length > 0
    const after = [...question.slice(start + first[0].length).matchAll(DATE_MENTION)].length > 0
    if (!comparing && !before && !after) return null
    const parsed = parsePeriod(first)
    return before && !after ? { ...EMPTY_RANGES, current: parsed } : { ...EMPTY_RANGES, previous: parsed }
  }

  // Never infer a year from the other range or from the current date.
  const previous = parsePeriod(first)
  const current = parsePeriod(second)
  return previous.startDate && current.startDate && previous.startDate > current.startDate
    ? { previous: current, current: previous }
    : { previous, current }
}

const COUNT = String.raw`([+-]?\d+(?:\.\d+)?)(?![\w/]|\.\d)`
const COMPARE = String.raw`\s+(?:vs\.?|versus|compared\s+(?:to|with)|against|with|to|and)\s+(?:the\s+)?`
const LAUNCH_COMPARISON = new RegExp(
  String.raw`\b(?:two|2)\s+weeks\s+before\s+(?:the\s+)?launch${COMPARE}(?:two|2)\s+weeks\s+after\b`, 'i',
)

const MILESTONE_TITLE = String.raw`(?:"([^"\r\n]+)"|“([^”\r\n]+)”|([^.!?;\r\n]+?))`
const MILESTONE_END = String.raw`(?=\s*(?:[.!?;\r\n]|$))`
const SURROUND_MILESTONE = new RegExp(
  String.raw`\b(?:two|2)\s+weeks\s+before\s+and\s+after\s+${MILESTONE_TITLE}${MILESTONE_END}`, 'i',
)
const COMPARE_AROUND_MILESTONE = new RegExp(
  String.raw`\b(?:two|2)\s+weeks\s+before\s+${MILESTONE_TITLE}${COMPARE}(?:two|2)\s+weeks\s+after\b${MILESTONE_END}`, 'i',
)
const CUSTOM_MILESTONE_WINDOW = new RegExp(
  String.raw`(?<![\w./+-])${COUNT}\s+days?\s+before\s+${MILESTONE_TITLE}${COMPARE}${COUNT}\s+days?\s+after\b${MILESTONE_END}`, 'i',
)

const validDayCount = (value: number) => Number.isSafeInteger(value) && value > 0
const cleanMilestoneTitle = (title?: string) => title?.trim().slice(0, 160) || undefined

export function eventComparisonProposal(question: string): ComparisonProposal | null {
  const custom = CUSTOM_MILESTONE_WINDOW.exec(question)
  if (custom) {
    const [, before, quoted, curved, plain, after] = custom
    const milestoneName = cleanMilestoneTitle(quoted ?? curved ?? plain)
    if (!milestoneName) return null
    const beforeDays = Number(before)
    const afterDays = Number(after)
    return { ranges: EMPTY_RANGES, eventBased: true, milestoneName,
      eventWindow: validDayCount(beforeDays) && validDayCount(afterDays) ? { beforeDays, afterDays } : 'invalid' }
  }
  if (LAUNCH_COMPARISON.test(question)) return { ranges: EMPTY_RANGES, eventBased: true }
  const match = SURROUND_MILESTONE.exec(question) ?? COMPARE_AROUND_MILESTONE.exec(question)
  const milestoneName = cleanMilestoneTitle(match?.[1] ?? match?.[2] ?? match?.[3])
  return milestoneName ? { ranges: EMPTY_RANGES, eventBased: true, milestoneName } : null
}

const ELIDED_UNIT = String.raw`(?=\s*(?:[.,:;!?]|$)|\s+(?:for|on|about|in)\b)`
const LAST_WEEK = String.raw`\blast\s+(?:completed\s+)?week\b`
const PREVIOUS_WEEK = String.raw`\bprevious\s+(?:completed\s+)?week\b`
const SINGLE_WEEK_COMPARISON = new RegExp(
  String.raw`${LAST_WEEK}${COMPARE}${PREVIOUS_WEEK}|${PREVIOUS_WEEK}${COMPARE}${LAST_WEEK}`, 'i',
)

function numberedComparisonPatterns(unit: RelativeUnit) {
  const suffix = String.raw`\s+(?:completed\s+)?${unit}s?\b`
  const last = String.raw`\blast\s+${COUNT}${suffix}`
  const previous = String.raw`\bprevious\s+${COUNT}`
  return {
    unit,
    forward: new RegExp(String.raw`${last}${COMPARE}${previous}(?:${suffix}|${ELIDED_UNIT})`, 'i'),
    reverse: new RegExp(String.raw`${previous}(?:${suffix})?${COMPARE}${last}`, 'i'),
  }
}

const NUMBERED_COMPARISONS = (['month', 'week', 'day'] as const).map(numberedComparisonPatterns)

function readRelativeCounts(question: string) {
  if (SINGLE_WEEK_COMPARISON.test(question)) return { unit: 'week' as const, count: 1, previousCount: 1 }
  for (const { unit, forward, reverse } of NUMBERED_COMPARISONS) {
    const match = forward.exec(question) ?? reverse.exec(question)
    if (match) return { unit, count: Number(match[1]), previousCount: Number(match[2]) }
  }
  return null
}

function calendarDayBefore(today: Date, days = 0): string {
  const date = new Date(today)
  date.setUTCDate(date.getUTCDate() - days)
  return Number.isFinite(date.getTime()) ? date.toISOString().slice(0, 10) : ''
}

export function eventComparisonRanges(day: string, window: ComparisonProposal['eventWindow'] = { beforeDays: 14, afterDays: 14 }): ComparisonRanges {
  if (!isCalendarDate(day) || window === 'invalid') return EMPTY_RANGES
  const anchor = new Date(day + 'T00:00:00Z')
  const ranges = {
    previous: { startDate: calendarDayBefore(anchor, window.beforeDays), endDate: calendarDayBefore(anchor, 1) },
    current: { startDate: calendarDayBefore(anchor, -1), endDate: calendarDayBefore(anchor, -window.afterDays) },
  }
  return validComparisonRanges(ranges) ? ranges : EMPTY_RANGES
}

export function calendarDateInZone(date: Date, timeZone: string): string {
  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone, calendar: 'iso8601', year: 'numeric', month: '2-digit', day: '2-digit',
  })
  const { year, month, day } = Object.fromEntries(formatter.formatToParts(date).map(({ type, value }) => [type, value]))
  return `${year?.padStart(4, '0')}-${month}-${day}`
}

function periodBoundary(today: Date, unit: RelativeUnit, periodsBefore: number): Date {
  const date = new Date(today)
  if (unit === 'month') {
    date.setUTCMonth(date.getUTCMonth() - periodsBefore, 1)
  } else {
    const days = unit === 'week' ? (date.getUTCDay() + 6) % 7 + periodsBefore * 7 : periodsBefore
    date.setUTCDate(date.getUTCDate() - days)
  }
  return date
}

function relativeComparison(question: string, timeZone: string, asOf: Date): ComparisonProposal | null {
  const counts = readRelativeCounts(question)
  if (!counts) return null
  const { unit, count, previousCount } = counts
  const invalid: ComparisonProposal = { ranges: EMPTY_RANGES, relative: `invalid-${unit}-count` }
  if (!Number.isSafeInteger(count) || count < 1 || count !== previousCount) return invalid

  // Once the local date is known, use UTC solely for calendar arithmetic across DST.
  const today = new Date(calendarDateInZone(asOf, timeZone) + 'T00:00:00Z')
  const end = periodBoundary(today, unit, 0)
  const split = periodBoundary(today, unit, count)
  const start = periodBoundary(today, unit, count * 2)
  const ranges = {
    previous: { startDate: calendarDayBefore(start), endDate: calendarDayBefore(split, 1) },
    current: { startDate: calendarDayBefore(split), endDate: calendarDayBefore(end, 1) },
  }
  return validComparisonRanges(ranges) ? { ranges, relative: `completed-${unit}s` } : invalid
}

export function proposeComparison(question: string, timeZone: string, asOf = new Date()): ComparisonProposal | null {
  const event = eventComparisonProposal(question)
  if (event) return event
  const relative = relativeComparison(question, timeZone, asOf)
  if (relative) return relative
  const ranges = parseTypedComparison(question)
  return ranges ? { ranges } : null
}
