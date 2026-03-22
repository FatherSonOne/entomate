import React from 'react';
import { ChevronRight } from 'lucide-react';
import { VCButton, VCBadge, VCCard, VCIconBox } from './vc';

export const GuideCard = ({ title, steps, activeStep = 0, className = "" }) => {
  return (
    <div
      className={`vc ${className}`}
      style={{
        border: '1px solid rgba(255,45,107,.20)',
        background: 'rgba(255,45,107,.05)',
        padding: '1rem',
        marginBottom: '1.5rem',
      }}
    >
      <div className="flex items-center gap-2 mb-3">
        <VCIconBox color="crimson" size="sm">
          <span style={{ fontFamily: 'var(--font-mono)', fontWeight: 700, fontSize: 11 }}>i</span>
        </VCIconBox>
        <h4 style={{
          fontFamily: 'var(--font-mono)',
          fontSize: 13,
          fontWeight: 700,
          color: 'var(--accent-primary, #FF2D6B)',
          textTransform: 'uppercase',
          letterSpacing: '.08em',
          margin: 0,
        }}>{title}</h4>
      </div>

      <div className="flex flex-wrap items-center gap-2" style={{ fontSize: 14 }}>
        {steps.map((step, idx) => (
          <React.Fragment key={idx}>
            <span
              style={{
                transition: 'color 200ms',
                ...(idx === activeStep
                  ? {
                      color: 'var(--text-primary)',
                      fontWeight: 700,
                      background: 'var(--bg-elevated, #101010)',
                      padding: '2px 8px',
                      borderRadius: 2,
                      border: '1px solid var(--border-subtle)',
                    }
                  : idx < activeStep
                  ? { color: 'var(--accent-primary, #FF2D6B)' }
                  : { color: 'var(--text-tertiary)' }),
              }}
            >
              {step}
            </span>
            {idx < steps.length - 1 && (
              <ChevronRight
                size={14}
                style={{ color: idx < activeStep ? 'var(--accent-primary, #FF2D6B)' : 'var(--text-tertiary)' }}
              />
            )}
          </React.Fragment>
        ))}
      </div>

      <div style={{
        marginTop: 12,
        fontSize: 12,
        color: 'var(--text-secondary)',
        paddingLeft: 28,
        borderLeft: '2px solid var(--border-subtle)',
        marginLeft: 10,
      }}>
        Current Step:{' '}
        <span style={{ color: 'var(--text-primary)', fontWeight: 500 }}>{steps[activeStep]}</span>
        . Complete this to proceed.
      </div>
    </div>
  );
};

export const PageHeader = ({ title, subtitle, actions }) => (
  <div
    className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8 pb-4"
    style={{ borderBottom: '1px solid var(--border-subtle)' }}
  >
    <div>
      <h1 style={{
        fontFamily: 'var(--font-display)',
        fontSize: '1.875rem',
        fontWeight: 700,
        letterSpacing: '-.02em',
        color: 'var(--text-primary)',
        margin: 0,
      }}>{title}</h1>
      {subtitle && (
        <p style={{ color: 'var(--text-secondary)', marginTop: 4, marginBottom: 0 }}>{subtitle}</p>
      )}
    </div>
    {actions && <div className="flex gap-3">{actions}</div>}
  </div>
);

export const Skeleton = ({ className, count = 1 }) => (
  <>
    {Array.from({ length: count }).map((_, i) => (
      <div
        key={i}
        className={`animate-pulse rounded-sm ${className}`}
        style={{ background: 'var(--bg-elevated, #101010)' }}
      />
    ))}
  </>
);
