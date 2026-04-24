import React, { useEffect, useState } from 'react'

export default function BackToTop({ threshold = 400 }) {
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    const onScroll = () => setVisible(window.scrollY > threshold)
    onScroll()
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [threshold])

  const handleClick = () => {
    const prefersReduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    window.scrollTo({ top: 0, behavior: prefersReduced ? 'auto' : 'smooth' })
  }

  return (
    <>
      <button
        type="button"
        aria-label="Back to top"
        title="Back to top"
        onClick={handleClick}
        className={`back-to-top${visible ? ' is-visible' : ''}`}
      >
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden="true">
          <path
            d="M12 5 L12 19 M5 12 L12 5 L19 12"
            stroke="currentColor"
            strokeWidth="2.2"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </button>

      <style>{`
        .back-to-top {
          position: fixed;
          right: 20px;
          bottom: 20px;
          z-index: 200;
          width: 48px;
          height: 48px;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          border: 1px solid rgba(255, 45, 107, 0.35);
          border-radius: 999px;
          background: rgba(16, 16, 16, 0.85);
          color: #FF2D6B;
          backdrop-filter: blur(10px) saturate(160%);
          -webkit-backdrop-filter: blur(10px) saturate(160%);
          cursor: pointer;
          opacity: 0;
          transform: translateY(12px) scale(0.9);
          pointer-events: none;
          transition:
            opacity 220ms ease,
            transform 220ms cubic-bezier(0.34, 1.56, 0.64, 1),
            box-shadow 220ms ease,
            background 220ms ease,
            color 220ms ease;
          box-shadow: 0 4px 16px rgba(0, 0, 0, 0.4);
          padding: 0;
        }
        .back-to-top.is-visible {
          opacity: 1;
          transform: translateY(0) scale(1);
          pointer-events: auto;
        }
        .back-to-top:hover {
          background: #FF2D6B;
          color: #fff;
          box-shadow: 0 6px 22px rgba(255, 45, 107, 0.45);
          transform: translateY(-2px) scale(1.05);
        }
        .back-to-top:active {
          transform: translateY(0) scale(0.95);
        }
        .back-to-top:focus-visible {
          outline: 2px solid #FF2D6B;
          outline-offset: 3px;
        }
        @media (max-width: 600px) {
          .back-to-top {
            right: 16px;
            bottom: 16px;
            width: 44px;
            height: 44px;
          }
        }
        @media (prefers-reduced-motion: reduce) {
          .back-to-top { transition: opacity 120ms ease; }
        }
      `}</style>
    </>
  )
}
