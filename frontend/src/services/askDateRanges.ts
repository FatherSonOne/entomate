export interface DateRange { startDate: string; endDate: string }

export interface ComparisonRanges {
  previous: DateRange
  current: DateRange
}

type CalendarUnit = 'day' | 'week' | 'month'
export interface EventWindowLength { count: number; unit: CalendarUnit }
export type EventWindowSide = 'before' | 'after'
export type EventWindowCounts = Partial<Record<EventWindowSide, number>>
type EventWindow = Record<EventWindowSide, EventWindowLength>
type ProposedWindowLength = { count: number | null; unit: CalendarUnit }
type EventWindowProposal = Record<EventWindowSide, ProposedWindowLength>

export interface ComparisonProposal {
  ranges: ComparisonRanges
  relative?: `completed-${CalendarUnit}s` | `invalid-${CalendarUnit}-count`
  eventBased?: true
  milestoneName?: string
  eventWindow?: EventWindowProposal | 'invalid'
}

export interface ComparisonEvent {
  name: string
  date: string
  source: 'manual' | 'scheduled' | 'completed'
  key?: string
  clarifiedCounts?: EventWindowCounts
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

const NUMERIC_COUNT = String.raw`[+-]?\d+(?:\.\d+)?(?![\w/]|\.\d)`
const COUNT = `(${NUMERIC_COUNT})`
const COMPARE = String.raw`\s+(?:vs\.?|versus|compared\s+(?:to|with)|against|with|to|and)\s+(?:the\s+)?`
const WINDOW_START = String.raw`(?<![\w./+-])`
const LAUNCH_COMPARISON = new RegExp(
  String.raw`${WINDOW_START}(?:two|2)\s+weeks\s+before\s+(?:the\s+)?launch${COMPARE}(?:two|2)\s+weeks\s+after\b`, 'i',
)

const MILESTONE_TITLE = String.raw`(?:"([^"\r\n]+)"|“([^”\r\n]+)”|([^.!?;\r\n]+?))`
const MILESTONE_END = String.raw`(?=\s*(?:[.!?;\r\n]|$))`
const SURROUND_MILESTONE = new RegExp(
  String.raw`${WINDOW_START}(?:two|2)\s+weeks\s+before\s+and\s+after\s+${MILESTONE_TITLE}${MILESTONE_END}`, 'i',
)
const COMPARE_AROUND_MILESTONE = new RegExp(
  String.raw`${WINDOW_START}(?:two|2)\s+weeks\s+before\s+${MILESTONE_TITLE}${COMPARE}(?:two|2)\s+weeks\s+after\b${MILESTONE_END}`, 'i',
)
const SMALL_COUNTS = [
  'zero', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine',
  'ten', 'eleven', 'twelve', 'thirteen', 'fourteen', 'fifteen', 'sixteen', 'seventeen', 'eighteen', 'nineteen',
]
const TENS = ['twenty', 'thirty', 'forty', 'fifty', 'sixty', 'seventy', 'eighty', 'ninety']
// Capture longer number phrases in full so "one hundred twenty" cannot become "twenty".
const COUNT_WORD = `(?:${[...SMALL_COUNTS, ...TENS].join('|')}|hundred|thousand|million|billion|trillion|minus|negative|point|half|quarter|few|a)`
const WORD_COUNT = String.raw`${COUNT_WORD}(?:[\s-]+(?:${COUNT_WORD}|and))*`
const WINDOW_LENGTH = String.raw`(${NUMERIC_COUNT}|${WORD_COUNT})\s+(days?|weeks?|months?)`
const CUSTOM_MILESTONE_WINDOW = new RegExp(
  String.raw`${WINDOW_START}${WINDOW_LENGTH}\s+before\s+${MILESTONE_TITLE}${COMPARE}${WINDOW_LENGTH}\s+after\b${MILESTONE_END}`, 'i',
)

const validWindowCount = (value: number | undefined): value is number =>
  value !== undefined && Number.isSafeInteger(value) && value > 0
const cleanMilestoneTitle = (title?: string) => title?.trim().slice(0, 160) || undefined

function parseWindowCount(value: string): number {
  const numeric = Number(value)
  if (!Number.isNaN(numeric)) return numeric

  const words = value.toLowerCase().split(/[\s-]+/)
  const [first = '', second = ''] = words
  const small = SMALL_COUNTS.indexOf(first)
  if (small >= 0 && words.length === 1) return small

  const tens = TENS.indexOf(first)
  if (tens < 0) return NaN
  const base = (tens + 2) * 10
  if (words.length === 1) return base
  const ones = SMALL_COUNTS.indexOf(second)
  return words.length === 2 && ones > 0 && ones < 10 ? base + ones : NaN
}

function parseWindowLength(value: string, unit: string): ProposedWindowLength {
  const writtenUnit = unit.toLowerCase()
  const plural = writtenUnit.endsWith('s')
  const calendarUnit = writtenUnit.replace(/s$/, '') as CalendarUnit
  if (plural && /^a\s+few$/i.test(value)) return { count: null, unit: calendarUnit }
  const count = value.toLowerCase() === 'a' && !plural ? 1 : parseWindowCount(value)
  return { count, unit: calendarUnit }
}

export function eventComparisonProposal(question: string): ComparisonProposal | null {
  const custom = CUSTOM_MILESTONE_WINDOW.exec(question)
  const launch = LAUNCH_COMPARISON.exec(question)
  if (launch && (!custom || launch.index === custom.index)) return { ranges: EMPTY_RANGES, eventBased: true }
  const match = SURROUND_MILESTONE.exec(question) ?? COMPARE_AROUND_MILESTONE.exec(question)
  const legacyName = cleanMilestoneTitle(match?.[1] ?? match?.[2] ?? match?.[3])
  if (legacyName && (!custom || match?.index === custom.index)) return { ranges: EMPTY_RANGES, eventBased: true, milestoneName: legacyName }

  if (!custom) return null
  const [, beforeCount, beforeUnit, quoted, curved, plain, afterCount, afterUnit] = custom
  const milestoneName = cleanMilestoneTitle(quoted ?? curved ?? plain)
  if (!milestoneName || !beforeCount || !beforeUnit || !afterCount || !afterUnit) return null
  const before = parseWindowLength(beforeCount, beforeUnit)
  const after = parseWindowLength(afterCount, afterUnit)
  const valid = [before.count, after.count].every((count) => count === null || validWindowCount(count))
  return { ranges: EMPTY_RANGES, eventBased: true, milestoneName,
    eventWindow: valid ? { before, after } : 'invalid' }
}

const ELIDED_UNIT = String.raw`(?=\s*(?:[.,:;!?]|$)|\s+(?:for|on|about|in)\b)`
const LAST_WEEK = String.raw`\blast\s+(?:completed\s+)?week\b`
const PREVIOUS_WEEK = String.raw`\bprevious\s+(?:completed\s+)?week\b`
const SINGLE_WEEK_COMPARISON = new RegExp(
  String.raw`${LAST_WEEK}${COMPARE}${PREVIOUS_WEEK}|${PREVIOUS_WEEK}${COMPARE}${LAST_WEEK}`, 'i',
)

function numberedComparisonPatterns(unit: CalendarUnit) {
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

function eventWindowBoundary(anchor: Date, { count, unit }: EventWindowLength, direction: -1 | 1): string {
  if (unit !== 'month') return calendarDayBefore(anchor, -direction * count * (unit === 'week' ? 7 : 1))
  const boundary = new Date(anchor)
  // Find the target month's last day before restoring the anchor day.
  boundary.setUTCMonth(anchor.getUTCMonth() + direction * count + 1, 0)
  boundary.setUTCDate(Math.min(anchor.getUTCDate(), boundary.getUTCDate()))
  return calendarDayBefore(boundary)
}

const TWO_WEEKS: EventWindowLength = { count: 2, unit: 'week' }
const DEFAULT_EVENT_WINDOW: EventWindow = { before: TWO_WEEKS, after: TWO_WEEKS }

export function resolveEventWindow(proposal: ComparisonProposal['eventWindow'], counts?: EventWindowCounts): EventWindow | 'invalid' | undefined {
  if (!proposal || proposal === 'invalid') return proposal
  const before = proposal.before.count ?? counts?.before
  const after = proposal.after.count ?? counts?.after
  if (!validWindowCount(before) || !validWindowCount(after)) return 'invalid'
  return { before: { ...proposal.before, count: before }, after: { ...proposal.after, count: after } }
}

export function eventComparisonRanges(day: string, proposal?: ComparisonProposal['eventWindow'], counts?: EventWindowCounts): ComparisonRanges {
  const window = resolveEventWindow(proposal, counts) ?? DEFAULT_EVENT_WINDOW
  if (!isCalendarDate(day) || window === 'invalid') return EMPTY_RANGES
  const anchor = new Date(day + 'T00:00:00Z')
  const ranges = {
    previous: { startDate: eventWindowBoundary(anchor, window.before, -1), endDate: calendarDayBefore(anchor, 1) },
    current: { startDate: calendarDayBefore(anchor, -1), endDate: eventWindowBoundary(anchor, window.after, 1) },
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

function periodBoundary(today: Date, unit: CalendarUnit, periodsBefore: number): Date {
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
