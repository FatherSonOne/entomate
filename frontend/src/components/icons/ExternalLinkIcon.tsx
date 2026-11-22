import React from 'react'
import type { SVGProps } from 'react'

/**
 * External link (line-md). Drawn box first, then the shaft, then the arrowhead,
 * so the app-wide icon draw (bench/iconDraw.ts) replays it in that order.
 */
export function ExternalLinkIcon({ size = 24, className, ...props }: SVGProps<SVGSVGElement> & { size?: number }): React.ReactElement {
  return (
    <svg
      width={size}
      height={size}
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      className={className}
      {...props}
    >
      <g fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2">
        <path d="M11 5h-6v14h14v-6" />
        <path d="M13 11l7 -7" />
        <path d="M21 3h-6M21 3v6" />
      </g>
    </svg>
  )
}

export default ExternalLinkIcon
