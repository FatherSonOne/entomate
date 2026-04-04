/**
 * EntoAssistant — Context-aware AI assistant panel for Entomate
 * Portal-rendered right-side drawer with streaming chat
 */
import React, { useState, useEffect, useRef, useCallback } from 'react'
import { createPortal } from 'react-dom'
import { useNavigate } from 'react-router-dom'
import { X, Send, Loader2, AlertCircle, ArrowRight, RefreshCw, MessageSquarePlus } from 'lucide-react'
import ReactMarkdown from 'react-markdown'
import { useAuth } from '../../contexts/AuthContext'
import useAssistantContext from './useAssistantContext'
import {
  getQuickActions,
  getSuggestedActions,
  streamQuery,
} from '../../services/entoAssistantService'
import './EntoAssistant.css'

// ── Circuit E Logo Mark (inline SVG) ──
function EntoLogo({ size = 20 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
      <rect x="22" y="14" width="26" height="6" rx="1.5" fill="#FF2D6B" />
      <rect x="22" y="29" width="20" height="6" rx="1.5" fill="#FF2D6B" opacity="0.85" />
      <rect x="22" y="44" width="26" height="6" rx="1.5" fill="#FF2D6B" />
      <path d="M22 17 L14 17 L10 13" stroke="#FF2D6B" strokeWidth="1.5" strokeLinecap="round" fill="none" />
      <circle cx="10" cy="13" r="2" fill="#FF2D6B" opacity="0.9" />
      <path d="M22 32 L12 32 L8 28" stroke="#FF2D6B" strokeWidth="1.5" strokeLinecap="round" fill="none" />
      <circle cx="8" cy="28" r="2" fill="#FF2D6B" opacity="0.9" />
      <path d="M22 47 L14 47 L10 51" stroke="#FF2D6B" strokeWidth="1.5" strokeLinecap="round" fill="none" />
      <circle cx="10" cy="51" r="2" fill="#FF2D6B" opacity="0.9" />
      <path d="M22 14 L18 10" stroke="#FF2D6B" strokeWidth="1.2" strokeLinecap="round" fill="none" opacity="0.6" />
      <circle cx="18" cy="10" r="1.5" fill="#FF2D6B" opacity="0.6" />
    </svg>
  )
}

const STORAGE_KEY = 'ento-ai-history'
const MAX_MESSAGES = 50

function loadHistory() {
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY)
    return raw ? JSON.parse(raw) : []
  } catch { return [] }
}

function saveHistory(messages) {
  try {
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(messages.slice(-MAX_MESSAGES)))
  } catch { /* quota */ }
}

export default function EntoAssistant({ isOpen, onClose }) {
  const { user } = useAuth()
  const navigate = useNavigate()
  const { context, sectionSummary, sectionLabel, isLoading: contextLoading } = useAssistantContext(isOpen)

  const [messages, setMessages] = useState(() => loadHistory())
  const [inputValue, setInputValue] = useState('')
  const [isQuerying, setIsQuerying] = useState(false)
  const [streamingContent, setStreamingContent] = useState('')
  const [error, setError] = useState(null)
  const [conversationId, setConversationId] = useState(null)

  const messagesEndRef = useRef(null)
  const inputRef = useRef(null)
  const abortRef = useRef(null)

  // Persist messages
  useEffect(() => { saveHistory(messages) }, [messages])

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
    return () => { abortRef.current?.abort() }
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

  const handleSend = useCallback(async (text) => {
    const query = (text || inputValue).trim()
    if (!query || isQuerying) return

    setError(null)
    setInputValue('')

    // Add user message
    const userMsg = { role: 'user', content: query, ts: Date.now() }
    setMessages(prev => [...prev, userMsg])

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
          onChunk: (chunk) => setStreamingContent(prev => prev + chunk),
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
  }, [inputValue, isQuerying, context, user, conversationId])

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
    sessionStorage.removeItem(STORAGE_KEY)
  }

  const handleNavigate = (to) => {
    navigate(to)
  }

  const quickActions = getQuickActions(context.section)
  const suggestedActions = getSuggestedActions(context.section)
  const hasMessages = messages.length > 0

  if (!isOpen) return null

  const panel = (
    <>
      <div className="ea-backdrop" onClick={onClose} />
      <div className="ea-panel" role="dialog" aria-modal="true" aria-label="Entomate AI Assistant">

        {/* Header */}
        <div className="ea-header">
          <div className="ea-header-left">
            <div className="ea-header-icon">
              <EntoLogo size={20} />
            </div>
            <div>
              <div className="ea-header-title">Entomate AI</div>
              <div className="ea-header-subtitle">Ask me anything about your data</div>
            </div>
          </div>
          <div className="ea-header-actions">
            {hasMessages && (
              <button className="ea-new-chat-btn" onClick={handleNewChat} title="New chat">
                <MessageSquarePlus className="w-3.5 h-3.5" />
                <span>New Chat</span>
              </button>
            )}
            <button className="ea-header-btn" onClick={onClose} title="Close (Esc)">
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Context chip bar */}
        <div className="ea-context-bar">
          <span className="ea-context-chip">
            <span style={{ width: 5, height: 5, borderRadius: '50%', background: 'currentColor', opacity: 0.6 }} />
            {sectionLabel}
          </span>
          {sectionSummary && <span className="ea-context-summary">{sectionSummary}</span>}
          {contextLoading && <Loader2 className="w-3 h-3 animate-spin" style={{ color: 'var(--text-muted)' }} />}
        </div>

        {/* Messages area */}
        <div className="ea-messages" role="log" aria-live="polite">

          {/* Error banner — always visible at top, dismissible */}
          {error && (
            <div className="ea-error">
              <AlertCircle className="w-4 h-4" style={{ flexShrink: 0 }} />
              <span style={{ flex: 1 }}>{error}</span>
              <button
                onClick={() => setError(null)}
                style={{ background: 'none', border: 'none', color: 'inherit', cursor: 'pointer', padding: 2 }}
                title="Dismiss"
              >
                <X className="w-3 h-3" />
              </button>
            </div>
          )}

          {!hasMessages && !isQuerying ? (
            /* Welcome state */
            <div className="ea-welcome">
              <div className="ea-welcome-icon">
                <EntoLogo size={24} />
              </div>
              <div className="ea-welcome-title">Hi, I'm Entomate AI</div>
              <div className="ea-welcome-desc">
                I'm context-aware and know which section you're in.
                Ask me anything — or use a quick action below.
              </div>
              <div className="ea-quick-actions">
                {quickActions.map((action, i) => (
                  <button
                    key={i}
                    className="ea-quick-btn"
                    onClick={() => handleSend(action.query)}
                  >
                    {action.label}
                  </button>
                ))}
              </div>
            </div>
          ) : (
            <>
              {messages.map((msg, idx) => (
                <div key={idx} className={`ea-msg ea-msg--${msg.role}`}>
                  <div className="ea-msg-bubble">
                    {msg.role === 'assistant' ? (
                      <ReactMarkdown>{msg.content}</ReactMarkdown>
                    ) : (
                      <p style={{ margin: 0, whiteSpace: 'pre-wrap' }}>{msg.content}</p>
                    )}

                    {/* Follow-up suggestions */}
                    {msg.followUp?.length > 0 && (
                      <div style={{ marginTop: 8, display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                        {msg.followUp.map((q, qi) => (
                          <button
                            key={qi}
                            className="ea-quick-btn"
                            style={{ fontSize: 11, padding: '3px 10px' }}
                            onClick={() => handleSend(q)}
                          >
                            {q}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              ))}

              {/* Streaming content */}
              {isQuerying && streamingContent && (
                <div className="ea-msg ea-msg--assistant">
                  <div className="ea-msg-bubble">
                    <ReactMarkdown>{streamingContent}</ReactMarkdown>
                    <span className="ea-cursor" />
                  </div>
                </div>
              )}

              {/* Loading spinner */}
              {isQuerying && !streamingContent && (
                <div className="ea-loading">
                  <div className="ea-loading-spinner" />
                  <span className="ea-loading-text">Thinking...</span>
                </div>
              )}

              {/* Suggested navigation — show after last assistant message */}
              {!isQuerying && hasMessages && messages[messages.length - 1]?.role === 'assistant' && (
                <div className="ea-suggested">
                  {suggestedActions.map((action, i) => (
                    <button
                      key={i}
                      className="ea-suggested-btn"
                      onClick={() => handleNavigate(action.to)}
                    >
                      {action.label}
                      <ArrowRight className="w-3 h-3" style={{ marginLeft: 3, opacity: 0.6 }} />
                    </button>
                  ))}
                </div>
              )}

              {/* Quick actions — always available at bottom of conversation */}
              {!isQuerying && hasMessages && (
                <div className="ea-quick-actions-inline">
                  <span className="ea-quick-actions-label">Quick actions</span>
                  <div className="ea-quick-actions">
                    {quickActions.map((action, i) => (
                      <button
                        key={i}
                        className="ea-quick-btn"
                        onClick={() => handleSend(action.query)}
                      >
                        {action.label}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              <div ref={messagesEndRef} />
            </>
          )}
        </div>

        {/* Input area */}
        <div className="ea-input-area">
          <div className="ea-input-row">
            <input
              ref={inputRef}
              className="ea-input"
              placeholder="Ask anything about your data..."
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              onKeyDown={handleKeyDown}
              disabled={isQuerying}
              aria-label="Message Entomate AI"
            />
            <button
              className="ea-send-btn"
              onClick={() => handleSend()}
              disabled={isQuerying || !inputValue.trim()}
              aria-label="Send message"
            >
              {isQuerying ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
            </button>
          </div>
          <div className="ea-input-hint">Enter to send · Esc to close</div>
        </div>
      </div>
    </>
  )

  return createPortal(panel, document.body)
}
