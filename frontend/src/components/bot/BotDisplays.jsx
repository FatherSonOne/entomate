/**
 * The bot's live display (in the call) and pipeline display (after it).
 * One Display per screen: a page shows one or the other, never both.
 */

import React, { useEffect, useRef, useState } from 'react'
import { Loader2 } from 'lucide-react'
import { Display, Key, Led } from '../bench'
import { PLATFORM_LABEL, elapsedMs, formatElapsed, quietWarning, runTitle } from '../../services/botView'

function useNow(active) {
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    if (!active) return undefined
    const t = window.setInterval(() => setNow(Date.now()), 1000)
    return () => window.clearInterval(t)
  }, [active])
  return now
}

const clock = (iso) => new Date(iso).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false })

/**
 * REC + timer and live captions while live; "Joining" or "Joins at 15:00"
 * before. Presentational: keys come in as `keys`, captions as `captions`.
 * `compact` is the pop-out window's layout.
 */
export function BotLiveDisplay({ view, canControl, onStop, stopping, keys = null, captions = null, paused = false, compact = false, footer = null }) {
  const live = view.phase === 'live'
  const now = useNow(live)
  // Paused by you, or in the call without recording (e.g. a Zoom host has not allowed it):
  // never REC unless Recall says it is recording.
  const byYou = Boolean(captions?.pausedByYou)
  const head = live
    ? paused
      ? <><Led tone="ai" /> {byYou ? 'Paused' : 'Not recording'}</>
      : <><Led tone="brand" className="bs-bot-rec" /> REC</>
    : view.phase === 'scheduled'
      ? <><Led tone="off" /> Joins at {clock(view.joinAt)}</>
      : <><Led tone="ai" /> Joining</>
  const elapsed = live ? elapsedMs(view, now) : 0
  const quiet = live && captions
    ? quietWarning({ startedAt: view.startedAt, lastLineAt: captions.lastLineAt ?? null, watchingSince: captions.watchingSince ?? null, captionsOn: captions.captionsOn ?? view.captionsOn ?? null, paused }, now)
    : null
  return (
    <Display className={`bs-bot-disp${compact ? ' is-compact' : ''}`}>
      <div className="bs-bot-disp-head">
        <span className={`bs-lbl bs-bot-disp-state${live && !paused ? ' is-rec' : paused ? ' is-ai' : ''}`}>{head}{!compact && <> · {runTitle(view)}</>}</span>
        <span className="bs-lbl">{compact ? runTitle(view) : PLATFORM_LABEL[view.platform]}</span>
      </div>
      <div className={`bs-bot-clock${live && !paused ? '' : ' is-idle'}`} role="timer" aria-label={live ? `In the call for ${formatElapsed(elapsed)}` : 'Not recording yet'}>
        {formatElapsed(elapsed)}
      </div>
      {live && !paused && quiet && (
        <p className="bs-bot-disp-note bs-bot-err" role="alert">{quiet}</p>
      )}
      {live && captions ? (
        <CaptionList captions={captions} paused={paused} byYou={byYou} compact={compact} />
      ) : !compact && (
        <p className="bs-bot-disp-note">
          {live
            ? paused && !byYou ? NOT_RECORDING : 'The bot is in the call and recording. Minutes write themselves when it leaves.'
            : view.phase === 'scheduled'
              ? 'Your calendar sent this bot. It joins on its own.'
              : 'The bot is asking to join. Let it in from the waiting room if your meeting has one.'}
        </p>
      )}
      {canControl && (
        <div className="bs-bot-keys">
          {live && keys}
          <Key size="sm" onDisplay onClick={onStop} disabled={stopping} className="bs-bot-stop">
            {stopping && <Loader2 className="animate-spin" aria-hidden="true" />}{view.phase === 'scheduled' ? 'Cancel bot' : 'Stop'}
          </Key>
        </div>
      )}
      {footer}
    </Display>
  )
}

/** The newest caption lines, newest last; the region announces new lines politely. */
const NOT_RECORDING = 'The bot is in the call but not recording. On Zoom, the host may need to allow it to record.'

function CaptionList({ captions, paused, byYou = true, compact }) {
  const lines = captions.lines.slice(compact ? -4 : -6)
  const boxRef = useRef(null)
  const lastSeq = lines.length ? lines[lines.length - 1].seq : 0
  // Keep the newest line in view inside the box (never scroll the page).
  useEffect(() => { if (boxRef.current) boxRef.current.scrollTop = boxRef.current.scrollHeight }, [lastSeq])
  return (
    <div className="bs-bot-caps" ref={boxRef} aria-live="polite" aria-label="Live captions">
      {lines.length === 0 ? (
        <p className="bs-bot-cap-empty">
          {paused ? (byYou ? 'Recording is paused. Nothing is recorded or captioned until you resume.' : NOT_RECORDING)
            : captions.available ? 'Captions appear here as people speak, a second or two behind.'
              : 'Live captions start with the next bot you send.'}
        </p>
      ) : lines.map((l) => (
        <p key={l.seq} className={`bs-bot-cap${l.hidden ? ' is-hidden' : ''}`}>
          <span className="bs-bot-cap-t">{l.atMs != null ? formatElapsed(l.atMs) : ''}</span>
          <span>{l.speaker && <b>{l.speaker}</b>} {l.text}</span>
        </p>
      ))}
      {paused && lines.length > 0 && <p className="bs-bot-cap-empty">{byYou ? 'Paused. Nothing is recorded until you resume.' : NOT_RECORDING}</p>}
    </div>
  )
}

const STEP_TONE = { done: 'live', working: 'ai', waiting: 'off' }

/** "The bot left": the pipeline (left the call, transcript, summary, actions, audio). */
export function BotPipelineDisplay({ view, onDismiss, plain = false }) {
  const steps = view.debrief?.steps || []
  const ready = view.phase === 'ready'
  // On the meeting page the tape is the screen's one display, so the debrief is a plain ruled strip.
  const Box = plain ? 'div' : Display
  return (
    <Box className={plain ? 'bs-bot-pipe-plain' : 'bs-bot-disp bs-bot-pipe-disp'}>
      <div className="bs-bot-disp-head">
        <span className={`bs-lbl bs-bot-disp-state ${ready ? 'is-live' : 'is-ai'}`}>
          <Led tone={ready ? 'live' : 'ai'} />{' '}
          {ready ? 'The bot left · everything it caught is on this page' : 'The bot left · writing the minutes'}
        </span>
        {onDismiss && <Key size="sm" onDisplay={!plain} onClick={onDismiss}>Dismiss</Key>}
      </div>
      <ol className="bs-bot-pipe">
        {steps.map((s) => (
          <li key={s.key} className={`bs-bot-step is-${s.state}`}>
            <span className="bs-lbl"><Led tone={STEP_TONE[s.state]} /> {s.label}</span>
            <b>{s.key === 'left' && s.state === 'done' && view.debrief?.durationMs ? formatElapsed(view.debrief.durationMs) : s.value}</b>
          </li>
        ))}
      </ol>
    </Box>
  )
}
