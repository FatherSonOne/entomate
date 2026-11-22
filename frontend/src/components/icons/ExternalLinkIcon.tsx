import React from 'react'
import type { SVGProps } from 'react'

/**
 * External link (line-md). The three strokes are dash-drawn, so CSS can replay
 * the draw-in: the box first, then the shaft, then the arrowhead. At rest it is
 * fully drawn; `.bs-draw-icon` in bench-swiss.css runs the draw on hover/focus
 * of the key that holds it (and not at all under reduced motion).
 */
export function ExternalLinkIcon({ size = 24, className, ...props }: SVGProps<SVGSVGElement> & { size?: number }): React.ReactElement {
  return (
    <svg
      width={size}
      height={size}
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      className={className ? `bs-draw-icon ${className}` : 'bs-draw-icon'}
      {...props}
    >
      <g fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2">
        <path style={{ '--dash': 42 } as React.CSSProperties} strokeDasharray="42" d="M11 5h-6v14h14v-6" />
        <path style={{ '--dash': 12 } as React.CSSProperties} strokeDasharray="12" d="M13 11l7 -7" />
        <path style={{ '--dash': 8 } as React.CSSProperties} strokeDasharray="8" d="M21 3h-6M21 3v6" />
      </g>
    </svg>
  )
}

export default ExternalLinkIcon
