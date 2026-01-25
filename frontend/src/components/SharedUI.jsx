import React from 'react';
import { ChevronRight } from 'lucide-react';

export const GuideCard = ({ title, steps, activeStep = 0, className = "" }) => {
  return (
    <div className={`border border-accent-primary/20 bg-accent-primary/5 p-4 rounded-sm mb-6 ${className}`}>
      <div className="flex items-center gap-2 mb-3">
        <div className="w-5 h-5 bg-accent-primary text-white flex items-center justify-center text-xs font-mono font-bold rounded-sm shadow-sm">
          i
        </div>
        <h4 className="font-mono text-sm font-bold text-accent-primary uppercase tracking-wider">{title}</h4>
      </div>
      
      <div className="flex flex-wrap items-center gap-2 text-sm">
        {steps.map((step, idx) => (
          <React.Fragment key={idx}>
            <span 
              className={`transition-colors duration-200 ${
                idx === activeStep 
                  ? 'text-content-primary font-bold bg-surface-elevated px-2 py-0.5 rounded-sm shadow-sm border border-line-subtle' 
                  : idx < activeStep 
                    ? 'text-accent-primary' 
                    : 'text-content-tertiary'
              }`}
            >
              {step}
            </span>
            {idx < steps.length - 1 && (
              <ChevronRight 
                size={14} 
                className={idx < activeStep ? "text-accent-primary" : "text-content-tertiary"} 
              />
            )}
          </React.Fragment>
        ))}
      </div>
      
      <div className="mt-3 text-xs text-content-secondary pl-7 border-l-2 border-line-subtle ml-2.5">
        Current Step: <span className="text-content-primary font-medium">{steps[activeStep]}</span>. Complete this to proceed.
      </div>
    </div>
  );
};

export const PageHeader = ({ title, subtitle, actions }) => (
  <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8 pb-4 border-b border-line-subtle">
    <div>
      <h1 className="text-3xl font-display font-bold tracking-tight text-content-primary">{title}</h1>
      {subtitle && <p className="text-content-secondary mt-1">{subtitle}</p>}
    </div>
    {actions && <div className="flex gap-3">{actions}</div>}
  </div>
);

export const Skeleton = ({ className, count = 1 }) => (
  <>
    {Array.from({ length: count }).map((_, i) => (
      <div key={i} className={`animate-pulse bg-surface-muted rounded-sm ${className}`} />
    ))}
  </>
);

