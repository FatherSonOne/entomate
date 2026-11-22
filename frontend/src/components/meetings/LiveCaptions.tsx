/**
 * Live captions while a meeting records in the browser, from the browser's own speech
 * recognition (Web Speech API). Free and fast, but a preview only: no speakers, and never
 * saved. The saved transcript is still Gemini's pass over the whole recording.
 *
 * The recorder's mixed audio track (tab sound plus microphone) is passed to `start(track)`.
 * A browser without that overload ignores it and listens to the default microphone.
 * Chrome sends the audio to Google to recognise it, so captions are off until chosen.
 */

import React, { useEffect, useRef, useState } from 'react'
import { AlertTriangle, X } from 'lucide-react'
import { formatClock } from '../../services/meetingTranscriptService'

interface RecognitionResult {
  isFinal: boolean
  0: { transcript: string }
}

interface RecognitionEvent {
  resultIndex: number
  results: ArrayLike<RecognitionResult>
}

interface Recognition {
  continuous: boolean
  interimResults: boolean
  lang: string
  onresult: ((e: RecognitionEvent) => void) | null
  onerror: ((e: { error: string }) => void) | null
  onend: (() => void) | null
  start: (track?: MediaStreamTrack) => void
  abort: () => void
}

type RecognitionCtor = new () => Recognition

/** The browser's speech recognition, or null where there is none (Firefox, for one). */
export function speechRecognitionCtor(win: unknown = typeof window === 'undefined' ? undefined : window): RecognitionCtor | null {
  const w = win as { SpeechRecognition?: RecognitionCtor; webkitSpeechRecognition?: RecognitionCtor } | undefined
  return w?.SpeechRecognition ?? w?.webkitSpeechRecognition ?? null
}

/** Errors after which listening again cannot work; the rest (silence, a restart) are routine. */
export function captionErrorMessage(code: string): string | null {
  if (code === 'not-allowed' || code === 'service-not-allowed') return 'Live captions were blocked by the browser. The recording continues.'
  if (code === 'network') return 'Live captions need the browser’s speech service, which could not be reached. The recording continues.'
  if (code === 'audio-capture') return 'Live captions could not hear the audio. The recording continues.'
  if (code === 'language-not-supported') return 'Live captions do not support this language. The recording continues.'
  return null
}

const MAX_LINES = 200

export interface LiveCaptionsProps {
  /** The recorder's mixed audio. */
  track: MediaStreamTrack | null
  /** When recording started (epoch ms), to time each line. */
  startedAt: number
  /** Turn captions off for the rest of this recording. */
  onClose: () => void
}

export function LiveCaptions({ track, startedAt, onClose }: LiveCaptionsProps): React.ReactElement | null {
  const [lines, setLines] = useState<Array<{ atMs: number; text: string }>>([])
  const [interim, setInterim] = useState('')
  const [error, setError] = useState<string | null>(null)
  const listRef = useRef<HTMLOListElement | null>(null)
  const Ctor = speechRecognitionCtor()

  useEffect(() => {
    if (!Ctor) return
    const rec = new Ctor()
    rec.continuous = true
    rec.interimResults = true
    rec.lang = navigator.language || 'en-US'
    let live = true
    let lineStartedAt: number | null = null

    rec.onresult = (e) => {
      let pending = ''
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const result = e.results[i]!
        const text = result[0].transcript.trim()
        if (!text) continue
        lineStartedAt ??= Date.now()
        if (result.isFinal) {
          const atMs = Math.max(0, lineStartedAt - startedAt)
          lineStartedAt = null
          setLines((prev) => [...prev, { atMs, text }].slice(-MAX_LINES))
        } else {
          pending += `${text} `
        }
      }
      setInterim(pending.trim())
    }
    rec.onerror = (e) => {
      const message = captionErrorMessage(e.error)
      if (!message) return
      live = false
      setError(message)
    }
    // The service ends a session after a pause or a few minutes; keep listening.
    rec.onend = () => {
      setInterim('')
      if (live) begin()
    }
    function begin(): void {
      try {
        if (track && track.readyState === 'live') rec.start(track)
        else rec.start()
      } catch {
        try {
          rec.start()
        } catch {
          live = false
          setError('Live captions could not start. The recording continues.')
        }
      }
    }
    begin()
    return () => {
      live = false
      rec.onend = null
      rec.abort()
    }
  }, [Ctor, track, startedAt])

  useEffect(() => {
    const list = listRef.current
    if (list) list.scrollTop = list.scrollHeight
  }, [lines, interim])

  if (!Ctor) return null

  return (
    <section aria-label="Live captions" className="space-y-2 rounded-lg border border-line-subtle p-3">
      <div className="flex items-center justify-between gap-2">
        <h4 className="text-xs font-medium text-content-secondary">Live captions (preview, not saved)</h4>
        <button
          type="button"
          onClick={onClose}
          className="inline-flex min-h-8 items-center gap-1 rounded px-2 text-xs text-content-secondary hover:text-content-primary focus:outline-none focus-visible:ring-2 focus-visible:ring-accent-primary"
        >
          <X className="h-3.5 w-3.5" aria-hidden="true" /> Turn off
        </button>
      </div>
      {error ? (
        <p role="alert" className="flex items-start gap-2 text-xs text-semantic-error">
          <AlertTriangle className="mt-0.5 h-3.5 w-3.5 flex-shrink-0" aria-hidden="true" /> {error}
        </p>
      ) : (
        <ol ref={listRef} role="log" aria-live="polite" data-testid="live-captions" className="max-h-40 space-y-1 overflow-y-auto text-sm scrollbar-thin">
          {lines.length === 0 && !interim && <li className="text-xs text-content-secondary">Listening…</li>}
          {lines.map((line, i) => (
            <li key={`${line.atMs}-${i}`} className="grid grid-cols-[3.5rem_1fr] gap-x-3">
              <span className="pt-px text-xs tabular-nums text-content-secondary">{formatClock(line.atMs)}</span>
              <span className="text-content-primary">{line.text}</span>
            </li>
          ))}
          {interim && (
            // Words still being recognised: shown, but not read out until they settle.
            <li aria-hidden="true" className="grid grid-cols-[3.5rem_1fr] gap-x-3">
              <span />
              <span className="italic text-content-secondary">{interim}</span>
            </li>
          )}
        </ol>
      )}
    </section>
  )
}

export default LiveCaptions
