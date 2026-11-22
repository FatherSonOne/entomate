/**
 * The bot's live display (in the call) and pipeline display (after it).
 * One Display per screen: a page shows one or the other, never both.
 */

import React, { useEffect, useState } from 'react'
import { Loader2 } from 'lucide-react'
import { Display, Key, Led } from '../bench'
import { PLATFORM_LABEL, elapsedMs, formatElapsed, runTitle } from '../../services/botView'

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

/** REC + timer while live; "Joining" or "Joins at 15:00" before. */
export function BotLiveDisplay({ view, canControl, onStop, stopping, extraKeys = null }) {
  const live = view.phase === 'live'
  const now = useNow(live)
  const head = live
    ? <><Led tone="brand" className="bs-bot-rec" /> REC</>
    : view.phase === 'scheduled'
      ? <><Led tone="off" /> Joins at {clock(view.joinAt)}</>
      : <><Led tone="ai" /> Joining</>
  return (
    <Display className="bs-bot-disp" aria-live="polite">
      <div className="bs-bot-disp-head">
        <span className={`bs-lbl bs-bot-disp-state${live ? ' is-rec' : ''}`}>{head} · {runTitle(view)}</span>
        <span className="bs-lbl">{PLATFORM_LABEL[view.platform]}</span>
      </div>
      <div className={`bs-bot-clock${live ? '' : ' is-idle'}`} role="timer" aria-label={live ? `Recording for ${formatElapsed(elapsedMs(view, now))}` : 'Not recording yet'}>
        {formatElapsed(live ? elapsedMs(view, now) : 0)}
      </div>
      <p className="bs-bot-disp-note">
        {live
          ? 'The bot is in the call and recording. Minutes write themselves when it leaves.'
          : view.phase === 'scheduled'
            ? 'Your calendar sent this bot. It joins on its own.'
            : 'The bot is asking to join. Let it in from the waiting room if your meeting has one.'}
      </p>
      {canControl && (
        <div className="bs-bot-keys">
          {extraKeys}
          <Key size="sm" onDisplay onClick={onStop} disabled={stopping} className="bs-bot-stop">
            {stopping && <Loader2 className="animate-spin" aria-hidden="true" />}{view.phase === 'scheduled' ? 'Cancel bot' : 'Stop bot'}
          </Key>
        </div>
      )}
    </Display>
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
