import React, { useState, useEffect } from 'react'
import { useParams, Link } from 'react-router-dom'
import {
  ArrowLeft, Clock, Users, FileText, CheckSquare, MessageSquare,
  Send, Loader2, RefreshCw, Share2, X
} from 'lucide-react'
import { meetingsApi, integrationsApi } from '../services/api'
import ActionItemsList from '../components/ActionItemsList'
import ChatChannelSelector from '../components/ChatChannelSelector'

export default function MeetingDetail() {
  const { id } = useParams()
  const [meeting, setMeeting] = useState(null)
  const [loading, setLoading] = useState(true)
  const [question, setQuestion] = useState('')
  const [askingQuestion, setAskingQuestion] = useState(false)
  const [answer, setAnswer] = useState(null)
  const [syncing, setSyncing] = useState(false)
  const [showShareModal, setShowShareModal] = useState(false)
  const [selectedChannel, setSelectedChannel] = useState('')
  const [sharing, setSharing] = useState(false)
  const [shareResult, setShareResult] = useState(null)

  useEffect(() => {
    loadMeeting()
  }, [id])

  const loadMeeting = async () => {
    try {
      setLoading(true)
      const data = await meetingsApi.get(id)
      setMeeting(data)
    } catch (error) {
      console.error('Failed to load meeting:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleAskQuestion = async (e) => {
    e.preventDefault()
    if (!question.trim()) return

    try {
      setAskingQuestion(true)
      const result = await meetingsApi.ask(id, question)
      setAnswer(result)
      setQuestion('')
    } catch (error) {
      console.error('Failed to ask question:', error)
    } finally {
      setAskingQuestion(false)
    }
  }

  const handleSyncToCRM = async () => {
    const actionItemIds = meeting.actionItems?.map(a => a.id) || []
    if (actionItemIds.length === 0) return

    try {
      setSyncing(true)
      await integrationsApi.crm.syncActionItems(actionItemIds)
      loadMeeting() // Reload to get updated sync status
    } catch (error) {
      console.error('Failed to sync to CRM:', error)
    } finally {
      setSyncing(false)
    }
  }

  const handlePostToChat = async () => {
    if (!selectedChannel) {
      setShowShareModal(true)
      return
    }

    try {
      setSharing(true)
      setShareResult(null)
      const result = await integrationsApi.chat.postRecap(id, selectedChannel)
      setShareResult({
        success: true,
        message: `Posted to ${result.channelId || 'chat'}`,
        provider: result.provider
      })
      loadMeeting() // Reload to update posted status
      setTimeout(() => {
        setShowShareModal(false)
        setShareResult(null)
      }, 2000)
    } catch (error) {
      console.error('Failed to post to chat:', error)
      setShareResult({
        success: false,
        message: error.message || 'Failed to post recap'
      })
    } finally {
      setSharing(false)
    }
  }

  const openShareModal = () => {
    setShareResult(null)
    setShowShareModal(true)
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="spinner" />
      </div>
    )
  }

  if (!meeting) {
    return (
      <div className="text-center py-12">
        <h2 className="text-xl font-semibold text-gray-900">Meeting not found</h2>
        <Link to="/meetings" className="text-primary-600 hover:underline mt-2 inline-block">
          Back to meetings
        </Link>
      </div>
    )
  }

  const getSentimentEmoji = (sentiment) => {
    switch (sentiment) {
      case 'Positive': return '😊'
      case 'Negative': return '😟'
      default: return '😐'
    }
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start gap-4">
        <Link
          to="/meetings"
          className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
        >
          <ArrowLeft className="w-5 h-5" />
        </Link>
        <div className="flex-1">
          <div className="flex items-center gap-3 mb-2">
            <span className="text-2xl">{getSentimentEmoji(meeting.sentiment_label)}</span>
            <h1 className="text-2xl font-bold text-gray-900">{meeting.title}</h1>
          </div>
          <div className="flex flex-wrap items-center gap-4 text-sm text-gray-500">
            <span className="flex items-center gap-1">
              <Clock className="w-4 h-4" />
              {new Date(meeting.created_at).toLocaleDateString('en-US', {
                weekday: 'long',
                month: 'long',
                day: 'numeric',
                year: 'numeric'
              })}
            </span>
            {meeting.duration_minutes && (
              <span>{meeting.duration_minutes} minutes</span>
            )}
            {meeting.attendees?.length > 0 && (
              <span className="flex items-center gap-1">
                <Users className="w-4 h-4" />
                {meeting.attendees.join(', ')}
              </span>
            )}
          </div>
        </div>
        <div className="flex gap-2">
          <button
            onClick={openShareModal}
            className="btn btn-secondary"
          >
            <Share2 className="w-4 h-4" />
            Share
            {meeting.chat_posted && (
              <span className="ml-1 w-2 h-2 bg-green-500 rounded-full" title="Already posted" />
            )}
          </button>
          <button
            onClick={handleSyncToCRM}
            disabled={syncing}
            className="btn btn-primary"
          >
            {syncing ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
            Sync to CRM
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main content */}
        <div className="lg:col-span-2 space-y-6">
          {/* Summary */}
          <div className="card p-5">
            <h2 className="font-semibold text-gray-900 mb-3">Summary</h2>
            <p className="text-gray-700">{meeting.summary || 'No summary available'}</p>
          </div>

          {/* Key Points */}
          {meeting.key_points?.length > 0 && (
            <div className="card p-5">
              <h2 className="font-semibold text-gray-900 mb-3">Key Points</h2>
              <ul className="space-y-2">
                {meeting.key_points.map((point, index) => (
                  <li key={index} className="flex items-start gap-2">
                    <span className="w-6 h-6 rounded-full bg-primary-100 text-primary-700 text-sm flex items-center justify-center flex-shrink-0">
                      {index + 1}
                    </span>
                    <span className="text-gray-700">{point}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Decisions */}
          {meeting.decisions?.length > 0 && (
            <div className="card p-5">
              <h2 className="font-semibold text-gray-900 mb-3">Decisions Made</h2>
              <ul className="space-y-2">
                {meeting.decisions.map((decision, index) => (
                  <li key={index} className="flex items-start gap-2">
                    <CheckSquare className="w-5 h-5 text-green-600 flex-shrink-0" />
                    <span className="text-gray-700">{decision}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Transcript */}
          <div className="card p-5">
            <h2 className="font-semibold text-gray-900 mb-3 flex items-center gap-2">
              <FileText className="w-5 h-5" />
              Full Transcript
            </h2>
            <div className="bg-gray-50 rounded-lg p-4 max-h-96 overflow-y-auto scrollbar-thin">
              <pre className="whitespace-pre-wrap text-sm text-gray-700 font-mono">
                {meeting.transcript || 'No transcript available'}
              </pre>
            </div>
          </div>
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          {/* Action Items */}
          <div className="card p-5">
            <h2 className="font-semibold text-gray-900 mb-4 flex items-center gap-2">
              <CheckSquare className="w-5 h-5" />
              Action Items ({meeting.actionItems?.length || 0})
            </h2>
            <ActionItemsList
              items={meeting.actionItems || []}
              meetingId={id}
              onUpdate={loadMeeting}
            />
          </div>

          {/* Ask AI */}
          <div className="card p-5">
            <h2 className="font-semibold text-gray-900 mb-3 flex items-center gap-2">
              <MessageSquare className="w-5 h-5" />
              Ask About This Meeting
            </h2>
            <form onSubmit={handleAskQuestion}>
              <div className="flex gap-2">
                <input
                  type="text"
                  className="input flex-1"
                  placeholder="Ask a question..."
                  value={question}
                  onChange={(e) => setQuestion(e.target.value)}
                  disabled={askingQuestion}
                />
                <button
                  type="submit"
                  disabled={askingQuestion || !question.trim()}
                  className="btn btn-primary"
                >
                  {askingQuestion ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Send className="w-4 h-4" />
                  )}
                </button>
              </div>
            </form>

            {answer && (
              <div className="mt-4 p-3 bg-primary-50 rounded-lg">
                <p className="text-sm text-gray-900">{answer.answer}</p>
                {answer.confidence && (
                  <p className="text-xs text-gray-500 mt-2">
                    Confidence: {Math.round(answer.confidence * 100)}%
                  </p>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Share to Chat Modal */}
      {showShareModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl shadow-xl max-w-md w-full mx-4 p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-gray-900">
                Share Meeting Recap
              </h3>
              <button
                onClick={() => setShowShareModal(false)}
                className="p-1 hover:bg-gray-100 rounded"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <p className="text-sm text-gray-600 mb-4">
              Post a formatted recap of "{meeting.title}" to your team chat.
            </p>

            {meeting.chat_posted && (
              <div className="mb-4 p-3 bg-blue-50 text-blue-700 text-sm rounded-lg">
                This meeting has already been posted to: {meeting.posted_to_channels?.join(', ') || 'chat'}
              </div>
            )}

            <div className="mb-6">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Select Channel
              </label>
              <ChatChannelSelector
                selectedChannel={selectedChannel}
                onChannelSelect={setSelectedChannel}
                disabled={sharing}
                showStatus={true}
              />
            </div>

            {shareResult && (
              <div className={`mb-4 p-3 rounded-lg text-sm ${
                shareResult.success
                  ? 'bg-green-50 text-green-700'
                  : 'bg-red-50 text-red-700'
              }`}>
                {shareResult.message}
              </div>
            )}

            <div className="flex gap-3">
              <button
                onClick={() => setShowShareModal(false)}
                className="btn btn-secondary flex-1"
                disabled={sharing}
              >
                Cancel
              </button>
              <button
                onClick={handlePostToChat}
                disabled={sharing}
                className="btn btn-primary flex-1"
              >
                {sharing ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Posting...
                  </>
                ) : (
                  <>
                    <Share2 className="w-4 h-4" />
                    Post Recap
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
