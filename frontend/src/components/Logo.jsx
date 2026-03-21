import React from 'react';

// Entomate Logo — Void × Crimson Brand Identity
// Quantum Loop mark with crimson/mint/amber palette + Syne wordmark
export const Logo = ({ className = "w-8 h-8", withText = true }) => {
  return (
    <div className="flex items-center gap-2">
      <svg
        className={className}
        viewBox="0 0 100 100"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
      >
        {/* Upper arc — muted base */}
        <path
          d="M25 50C25 36.1929 36.1929 25 50 25C63.8071 25 75 36.1929 75 50"
          stroke="currentColor"
          strokeWidth="8"
          strokeLinecap="round"
          className="text-content-tertiary opacity-30"
        />
        {/* Lower arc — electric crimson */}
        <path
          d="M75 50C75 63.8071 63.8071 75 50 75C36.1929 75 25 63.8071 25 50"
          stroke="var(--accent-primary)"
          strokeWidth="8"
          strokeLinecap="round"
        />

        {/* Particle 1 — Neon Mint */}
        <circle
          cx="25"
          cy="50"
          r="8"
          fill="var(--bg-base)"
          stroke="var(--accent-secondary)"
          strokeWidth="2"
        />

        {/* Particle 2 — Amber */}
        <circle
          cx="75"
          cy="50"
          r="8"
          fill="var(--bg-base)"
          stroke="var(--accent-tertiary)"
          strokeWidth="2"
        />

        {/* Connection line */}
        <path
          d="M25 50L75 50"
          stroke="currentColor"
          strokeWidth="2"
          strokeDasharray="4 2"
          className="text-content-primary opacity-40"
        />
      </svg>

      {withText && (
        <span
          style={{
            fontFamily: "'Syne', 'Space Grotesk', sans-serif",
            fontWeight: 800,
            fontSize: '1.2rem',
            letterSpacing: '-0.03em',
            lineHeight: 1,
            background: 'linear-gradient(90deg, var(--accent-primary) 0%, #FF6699 50%, var(--accent-tertiary) 100%)',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
            backgroundClip: 'text',
          }}
        >
          Entomate
        </span>
      )}
    </div>
  );
};

export default Logo;
