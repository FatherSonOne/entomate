import React from 'react'

// Entomate Logo — Void × Crimson
// Wireframe geometric hands reaching upward, circuit node at fingertips, E-bar letterform
// Matches brand identity: crimson outline hands, amber glowing circuit node, gradient wordmark

const SIZES = {
  sm: { svg: 32,  textSize: '1rem'    },
  md: { svg: 44,  textSize: '1.15rem' },
  lg: { svg: 72,  textSize: '1.6rem'  },
  xl: { svg: 120, textSize: '2.4rem'  },
}

export const Logo = ({ size = 'md', withText = true, className = '' }) => {
  const s = SIZES[size] || SIZES.md
  return (
    <div className={`flex items-center gap-2 ${className}`} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
      <svg
        width={s.svg}
        height={s.svg}
        viewBox="0 0 100 100"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        style={{ flexShrink: 0, animation: 'vc-logo-breathe 2.8s ease-in-out infinite' }}
        aria-label="Entomate Logo"
      >
        <defs>
          <filter id="amber-glow" x="-40%" y="-40%" width="180%" height="180%">
            <feGaussianBlur stdDeviation="2.5" result="blur" />
            <feMerge><feMergeNode in="blur"/><feMergeNode in="SourceGraphic"/></feMerge>
          </filter>
          <filter id="crimson-glow" x="-30%" y="-30%" width="160%" height="160%">
            <feGaussianBlur stdDeviation="1.5" result="blur" />
            <feMerge><feMergeNode in="blur"/><feMergeNode in="SourceGraphic"/></feMerge>
          </filter>
          <linearGradient id="hand-l-grad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#FF2D6B" stopOpacity="1" />
            <stop offset="100%" stopColor="#FF2D6B" stopOpacity="0.5" />
          </linearGradient>
          <linearGradient id="hand-r-grad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#FF2D6B" stopOpacity="1" />
            <stop offset="100%" stopColor="#FF2D6B" stopOpacity="0.5" />
          </linearGradient>
        </defs>

        {/* ── LEFT HAND (wireframe, reaching up-right) ── */}
        {/* Palm */}
        <path d="M18 72 L26 52 L36 50 L40 68 Z" stroke="url(#hand-l-grad)" strokeWidth="1.2" fill="rgba(255,45,107,0.05)" strokeLinejoin="round" filter="url(#crimson-glow)" />
        {/* Wrist */}
        <path d="M18 72 L22 82 L38 80 L40 68" stroke="#FF2D6B" strokeWidth="1" fill="rgba(255,45,107,0.04)" strokeLinecap="round" />
        {/* Thumb */}
        <path d="M26 52 L20 44 L17 38" stroke="#FF2D6B" strokeWidth="1.1" fill="none" strokeLinecap="round" strokeLinejoin="round" />
        {/* Index finger */}
        <path d="M28 51 L26 38 L25 28" stroke="#FF2D6B" strokeWidth="1.1" fill="none" strokeLinecap="round" />
        {/* Middle finger */}
        <path d="M32 50 L31 35 L30 24" stroke="#FF2D6B" strokeWidth="1.3" fill="none" strokeLinecap="round" />
        {/* Ring finger */}
        <path d="M35 51 L36 37 L36 28" stroke="#FF2D6B" strokeWidth="1.1" fill="none" strokeLinecap="round" />
        {/* Pinky */}
        <path d="M38 53 L40 40 L40 33" stroke="#FF2D6B" strokeWidth="1" fill="none" strokeLinecap="round" />
        {/* Palm facets */}
        <line x1="26" y1="52" x2="32" y2="60" stroke="#FF2D6B" strokeWidth="0.6" opacity="0.4" />
        <line x1="32" y1="60" x2="40" y2="68" stroke="#FF2D6B" strokeWidth="0.6" opacity="0.4" />
        <line x1="28" y1="56" x2="36" y2="54" stroke="#FF2D6B" strokeWidth="0.5" opacity="0.3" />

        {/* ── RIGHT HAND (mirror, reaching up-left) ── */}
        {/* Palm */}
        <path d="M82 72 L74 52 L64 50 L60 68 Z" stroke="url(#hand-r-grad)" strokeWidth="1.2" fill="rgba(255,45,107,0.05)" strokeLinejoin="round" filter="url(#crimson-glow)" />
        {/* Wrist */}
        <path d="M82 72 L78 82 L62 80 L60 68" stroke="#FF2D6B" strokeWidth="1" fill="rgba(255,45,107,0.04)" strokeLinecap="round" />
        {/* Thumb */}
        <path d="M74 52 L80 44 L83 38" stroke="#FF2D6B" strokeWidth="1.1" fill="none" strokeLinecap="round" strokeLinejoin="round" />
        {/* Index finger */}
        <path d="M72 51 L74 38 L75 28" stroke="#FF2D6B" strokeWidth="1.1" fill="none" strokeLinecap="round" />
        {/* Middle finger */}
        <path d="M68 50 L69 35 L70 24" stroke="#FF2D6B" strokeWidth="1.3" fill="none" strokeLinecap="round" />
        {/* Ring finger */}
        <path d="M65 51 L64 37 L64 28" stroke="#FF2D6B" strokeWidth="1.1" fill="none" strokeLinecap="round" />
        {/* Pinky */}
        <path d="M62 53 L60 40 L60 33" stroke="#FF2D6B" strokeWidth="1" fill="none" strokeLinecap="round" />
        {/* Palm facets */}
        <line x1="74" y1="52" x2="68" y2="60" stroke="#FF2D6B" strokeWidth="0.6" opacity="0.4" />
        <line x1="68" y1="60" x2="60" y2="68" stroke="#FF2D6B" strokeWidth="0.6" opacity="0.4" />
        <line x1="72" y1="56" x2="64" y2="54" stroke="#FF2D6B" strokeWidth="0.5" opacity="0.3" />

        {/* ── CIRCUIT NODE (amber, above fingertips) ── */}
        {/* Outer glow ring */}
        <circle cx="50" cy="18" r="7" fill="rgba(255,184,0,0.15)" stroke="#FFB800" strokeWidth="0.8" opacity="0.6" filter="url(#amber-glow)" />
        {/* Main node */}
        <circle cx="50" cy="18" r="4.5" fill="rgba(255,184,0,0.25)" stroke="#FFB800" strokeWidth="1.4" filter="url(#amber-glow)" />
        {/* Inner dot */}
        <circle cx="50" cy="18" r="2" fill="#FFB800" />
        {/* Circuit branches */}
        <line x1="50" y1="13.5" x2="50" y2="9" stroke="#FFB800" strokeWidth="1" strokeLinecap="round" />
        <line x1="50" y1="9" x2="45" y2="9" stroke="#FFB800" strokeWidth="0.8" strokeLinecap="round" />
        <line x1="50" y1="9" x2="55" y2="9" stroke="#FFB800" strokeWidth="0.8" strokeLinecap="round" />
        <circle cx="45" cy="9" r="1.2" fill="#FFB800" opacity="0.8" />
        <circle cx="55" cy="9" r="1.2" fill="#FFB800" opacity="0.8" />
        {/* Circuit traces to finger tips */}
        <path d="M30 24 Q38 20 46 18" stroke="#FF2D6B" strokeWidth="0.7" strokeDasharray="2.5 2" opacity="0.6" fill="none" />
        <path d="M70 24 Q62 20 54 18" stroke="#FF2D6B" strokeWidth="0.7" strokeDasharray="2.5 2" opacity="0.6" fill="none" />

        {/* ── E LETTERFORM (three bars between wrists) ── */}
        <rect x="38" y="84" width="24" height="3" rx="1.5" fill="#FF2D6B" opacity="0.95" />
        <rect x="40" y="90" width="18" height="2.5" rx="1.25" fill="#FF2D6B" opacity="0.7" />
        <rect x="38" y="96" width="24" height="3" rx="1.5" fill="#FF2D6B" opacity="0.95" />
      </svg>

      {withText && (
        <span style={{
          fontFamily: "'Syne', system-ui, sans-serif",
          fontWeight: 700,
          fontSize: s.textSize,
          letterSpacing: '0.04em',
          lineHeight: 1.35,
          background: 'linear-gradient(90deg, #FF2D6B 0%, #FF6699 55%, #FFB800 100%)',
          WebkitBackgroundClip: 'text',
          WebkitTextFillColor: 'transparent',
          backgroundClip: 'text',
        }}>
          entomate
        </span>
      )}
    </div>
  )
}

export default Logo
