/**
 * EAI-02c: "Print or save as PDF" for one answer.
 *
 * Logos AI opens a branded PDF preview built by its report-document engine. Entomate has no
 * such engine, so the answer as the panel already rendered it goes into a hidden iframe on a
 * plain print page, and the browser's own print dialog prints it or saves it as a PDF. An
 * iframe, not a new window, so no pop-up blocker stands in the way.
 */

const escapeHtml = (s: string) =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')

export interface PrintableAnswer {
  title: string
  question?: string
  /** The answer's rendered HTML, taken from the panel (React already escaped it). */
  bodyHtml: string
  /** When it was printed, as the reader should see it. */
  printedAt: string
}

/** The whole print page. Pure, so it is tested without a browser. */
export function printDocument({ title, question, bodyHtml, printedAt }: PrintableAnswer): string {
  const q = (question ?? '').trim()
  return `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><title>${escapeHtml(title)}</title>
<style>
  @page { margin: 18mm 16mm; }
  body { font: 11pt/1.5 system-ui, -apple-system, "Segoe UI", sans-serif; color: #1e1b18; margin: 0; }
  header { border-bottom: 2px solid #1e1b18; padding-bottom: 8pt; margin-bottom: 14pt; }
  .kicker { font-size: 8pt; letter-spacing: 0.12em; text-transform: uppercase; color: #6b6560; }
  h1 { font-size: 18pt; margin: 4pt 0 0; line-height: 1.2; }
  .question { margin: 6pt 0 0; color: #4a4540; }
  main h1, main h2, main h3 { font-size: 13pt; margin: 14pt 0 4pt; }
  table { border-collapse: collapse; width: 100%; margin: 8pt 0; }
  th, td { border: 1px solid #cfc9c2; padding: 4pt 6pt; text-align: left; vertical-align: top; }
  a { color: inherit; }
  footer { margin-top: 18pt; padding-top: 6pt; border-top: 1px solid #cfc9c2; font-size: 8pt; color: #6b6560; }
</style></head>
<body>
<header><div class="kicker">Ask Entomate</div><h1>${escapeHtml(title)}</h1>${q ? `<p class="question">Asked: ${escapeHtml(q)}</p>` : ''}</header>
<main>${bodyHtml}</main>
<footer>Printed ${escapeHtml(printedAt)} from Ask Entomate.</footer>
</body></html>`
}

/** Opens the print dialog for one answer. False when the page could not be prepared. */
export function printAnswer(answer: PrintableAnswer): boolean {
  const frame = document.createElement('iframe')
  frame.setAttribute('aria-hidden', 'true')
  frame.setAttribute('data-testid', 'ento-print-frame')
  frame.style.cssText = 'position:fixed;right:0;bottom:0;width:0;height:0;border:0;visibility:hidden'
  document.body.appendChild(frame)
  const win = frame.contentWindow
  const doc = frame.contentDocument
  if (!win || !doc) { frame.remove(); return false }
  doc.open()
  doc.write(printDocument(answer))
  doc.close()
  const cleanup = () => frame.remove()
  win.addEventListener('afterprint', () => setTimeout(cleanup, 0), { once: true })
  // Browsers that never fire afterprint for an iframe still lose the frame.
  setTimeout(cleanup, 60_000)
  win.focus()
  win.print()
  return true
}
