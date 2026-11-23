/**
 * EAI-02c: an answer's Markdown as plain words, ported from Logos AI
 * (LV `services/reports/document/answerDocument.ts`: `plainInline`, `answerPlainText`,
 * `answerTitle`). The Share panel copies it and titles a printed answer with it.
 *
 * Not ported: LV's `printableText` (it maps characters its PDF brand fonts lack; a printed
 * answer here goes through the browser, which draws them), and its `lv://` and `<<next: ...>>`
 * rules (Entomate answers carry neither).
 */

/**
 * Inline Markdown to plain words: links keep their text (a web link keeps its address),
 * emphasis and code markers go.
 */
export function plainInline(text: string): string {
  return text
    // Images: keep the alt text only.
    .replace(/!\[([^\]]*)\]\([^)]*\)/g, '$1')
    // Links: a web link keeps its address; an in-app link (#, /path) keeps only its text.
    .replace(/\[([^\]]+)\]\(([^)\s]+)(?:\s+"[^"]*")?\)/g, (_m, label: string, href: string) =>
      /^https?:\/\//i.test(href) && label.trim() !== href.trim() ? `${label} (${href})` : label)
    // Bold / italic / strike / code.
    .replace(/\*\*([^*]+)\*\*/g, '$1')
    .replace(/__([^_]+)__/g, '$1')
    .replace(/(^|[^*\w])\*([^*\n]+)\*(?=[^*\w]|$)/g, '$1$2')
    .replace(/(^|[^_\w])_([^_\n]+)_(?=[^_\w]|$)/g, '$1$2')
    .replace(/~~([^~]+)~~/g, '$1')
    .replace(/`([^`]+)`/g, '$1')
    .replace(/[ \t]{2,}/g, ' ')
    .trim()
}

interface ListItem {
  depth: number
  ordinal: string | null
  text: string
}

function listItem(line: string): ListItem | null {
  const m = line.match(/^(\s*)(?:([-*+])|(\d{1,3})[.)])\s+(.*)$/)
  if (!m) return null
  const depth = Math.min(Math.floor(m[1]!.replace(/\t/g, '  ').length / 2), 3)
  // A task-list box ("- [ ] Call Maria") becomes a plain bullet.
  const text = m[4]!.replace(/^\[[ xX]\]\s+/, '')
  return { depth, ordinal: m[3] ?? null, text }
}

function isTableRow(line: string): boolean {
  const t = line.trim()
  return t.startsWith('|') && t.endsWith('|') && t.length > 2
}

function isTableSeparator(line: string): boolean {
  return /^\s*\|?\s*:?-{2,}:?\s*(\|\s*:?-{2,}:?\s*)+\|?\s*$/.test(line)
}

function splitRow(line: string): string[] {
  return line.trim().replace(/^\|/, '').replace(/\|$/, '').split('|').map((c) => c.trim())
}

/**
 * The whole answer as plain text, ready to paste anywhere. Lists keep a bullet, tables
 * become "a | b" rows, headings stand on their own line.
 */
export function answerPlainText(markdown: string): string {
  const lines = markdown.replace(/\r\n?/g, '\n').split('\n')
  const out: string[] = []
  for (const raw of lines) {
    const line = raw.replace(/\s+$/, '')
    if (/^\s*```/.test(line)) continue
    if (/^\s*(?:-{3,}|\*{3,}|_{3,})\s*$/.test(line)) continue
    if (isTableSeparator(line)) continue
    const heading = line.match(/^\s{0,3}#{1,6}\s+(.*)$/)
    if (heading) { out.push(plainInline(heading[1]!.replace(/#+\s*$/, ''))); continue }
    if (isTableRow(line)) { out.push(splitRow(line).map(plainInline).join(' | ')); continue }
    const item = listItem(line)
    if (item) {
      const marker = item.ordinal ? `${item.ordinal}.` : '•'
      out.push(`${'  '.repeat(item.depth)}${marker} ${plainInline(item.text)}`)
      continue
    }
    out.push(plainInline(line.replace(/^\s*>\s?/, '')))
  }
  return out.join('\n').replace(/\n{3,}/g, '\n\n').trim()
}

/** A short, human title: the answer's own leading heading, else the question, else a fallback. */
export function answerTitle(question: string | undefined, answer: string): string {
  const firstHeading = answer.match(/^\s{0,3}#{1,6}\s+(.+)$/m)
  if (firstHeading && answer.trim().startsWith('#')) {
    return plainInline(firstHeading[1]!).slice(0, 90).trim()
  }
  const q = plainInline(question ?? '').replace(/\s+/g, ' ').replace(/[?.!]+$/, '').trim()
  if (!q) return 'Entomate answer'
  const short = q.length > 90 ? `${q.slice(0, 87).replace(/\s+\S*$/, '')}...` : q
  return short.charAt(0).toUpperCase() + short.slice(1)
}
