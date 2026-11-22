/**
 * EntoAssistant — Context-aware AI assistant panel for Entomate
 * Portal-rendered right-side drawer with streaming chat.
 *
 * EAI-02: the visual shell is the Logos AI panel (EntoAI.css + the ported orb, composer,
 * context card and resize edge). The data path is unchanged: same endpoint, same
 * sessionStorage history, same section context, quick actions and follow-ups.
 */
import React, { useState, useEffect, useRef, useCallback } from 'react'
import { createPortal } from 'react-dom'
import { X, AlertCircle, User as UserIcon } from 'lucide-react'
import ReactMarkdown from 'react-markdown'
import { useAuth } from '../../contexts/AuthContext'
import useAssistantContext from './useAssistantContext'
import { getStarter, streamQuery } from '../../services/entoAssistantService'
import { useMediaQuery } from '../bench/useMediaQuery'
import { usePresence, MOTION } from '../bench/motion'
import Composer from './Composer'
import ContextCard from './ContextCard'
import { WelcomeOrb, orbStateFor, useSettledOrbState, AI_ORB_LABELS } from './AiOrb'
import { EntoOrb, EntoOrbGlyph } from './EntoOrb'
import { usePanelResize } from './usePanelResize'
import { setVoiceState, pulseVoice, onVoiceRequest } from './voiceSignal'
import { useMicLevel } from './useMicLevel'
import './EntoAI.css'
import './EntoAI.tokens.css'

const STORAGE_KEY = 'ento-ai-history'
const PARKED_KEY = 'ento-ai-parked'
const MAX_MESSAGES = 50
/**
 * A conversation left this long, or started on another page, is set aside when the panel
 * opens so the panel starts clean for the page you are on. It can be brought back from the
 * starting state; it is not deleted.
 */
const STALE_AFTER_MS = 30 * 60 * 1000
/** usePanelResize is desktop-only: below this the CSS media queries own the width. */
const RESIZE_QUERY = '(min-width: 1281px)'

// A refused or missing microphone ends dictation with no word; say why (from Logos AI).
const MIC_ERRORS = {
  'not-allowed': 'The microphone is blocked. Allow it in your browser’s site settings, then try again.',
  'service-not-allowed': 'The microphone is blocked. Allow it in your browser’s site settings, then try again.',
  'audio-capture': 'No microphone found. Connect one, then try again.',
}

function loadHistory(key = STORAGE_KEY) {
  try {
    const raw = sessionStorage.getItem(key)
    const parsed = raw ? JSON.parse(raw) : []
    return Array.isArray(parsed) ? parsed : []
  } catch { return [] }
}

function saveHistory(messages, key = STORAGE_KEY) {
  try {
    if (messages.length) sessionStorage.setItem(key, JSON.stringify(messages.slice(-MAX_MESSAGES)))
    else sessionStorage.removeItem(key)
  } catch { /* quota */ }
}

/** True when a saved conversation does not belong on the page the panel is opening over. */
function isStale(messages, section) {
  if (!messages.length) return false
  const last = messages[messages.length - 1]
  // Messages saved before conversations carried their page have no section: treat as stale.
  if (!messages[0].section || messages[0].section !== section) return true
  return !last.ts || Date.now() - last.ts > STALE_AFTER_MS
}

export default function EntoAssistant({ isOpen, onClose }) {
  const { user } = useAuth()
  const { context, section, sectionSummary, sectionLabel, isLoading: contextLoading, isReady: contextReady } = useAssistantContext(isOpen)

  const [messages, setMessages] = useState(() => loadHistory())
  // A conversation set aside on open (see STALE_AFTER_MS), offered back from the starting state.
  const [parked, setParked] = useState(() => loadHistory(PARKED_KEY))
  const [inputValue, setInputValue] = useState('')
  const [isQuerying, setIsQuerying] = useState(false)
  const [streamingContent, setStreamingContent] = useState('')
  const [error, setError] = useState(null)
  const [conversationId, setConversationId] = useState(null)
  const [isListening, setIsListening] = useState(false)

  const messagesEndRef = useRef(null)
  const inputRef = useRef(null)
  const abortRef = useRef(null)
  const panelRef = useRef(null)

  const canResize = useMediaQuery(RESIZE_QUERY)
  const {
    appliedWidth, minWidth: resizeMin, maxWidth: resizeMax,
    onPointerDown: onResizePointerDown, onKeyDown: onResizeKeyDown, onDoubleClick: onResizeDoubleClick,
  } = usePanelResize(panelRef, canResize)

  // Persist messages
  useEffect(() => { saveHistory(messages) }, [messages])
  useEffect(() => { saveHistory(parked, PARKED_KEY) }, [parked])

  // Opening the panel over another page, or long after the last answer, starts clean.
  // Read through refs so this runs on open only, not on every message.
  const messagesRef = useRef(messages)
  messagesRef.current = messages
  useEffect(() => {
    if (!isOpen) return
    const current = messagesRef.current
    if (!isStale(current, section)) return
    abortRef.current?.abort()
    setIsQuerying(false)
    setStreamingContent('')
    setParked(current)
    setMessages([])
    setConversationId(null)
  }, [isOpen]) // eslint-disable-line react-hooks/exhaustive-deps

  // Auto-scroll
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, streamingContent])

  // Auto-focus input when panel opens
  useEffect(() => {
    if (isOpen) setTimeout(() => inputRef.current?.focus(), 100)
  }, [isOpen])

  // Cleanup on unmount
  useEffect(() => {
    return () => { abortRef.current?.abort(); setVoiceState('idle') }
  }, [])

  // Keyboard: Esc to close
  useEffect(() => {
    if (!isOpen) return
    const handler = (e) => {
      if (e.key === 'Escape') { e.preventDefault(); onClose() }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [isOpen, onClose])

  // --- Voice input (Web Speech API), ported from Logos AI ---
  const recognitionRef = useRef(null)

  const handleVoiceInput = useCallback(() => {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition
    if (!SpeechRecognition) {
      setError('Voice input is not supported in this browser. Try Chrome or Edge.')
      return
    }

    // Clearing the ref is the "user is done" signal: onend restarts only the current recognizer.
    if (isListening) {
      const current = recognitionRef.current
      recognitionRef.current = null
      current?.stop()
      setIsListening(false)
      return
    }

    const recognition = new SpeechRecognition()
    recognition.continuous = true
    recognition.interimResults = false
    recognition.lang = 'en-US'

    // Some Chrome builds fire onresult again for every growing phrase, so keep the draft from
    // before dictation and REPLACE the dictated part each time (results are kept by index).
    let draft = null
    let phrases = []
    recognition.onresult = (event) => {
      for (let i = event.resultIndex ?? 0; i < event.results.length; i++) {
        phrases[i] = event.results[i][0].transcript.trim()
      }
      const transcript = phrases.filter(Boolean).join(' ')
      setInputValue(prev => {
        if (draft === null) draft = prev
        return draft ? `${draft} ${transcript}` : transcript
      })
    }

    recognition.onerror = (event) => {
      // A pause raises 'no-speech'; only a lost or refused microphone ends dictation.
      const message = MIC_ERRORS[event?.error]
      if (message) {
        if (recognitionRef.current === recognition) recognitionRef.current = null
        setIsListening(false)
        setError(message)
      }
    }

    // Chrome ends even a continuous session after a few seconds of silence. Keep listening
    // until the user presses stop: start a new session on top of what is already typed.
    recognition.onend = () => {
      if (recognitionRef.current === recognition) {
        draft = null
        phrases = []
        try {
          recognition.start()
          return
        } catch { /* fall through: the recognizer refused to restart */ }
        recognitionRef.current = null
      }
      setIsListening(false)
    }

    recognitionRef.current = recognition
    recognition.start()
    setIsListening(true)
    // A fresh try clears an older microphone message; other errors stay.
    setError(prev => (prev && Object.values(MIC_ERRORS).includes(prev) ? null : prev))
  }, [isListening])

  // Closing the panel ends dictation (the panel stays mounted after its first open).
  // abort(), not stop(): nothing said after closing is transcribed.
  useEffect(() => {
    if (!isOpen) return
    return () => {
      const current = recognitionRef.current
      recognitionRef.current = null
      current?.abort()
      setIsListening(false)
    }
  }, [isOpen])

  // Sending ends dictation too, so speech after the send cannot re-type the sent draft.
  useEffect(() => {
    if (!isQuerying || !recognitionRef.current) return
    const current = recognitionRef.current
    recognitionRef.current = null
    current.abort()
    setIsListening(false)
  }, [isQuerying])

  // The Web Speech API never exposes audio, so a parallel capture feeds the mic level to voiceSignal.
  useMicLevel(isListening)

  // The launcher's mic asks the panel to listen as soon as it opens.
  useEffect(() => onVoiceRequest(handleVoiceInput), [handleVoiceInput])

  // The orb and the launcher's dot field read voiceSignal: listening wins, then thinking until
  // text arrives, then speaking.
  const voiceState = isListening ? 'listening' : !isQuerying ? 'idle' : streamingContent ? 'speaking' : 'thinking'
  useEffect(() => { setVoiceState(voiceState) }, [voiceState])

  const handleSend = useCallback(async (text) => {
    const query = (text || inputValue).trim()
    if (!query || isQuerying) return

    setError(null)
    setInputValue('')

    // Add user message. The page it was asked on travels with it (see isStale).
    const userMsg = { role: 'user', content: query, ts: Date.now(), section }
    setMessages(prev => [...prev, userMsg])
    // A new conversation replaces the one set aside.
    setParked([])

    // Abort previous
    abortRef.current?.abort()
    const controller = new AbortController()
    abortRef.current = controller

    setIsQuerying(true)
    setStreamingContent('')

    let streamedCitations = []
    let streamedFollowUp = []

    try {
      await streamQuery(
        query,
        {
          ...context,
          userName: user?.name || user?.email || 'User',
          conversationId,
        },
        {
          signal: controller.signal,
          onChunk: (chunk) => { pulseVoice(); setStreamingContent(prev => prev + chunk) },
          onCitations: (citations) => { streamedCitations = citations },
          onFollowUp: (suggestions) => { streamedFollowUp = suggestions },
          onComplete: (result) => {
            if (result.conversationId) setConversationId(result.conversationId)
            setMessages(prev => [...prev, {
              role: 'assistant',
              content: result.answer,
              citations: streamedCitations,
              followUp: streamedFollowUp,
              confidence: result.confidence,
              ts: Date.now(),
              section,
            }])
            setStreamingContent('')
            setIsQuerying(false)
          },
          onError: (err) => {
            setError(err?.message || 'Failed to get a response. Please try again.')
            setIsQuerying(false)
            setStreamingContent('')
          },
        }
      )
    } catch (err) {
      if (err.name === 'AbortError') return
      setError('Failed to connect. Is the backend running?')
      setIsQuerying(false)
      setStreamingContent('')
    }
  }, [inputValue, isQuerying, context, section, user, conversationId])

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  const handleNewChat = () => {
    abortRef.current?.abort()
    setMessages([])
    setConversationId(null)
    setStreamingContent('')
    setIsQuerying(false)
    setError(null)
    setParked([])
  }

  const handleResume = () => {
    setMessages(parked)
    setParked([])
  }

  // Until this page's data arrives the questions are not shown, so they never flip from
  // the regular set to the "nothing here yet" set in front of you.
  const starter = getStarter(section, contextReady ? context.data : undefined)
  const hasMessages = messages.length > 0
  const lastIdx = messages.length - 1

  const orbState = useSettledOrbState(orbStateFor({
    isListening,
    isLoading: isQuerying,
    isTyping: Boolean(inputValue.trim()),
    error,
    streamingText: streamingContent,
    toolSteps: [],
    thoughts: [],
    awaitingApproval: false,
    hasAnswered: messages[messages.length - 1]?.role === 'assistant',
  }))

  // Stays mounted through its exit so the panel slides away instead of vanishing.
  const { mounted, state: presence } = usePresence(isOpen, MOTION.base)
  if (!mounted) return null

  const panel = (
    <div className="logos-assistant la-swiss" role="dialog" aria-modal="true" aria-label="Entomate AI Assistant">
      <div className="la-backdrop" data-state={presence} onClick={onClose} />
      <div
        ref={panelRef}
        className="la-panel"
        data-state={presence}
        style={appliedWidth ? { width: `${appliedWidth}px` } : undefined}
      >

        {/* Header */}
        <div className="la-header">
          <div className="la-header-left">
            <div className="la-header-title">
              <h2>Entomate AI</h2>
              <span className="la-header-mode" data-voice={voiceState}>
                {contextLoading ? 'Loading context' : AI_ORB_LABELS[orbState]}
              </span>
            </div>
          </div>
          <div className="la-header-right">
            {hasMessages && (
              <button type="button" className="la-header-action-btn la-header-history-btn" onClick={handleNewChat} title="New chat">
                <span className="la-header-action-label">New chat</span>
              </button>
            )}
            <button type="button" className="la-close-btn" onClick={onClose} title="Close (Esc)" aria-label="Close assistant">
              <X size={18} />
            </button>
          </div>
        </div>

        <ContextCard variant="bar" sectionLabel={sectionLabel} sectionSummary={sectionSummary} context={context.data || {}} />

        {/* Messages area */}
        <div className="la-messages" role="log" aria-live="polite" aria-busy={isQuerying || undefined}>

          {/* Error banner — always visible at top, dismissible */}
          {error && (
            <div className="la-error">
              <AlertCircle size={16} />
              <span>{error}</span>
              <button type="button" className="la-retry-btn" onClick={() => setError(null)} title="Dismiss">
                <X size={13} />
                Dismiss
              </button>
            </div>
          )}

          {!hasMessages && !isQuerying ? (
            /* Starting state: one line, three questions, the composer. */
            <div className="la-welcome la-welcome-brief">
              <div className="la-welcome-icon la-welcome-hero">
                <WelcomeOrb state={orbState} />
              </div>
              <div className="la-welcome-head">
                <h3 className="la-welcome-title">{starter.title}</h3>
              </div>
              <div className="la-quick-actions" aria-busy={!contextReady || undefined}>
                <span className="la-quick-actions-label">Try asking</span>
                <div className="la-quick-actions-list">
                  {contextReady && starter.prompts.map((action) => (
                    <button
                      key={action.label}
                      type="button"
                      className="la-quick-action-btn"
                      onClick={() => handleSend(action.query)}
                    >
                      {action.label}
                    </button>
                  ))}
                </div>
              </div>
              {parked.length > 0 && (
                <button type="button" className="la-welcome-help" onClick={handleResume}>
                  Back to your last chat
                </button>
              )}
            </div>
          ) : (
            <>
              {messages.map((msg, idx) => (
                <article key={idx} className={`la-message la-message-${msg.role}`} aria-label={msg.role === 'user' ? 'Request' : 'Entomate AI answer'}>
                  <div className="la-message-avatar">
                    {msg.role === 'user' ? <UserIcon size={16} /> : <EntoOrbGlyph size={20} />}
                  </div>
                  <div className="la-message-content">
                    <div className="la-message-kicker" aria-hidden="true">
                      <span>{msg.role === 'user' ? 'Request' : 'Entomate AI'}</span>
                    </div>
                    {msg.role === 'assistant' ? (
                      <div className="la-markdown">
                        <ReactMarkdown>{msg.content}</ReactMarkdown>
                      </div>
                    ) : (
                      <p style={{ margin: 0, whiteSpace: 'pre-wrap' }}>{msg.content}</p>
                    )}

                    {/* Follow-up suggestions */}
                    {idx === lastIdx && !isQuerying && msg.followUp?.length > 0 && (
                      <div className="la-suggested-list">
                        {msg.followUp.map((q, qi) => (
                          <button key={qi} type="button" className="la-suggested-btn" onClick={() => handleSend(q)}>
                            {q}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                </article>
              ))}

              {/* Streaming / thinking */}
              {isQuerying && (
                <div className="la-message la-message-assistant la-message-loading">
                  <div className="la-message-avatar">
                    <EntoOrb size={20} />
                  </div>
                  <div className="la-message-content">
                    <div className="la-message-kicker" aria-hidden="true">
                      <span>Entomate AI</span>
                    </div>
                    <div className={`la-markdown${streamingContent ? ' la-streaming' : ''}`}>
                      {streamingContent ? <ReactMarkdown>{streamingContent}</ReactMarkdown> : <p>Thinking…</p>}
                    </div>
                  </div>
                </div>
              )}

              <div ref={messagesEndRef} />
            </>
          )}
        </div>

        {/* Input area */}
        <Composer
          inputRef={inputRef}
          value={inputValue}
          onChange={setInputValue}
          onKeyDown={handleKeyDown}
          placeholder="Ask anything about your data..."
          disabled={isQuerying}
          isListening={isListening}
          onVoiceInput={handleVoiceInput}
          onSend={() => handleSend()}
          orbState={orbState}
        />

        {canResize && (
          <div
            className="la-resize-handle"
            role="separator"
            aria-orientation="vertical"
            aria-label="Resize assistant panel"
            aria-valuenow={appliedWidth ?? panelRef.current?.offsetWidth ?? resizeMin}
            aria-valuemin={resizeMin}
            aria-valuemax={resizeMax}
            tabIndex={0}
            onPointerDown={onResizePointerDown}
            onKeyDown={onResizeKeyDown}
            onDoubleClick={onResizeDoubleClick}
            title="Drag to resize · double-click to reset"
          />
        )}
      </div>
    </div>
  )

  return createPortal(panel, document.body)
}
