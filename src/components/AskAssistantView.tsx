import React, { useState, useEffect, useRef } from 'react'
import { getMeetings, getMeetingById } from '../services/meetingService'
import { askAboutMeeting } from '../services/geminiService'
import type { EntomateMeeting } from '../lib/supabase'

// ==================== TYPES ====================

interface Message {
  id: string
  role: 'user' | 'assistant'
  content: string
  timestamp: Date
  meetingId?: string
}

// ==================== COMPONENT ====================

export const AskAssistantView: React.FC = () => {
  // Meeting selection
  const [meetings, setMeetings] = useState<EntomateMeeting[]>([])
  const [selectedMeeting, setSelectedMeeting] = useState<EntomateMeeting | null>(null)
  const [showMeetingSelector, setShowMeetingSelector] = useState(false)

  // Chat state
  const [messages, setMessages] = useState<Message[]>([])
  const [inputValue, setInputValue] = useState('')
  const [isLoading, setIsLoading] = useState(false)

  // Refs
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)

  // ==================== EFFECTS ====================

  useEffect(() => {
    loadMeetings()
  }, [])

  useEffect(() => {
    scrollToBottom()
  }, [messages])

  // ==================== DATA LOADING ====================

  const loadMeetings = async () => {
    const data = await getMeetings()
    // Only show meetings with transcripts
    const meetingsWithTranscripts = data.filter(m => m.transcript)
    setMeetings(meetingsWithTranscripts)

    // Auto-select most recent meeting
    if (meetingsWithTranscripts.length > 0 && !selectedMeeting) {
      setSelectedMeeting(meetingsWithTranscripts[0])
    }
  }

  // ==================== HELPERS ====================

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }

  const generateId = () => `msg-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`

  // ==================== ACTIONS ====================

  const handleSendMessage = async () => {
    if (!inputValue.trim() || !selectedMeeting?.transcript || isLoading) return

    const userMessage: Message = {
      id: generateId(),
      role: 'user',
      content: inputValue.trim(),
      timestamp: new Date(),
      meetingId: selectedMeeting.id
    }

    setMessages(prev => [...prev, userMessage])
    setInputValue('')
    setIsLoading(true)

    try {
      const response = await askAboutMeeting(selectedMeeting.transcript!, userMessage.content)

      const assistantMessage: Message = {
        id: generateId(),
        role: 'assistant',
        content: response,
        timestamp: new Date(),
        meetingId: selectedMeeting.id
      }

      setMessages(prev => [...prev, assistantMessage])
    } catch (error) {
      console.error('Failed to get response:', error)

      const errorMessage: Message = {
        id: generateId(),
        role: 'assistant',
        content: 'Sorry, I encountered an error processing your question. Please try again.',
        timestamp: new Date()
      }

      setMessages(prev => [...prev, errorMessage])
    } finally {
      setIsLoading(false)
      inputRef.current?.focus()
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSendMessage()
    }
  }

  const handleSelectMeeting = (meeting: EntomateMeeting) => {
    setSelectedMeeting(meeting)
    setShowMeetingSelector(false)

    // Add a system message about the context change
    if (messages.length > 0) {
      const contextMessage: Message = {
        id: generateId(),
        role: 'assistant',
        content: `Now answering questions about: **${meeting.title}**`,
        timestamp: new Date()
      }
      setMessages(prev => [...prev, contextMessage])
    }
  }

  const clearChat = () => {
    setMessages([])
  }

  // ==================== SUGGESTED QUESTIONS ====================

  const suggestedQuestions = [
    "What were the main topics discussed?",
    "What decisions were made?",
    "Who said what about the deadline?",
    "What are the next steps?",
    "Were there any concerns raised?",
    "Summarize this in 3 bullet points"
  ]

  const handleSuggestedQuestion = (question: string) => {
    setInputValue(question)
    inputRef.current?.focus()
  }

  // ==================== RENDER ====================

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex justify-between items-center mb-6">
        <div>
          <h2 className="text-2xl font-bold">Ask Assistant</h2>
          <p className="text-gray-500 text-sm">Ask questions about your meeting transcripts</p>
        </div>

        {messages.length > 0 && (
          <button
            onClick={clearChat}
            className="text-gray-400 hover:text-gray-600 text-sm flex items-center gap-1"
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>
            Clear chat
          </button>
        )}
      </div>

      {/* Meeting Selector */}
      <div className="mb-4 relative">
        <button
          onClick={() => setShowMeetingSelector(!showMeetingSelector)}
          className="w-full px-4 py-3 bg-white border border-gray-200 rounded-xl flex justify-between items-center hover:border-gray-300 transition-colors"
        >
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-[#2563EB]/10 rounded-full flex items-center justify-center">
              <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#2563EB" strokeWidth="2"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path></svg>
            </div>
            <div className="text-left">
              {selectedMeeting ? (
                <>
                  <p className="font-medium">{selectedMeeting.title}</p>
                  <p className="text-xs text-gray-400">
                    {new Date(selectedMeeting.created_at).toLocaleDateString()} • {selectedMeeting.duration_minutes} min
                  </p>
                </>
              ) : (
                <p className="text-gray-400">Select a meeting to ask questions about...</p>
              )}
            </div>
          </div>
          <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className={`transition-transform ${showMeetingSelector ? 'rotate-180' : ''}`}><polyline points="6 9 12 15 18 9"></polyline></svg>
        </button>

        {/* Meeting Dropdown */}
        {showMeetingSelector && (
          <div className="absolute top-full left-0 right-0 mt-2 bg-white border border-gray-200 rounded-xl shadow-lg max-h-64 overflow-y-auto z-10">
            {meetings.length === 0 ? (
              <div className="p-4 text-center text-gray-400">
                No meetings with transcripts found
              </div>
            ) : (
              meetings.map(meeting => (
                <button
                  key={meeting.id}
                  onClick={() => handleSelectMeeting(meeting)}
                  className={`w-full px-4 py-3 text-left hover:bg-gray-50 flex items-center gap-3 border-b border-gray-100 last:border-0 ${
                    selectedMeeting?.id === meeting.id ? 'bg-[#2563EB]/5' : ''
                  }`}
                >
                  <div className="flex-1">
                    <p className="font-medium">{meeting.title}</p>
                    <p className="text-xs text-gray-400">
                      {new Date(meeting.created_at).toLocaleDateString()}
                      {meeting.duration_minutes && ` • ${meeting.duration_minutes} min`}
                    </p>
                  </div>
                  {selectedMeeting?.id === meeting.id && (
                    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#2563EB" strokeWidth="2"><polyline points="20 6 9 17 4 12"></polyline></svg>
                  )}
                </button>
              ))
            )}
          </div>
        )}
      </div>

      {/* Chat Area */}
      <div className="flex-1 bg-white border border-gray-100 rounded-2xl flex flex-col overflow-hidden">
        {/* Messages */}
        <div className="flex-1 overflow-y-auto p-6">
          {messages.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-center">
              <div className="w-16 h-16 bg-[#2563EB]/10 rounded-full flex items-center justify-center mb-4">
                <svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#2563EB" strokeWidth="2"><circle cx="12" cy="12" r="10"></circle><path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"></path><line x1="12" y1="17" x2="12.01" y2="17"></line></svg>
              </div>
              <h3 className="font-bold text-lg mb-2">Ask anything about your meeting</h3>
              <p className="text-gray-400 text-sm mb-6 max-w-md">
                Select a meeting above, then ask questions like "What were the main decisions?" or "Who is responsible for the follow-up?"
              </p>

              {/* Suggested Questions */}
              {selectedMeeting && (
                <div className="w-full max-w-lg">
                  <p className="text-xs text-gray-400 uppercase mb-3">Suggested questions</p>
                  <div className="flex flex-wrap gap-2 justify-center">
                    {suggestedQuestions.slice(0, 4).map((q, i) => (
                      <button
                        key={i}
                        onClick={() => handleSuggestedQuestion(q)}
                        className="px-3 py-2 bg-gray-100 hover:bg-gray-200 rounded-full text-sm transition-colors"
                      >
                        {q}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div className="space-y-4">
              {messages.map(message => (
                <div
                  key={message.id}
                  className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
                >
                  <div
                    className={`max-w-[80%] px-4 py-3 rounded-2xl ${
                      message.role === 'user'
                        ? 'bg-[#2563EB] text-white rounded-br-md'
                        : 'bg-gray-100 text-gray-800 rounded-bl-md'
                    }`}
                  >
                    <p className="whitespace-pre-wrap">{message.content}</p>
                    <p className={`text-[10px] mt-1 ${
                      message.role === 'user' ? 'text-white/60' : 'text-gray-400'
                    }`}>
                      {message.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </p>
                  </div>
                </div>
              ))}

              {/* Loading indicator */}
              {isLoading && (
                <div className="flex justify-start">
                  <div className="bg-gray-100 px-4 py-3 rounded-2xl rounded-bl-md">
                    <div className="flex items-center gap-2">
                      <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }}></div>
                      <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></div>
                      <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></div>
                    </div>
                  </div>
                </div>
              )}

              <div ref={messagesEndRef} />
            </div>
          )}
        </div>

        {/* Input Area */}
        <div className="border-t border-gray-100 p-4">
          <div className="flex gap-3">
            <textarea
              ref={inputRef}
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder={selectedMeeting ? "Ask a question about this meeting..." : "Select a meeting first..."}
              disabled={!selectedMeeting || isLoading}
              rows={1}
              className="flex-1 px-4 py-3 bg-gray-100 rounded-xl resize-none focus:outline-none focus:ring-2 focus:ring-[#2563EB]/20 disabled:opacity-50 disabled:cursor-not-allowed"
              style={{ minHeight: '48px', maxHeight: '120px' }}
            />
            <button
              onClick={handleSendMessage}
              disabled={!inputValue.trim() || !selectedMeeting || isLoading}
              className="px-4 py-3 bg-[#2563EB] text-white rounded-xl hover:bg-[#008f5b] disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="22" y1="2" x2="11" y2="13"></line><polygon points="22 2 15 22 11 13 2 9 22 2"></polygon></svg>
            </button>
          </div>

          {/* Quick suggestions when chatting */}
          {messages.length > 0 && selectedMeeting && !isLoading && (
            <div className="mt-3 flex flex-wrap gap-2">
              {suggestedQuestions.slice(0, 3).map((q, i) => (
                <button
                  key={i}
                  onClick={() => handleSuggestedQuestion(q)}
                  className="px-2 py-1 text-xs text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-full transition-colors"
                >
                  {q}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

export default AskAssistantView
