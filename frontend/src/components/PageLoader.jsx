import React from 'react'

export default function PageLoader() {
  return (
    <div style={{
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      minHeight: '60vh',
      color: 'var(--t2)'
    }}>
      <div style={{ textAlign: 'center' }}>
        <div
          style={{
            width: 32,
            height: 32,
            border: '2px solid var(--b1)',
            borderTopColor: 'var(--c)',
            borderRadius: '50%',
            animation: 'spin 0.8s linear infinite',
            margin: '0 auto 12px'
          }}
        />
        <div style={{ fontSize: 12, letterSpacing: '.04em' }}>Loading...</div>
      </div>
    </div>
  )
}
