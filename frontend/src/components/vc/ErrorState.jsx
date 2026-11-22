import React from 'react';
import { AlertTriangle } from 'lucide-react';
import { classifyError, errorCopy } from '../../services/errorKinds';

export default function ErrorState({ message, error, onRetry, icon: Icon = AlertTriangle }) {
  // Name the cause when it is known (offline, signed out, no access...)
  const kind = classifyError(error ?? new Error(message || ''));
  const title = kind === 'render' ? 'Something went wrong' : errorCopy(kind).title;
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
        {title}
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
