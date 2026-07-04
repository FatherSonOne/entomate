import React from 'react'
import { useAuth } from '../contexts/AuthContext'

/*
 * HeldHero — the "intelligence you hold" dashboard hero for Held Light.
 * Text-only: greeting + a solid-crimson emphasis line (deliberately NOT a
 * gradient-clipped headline, which is a banned AI tell). Renders only when
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
    <div className="vc held-hero" style={{ padding: '24px 26px' }}>
      <div style={{ fontFamily: 'var(--font-display, Syne, sans-serif)', fontWeight: 700, fontSize: 28, letterSpacing: '-.02em', color: 'var(--text-primary)', lineHeight: 1.1 }}>
        {timeGreet}, {firstName}.
      </div>
      <div style={{ fontFamily: 'var(--font-display, Syne, sans-serif)', fontWeight: 700, fontSize: 18, marginTop: 5, color: 'var(--text-secondary)' }}>
        Intelligence <span style={{ color: 'var(--accent-primary)' }}>you hold.</span>
      </div>
      <p style={{ fontSize: 13, color: 'var(--text-tertiary)', marginTop: 10, lineHeight: 1.5, maxWidth: 440 }}>
        {dateStr}. Entomate joins every meeting, listens, and hands you decisions, action items and follow-ups.
      </p>
    </div>
  )
}
