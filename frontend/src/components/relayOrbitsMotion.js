import { gsap } from 'gsap/gsap-core.js'

// The same Bézier points as the resting mark, pulled open around the iris.
const OPEN_SEAM = 'M757 220C674 167 572 171 495 217C395 270 329 387 329 500C329 616 397 736 500 789C582 835 685 834 772 770'
const OPEN_PATHS = {
  hull: 'M788 248C713 159 605 122 502 132C317 132 158 297 158 500C158 710 316 872 518 870C629 869 732 836 803 743C717 793 631 799 551 749C454 690 396 606 396 500C396 394 453 307 544 250C617 203 700 196 788 248Z',
  face: 'M788 248C703 175 600 152 501 166C329 185 195 321 195 500C195 681 333 824 520 838C623 844 717 809 803 743C716 795 628 797 543 744C449 686 393 604 393 500C393 396 450 310 537 256C615 208 700 196 788 248Z',
  lip: 'M788 248C687 188 601 187 515 231C416 279 350 382 350 500C350 620 418 724 522 772C607 819 703 805 803 743C717 793 631 799 551 749C454 690 396 606 396 500C396 394 453 307 544 250C617 203 700 196 788 248Z',
  etch: 'M751 213C662 160 557 151 471 172C314 200 202 337 202 500C202 666 325 808 487 834C582 850 685 830 765 780',
  seam: OPEN_SEAM,
  charge: OPEN_SEAM,
}

const axisPosition = (x) => `translate(${x} 500)`
const irisScale = (x, y) => `translate(531 500) scale(${x} ${y}) translate(-531 -500)`

export function createRelayOrbitsTimeline(svg) {
  const part = (name) => svg.querySelector(`[data-${name}]`)
  const paths = Object.entries(OPEN_PATHS).map(([name, open]) => {
    const path = part(name)
    return { path, open, rest: path.getAttribute('d') }
  })
  const iris = part('iris')
  const core = part('core')
  const inbound = part('inbound')
  const outbound = part('outbound')
  const charge = part('charge')
  const glow = part('catch')
  const wave = part('wave')
  const timeline = gsap.timeline({ paused: true, repeat: -1, repeatDelay: 0.3 })
  timeline.addLabel('receive', 0.86).addLabel('release', 1.53)

  timeline
    .to(inbound, { attr: { opacity: 1 }, duration: 0.16 }, 0)
    .to(inbound, { attr: { transform: axisPosition(531) }, duration: 0.86, ease: 'power2.in' }, 0)
    .to(inbound, { attr: { opacity: 0 }, duration: 0.14 }, 'receive')
    .to(iris, { attr: { transform: irisScale(0.86, 1.04) }, duration: 0.37, ease: 'sine.inOut' }, 0.48)
    .to(core, { attr: { transform: irisScale(0.82, 1.13) }, duration: 0.27, ease: 'sine.inOut' }, 0.64)
    .to(core, { attr: { transform: irisScale(1.17, 0.94) }, duration: 0.42, ease: 'power2.out' }, 'receive')
    .to(glow, { attr: { opacity: 0.8 }, duration: 0.32, ease: 'power2.out' }, 'receive')
    .to(glow, { attr: { opacity: 0 }, duration: 0.55, ease: 'sine.out' }, 'release')
    .to(charge, { attr: { opacity: 0.95 }, duration: 0.32 }, 'receive-=0.21')
    .to(charge, { attr: { 'stroke-dashoffset': -1 }, duration: 1.53, ease: 'power1.inOut' }, 'receive-=0.21')
    .to(charge, { attr: { opacity: 0 }, duration: 0.38, ease: 'sine.in' }, 1.8)
    .to(iris, { attr: { transform: irisScale(1.15, 1.07) }, duration: 0.72, ease: 'sine.inOut' }, 'receive')
    .to(iris, { attr: { transform: irisScale(1, 1) }, duration: 1.48, ease: 'sine.inOut' }, 1.58)
    .to(core, { attr: { transform: irisScale(1, 1) }, duration: 1.13, ease: 'sine.inOut' }, 'release')
    .to(wave, { attr: { opacity: 0.72 }, duration: 0.12 }, 'release')
    .to(wave, { attr: { rx: 178, ry: 222 }, duration: 0.93, ease: 'power2.out' }, 'release')
    .to(wave, { attr: { opacity: 0 }, duration: 0.81, ease: 'power2.out' }, 'release+=0.12')
    .to(outbound, { attr: { opacity: 1 }, duration: 0.18 }, 'release')
    .to(outbound, { attr: { transform: axisPosition(881) }, duration: 0.87, ease: 'power2.out' }, 'release')
    .to(outbound, { attr: { opacity: 0 }, duration: 0.39, ease: 'sine.in' }, 'release+=0.48')

  for (const { path, open, rest } of paths) {
    timeline
      .to(path, { attr: { d: open }, duration: 1.15, ease: 'sine.inOut' }, 0.35)
      .to(path, { attr: { d: rest }, duration: 1.62, ease: 'sine.inOut' }, 1.5)
  }
  return timeline
}
