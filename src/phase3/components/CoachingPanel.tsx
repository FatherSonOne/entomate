import React, { useState, useEffect, useCallback } from 'react'
import { useCoachingSession, useCoachingStats } from '../hooks'
import * as coachingService from '../coachingService'
import type { CoachingPrompt, CoachingContext, CoachingPromptPriority } from '../types'

interface CoachingPanelProps {
  meetingId: string
  userId: string
  onSessionStart?: () => void
  onSessionEnd?: () => void
}

export const CoachingPanel: React.FC<CoachingPanelProps> = ({
  meetingId,
  userId,
  onSessionStart,
  onSessionEnd
}) => {
  const {
    session,
    prompts,
    isActive,
    error,
    startSession,
    endSession,
    markPromptUsed,
    dismissPrompt
  } = useCoachingSession(meetingId, userId)

  const { stats } = useCoachingStats(userId, 30)
  const [talkTime, setTalkTime] = useState({ user: 0, customer: 0 })
  const [currentPrompt, setCurrentPrompt] = useState<CoachingPrompt | null>(null)

  // Get the most recent unhandled prompt
  useEffect(() => {
    const unhandled = prompts.find(p => !p.usedAt && !p.dismissedAt)
    setCurrentPrompt(unhandled || null)
  }, [prompts])

  const handleStart = async () => {
    const newSession = await startSession()
    if (newSession) {
      onSessionStart?.()
    }
  }

  const handleEnd = async () => {
    await endSession()
    onSessionEnd?.()
  }

  const handleUsePrompt = async (promptId: string) => {
    await markPromptUsed(promptId)
    setCurrentPrompt(null)
  }

  const handleDismissPrompt = async (promptId: string) => {
    await dismissPrompt(promptId)
    setCurrentPrompt(null)
  }

  const getPriorityColor = (priority: CoachingPromptPriority) => {
    switch (priority) {
      case 'critical': return 'border-red-500 bg-red-50'
      case 'high': return 'border-orange-500 bg-orange-50'
      case 'medium': return 'border-yellow-500 bg-yellow-50'
      default: return 'border-blue-500 bg-blue-50'
    }
  }

  const getPriorityIcon = (priority: CoachingPromptPriority) => {
    switch (priority) {
      case 'critical':
        return (
          <div className="w-8 h-8 rounded-full bg-red-500 flex items-center justify-center">
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2">
              <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"></path>
              <line x1="12" y1="9" x2="12" y2="13"></line>
              <line x1="12" y1="17" x2="12.01" y2="17"></line>
            </svg>
          </div>
        )
      case 'high':
        return (
          <div className="w-8 h-8 rounded-full bg-orange-500 flex items-center justify-center">
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2">
              <circle cx="12" cy="12" r="10"></circle>
              <line x1="12" y1="8" x2="12" y2="12"></line>
              <line x1="12" y1="16" x2="12.01" y2="16"></line>
            </svg>
          </div>
        )
      default:
        return (
          <div className="w-8 h-8 rounded-full bg-blue-500 flex items-center justify-center">
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2">
              <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path>
            </svg>
          </div>
        )
    }
  }

  const getPromptTypeIcon = (type: string) => {
    switch (type) {
      case 'objection_handling':
        return '🛡️'
      case 'competitor_alert':
        return '⚔️'
      case 'talk_time_warning':
        return '🎤'
      case 'question_prompt':
        return '❓'
      case 'topic_suggestion':
        return '💡'
      case 'sentiment_alert':
        return '📊'
      default:
        return '💬'
    }
  }

  // Calculate talk time percentage
  const totalTalkTime = talkTime.user + talkTime.customer
  const userTalkPercent = totalTalkTime > 0 ? (talkTime.user / totalTalkTime) * 100 : 50

  return (
    <div className="bg-white border border-gray-100 rounded-2xl overflow-hidden">
      {/* Header */}
      <div className="p-4 border-b border-gray-100 bg-gradient-to-r from-gray-50 to-white">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className={`w-3 h-3 rounded-full ${isActive ? 'bg-green-500 animate-pulse' : 'bg-gray-300'}`}></div>
            <div>
              <h3 className="font-bold">Live Coaching</h3>
              <p className="text-xs text-gray-500">
                {isActive ? 'Session active' : 'Start a coaching session'}
              </p>
            </div>
          </div>
          {!isActive ? (
            <button
              onClick={handleStart}
              className="px-4 py-2 bg-[#2563EB] text-white hover:bg-[#1d4ed8] rounded-full text-sm font-bold transition-colors"
            >
              Start Coaching
            </button>
          ) : (
            <button
              onClick={handleEnd}
              className="px-4 py-2 bg-red-500 text-white hover:bg-red-600 rounded-full text-sm font-bold transition-colors"
            >
              End Session
            </button>
          )}
        </div>
      </div>

      {error && (
        <div className="p-3 bg-red-50 border-b border-red-100 text-red-600 text-sm">
          {error}
        </div>
      )}

      {isActive && (
        <>
          {/* Current Prompt */}
          {currentPrompt && (
            <div className={`p-4 border-b-2 ${getPriorityColor(currentPrompt.priority)} animate-fade-in`}>
              <div className="flex items-start gap-3">
                {getPriorityIcon(currentPrompt.priority)}
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-lg">{getPromptTypeIcon(currentPrompt.promptType)}</span>
                    <span className="text-xs font-mono uppercase text-gray-500">
                      {currentPrompt.promptType.replace('_', ' ')}
                    </span>
                    {currentPrompt.triggerKeyword && (
                      <span className="px-2 py-0.5 bg-white rounded text-xs font-mono">
                        "{currentPrompt.triggerKeyword}"
                      </span>
                    )}
                  </div>
                  <p className="font-medium text-gray-800">{currentPrompt.promptText}</p>
                </div>
              </div>
              <div className="flex gap-2 mt-3 ml-11">
                <button
                  onClick={() => handleUsePrompt(currentPrompt.id)}
                  className="px-3 py-1 bg-[#2563EB] text-white hover:bg-[#1d4ed8] rounded-full text-xs font-bold transition-colors"
                >
                  Used It
                </button>
                <button
                  onClick={() => handleDismissPrompt(currentPrompt.id)}
                  className="px-3 py-1 bg-gray-200 hover:bg-gray-300 rounded-full text-xs font-medium transition-colors"
                >
                  Dismiss
                </button>
              </div>
            </div>
          )}

          {/* Talk Time Bar */}
          <div className="p-4 border-b border-gray-100">
            <div className="flex justify-between text-xs text-gray-500 mb-2">
              <span>You: {Math.round(userTalkPercent)}%</span>
              <span>Customer: {Math.round(100 - userTalkPercent)}%</span>
            </div>
            <div className="h-2 rounded-full overflow-hidden flex bg-gray-100">
              <div
                className={`transition-all duration-500 ${
                  userTalkPercent > 70 ? 'bg-red-500' :
                  userTalkPercent > 60 ? 'bg-yellow-500' :
                  'bg-green-500'
                }`}
                style={{ width: `${userTalkPercent}%` }}
              />
              <div
                className="bg-blue-500 transition-all duration-500"
                style={{ width: `${100 - userTalkPercent}%` }}
              />
            </div>
            {userTalkPercent > 70 && (
              <p className="text-xs text-red-500 mt-2">
                Tip: Ask more questions to let the customer speak
              </p>
            )}
          </div>

          {/* Session Stats */}
          <div className="p-4 grid grid-cols-3 gap-4 text-center">
            <div>
              <div className="text-2xl font-bold">{session?.promptsShown || 0}</div>
              <div className="text-xs text-gray-500">Prompts</div>
            </div>
            <div>
              <div className="text-2xl font-bold text-green-600">{session?.promptsUsed || 0}</div>
              <div className="text-xs text-gray-500">Used</div>
            </div>
            <div>
              <div className="text-2xl font-bold text-gray-400">{session?.promptsDismissed || 0}</div>
              <div className="text-xs text-gray-500">Dismissed</div>
            </div>
          </div>

          {/* Prompt History */}
          {prompts.length > 0 && (
            <div className="p-4 border-t border-gray-100 max-h-48 overflow-y-auto">
              <span className="font-mono text-xs uppercase text-gray-400 block mb-3">Prompt History</span>
              <div className="space-y-2">
                {prompts.filter(p => p.usedAt || p.dismissedAt).slice(0, 5).map((prompt) => (
                  <div
                    key={prompt.id}
                    className={`p-2 rounded-lg text-xs ${
                      prompt.usedAt ? 'bg-green-50 text-green-700' : 'bg-gray-50 text-gray-500'
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <span>{getPromptTypeIcon(prompt.promptType)}</span>
                      <span className="truncate flex-1">{prompt.promptText}</span>
                      <span className="font-mono">
                        {prompt.usedAt ? '✓' : '✕'}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </>
      )}

      {/* Stats when not active */}
      {!isActive && stats && (
        <div className="p-6">
          <span className="font-mono text-xs uppercase text-gray-400 block mb-4">Your Coaching Stats (30 days)</span>
          <div className="grid grid-cols-2 gap-4">
            <div className="p-4 bg-gray-50 rounded-xl">
              <div className="text-2xl font-bold">{stats.totalSessions}</div>
              <div className="text-xs text-gray-500">Sessions</div>
            </div>
            <div className="p-4 bg-gray-50 rounded-xl">
              <div className="text-2xl font-bold">{stats.totalPrompts}</div>
              <div className="text-xs text-gray-500">Total Prompts</div>
            </div>
            <div className="p-4 bg-green-50 rounded-xl">
              <div className="text-2xl font-bold text-green-600">
                {Math.round(stats.usageRate)}%
              </div>
              <div className="text-xs text-gray-500">Usage Rate</div>
            </div>
            <div className="p-4 bg-blue-50 rounded-xl">
              <div className="text-2xl font-bold text-blue-600">
                {stats.avgResponseTime ? `${(stats.avgResponseTime / 1000).toFixed(1)}s` : '—'}
              </div>
              <div className="text-xs text-gray-500">Avg Response</div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default CoachingPanel
