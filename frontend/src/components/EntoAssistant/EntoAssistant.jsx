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
import { AgentPipeline, ToolsUsed, applyToolEvent } from './AgentPipeline'
import ProposalCard from './ProposalCard'
import PlanCard, { groupProposals } from './PlanCard'
import ThreadRail from './ThreadRail'
import { welcomeGreeting } from './welcomeGreeting'
import { useProposals } from './useProposals'
import { useNavigate } from 'react-router-dom'
import { entoAiApi } from '../../services/api'
import './EntoAI.css'
import './EntoAI.tokens.css'

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

/** True when a saved conversation does not belong on the page the panel is opening over. */
function isStale(messages, section) {
  if (!messages.length) return false
  const last = messages[messages.length - 1]
  // Messages saved before conversations carried their page have no section: treat as stale.
  if (!messages[0].section || messages[0].section !== section) return true
  return !last.ts || Date.now() - last.ts > STALE_AFTER_MS
}

/**
 * EAI-05: a saved thread holds each proposal as it was proposed. Its real status (confirmed,
 * undone, ...) lives in ento_ai_action_log, so read it back before the cards show. A failed
 * read keeps the saved copies: the card's buttons then report the server's answer.
 */
async function withFreshProposals(messages) {
  const ids = messages.flatMap((m) => (Array.isArray(m.proposals) ? m.proposals.map((p) => p.id) : []))
  if (!ids.length) return messages
  try {
    const { proposals } = await entoAiApi.actions.list(ids)
    const byId = new Map((proposals || []).map((p) => [p.id, p]))
    return messages.map((m) => (Array.isArray(m.proposals)
      ? { ...m, proposals: m.proposals.map((p) => byId.get(p.id) || p) }
      : m))
  } catch (err) {
    console.warn('[EntoAI] Could not refresh proposals:', err?.message)
    return messages
  }
}

export default function EntoAssistant({ isOpen, onClose, signals = [], signalTotal = 0 }) {
  const { user } = useAuth()
  const { context, section, sectionSummary, sectionLabel, isLoading: contextLoading, isReady: contextReady } = useAssistantContext(isOpen)

  // EAI-03: the thread lives in ento_ai_threads (the backend appends each exchange), so it
  // is read once on the first open and survives a reload and a second device.
  const [messages, setMessages] = useState([])
  const [threadId, setThreadId] = useState(null)
  const [threadLoaded, setThreadLoaded] = useState(false)
  // A thread set aside on open (see STALE_AFTER_MS), offered back from the starting state.
  const [parked, setParked] = useState(null)
  const [inputValue, setInputValue] = useState('')
  const [isQuerying, setIsQuerying] = useState(false)
  const [streamingContent, setStreamingContent] = useState('')
  // EAI-04: live tool steps from /api/ento-ai/query, and whether the answer is being written.
  const [toolSteps, setToolSteps] = useState([])
  const [answering, setAnswering] = useState(false)
  const [error, setError] = useState(null)
  // Used only by the /api/assistant/query fallback, which keeps its own conversations table.
  const [conversationId, setConversationId] = useState(null)
  const [isListening, setIsListening] = useState(false)
  // EAI-02b: the History rail. The list is read each time the rail opens, so it is never stale.
  const [railOpen, setRailOpen] = useState(false)
  const [threads, setThreads] = useState([])
  const [threadsLoading, setThreadsLoading] = useState(false)
  const [railError, setRailError] = useState(null)

  // EAI-05: confirm / dismiss / edit / undo for the cards under an answer. The proposals
  // stay on their message; this patches one in place with the state the server reports.
  const navigate = useNavigate()
  const replaceProposal = useCallback((messageIdx, proposal) => {
    setMessages(prev => prev.map((m, i) => (i === messageIdx && Array.isArray(m.proposals)
      ? { ...m, proposals: m.proposals.map(p => (p.id === proposal.id ? proposal : p)) }
      : m)))
  }, [])
  const proposalUi = useProposals({ replaceProposal, navigate, onClose })

  const messagesEndRef = useRef(null)
  const inputRef = useRef(null)
  const abortRef = useRef(null)
  const panelRef = useRef(null)

  const canResize = useMediaQuery(RESIZE_QUERY)
  const {
    appliedWidth, minWidth: resizeMin, maxWidth: resizeMax,
    onPointerDown: onResizePointerDown, onKeyDown: onResizeKeyDown, onDoubleClick: onResizeDoubleClick,
  } = usePanelResize(panelRef, canResize)

  // Opening the panel over another page, or long after the last answer, starts clean.
  // Read through refs so this runs on open only, not on every message.
  const messagesRef = useRef(messages)
  messagesRef.current = messages
  const threadIdRef = useRef(threadId)
  threadIdRef.current = threadId
  useEffect(() => {
    if (!isOpen) return
    if (!threadLoaded) {
      // First open: the newest saved thread, set aside by the same rule if it is stale.
      let cancelled = false
      entoAiApi.latestThread()
        .then(async (thread) => {
          const saved = await withFreshProposals(Array.isArray(thread?.messages) ? thread.messages : [])
          return { thread, saved }
        })
        .then(({ thread, saved }) => {
          if (cancelled) return
          setThreadLoaded(true)
          // A question asked while the read was in flight starts its own thread.
          if (!thread || messagesRef.current.length) return
          if (!saved.length) return
          if (isStale(saved, section)) {
            setParked({ id: thread.id, messages: saved })
          } else {
            setMessages(saved)
            setThreadId(thread.id)
          }
        })
        .catch((err) => {
          if (cancelled) return
          // A failed read is not "no thread": nothing is overwritten, and the next question
          // starts a new thread. Say so in the console only; the panel still works.
          console.warn('[EntoAI] Could not load the last conversation:', err?.message)
          setThreadLoaded(true)
        })
      return () => { cancelled = true }
    }
    const current = messagesRef.current
    if (!isStale(current, section)) return
    abortRef.current?.abort()
    setIsQuerying(false)
    setStreamingContent('')
    setToolSteps([])
    setParked({ id: threadIdRef.current, messages: current })
    setMessages([])
    setThreadId(null)
    setConversationId(null)
  }, [isOpen]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!isOpen) { setRailOpen(false); return }
    if (!railOpen) return
    let cancelled = false
    setThreadsLoading(true)
    setRailError(null)
    entoAiApi.threads.list()
      .then((body) => { if (!cancelled) setThreads(Array.isArray(body?.threads) ? body.threads : []) })
      .catch(() => {
        if (cancelled) return
        // Never the list from the last open: it may hold a conversation deleted since.
        setThreads([])
        setRailError('Your conversations could not be loaded. Close this list and open it again to retry.')
      })
      .finally(() => { if (!cancelled) setThreadsLoading(false) })
    return () => { cancelled = true }
  }, [isOpen, railOpen])

  // Auto-scroll
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, streamingContent])

  // Auto-focus input when panel opens
  useEffect(() => {
    if (isOpen) setTimeout(() => inputRef.current?.focus(), 100)
  }, [isOpen])

  // EAI-02c: the panel stays mounted, so the greeting's hour and line are drawn each time it
  // opens: it changes between visits, never while it is being read.
  const [greetingDraw, setGreetingDraw] = useState(() => ({ now: new Date(), pick: Math.floor(Math.random() * 1000) }))
  useEffect(() => {
    if (isOpen) setGreetingDraw({ now: new Date(), pick: Math.floor(Math.random() * 1000) })
  }, [isOpen])
  const greeting = welcomeGreeting({ ...greetingDraw, name: user?.name })

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
    setParked(null)

    // Abort previous
    abortRef.current?.abort()
    const controller = new AbortController()
    abortRef.current = controller

    setIsQuerying(true)
    setStreamingContent('')
    setToolSteps([])
    setAnswering(false)

    let streamedCitations = []
    let streamedFollowUp = []
    const streamedProposals = []

    try {
      await streamQuery(
        query,
        {
          ...context,
          userName: user?.name || user?.email || 'User',
          threadId,
          conversationId,
        },
        {
          signal: controller.signal,
          onToolEvent: (event) => setToolSteps(prev => applyToolEvent(prev, event)),
          onProposal: (proposal) => { if (proposal?.id) streamedProposals.push(proposal) },
          onAnswering: () => setAnswering(true),
          // The text so far was a preamble to a tool call: the tool steps replace it.
          onChunkReset: () => { setStreamingContent(''); setAnswering(false) },
          onChunk: (chunk) => { pulseVoice(); setStreamingContent(prev => prev + chunk) },
          onCitations: (citations) => { streamedCitations = citations },
          onFollowUp: (suggestions) => { streamedFollowUp = suggestions },
          onComplete: (result) => {
            if (result.threadId) setThreadId(result.threadId)
            if (result.conversationId) setConversationId(result.conversationId)
            setMessages(prev => [...prev, {
              role: 'assistant',
              content: result.answer,
              citations: streamedCitations,
              followUp: streamedFollowUp,
              tools: Array.isArray(result.tools) ? result.tools : [],
              // EAI-05: the writes this answer proposed. Nothing changed until a card is confirmed.
              proposals: Array.isArray(result.proposals) ? result.proposals : streamedProposals,
              confidence: result.confidence,
              ts: Date.now(),
              section,
            }])
            setStreamingContent('')
            setToolSteps([])
            setIsQuerying(false)
          },
          onError: (err) => {
            setError(err?.message || 'Failed to get a response. Please try again.')
            setIsQuerying(false)
            setStreamingContent('')
            setToolSteps([])
          },
        }
      )
    } catch (err) {
      if (err.name === 'AbortError') return
      setError('Failed to connect. Is the backend running?')
      setIsQuerying(false)
      setStreamingContent('')
      setToolSteps([])
    }
  }, [inputValue, isQuerying, context, section, user, threadId, conversationId])

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  const handleNewChat = () => {
    abortRef.current?.abort()
    setMessages([])
    setThreadId(null)
    setConversationId(null)
    setStreamingContent('')
    setToolSteps([])
    setIsQuerying(false)
    setError(null)
    setParked(null)
  }

  const handleResume = () => {
    if (!parked) return
    setMessages(parked.messages)
    setThreadId(parked.id)
    setParked(null)
  }

  // EAI-02b History rail (ported from Logos AI). Every rail action lands you in another
  // conversation, so it closes the rail; a delete keeps it open, since you may prune several.
  const handleNewThread = () => {
    setRailOpen(false)
    handleNewChat()
  }

  const handleSelectThread = async (id) => {
    setRailError(null)
    if (id === threadIdRef.current) { setRailOpen(false); return }
    try {
      const body = await entoAiApi.threads.get(id)
      const saved = await withFreshProposals(Array.isArray(body?.thread?.messages) ? body.thread.messages : [])
      setRailOpen(false)
      handleNewChat()
      setMessages(saved)
      setThreadId(id)
    } catch (err) {
      setRailError(err?.status === 404
        ? 'That conversation is gone. It may have been deleted on another device.'
        : 'That conversation could not be opened. Try again.')
    }
  }

  const handleDeleteThread = async (id) => {
    setRailError(null)
    try {
      await entoAiApi.threads.remove(id)
    } catch (err) {
      // 404: already gone (another device), so the row goes either way.
      if (err?.status !== 404) {
        setRailError('That conversation could not be deleted. Try again.')
        return
      }
    }
    setThreads(prev => prev.filter(t => t.id !== id))
    if (parked?.id === id) setParked(null)
    if (id === threadIdRef.current) handleNewChat()
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
    toolSteps,
    thoughts: [],
    awaitingApproval: false,
    hasAnswered: messages[messages.length - 1]?.role === 'assistant',
  }))

  // Stays mounted through its exit so the panel slides away instead of vanishing.
  const { mounted, state: presence } = usePresence(isOpen, MOTION.base)
  if (!mounted) return null

  const panel = (
    <div className="logos-assistant la-swiss" role="dialog" aria-modal="true" aria-label="Ask Entomate">
      <div className="la-backdrop" data-state={presence} onClick={onClose} />
      <div
        ref={panelRef}
        className="la-panel"
        data-state={presence}
        style={appliedWidth ? { width: `${appliedWidth}px` } : undefined}
      >

        <ThreadRail
          open={railOpen}
          threads={threads}
          activeThreadId={threadId}
          loading={threadsLoading}
          error={railError}
          onClose={() => setRailOpen(false)}
          onSelect={handleSelectThread}
          onDelete={handleDeleteThread}
          onNew={handleNewThread}
        />

        {/* Header */}
        <div className="la-header">
          <div className="la-header-left">
            <div className="la-header-title">
              <h2>Ask Entomate</h2>
              <span className="la-header-mode" data-voice={voiceState}>
                {contextLoading ? 'Loading context' : AI_ORB_LABELS[orbState]}
              </span>
            </div>
          </div>
          <div className="la-header-right">
            {/* Outside the hasMessages gate (as in LV): after "New chat" the panel is empty but
                the history is not, and the rail is the only way back to it. */}
            <button
              type="button"
              className="la-header-action-btn la-header-history-btn"
              onClick={() => setRailOpen(open => !open)}
              title="Conversation history"
              aria-label="Conversation history"
              aria-expanded={railOpen}
            >
              <span className="la-header-action-label">History</span>
            </button>
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

          {!hasMessages && !isQuerying && !threadLoaded ? null : !hasMessages && !isQuerying ? (
            /* Starting state: one line, three questions, the composer. */
            <div className="la-welcome la-welcome-brief">
              <div className="la-welcome-icon la-welcome-hero">
                <WelcomeOrb state={orbState} />
              </div>
              <div className="la-welcome-head">
                {/* EAI-02c: LV's greeting over the page's own line, stacked as in LV. */}
                <div className="la-welcome-headings">
                  <h3 className="la-welcome-title">{greeting}</h3>
                  <p className="la-welcome-tagline">{starter.title}.</p>
                </div>
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
              {/* EAI-06: server signals (an overdue task, a meeting about to start). Each one asks
                  about it, so the answer can propose the fix on the confirm → undo spine. */}
              {signals.length > 0 && (
                <div className="la-quick-actions" data-testid="ento-signals">
                  <span className="la-quick-actions-label">
                    Needs attention<span className="la-quick-actions-count la-quick-actions-count-due">{Math.max(signalTotal, signals.length)}</span>
                  </span>
                  <div className="la-quick-actions-list">
                    {signals.map((sig) => (
                      <button
                        key={sig.id}
                        type="button"
                        className="la-quick-action-btn la-quick-action-proactive"
                        onClick={() => handleSend(sig.query)}
                      >
                        {sig.label}
                      </button>
                    ))}
                  </div>
                </div>
              )}
              {parked?.messages.length > 0 && (
                <button type="button" className="la-welcome-help" onClick={handleResume}>
                  Back to your last chat
                </button>
              )}
            </div>
          ) : (
            <>
              {messages.map((msg, idx) => (
                <article key={idx} className={`la-message la-message-${msg.role}`} aria-label={msg.role === 'user' ? 'Request' : 'Ask Entomate answer'}>
                  <div className="la-message-avatar">
                    {msg.role === 'user' ? <UserIcon size={16} /> : <EntoOrbGlyph size={20} />}
                  </div>
                  <div className="la-message-content">
                    <div className="la-message-kicker" aria-hidden="true">
                      <span>{msg.role === 'user' ? 'Request' : 'Ask Entomate'}</span>
                    </div>
                    {msg.role === 'assistant' ? (
                      <>
                        <div className="la-markdown">
                          <ReactMarkdown>{msg.content}</ReactMarkdown>
                        </div>
                        {msg.tools?.length > 0 && <ToolsUsed calls={msg.tools} />}
                        {msg.proposals?.length > 0 && (
                          <div className="la-proposals">
                            {groupProposals(msg.proposals).map((g) => (g.kind === 'plan' ? (
                              <PlanCard
                                key={g.planId}
                                steps={g.steps}
                                isWorking={proposalUi.resolvingPlanId === g.planId}
                                error={proposalUi.planErrors[g.planId] || null}
                                onConfirm={() => proposalUi.handleConfirmPlan(idx, g.planId)}
                                onDismiss={() => proposalUi.handleRejectPlan(idx, g.planId)}
                                onUndo={() => proposalUi.handleUndoPlan(idx, g.planId)}
                                onViewStep={proposalUi.handleView}
                              />
                            ) : (
                              <ProposalCard
                                key={g.proposal.id}
                                proposal={g.proposal}
                                isResolving={proposalUi.resolvingId === g.proposal.id}
                                isEditing={proposalUi.editingId === g.proposal.id}
                                editDraft={proposalUi.editDraft}
                                editError={proposalUi.editingId === g.proposal.id ? proposalUi.editError : null}
                                onStartEdit={() => proposalUi.handleStartEdit(g.proposal)}
                                onEditField={proposalUi.handleEditField}
                                onSaveEdit={() => proposalUi.handleSaveEdit(idx, g.proposal)}
                                onCancelEdit={proposalUi.handleCancelEdit}
                                isConfirming={proposalUi.confirmingId === g.proposal.id}
                                confirmText={proposalUi.confirmText}
                                confirmError={proposalUi.confirmingId === g.proposal.id ? proposalUi.confirmError : null}
                                onConfirmTextChange={proposalUi.handleConfirmTextChange}
                                onCancelConfirm={proposalUi.handleCancelConfirm}
                                actionError={proposalUi.actionErrors[g.proposal.id] || null}
                                onConfirm={() => proposalUi.handleConfirm(idx, g.proposal)}
                                onReject={() => proposalUi.handleReject(idx, g.proposal)}
                                onUndo={() => proposalUi.handleUndo(idx, g.proposal)}
                                onView={() => proposalUi.handleView(g.proposal)}
                              />
                            )))}
                          </div>
                        )}
                      </>
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
                      <span>Ask Entomate</span>
                    </div>
                    {streamingContent ? (
                      <div className="la-markdown la-streaming">
                        <ReactMarkdown>{streamingContent}</ReactMarkdown>
                      </div>
                    ) : (
                      <AgentPipeline steps={toolSteps} answering={answering} />
                    )}
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
