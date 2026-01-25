import React from 'react';

// Design B: The Quantum Loop
// Concept: An infinity loop / Möbius strip representing continuous automated flow, with two entangled particles.
export const Logo = ({ className = "w-8 h-8", withText = true }) => {
  return (
    <div className="flex items-center gap-2">
      <svg 
        className={className} 
        viewBox="0 0 100 100" 
        fill="none" 
        xmlns="http://www.w3.org/2000/svg"
      >
        <path 
          d="M25 50C25 36.1929 36.1929 25 50 25C63.8071 25 75 36.1929 75 50" 
          stroke="currentColor" 
          strokeWidth="8" 
          strokeLinecap="round" 
          className="text-content-tertiary opacity-30" 
        />
        <path 
          d="M75 50C75 63.8071 63.8071 75 50 75C36.1929 75 25 63.8071 25 50" 
          stroke="var(--accent-primary)" 
          strokeWidth="8" 
          strokeLinecap="round" 
        />
        
        {/* Particle 1 */}
        <circle 
          cx="25" 
          cy="50" 
          r="8" 
          fill="var(--bg-base)" 
          stroke="var(--accent-secondary)" 
          strokeWidth="2" 
        />
        
        {/* Particle 2 */}
        <circle 
          cx="75" 
          cy="50" 
          r="8" 
          fill="var(--bg-base)" 
          stroke="var(--accent-tertiary)" 
          strokeWidth="2" 
        />
        
        {/* Connection */}
        <path 
          d="M25 50L75 50" 
          stroke="currentColor" 
          strokeWidth="2" 
          strokeDasharray="4 2" 
          className="text-content-primary opacity-40" 
        />
      </svg>
      
      {withText && (
        <span className="text-xl font-bold tracking-tight text-content-primary">
          Entomate
        </span>
      )}
    </div>
  );
};

export default Logo;

