import React from 'react'

export interface TapeMarker {
  /** Position in the meeting, in ms (summary_moments / transcript_at_ms). */
  atMs: number
  /** Accessible label, e.g. the decision text. */
  label: string
}

export interface TapeProps {
  durationMs: number
  /** Crimson ticks. */
  decisions?: ReadonlyArray<TapeMarker>
  /** Amber ticks: agent actions. */
  actions?: ReadonlyArray<TapeMarker>
  /** Played or recorded share, 0–1. Defaults to the full tape. */
  progress?: number
  /**
   * Optional meter: one 0–1 level per slice of the meeting (speech density). Drawn as
   * bars instead of the plain fill; bars before `progress` read as played.
   */
  density?: ReadonlyArray<number>
  /** Accessible name; defaults to the marker counts. */
  label?: string
  /** Show a playhead at `progress`. */
  playhead?: boolean
  /** When set, markers become buttons that jump to the moment. */
  onSeek?: (atMs: number) => void
  className?: string
}

function pct(atMs: number, durationMs: number): string {
  if (durationMs <= 0) return '0%'
  return `${Math.min(100, Math.max(0, (atMs / durationMs) * 100))}%`
}

/** A meeting's length as a track, with decision and agent-action ticks. */
export function Tape({ durationMs, decisions = [], actions = [], progress = 1, density, label, playhead = false, onSeek, className }: TapeProps): React.ReactElement {
  const marker = (m: TapeMarker, kind: 'd' | 'a', i: number): React.ReactElement => {
    const style: React.CSSProperties = { left: pct(m.atMs, durationMs) }
    return onSeek ? (
      <button key={`${kind}${i}`} type="button" className={`bs-tape-mk ${kind}`} style={style} aria-label={m.label} title={m.label} onClick={() => onSeek(m.atMs)} />
    ) : (
      <b key={`${kind}${i}`} className={`bs-tape-mk ${kind}`} style={style} title={m.label} />
    )
  }
  const p = Math.min(1, Math.max(0, progress))
  return (
    <div className={['bs-tape', density && 'bs-tape-meter', className].filter(Boolean).join(' ')} role={onSeek ? 'group' : 'img'} aria-label={label ?? `Tape: ${decisions.length} decisions, ${actions.length} agent actions`}>
      {density ? (
        <span className="bs-tape-bars" aria-hidden="true">
          {density.map((v, i) => (
            <i
              key={i}
              className={(i + 0.5) / density.length <= p ? 'p' : undefined}
              style={{ height: `${Math.round(12 + Math.min(1, Math.max(0, v)) * 88)}%` }}
            />
          ))}
        </span>
      ) : (
        <i className="bs-tape-fill" style={{ width: `${p * 100}%` }} />
      )}
      {playhead && <i className="bs-tape-head" style={{ left: `${p * 100}%` }} aria-hidden="true" />}
      {decisions.map((m, i) => marker(m, 'd', i))}
      {actions.map((m, i) => marker(m, 'a', i))}
    </div>
  )
}
