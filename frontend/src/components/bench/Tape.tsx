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
  /** When set, markers become buttons that jump to the moment. */
  onSeek?: (atMs: number) => void
  className?: string
}

function pct(atMs: number, durationMs: number): string {
  if (durationMs <= 0) return '0%'
  return `${Math.min(100, Math.max(0, (atMs / durationMs) * 100))}%`
}

/** A meeting's length as a track, with decision and agent-action ticks. */
export function Tape({ durationMs, decisions = [], actions = [], progress = 1, onSeek, className }: TapeProps): React.ReactElement {
  const marker = (m: TapeMarker, kind: 'd' | 'a', i: number): React.ReactElement => {
    const style: React.CSSProperties = { left: pct(m.atMs, durationMs) }
    return onSeek ? (
      <button key={`${kind}${i}`} type="button" className={`bs-tape-mk ${kind}`} style={style} aria-label={m.label} title={m.label} onClick={() => onSeek(m.atMs)} />
    ) : (
      <b key={`${kind}${i}`} className={`bs-tape-mk ${kind}`} style={style} title={m.label} />
    )
  }
  return (
    <div className={['bs-tape', className].filter(Boolean).join(' ')} role={onSeek ? 'group' : 'img'} aria-label={`Tape: ${decisions.length} decisions, ${actions.length} agent actions`}>
      <i className="bs-tape-fill" style={{ width: `${Math.min(1, Math.max(0, progress)) * 100}%` }} />
      {decisions.map((m, i) => marker(m, 'd', i))}
      {actions.map((m, i) => marker(m, 'a', i))}
    </div>
  )
}
