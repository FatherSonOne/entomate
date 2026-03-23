import React from 'react';
import { useNavigate } from 'react-router-dom';

export default function NotFound() {
  const navigate = useNavigate();

  return (
    <div style={{
      minHeight: '100vh',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      background: 'var(--bg0)',
      color: 'var(--t0)',
      padding: '2rem'
    }}>
      <div className="vc" style={{
        maxWidth: 480,
        padding: '3rem',
        textAlign: 'center',
        borderRadius: 12
      }}>
        <div style={{
          fontSize: '4rem',
          fontWeight: 700,
          color: 'var(--c)',
          lineHeight: 1,
          marginBottom: '0.75rem',
          fontFamily: 'var(--font-mono, monospace)'
        }}>
          404
        </div>
        <h1 style={{ fontSize: '1.25rem', fontWeight: 600, marginBottom: '0.5rem' }}>
          Page not found
        </h1>
        <p style={{
          color: 'var(--t1)',
          fontSize: '0.875rem',
          marginBottom: '2rem'
        }}>
          The page you're looking for doesn't exist or has been moved.
        </p>
        <button
          onClick={() => navigate('/dashboard')}
          className="vc-btn vc-btn-primary"
          style={{ padding: '0.5rem 1.5rem' }}
        >
          Go to Dashboard
        </button>
      </div>
    </div>
  );
}
