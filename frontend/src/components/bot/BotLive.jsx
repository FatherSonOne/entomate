/**
 * The bot in a call, with its controls: live captions, Mark (M), Pause /
 * Resume, Pop out and Stop. Used on the Bot page and the meeting page's live
 * view. The pop-out is the same React tree rendered into a small always-on-
 * top window (Document Picture-in-Picture in Chrome and Edge, a plain popup
 * elsewhere), so it shares this component's state and polling.
 */

import React, { useCallback, useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { botsApi } from '../../services/api'
import { Key, Led, useMediaQuery, PHONE_QUERY } from '../bench'
import { BotLiveDisplay } from './BotDisplays'
import { formatElapsed, runTitle } from '../../services/botView'

const POLL_MS = 2000

/** Caption lines for a live session, polled every 2 s while `active`. */
export function useBotCaptions(sessionId, active) {
  const [state, setState] = useState({ lines: [], seq: 0, paused: false, pausedByYou: false, lastLineAt: null, watchingSince: null, captionsOn: null, optOutsHidden: false, available: false })
  const seqRef = useRef(0)
  useEffect(() => { seqRef.current = 0; setState((s) => ({ ...s, lines: [], seq: 0 })) }, [sessionId])
  const poll = useCallback(async () => {
    try {
      const res = await botsApi.captions(sessionId, seqRef.current)
      const fresh = Array.isArray(res?.lines) ? res.lines : []
      seqRef.current = Math.max(seqRef.current, Number(res?.seq) || 0)
      setState((s) => ({
        lines: [...s.lines, ...fresh.filter((l) => l.seq > (s.lines[s.lines.length - 1]?.seq || 0))].slice(-200),
        seq: seqRef.current,
        paused: Boolean(res?.paused),
        pausedByYou: Boolean(res?.pausedByYou),
        lastLineAt: typeof res?.lastLineAt === 'string' ? res.lastLineAt : null,
        watchingSince: typeof res?.watchingSince === 'string' ? res.watchingSince : null,
        captionsOn: typeof res?.captionsOn === 'boolean' ? res.captionsOn : null,
        optOutsHidden: Boolean(res?.optOutsHidden),
        available: s.available || seqRef.current > 0 || fresh.length > 0,
      }))
    } catch { /* keep the last lines; the next poll retries */ }
  }, [sessionId])
  useEffect(() => {
    if (!active) return undefined
    poll()
    const t = window.setInterval(poll, POLL_MS)
    return () => window.clearInterval(t)
  }, [active, poll])
  return [state, setState]
}

export const canPip = () => typeof window !== 'undefined' && 'documentPictureInPicture' in window

/** Copy the app's styles and theme into the pop-out window's document. */
export function dressWindow(win, title = 'Entomate · bot') {
  const doc = win.document
  doc.title = title
  for (const node of document.querySelectorAll('link[rel="stylesheet"], style')) {
    doc.head.appendChild(node.cloneNode(true))
  }
  const html = doc.documentElement
  html.dataset.style = document.documentElement.dataset.style || 'bench-swiss'
  html.className = document.documentElement.className
  doc.body.className = 'bs-bot-popbody'
  const root = doc.createElement('div')
  doc.body.appendChild(root)
  return root
}

/** The pop-out after the call: one line and a key back to the app. Plain DOM: React has let go of it. */
function showDebriefReady(win) {
  const doc = win.document
  doc.body.replaceChildren()
  const box = doc.createElement('div')
  box.className = 'bs-bot-pop bs-bot-pop-done'
  const head = doc.createElement('p')
  head.className = 'bs-lbl'
  head.textContent = 'The bot left'
  const line = doc.createElement('p')
  line.className = 'bs-h3'
  line.textContent = 'Debrief ready. It is open in Entomate.'
  const open = doc.createElement('button')
  open.type = 'button'
  open.className = 'bs-key pri'
  open.textContent = 'Open'
  open.addEventListener('click', () => { try { window.focus() } catch { /* refused */ } win.close() })
  box.append(head, line, open)
  doc.body.appendChild(box)
}

export default function BotLive({ view, canControl, onStop, stopping }) {
  const isPhone = useMediaQuery(PHONE_QUERY)
  const live = view.phase === 'live'
  const [captions, setCaptions] = useBotCaptions(view.sessionId, live)
  const [busy, setBusy] = useState(null)
  const [note, setNote] = useState(null)
  const [pop, setPop] = useState(null) // { win, root }

  // Not recording: paused here, or Recall reports the bot in the call without recording.
  const paused = captions.paused || view.recording === false
  const togglePause = async () => {
    setBusy('pause')
    try {
      await (paused ? botsApi.resume(view.sessionId) : botsApi.pause(view.sessionId))
      setCaptions((s) => ({ ...s, paused: !paused, pausedByYou: !paused }))
      setNote(paused ? 'Recording again' : 'Paused. Nothing is recorded until you resume.')
    } catch {
      setNote(paused ? 'Could not resume. Try again.' : 'Could not pause. Try again.')
    } finally {
      setBusy(null)
    }
  }

  const mark = useCallback(async () => {
    if (!live) return
    setBusy('mark')
    try {
      const res = await botsApi.mark(view.sessionId)
      const at = res?.mark?.atMs
      setNote(at != null ? `Marked ${formatElapsed(at)}. It shows in the debrief.` : 'Marked. It shows in the debrief.')
    } catch (err) {
      setNote(err?.response?.status === 503 ? 'Marks need a quick database update first.' : 'Could not mark. Try again.')
    } finally {
      setBusy(null)
    }
  }, [live, view.sessionId])

  // M marks the moment, in the app and in the pop-out (not while typing).
  useEffect(() => {
    if (!live || !canControl) return undefined
    const onKey = (e) => {
      const t = e.target
      if (e.key !== 'm' && e.key !== 'M') return
      if (e.metaKey || e.ctrlKey || e.altKey) return
      if (t && (t.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName))) return
      e.preventDefault()
      mark()
    }
    const docs = [document, pop?.win?.document].filter(Boolean)
    docs.forEach((d) => d.addEventListener('keydown', onKey))
    return () => docs.forEach((d) => d.removeEventListener('keydown', onKey))
  }, [live, canControl, mark, pop])

  useEffect(() => {
    if (!note) return undefined
    const t = window.setTimeout(() => setNote(null), 4000)
    return () => window.clearTimeout(t)
  }, [note])

  const openPop = async () => {
    if (pop) { pop.win.focus(); return }
    try {
      const win = canPip()
        ? await window.documentPictureInPicture.requestWindow({ width: 380, height: 460 })
        : window.open('', 'entomate-bot', 'popup,width=380,height=500')
      if (!win) { setNote('Your browser blocked the pop-out. Allow pop-ups for Entomate.'); return }
      const root = dressWindow(win)
      win.addEventListener('pagehide', () => setPop(null), { once: true })
      setPop({ win, root })
    } catch {
      setNote('The pop-out could not open in this browser.')
    }
  }

  // When this view goes away: if the call ended, the pop-out turns into
  // "Debrief ready" (the app is moving to the debrief); otherwise it closes.
  const meetingIdRef = useRef(view.meetingId)
  meetingIdRef.current = view.meetingId
  useEffect(() => () => {
    if (!pop?.win || pop.win.closed) return
    const { win } = pop
    botsApi.forMeeting(meetingIdRef.current)
      .then((res) => {
        const phase = res?.session?.phase
        if (phase === 'processing' || phase === 'ready') showDebriefReady(win)
        else win.close()
      })
      .catch(() => win.close())
  }, [pop])

  const keys = (
    <>
      <Key size="sm" onDisplay onClick={mark} disabled={busy === 'mark' || paused} kbd="M">Mark</Key>
      <Key size="sm" onDisplay onClick={togglePause} disabled={busy === 'pause'}>{paused ? 'Resume' : 'Pause'}</Key>
      {!isPhone && <Key size="sm" onDisplay onClick={openPop} aria-pressed={Boolean(pop)}>{pop ? 'Popped out' : 'Pop out ↗'}</Key>}
    </>
  )
  const status = note && <p className="bs-bot-disp-note bs-bot-live-note" role="status">{note}</p>

  return (
    <>
      <BotLiveDisplay
        view={view}
        canControl={canControl}
        onStop={onStop}
        stopping={stopping}
        keys={keys}
        captions={captions}
        paused={paused}
        footer={status}
      />
      {pop && createPortal(
        <BotPopPanel
          view={view}
          canControl={canControl}
          captions={captions}
          paused={paused}
          busy={busy}
          note={note}
          onMark={mark}
          onPause={togglePause}
          onStop={onStop}
          stopping={stopping}
          onOpen={() => { try { window.focus() } catch { /* some browsers refuse */ } }}
        />,
        pop.root,
      )}
    </>
  )
}

/** The pop-out window: REC, timer, captions, Mark / Pause / Stop. */
function BotPopPanel({ view, canControl, captions, paused, busy, note, onMark, onPause, onStop, stopping, onOpen }) {
  const keys = (
    <>
      <Key size="sm" onDisplay onClick={onMark} disabled={busy === 'mark' || paused} kbd="M">Mark</Key>
      <Key size="sm" onDisplay onClick={onPause} disabled={busy === 'pause'}>{paused ? 'Resume' : 'Pause'}</Key>
    </>
  )
  return (
    <div className="bs-bot-pop">
      <BotLiveDisplay
        view={view}
        canControl={canControl}
        onStop={onStop}
        stopping={stopping}
        keys={keys}
        captions={captions}
        paused={paused}
        compact
        footer={note && <p className="bs-bot-disp-note bs-bot-live-note" role="status">{note}</p>}
      />
      <div className="bs-bot-pop-foot">
        <span className="bs-lbl">{captions.optOutsHidden ? <><Led tone="mint" /> Opt-outs hidden</> : runTitle(view)}</span>
        <button type="button" className="bs-linkbtn bs-lbl" onClick={onOpen}>Open in Entomate</button>
      </div>
    </div>
  )
}
