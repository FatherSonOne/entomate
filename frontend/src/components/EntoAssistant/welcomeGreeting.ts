/**
 * EAI-02c: the welcome's greeting, ported from Logos AI (LV `welcomeGreeting.ts`). A line that
 * changes with the time of day and greets the user by first name, instead of the same title on
 * every visit. Pure, so it is unit-tested without rendering the panel.
 *
 * LV's org-group intro is not ported: Entomate has no org groups, and the panel keeps its own
 * per-page line ("Ask about your tasks") under the greeting.
 */
type Line = (name: string | null) => string

const withName = (base: string, name: string | null, end = '') => (name ? `${base}, ${name}${end}` : `${base}${end}`)

const MORNING: Line[] = [
  (n) => withName('Good morning', n),
  (n) => withName('Morning', n, '. Where should we start?'),
  (n) => withName("Let's get to work", n),
]
const AFTERNOON: Line[] = [
  (n) => withName('Good afternoon', n),
  (n) => (n ? `What's next, ${n}?` : "What's next?"),
  (n) => withName("Let's get to work", n),
]
const EVENING: Line[] = [
  (n) => withName('Good evening', n),
  (n) => withName('Evening', n, '. What can I take off your plate?'),
  (n) => withName("Let's wrap up the day", n),
]
const LATE: Line[] = [
  (n) => (n ? `Working late, ${n}?` : 'Working late?'),
  (n) => withName("Let's get this done", n),
  (n) => (n ? `Still at it, ${n}?` : 'Still at it?'),
]

/** The lines for an hour of the day, 0–23. */
export function linesForHour(hour: number): Line[] {
  if (hour >= 5 && hour < 12) return MORNING
  if (hour >= 12 && hour < 17) return AFTERNOON
  if (hour >= 17 && hour < 22) return EVENING
  return LATE
}

/** "Frank Messana" → "Frank". Blank or missing → null, so the greeting drops the name. */
export function firstNameOf(name: string | null | undefined): string | null {
  const first = name?.trim().split(/\s+/)[0]
  return first ? first : null
}

/**
 * `pick` chooses among the lines for that time of day. The panel draws `now` and `pick` each
 * time it opens, so the greeting changes from one visit to the next but not while it is read.
 */
export function welcomeGreeting(opts: { now: Date; name: string | null | undefined; pick: number }): string {
  const lines = linesForHour(opts.now.getHours())
  const line = lines[Math.abs(Math.floor(opts.pick)) % lines.length]!
  return line(firstNameOf(opts.name))
}
