import React, { useLayoutEffect, useRef } from 'react'
import { X } from 'lucide-react'
import { Key } from '../bench'
import { MOTION, prefersReducedMotion } from '../bench/motion'

const slide = { duration: MOTION.navrail, easing: MOTION.easeInOut, fill: 'both' }
const move = (x) => ({ transform: `translateX(${x})` })
const CLOSE_SWIPE_DISTANCE = 72
const TOUCH_CONTROLS = 'input, textarea, select, [contenteditable], [role="slider"], [role="combobox"]'

function canSlide() {
  return !prefersReducedMotion() && typeof Element.prototype.animate === 'function'
}

function clearPreview(preview) {
  preview.hidden = true
  preview.getAnimations?.().forEach((animation) => animation.cancel())
  preview.replaceChildren()
}

function showExitPreview(pane, exit, pageScroll) {
  const page = document.createElement('div')
  page.className = 'app-layout-settings-exit-page'
  page.append(pane.cloneNode(true))
  exit.append(page)

  // Mobile section sheets live in a portal. Keep the visible sheet and its scrim in the exit frame.
  const sheet = document.querySelector('.bs-set-section-sheet[data-open="true"]')
  const scrim = sheet?.previousElementSibling
  const sheetCopy = sheet?.cloneNode(true)
  if (scrim?.matches('.bs-scrim[data-layer="underlay"]')) {
    const scrimCopy = scrim.cloneNode(true)
    scrimCopy.style.opacity = getComputedStyle(scrim).opacity
    exit.append(scrimCopy)
  }
  if (sheetCopy) {
    sheetCopy.style.transform = getComputedStyle(sheet).transform
    exit.append(sheetCopy)
  }

  exit.hidden = false
  page.scrollTop = pageScroll
  if (sheetCopy) {
    sheetCopy.querySelector('.bs-drawer-body').scrollTop = sheet.querySelector('.bs-drawer-body').scrollTop
  }
}

function SettingsPane({ exitRef, onClose, children }) {
  const paneRef = useRef(null)
  const scrollRef = useRef(0)
  const swipeRef = useRef(null)

  const closeSettings = () => {
    scrollRef.current = window.scrollY
    onClose()
  }

  const startSwipe = (event) => {
    swipeRef.current = null
    if (event.defaultPrevented || event.touches.length !== 1) return
    const target = event.target
    if (!target.closest?.('.bs-settings-shell, .bs-set-section-sheet') || target.closest(TOUCH_CONTROLS)) return
    const touch = event.touches[0]
    const scroller = target.closest('.bs-drawer-body') ?? document.scrollingElement
    swipeRef.current = { id: touch.identifier, x: touch.clientX, y: touch.clientY, scroller, scroll: scroller?.scrollTop ?? 0 }
  }

  const trackSwipe = (event) => {
    const start = swipeRef.current
    if (!start) return
    const touch = event.touches[0]
    if (event.touches.length !== 1 || touch.identifier !== start.id) {
      swipeRef.current = null
      return
    }
    const vertical = Math.abs(touch.clientY - start.y)
    if (vertical > 16 && vertical > Math.abs(touch.clientX - start.x)) swipeRef.current = null
  }

  const finishSwipe = (event) => {
    const start = swipeRef.current
    swipeRef.current = null
    const touch = event.changedTouches[0]
    if (!start || event.defaultPrevented || event.touches.length || touch?.identifier !== start.id) return
    const distance = touch.clientX - start.x
    const vertical = Math.abs(touch.clientY - start.y)
    const scroll = start.scroller?.scrollTop ?? 0
    if (distance < CLOSE_SWIPE_DISTANCE || distance < vertical * 1.5 || Math.abs(scroll - start.scroll) > 4) return
    if (event.cancelable) event.preventDefault()
    closeSettings()
  }

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
      showExitPreview(pane, exit, scrollRef.current)
      exit.animate([move(`${left}px`), move('100%')], slide).onfinish = () => clearPreview(exit)
    }
  }, [exitRef])

  return (
    <div className="bs-app bs-tokens bs-settings-shell" ref={paneRef}
      onTouchStart={startSwipe} onTouchMove={trackSwipe} onTouchEnd={finishSwipe}
      onTouchCancel={() => { swipeRef.current = null }}>
      <header className="bs-settings-bar">
        <Key autoFocus onClick={closeSettings} icon={<X size={16} aria-hidden="true" />}>Close Settings</Key>
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
