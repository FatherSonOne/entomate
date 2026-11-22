import React from 'react'
import '../styles/page-skeleton.css'

const ROWS = 6

/**
 * Inside the shell, while a page's code loads: the Bench Swiss page shape
 * (title, meta, 2px rule, ruled rows) in quiet bars, so the app arrives
 * already laid out. The bars shimmer unless motion is reduced.
 */
export default function PageSkeleton(): React.ReactElement {
  return (
    <div className="bs-tokens en-skel" role="status" aria-live="polite" aria-label="Loading page">
      <div className="en-skel-head">
        <span className="en-skel-bar en-skel-title" />
        <span className="en-skel-bar en-skel-meta" />
      </div>
      <div className="en-skel-keys">
        <span className="en-skel-bar en-skel-key" />
        <span className="en-skel-bar en-skel-key" />
      </div>
      <div className="en-skel-rule" />
      <ul className="en-skel-rows">
        {Array.from({ length: ROWS }, (_, i) => (
          <li key={i}>
            <span className="en-skel-bar en-skel-date" />
            <span className="en-skel-bar en-skel-main" />
            <span className="en-skel-bar en-skel-side" />
          </li>
        ))}
      </ul>
    </div>
  )
}
