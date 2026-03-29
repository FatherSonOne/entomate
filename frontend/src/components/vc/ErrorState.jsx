import React from 'react';
import { AlertTriangle } from 'lucide-react';

export default function ErrorState({ message, onRetry, icon: Icon = AlertTriangle }) {
  return (
    <div className="vc" style={{
      padding: '3rem 2rem',
      textAlign: 'center',
      borderRadius: 12,
      maxWidth: 480,
      margin: '2rem auto'
    }}>
      <Icon
        size={40}
        style={{ color: 'var(--c)', marginBottom: '1rem', opacity: 0.7 }}
      />
      <h3 style={{ fontSize: '1rem', fontWeight: 600, marginBottom: '0.5rem' }}>
        Something went wrong
      </h3>
      <p style={{
        color: 'var(--t1)',
        fontSize: '0.875rem',
        marginBottom: onRetry ? '1.5rem' : 0
      }}>
        {message || 'An error occurred while loading this page.'}
      </p>
      {onRetry && (
        <button
          onClick={onRetry}
          className="vc-btn vc-btn-secondary"
          style={{ padding: '0.5rem 1.25rem' }}
        >
          Try Again
        </button>
      )}
    </div>
  );
}
