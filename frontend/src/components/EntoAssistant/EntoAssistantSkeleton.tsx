import React from 'react';
import './EntoAssistantSkeleton.css';
import './EntoAI.tokens.css'; // the skeleton reads --cmf-*; the bench-swiss shell never mounts the launcher

/**
 * EntoAssistantSkeleton
 *
 * Instant, self-contained placeholder shown by the `<Suspense>` boundary in
 * AppInner while the lazy `LogosAssistant` chunk downloads. Before this, the
 * fallback was `null` — the user clicked the launcher and saw a blank screen
 * until the whole chunk (react-markdown + the panel tree) arrived, which reads
 * as "the panel is slow / did my click register?".
 *
 * This paints the panel frame — right-edge drawer, header, a couple of message
 * bubbles, and the composer bar — the instant the panel is requested, so the
 * open feels immediate even on a cold (un-prefetched) load. It imports its own
 * lightweight stylesheet rather than the panel's, because the panel's CSS lives
 * inside the very chunk we're waiting on (see EntoAssistantSkeleton.css header).
 *
 * Once the prefetch (LogosAssistantButton) has warmed the chunk, Suspense never
 * needs this — it only ever shows on a genuinely cold open. No props, no data, no
 * context reads.
 *
 * On a phone it takes the sheet's shape and slides up the way the sheet does, and it
 * marks that it showed so the real panel takes its place without sliding up a second
 * time (Frank, 2026-10-27: the old right-edge frame flashed before the drawer).
 */
const EntoAssistantSkeleton: React.FC = () => {
  return (
  <div className="la-skel" role="status" aria-label="Loading Ask Entomate">
    <div className="la-skel-panel">
      <div className="la-skel-handle" aria-hidden="true" />
      {/* Header */}
      <div className="la-skel-header" aria-hidden="true">
        <div className="la-skel-header-icon la-skel-shimmer" />
        <div className="la-skel-header-title la-skel-shimmer" />
        <div className="la-skel-header-spacer" />
        <div className="la-skel-header-dot la-skel-shimmer" />
        <div className="la-skel-header-dot la-skel-shimmer" />
      </div>

      {/* Conversation placeholder */}
      <div className="la-skel-body" aria-hidden="true">
        <div className="la-skel-bubble la-skel-bubble--me">
          <div className="la-skel-line la-skel-shimmer" style={{ width: '70%' }} />
          <div className="la-skel-line la-skel-shimmer" style={{ width: '45%' }} />
        </div>
        <div className="la-skel-bubble la-skel-bubble--ai">
          <div className="la-skel-line la-skel-shimmer" style={{ width: '90%' }} />
          <div className="la-skel-line la-skel-shimmer" style={{ width: '82%' }} />
          <div className="la-skel-line la-skel-shimmer" style={{ width: '60%' }} />
        </div>
        <div className="la-skel-bubble la-skel-bubble--me">
          <div className="la-skel-line la-skel-shimmer" style={{ width: '55%' }} />
        </div>
      </div>

      {/* Composer */}
      <div className="la-skel-composer" aria-hidden="true">
        <div className="la-skel-composer-field la-skel-shimmer" />
      </div>
    </div>
  </div>
  );
};

export default EntoAssistantSkeleton;
