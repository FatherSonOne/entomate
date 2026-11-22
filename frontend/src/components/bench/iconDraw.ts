import { prefersReducedMotion } from './motion'

/**
 * Icon draw-in: when the pointer enters (or keyboard focus lands on) a key,
 * link, tab or menu item, the outline icons inside it redraw themselves stroke
 * by stroke, in source order, like the line-md icons. At rest every icon is
 * fully drawn. One delegated listener covers every icon in the app (Lucide and
 * inline SVG) with no per-component changes.
 *
 * Skipped: reduced motion (OS or the in-app toggle), icons that already run a
 * CSS animation (spinners, pulses), brand marks,
 * anything inside [data-no-draw], SVGs larger than 32px (illustrations), and
 * strokes that are already dashed (their dashes are the design).
 */

const HOSTS = 'a[href], button, [role="button"], [role="menuitem"], [role="tab"], [role="option"], summary, label'
const SHAPES = 'path, line, polyline, polygon, circle, rect, ellipse'
const SKIP = '[data-no-draw], .bs-brand, .bs-tbar-brand, .animate-spin, .bs-spin'
/** Whole draw, all strokes together, in ms. */
const TOTAL_MS = 620
/** No single stroke goes faster than this. */
const MIN_STROKE_MS = 140
const MAX_ICON_PX = 32

const running = new WeakSet<SVGSVGElement>()

function drawable(svg: SVGSVGElement): boolean {
  if (running.has(svg) || svg.closest(SKIP)) return false
  // Already animated by its own CSS (spinners, pulsing status icons).
  if (getComputedStyle(svg).animationName !== 'none') return false
  const box = svg.getBoundingClientRect()
  return box.width > 0 && box.width <= MAX_ICON_PX && box.height <= MAX_ICON_PX
}

function strokes(svg: SVGSVGElement): Array<{ el: SVGGeometryElement; len: number }> {
  const out: Array<{ el: SVGGeometryElement; len: number }> = []
  svg.querySelectorAll<SVGGeometryElement>(SHAPES).forEach((el) => {
    const cs = getComputedStyle(el)
    if (cs.stroke === 'none' || cs.strokeWidth === '0px' || cs.visibility === 'hidden') return
    if (cs.strokeDasharray && cs.strokeDasharray !== 'none') return
    let len = 0
    try { len = el.getTotalLength() } catch { return }
    if (len > 0.5) out.push({ el, len })
  })
  return out
}

export function drawIcon(svg: SVGSVGElement): void {
  if (!drawable(svg)) return
  const parts = strokes(svg)
  if (parts.length === 0) return
  const sum = parts.reduce((n, p) => n + p.len, 0)
  running.add(svg)
  let delay = 0
  let last: Animation | null = null
  for (const { el, len } of parts) {
    const duration = Math.max(MIN_STROKE_MS, (TOTAL_MS * len) / sum)
    const dash = `${len} ${len}`
    // fill "backwards" holds the hidden start during the delay, then lets go,
    // so nothing is left on the element after the draw.
    last = el.animate(
      [
        { strokeDasharray: dash, strokeDashoffset: `${len}` },
        { strokeDasharray: dash, strokeDashoffset: '0' },
      ],
      { duration, delay, easing: 'cubic-bezier(0.23, 1, 0.32, 1)', fill: 'backwards' },
    )
    delay += duration * 0.7
  }
  const done = (): void => { running.delete(svg) }
  if (last) { last.onfinish = done; last.oncancel = done } else done()
}

function onEnter(e: Event): void {
  if (prefersReducedMotion()) return
  const target = e.target as Element | null
  const host = target?.closest?.(HOSTS)
  if (!host) return
  // Only when arriving from outside the host, not when moving between its children.
  const from = (e as MouseEvent | FocusEvent).relatedTarget as Node | null
  if (from && host.contains(from)) return
  if (e.type === 'focusin' && !host.matches(':focus-visible')) return
  host.querySelectorAll<SVGSVGElement>('svg').forEach(drawIcon)
}

let installed = false

/** Call once at boot. */
export function installIconDraw(): void {
  if (installed || typeof document === 'undefined' || !('animate' in Element.prototype)) return
  installed = true
  document.addEventListener('pointerover', onEnter, { passive: true })
  document.addEventListener('focusin', onEnter)
}
