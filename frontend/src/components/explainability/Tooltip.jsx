import React, { useState } from 'react';

/**
 * Tooltip - Displays helpful context on hover
 *
 * Props:
 * - content: Tooltip text
 * - children: Element to trigger tooltip
 * - position: 'top' | 'bottom' | 'left' | 'right'
 */
export default function Tooltip({ content, children, position = 'top' }) {
  const [isVisible, setIsVisible] = useState(false);

  const positionClasses = {
    top: 'bottom-full left-1/2 transform -translate-x-1/2 mb-2',
    bottom: 'top-full left-1/2 transform -translate-x-1/2 mt-2',
    left: 'right-full top-1/2 transform -translate-y-1/2 mr-2',
    right: 'left-full top-1/2 transform -translate-y-1/2 ml-2'
  };

  return (
    <div className="relative inline-block">
      <div
        onMouseEnter={() => setIsVisible(true)}
        onMouseLeave={() => setIsVisible(false)}
        onFocus={() => setIsVisible(true)}
        onBlur={() => setIsVisible(false)}
        className="cursor-help"
      >
        {children}
      </div>

      {isVisible && content && (
        <div
          className={`absolute z-50 ${positionClasses[position]} pointer-events-none`}
          role="tooltip"
        >
          <div className="vc-bg-code vc-text-primary text-xs rounded py-2 px-3 shadow-lg max-w-xs">
            {content}
            <div
              className={`tooltip-arrow ${position}`}
              style={{
                position: 'absolute',
                ...(position === 'top' && { top: '100%', left: '50%', transform: 'translateX(-50%)' }),
                ...(position === 'bottom' && { bottom: '100%', left: '50%', transform: 'translateX(-50%)' }),
                ...(position === 'left' && { left: '100%', top: '50%', transform: 'translateY(-50%)' }),
                ...(position === 'right' && { right: '100%', top: '50%', transform: 'translateY(-50%)' })
              }}
            >
              <div
                style={{
                  width: 0,
                  height: 0,
                  borderStyle: 'solid',
                  ...(position === 'top' && {
                    borderWidth: '6px 6px 0 6px',
                    borderColor: '#1a1a1a transparent transparent transparent'
                  }),
                  ...(position === 'bottom' && {
                    borderWidth: '0 6px 6px 6px',
                    borderColor: 'transparent transparent #1a1a1a transparent'
                  }),
                  ...(position === 'left' && {
                    borderWidth: '6px 0 6px 6px',
                    borderColor: 'transparent transparent transparent #1a1a1a'
                  }),
                  ...(position === 'right' && {
                    borderWidth: '6px 6px 6px 0',
                    borderColor: 'transparent #1a1a1a transparent transparent'
                  })
                }}
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
