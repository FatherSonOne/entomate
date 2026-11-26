import React, { useLayoutEffect, useRef } from 'react'
import { X } from 'lucide-react'
import { Key } from '../bench'
import { MOTION, prefersReducedMotion } from '../bench/motion'

export const DESKTOP_QUERY = '(min-width: 1024px)'

const slide = { duration: MOTION.navrail, easing: MOTION.easeInOut, fill: 'both' }
const move = (x) => ({ transform: `translateX(${x})` })

function canSlide() {
  return window.matchMedia?.(DESKTOP_QUERY).matches && !prefersReducedMotion() &&
    typeof Element.prototype.animate === 'function'
}

function clearPreview(preview) {
  preview.hidden = true
  preview.getAnimations?.().forEach((animation) => animation.cancel())
  preview.replaceChildren()
}

function SettingsPane({ exitRef, onClose, children }) {
  const paneRef = useRef(null)
  const scrollRef = useRef(0)

  useLayoutEffect(() => {
    const pane = paneRef.current
    const exit = exitRef.current
    clearPreview(exit)

    const rememberScroll = () => { scrollRef.current = window.scrollY }
    rememberScroll()
    window.addEventListener('scroll', rememberScroll, { passive: true })
    return () => {
      window.removeEventListener('scroll', rememberScroll)
      if (!exit.isConnected || !canSlide()) return

      // Keep the visible Settings content after its route unmounts.
      const left = pane.getBoundingClientRect().left
      exit.append(pane.cloneNode(true))
      exit.hidden = false
      exit.scrollTop = scrollRef.current
      exit.animate([move(`${left}px`), move('100%')], slide).onfinish = () => clearPreview(exit)
    }
  }, [exitRef])

  return (
    <div className="bs-app bs-tokens bs-settings-shell" ref={paneRef}>
      <header className="bs-settings-bar">
        <Key autoFocus onClick={() => { scrollRef.current = window.scrollY; onClose() }}
          icon={<X size={16} aria-hidden="true" />}>Close Settings</Key>
      </header>
      <main className="bs-plate bs-settings-page">{children}</main>
    </div>
  )
}

export default class SettingsTransition extends React.Component {
  app = React.createRef()
  settings = React.createRef()
  underlay = React.createRef()
  exit = React.createRef()

  getSnapshotBeforeUpdate(previous) {
    if (previous.settingsOpen || !this.props.settingsOpen || !canSlide()) return null

    // Read and copy the app viewport before React replaces its routed content.
    const shell = this.app.current.firstElementChild
    const main = shell?.querySelector('.bs-main, .nl-main')
    if (!main) return null

    const bounds = main.getBoundingClientRect()
    const preview = shell.cloneNode(false)
    const content = main.cloneNode(true)
    const inset = previous.isBenchSwiss ? 0 : parseFloat(getComputedStyle(main).paddingLeft) || 0
    preview.style.display = 'block'
    if (inset) content.style.paddingLeft = '0'
    preview.append(content)

    return {
      preview,
      left: bounds.left + inset,
      right: bounds.right,
      scroll: window.scrollY,
      enteringFrom: this.exit.current.hidden ? '100%' : `${this.exit.current.getBoundingClientRect().left}px`,
    }
  }

  componentDidUpdate(previous, _, outgoing) {
    const underlay = this.underlay.current
    if (!this.props.settingsOpen) {
      if (previous.settingsOpen) clearPreview(underlay)
      return
    }
    if (!outgoing) return

    const { preview, left, right, scroll, enteringFrom } = outgoing
    const pane = this.settings.current.querySelector(':scope > .bs-settings-shell')
    underlay.style.left = `${left}px`
    underlay.style.width = `${right - left}px`
    underlay.replaceChildren(preview)
    underlay.hidden = false
    underlay.scrollTop = scroll
    underlay.animate([move('0'), move(`${-left}px`)], slide)
    const animation = pane.animate([move(enteringFrom), move('0')], slide)
    animation.onfinish = () => {
      clearPreview(underlay)
      animation.cancel()
    }
  }

  render() {
    const { isBenchSwiss, settingsOpen, onClose, appShell, children } = this.props
    return (
      <div className="app-layout" data-bench={isBenchSwiss || undefined}>
        <div className="app-layout-view" ref={(el) => {
          this.app.current = el
          if (el) el.inert = settingsOpen
        }}>
          {appShell}
        </div>
        <div className="app-layout-settings" ref={this.settings}>
          <div className="app-layout-settings-underlay" ref={this.underlay} inert="" aria-hidden="true" hidden />
          <div className="app-layout-settings-exit" ref={this.exit} inert="" aria-hidden="true" hidden />
          {settingsOpen && <SettingsPane exitRef={this.exit} onClose={onClose}>{children}</SettingsPane>}
        </div>
      </div>
    )
  }
}
