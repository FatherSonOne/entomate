import React from 'react'
import { useAuth } from '../contexts/AuthContext'
import { HandsHero } from './Logo'

/*
 * HeldHero — the "intelligence you hold" dashboard hero for Held Light.
 * The app's themeable HandsHero SVG (not the raster brand render) cradles
 * the greeting. Emphasis is solid crimson on weight — deliberately NOT a
 * gradient-clipped headline (that's a banned AI tell). Renders only when
 * the Held Light foundation is on; the legacy greeting card shows otherwise.
 */
export default function HeldHero() {
  const { user } = useAuth()
  const hour = new Date().getHours()
  const timeGreet = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening'
  const firstName = user?.name?.trim().split(' ')[0] || 'there'
  const dateStr = new Date().toLocaleDateString('en-US', {
    weekday: 'long', month: 'long', day: 'numeric', year: 'numeric',
  })

  return (
    <div className="vc held-hero" style={{ display: 'flex', alignItems: 'center', gap: 20, padding: '22px 24px' }}>
      <div style={{ flexShrink: 0, width: 92, height: 92, display: 'grid', placeItems: 'center' }} aria-hidden="true">
        <HandsHero size={84} />
      </div>
      <div style={{ minWidth: 0 }}>
        <div style={{ fontFamily: 'var(--font-display, Syne, sans-serif)', fontWeight: 700, fontSize: 26, letterSpacing: '-.02em', color: 'var(--text-primary)', lineHeight: 1.1 }}>
          {timeGreet}, {firstName}.
        </div>
        <div style={{ fontFamily: 'var(--font-display, Syne, sans-serif)', fontWeight: 700, fontSize: 18, marginTop: 4, color: 'var(--text-secondary)' }}>
          Intelligence <span style={{ color: 'var(--accent-primary)' }}>you hold.</span>
        </div>
        <p style={{ fontSize: 13, color: 'var(--text-tertiary)', marginTop: 9, lineHeight: 1.5, maxWidth: 440 }}>
          {dateStr}. Entomate joins every meeting, listens, and hands you decisions, action items and follow-ups.
        </p>
      </div>
    </div>
  )
}
