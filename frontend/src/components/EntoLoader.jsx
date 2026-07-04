// EntoLoader.jsx
// Reusable animated loader for Entomate — replaces basic spinning wheels everywhere
// Variants: spinner (default), dots, pulse, orbit
// Sizes: xs (12px), sm (16px), md (24px), lg (32px), xl (48px)

import React from 'react'

const SIZE_MAP = { xs: 12, sm: 16, md: 24, lg: 32, xl: 48 }

export default function EntoLoader({
  size = 'md',
  variant = 'spinner',
  color,
  className = '',
  label,
}) {
  const px = SIZE_MAP[size] || SIZE_MAP.md

  if (variant === 'dots') return <DotLoader size={px} color={color} className={className} />
  if (variant === 'pulse') return <PulseLoader size={px} color={color} className={className} />
  if (variant === 'orbit') return <OrbitLoader size={px} color={color} className={className} />

  // Default: neural spinner
  return (
    <span className={`en-loader-wrap ${className}`} style={{ width: px, height: px }} role="status" aria-label={label || 'Loading'}>
      <svg viewBox="0 0 40 40" fill="none" style={{ width: px, height: px }}>
        <defs>
          <linearGradient id={`en-spin-grad-${px}`} x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor={color || '#FF2D6B'} />
            <stop offset="100%" stopColor={color ? color : '#00F5D4'} />
          </linearGradient>
        </defs>
        {/* Track */}
        <circle cx="20" cy="20" r="16" stroke="var(--border-subtle, rgba(255,255,255,0.08))" strokeWidth="2.5" fill="none" />
        {/* Spinning arc */}
        <circle
          cx="20" cy="20" r="16"
          stroke={color ? color : `url(#en-spin-grad-${px})`}
          strokeWidth="2.5"
          fill="none"
          strokeLinecap="round"
          strokeDasharray="75 25"
          className="en-loader-arc"
          style={{ filter: `drop-shadow(0 0 3px ${color || '#FF2D6B'})` }}
        />
        {/* Catalyst dot at head */}
        <circle cx="20" cy="4" r="2" fill={color || '#FF2D6B'} className="en-loader-arc" style={{ filter: `drop-shadow(0 0 4px ${color || '#FF2D6B'})` }} />
      </svg>
    </span>
  )
}

function DotLoader({ size, color, className }) {
  const dotSize = Math.max(3, size / 5)
  return (
    <span className={`en-loader-dots-wrap ${className}`} style={{ gap: dotSize * 0.8 }} role="status" aria-label="Loading">
      {[0, 1, 2].map((i) => (
        <span
          key={i}
          className="en-loader-dot-item"
          style={{
            width: dotSize,
            height: dotSize,
            background: color || (i === 0 ? '#FF2D6B' : i === 1 ? '#00F5D4' : '#FF6699'),
            animationDelay: `${i * 0.16}s`,
          }}
        />
      ))}
    </span>
  )
}

function PulseLoader({ size, color, className }) {
  return (
    <span className={`en-loader-pulse-wrap ${className}`} style={{ width: size, height: size }} role="status" aria-label="Loading">
      <span className="en-loader-pulse-ring" style={{ borderColor: color || '#FF2D6B' }} />
      <span className="en-loader-pulse-ring en-loader-pulse-ring-2" style={{ borderColor: color || '#00F5D4' }} />
      <span className="en-loader-pulse-core" style={{ background: color || '#FF2D6B', width: size * 0.3, height: size * 0.3 }} />
    </span>
  )
}

function OrbitLoader({ size, color, className }) {
  return (
    <span className={`en-loader-orbit-wrap ${className}`} style={{ width: size, height: size }} role="status" aria-label="Loading">
      <span className="en-loader-orbit-track" style={{ borderColor: 'var(--border-subtle, rgba(255,255,255,0.08))' }} />
      <span className="en-loader-orbit-dot" style={{ background: color || '#FF2D6B', filter: `drop-shadow(0 0 4px ${color || '#FF2D6B'})` }} />
      <span className="en-loader-orbit-dot en-loader-orbit-dot-2" style={{ background: '#00F5D4', filter: 'drop-shadow(0 0 4px #00F5D4)' }} />
    </span>
  )
}

// Section-level loader — used for page sections that are fetching data
export function SectionLoader({ label = 'Loading...', className = '' }) {
  return (
    <div className={`flex flex-col items-center justify-center gap-3 py-12 ${className}`}>
      <EntoLoader size="lg" variant="orbit" />
      <span style={{ color: 'var(--text-tertiary)', fontSize: 13, letterSpacing: '0.04em' }}>{label}</span>
    </div>
  )
}

// Full-page loader — used when an entire page view is loading
export function FullPageLoader({ label = 'Loading...' }) {
  return (
    <div className="flex items-center justify-center" style={{ minHeight: '60vh' }}>
      <div className="flex flex-col items-center gap-4">
        <EntoLoader size="xl" variant="orbit" />
        <span style={{ color: 'var(--text-tertiary)', fontSize: 14, letterSpacing: '0.04em' }}>{label}</span>
      </div>
    </div>
  )
}
