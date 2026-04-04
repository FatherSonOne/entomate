/**
 * AskAIPanel — AI chat interface with streaming and citation rendering
 */
import React, { useState, useEffect, useRef } from 'react'
import { Link } from 'react-router-dom'
import { Sparkles, MessageSquare, RefreshCw, Send, Loader2 } from 'lucide-react'
import { VCButton } from '../vc'
import { searchApi } from '../../services/api'

// Citation source type labels (ported from SearchView.tsx)
const SOURCE_LABELS = {
  meeting: { label: 'Meeting', color: 'rgba(255,184,0,0.15)', textColor: 'var(--accent-tertiary)' },
  task: { label: 'Task', color: 'rgba(0,245,212,0.12)', textColor: 'var(--accent-secondary)' },
  project: { label: 'Project', color: 'rgba(0,245,212,0.12)', textColor: 'var(--accent-secondary)' },
  crm_deal: { label: 'Deal', color: 'rgba(255,184,0,0.15)', textColor: 'var(--accent-tertiary)' },
  crm_contact: { label: 'Contact', color: 'rgba(255,45,107,0.1)', textColor: 'var(--accent-primary)' },
  pulse_message: { label: 'Pulse', color: 'rgba(99,102,241,0.12)', textColor: '#818cf8' },
}

function getSourceUrl(cite) {
  if (cite.url) return cite.url
  if (cite.type === 'meeting' || cite.sourceType === 'meeting') return `/meetings/${cite.id || cite.sourceId}`
  if (cite.type === 'task' || cite.sourceType === 'task') return `/tasks`
  if (cite.type === 'project' || cite.sourceType === 'project') return `/projects/${cite.id || cite.sourceId}`
  return '#'
}

// Render answer text with inline citation badges
function renderAnswerWithCitations(text, citations) {
  if (!text) return null
  if (!citations || citations.length === 0) return <p className="whitespace-pre-wrap">{text}</p>

  const parts = text.split(/(\[[A-Z]+\d+\])/g)
  return (
    <p className="whitespace-pre-wrap">
      {parts.map((part, i) => {
        const match = part.match(/^\[([A-Z]+)(\d+)\]$/)
        if (match) {
          const cite = citations.find(c => c.id === part.slice(1, -1))
          if (cite) {
            const source = SOURCE_LABELS[cite.sourceType] || { color: 'rgba(248,240,242,0.08)', textColor: 'var(--text-secondary)' }
            return (
              <Link
                key={i}
                to={getSourceUrl(cite)}
                className="inline-block px-1.5 py-0.5 rounded text-xs font-bold mx-0.5 hover:opacity-80 transition-opacity"
                style={{ background: source.color, color: source.textColor }}
                title={cite.title}
              >
                {part}
              </Link>
            )
          }
        }
        return <span key={i}>{part}</span>
      })}
    </p>
  )
}

export default function AskAIPanel() {
  const [askQuestion, setAskQuestion] = useState('')
  const [messages, setMessages] = useState([])
  const [askingQuestion, setAskingQuestion] = useState(false)
  const [conversationId, setConversationId] = useState(null)
  const [streamingContent, setStreamingContent] = useState('')
  const abortControllerRef = useRef(null)
  const messagesEndRef = useRef(null)

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, streamingContent])

  // Cleanup abort controller on unmount
  useEffect(() => {
    return () => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort()
      }
    }
  }, [])

  const clearConversation = () => {
    if (abortControllerRef.current) abortControllerRef.current.abort()
    setMessages([])
    setConversationId(null)
    setStreamingContent('')
    setAskingQuestion(false)
  }

  const handleAskQuestion = async (e) => {
    e.preventDefault()
    if (!askQuestion.trim()) return

    // Abort any in-flight stream
    if (abortControllerRef.current) abortControllerRef.current.abort()
    const controller = new AbortController()
    abortControllerRef.current = controller

    const userMessage = { role: 'user', content: askQuestion, timestamp: new Date() }
    setMessages(prev => [...prev, userMessage])
    const currentQuestion = askQuestion
    setAskQuestion('')

    try {
      setAskingQuestion(true)
      setStreamingContent('')
      let streamedCitations = []
      let streamedFollowUp = []

      await searchApi.askStream(
        { question: currentQuestion, conversationId },
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
              timestamp: new Date()
            }])
            setStreamingContent('')
            setAskingQuestion(false)
          },
          onError: () => {
            setMessages(prev => [...prev, {
              role: 'assistant',
              content: 'Sorry, I encountered an error. Please try again.',
              timestamp: new Date()
            }])
            setStreamingContent('')
            setAskingQuestion(false)
          }
        }
      )
    } catch (error) {
      if (error.name === 'AbortError') return
      setMessages(prev => [...prev, {
        role: 'assistant',
        content: 'Sorry, I encountered an error. Please try again.',
        timestamp: new Date()
      }])
      setAskingQuestion(false)
    }
  }

  return (
    <div className="vc">
      {/* Header */}
      <div className="p-4 flex items-center justify-between" style={{ borderBottom: '1px solid rgba(248,240,242,.08)' }}>
        <h3 className="font-semibold flex items-center gap-2" style={{ color: 'var(--text-primary)' }}>
          <Sparkles className="w-5 h-5" style={{ color: 'var(--accent-primary)' }} />
          Ask AI About Your Meetings
        </h3>
        {messages.length > 0 && (
          <button
            onClick={clearConversation}
            className="text-sm flex items-center gap-1 transition-colors"
            style={{ color: 'var(--text-tertiary)' }}
            onMouseEnter={e => { e.currentTarget.style.color = 'var(--text-secondary)' }}
            onMouseLeave={e => { e.currentTarget.style.color = 'var(--text-tertiary)' }}
          >
            <RefreshCw className="w-4 h-4" />
            New Chat
          </button>
        )}
      </div>

      {/* Messages */}
      <div className="max-h-96 overflow-y-auto p-4">
        {messages.length === 0 ? (
          <div className="text-center py-8">
            <MessageSquare className="w-12 h-12 mx-auto mb-3" style={{ color: 'var(--text-tertiary)' }} />
            <p style={{ color: 'var(--text-tertiary)' }}>Ask me anything about your meetings!</p>
            <div className="mt-4 flex flex-wrap justify-center gap-2">
              {[
                "What did we discuss about budget?",
                "Who owns the website project?",
                "What decisions were made recently?"
              ].map((suggestion, idx) => (
                <button
                  key={idx}
                  onClick={() => setAskQuestion(suggestion)}
                  className="text-sm px-3 py-1.5 rounded-full transition-colors"
                  style={{ background: 'rgba(255,45,107,0.08)', color: 'var(--accent-primary)', border: '1px solid rgba(255,45,107,0.2)' }}
                  onMouseEnter={e => { e.currentTarget.style.background = 'rgba(255,45,107,0.14)' }}
                  onMouseLeave={e => { e.currentTarget.style.background = 'rgba(255,45,107,0.08)' }}
                >
                  {suggestion}
                </button>
              ))}
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            {messages.map((msg, idx) => (
              <div key={idx} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                <div
                  className="max-w-[80%] rounded-lg p-3"
                  style={
                    msg.role === 'user'
                      ? { background: 'var(--accent-primary)', color: '#fff' }
                      : { background: 'rgba(248,240,242,0.06)', color: 'var(--text-primary)' }
                  }
                >
                  {msg.role === 'assistant' && msg.citations && msg.citations.length > 0
                    ? renderAnswerWithCitations(msg.content, msg.citations)
                    : <p className="whitespace-pre-wrap">{msg.content}</p>
                  }

                  {msg.confidence !== undefined && (
                    <p className="text-xs mt-2" style={{ color: msg.role === 'user' ? 'rgba(255,255,255,0.6)' : 'var(--text-tertiary)' }}>
                      Confidence: {Math.round(msg.confidence * 100)}%
                    </p>
                  )}

                  {/* Citations sidebar-style listing */}
                  {msg.citations && msg.citations.length > 0 && (
                    <div className="mt-3 pt-2" style={{ borderTop: '1px solid rgba(248,240,242,.1)' }}>
                      <p className="text-xs mb-1" style={{ color: 'var(--text-tertiary)' }}>Sources:</p>
                      <div className="flex flex-wrap gap-1">
                        {msg.citations.map((cite, cidx) => {
                          const source = SOURCE_LABELS[cite.sourceType || cite.type] || { color: 'rgba(255,45,107,0.08)', textColor: 'var(--accent-primary)' }
                          return (
                            <Link
                              key={cidx}
                              to={getSourceUrl(cite)}
                              className="text-xs px-2 py-0.5 rounded hover:opacity-80 transition-opacity"
                              style={{ color: source.textColor, background: source.color }}
                            >
                              {cite.title}
                            </Link>
                          )
                        })}
                      </div>
                    </div>
                  )}

                  {msg.followUp && msg.followUp.length > 0 && (
                    <div className="mt-3 pt-2" style={{ borderTop: '1px solid rgba(248,240,242,.1)' }}>
                      <p className="text-xs mb-1" style={{ color: 'var(--text-tertiary)' }}>Follow-up:</p>
                      <div className="flex flex-wrap gap-1">
                        {msg.followUp.map((q, qidx) => (
                          <button
                            key={qidx}
                            onClick={() => setAskQuestion(q)}
                            className="text-xs px-2 py-0.5 rounded transition-colors"
                            style={{ background: 'rgba(248,240,242,0.06)', color: 'var(--text-secondary)' }}
                            onMouseEnter={e => { e.currentTarget.style.background = 'rgba(248,240,242,0.1)' }}
                            onMouseLeave={e => { e.currentTarget.style.background = 'rgba(248,240,242,0.06)' }}
                          >
                            {q}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            ))}

            {/* Streaming content */}
            {askingQuestion && streamingContent && (
              <div className="flex justify-start">
                <div className="max-w-[80%] rounded-lg p-3" style={{ background: 'rgba(248,240,242,0.06)', color: 'var(--text-primary)' }}>
                  <p className="whitespace-pre-wrap">
                    {streamingContent}
                    <span className="inline-block w-2 h-4 animate-pulse ml-1" style={{ background: 'var(--accent-primary)' }} />
                  </p>
                </div>
              </div>
            )}

            {/* Loading spinner */}
            {askingQuestion && !streamingContent && (
              <div className="flex justify-start">
                <div className="rounded-lg p-3 flex items-center gap-2" style={{ background: 'rgba(248,240,242,0.06)' }}>
                  <Loader2 className="w-5 h-5 animate-spin" style={{ color: 'var(--accent-primary)' }} />
                  <span className="text-sm" style={{ color: 'var(--text-tertiary)' }}>Thinking...</span>
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>
        )}
      </div>

      {/* Input */}
      <div className="p-4" style={{ borderTop: '1px solid rgba(248,240,242,.08)' }}>
        <form onSubmit={handleAskQuestion} className="flex gap-3">
          <input
            type="text"
            className="vinput flex-1"
            placeholder="Ask a question about your meetings..."
            value={askQuestion}
            onChange={(e) => setAskQuestion(e.target.value)}
            disabled={askingQuestion}
          />
          <VCButton type="submit" variant="primary" disabled={askingQuestion || !askQuestion.trim()}>
            {askingQuestion ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
          </VCButton>
        </form>
      </div>
    </div>
  )
}
