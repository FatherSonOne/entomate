export interface DateRange { startDate: string; endDate: string }

export interface ComparisonRanges {
  previous: DateRange
  current: DateRange
}

export interface ComparisonProposal {
  ranges: ComparisonRanges
  relative?: 'completed-days' | 'invalid-day-count'
}

export const EMPTY_RANGES: ComparisonRanges = {
  previous: { startDate: '', endDate: '' },
  current: { startDate: '', endDate: '' },
}

export const rangeDates = ({ previous, current }: ComparisonRanges) =>
  [previous.startDate, previous.endDate, current.startDate, current.endDate]

function isCalendarDate(value: string): boolean {
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
const LAST_DAYS = String.raw`\blast\s+${COUNT}\s+(?:completed\s+)?days?\b`
const PREVIOUS = String.raw`\bprevious\s+${COUNT}`
const DAYS = String.raw`\s+(?:completed\s+)?days?\b`
const COMPARE = String.raw`\s+(?:vs\.?|versus|compared\s+(?:to|with)|against|with|to|and)\s+(?:the\s+)?`
const LAST_THEN_PREVIOUS = new RegExp(
  String.raw`${LAST_DAYS}${COMPARE}${PREVIOUS}(?:${DAYS}|(?=\s*(?:[.,:;!?]|$)|\s+(?:for|on|about|in)\b))`, 'i',
)
const PREVIOUS_THEN_LAST = new RegExp(String.raw`${PREVIOUS}(?:${DAYS})?${COMPARE}${LAST_DAYS}`, 'i')

function calendarDaysBefore(today: Date, days: number): string {
  const date = new Date(today)
  date.setUTCDate(date.getUTCDate() - days)
  return Number.isFinite(date.getTime()) ? date.toISOString().slice(0, 10) : ''
}

function relativeComparison(question: string, timeZone: string, asOf: Date): ComparisonProposal | null {
  const counts = LAST_THEN_PREVIOUS.exec(question) ?? PREVIOUS_THEN_LAST.exec(question)
  if (!counts) return null
  const days = Number(counts[1])
  const invalid: ComparisonProposal = { ranges: EMPTY_RANGES, relative: 'invalid-day-count' }
  if (!Number.isSafeInteger(days) || days < 1 || days !== Number(counts[2])) return invalid

  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone, calendar: 'iso8601', year: 'numeric', month: '2-digit', day: '2-digit',
  })
  const { year, month, day } = Object.fromEntries(formatter.formatToParts(asOf).map(({ type, value }) => [type, value]))
  // Once the local date is known, use UTC solely for calendar arithmetic across DST.
  const today = new Date(`${year?.padStart(4, '0')}-${month}-${day}T00:00:00Z`)
  const ranges = {
    previous: { startDate: calendarDaysBefore(today, days * 2), endDate: calendarDaysBefore(today, days + 1) },
    current: { startDate: calendarDaysBefore(today, days), endDate: calendarDaysBefore(today, 1) },
  }
  return validComparisonRanges(ranges) ? { ranges, relative: 'completed-days' } : invalid
}

export function proposeComparison(question: string, timeZone: string, asOf = new Date()): ComparisonProposal | null {
  const relative = relativeComparison(question, timeZone, asOf)
  if (relative) return relative
  const ranges = parseTypedComparison(question)
  return ranges ? { ranges } : null
}
