import React, { useState, useEffect } from 'react'
import { useParams, Link } from 'react-router-dom'
import {
  ArrowLeft, Clock, Users, FileText, CheckSquare, MessageSquare,
  Send, Loader2, RefreshCw, Share2, X
} from 'lucide-react'
import { meetingsApi, integrationsApi } from '../services/api'
import ActionItemsList from '../components/ActionItemsList'
import ChatChannelSelector from '../components/ChatChannelSelector'
import { VCButton, VCBadge, VCTimeline } from '../components/vc'

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
        <h2
          className="text-xl font-semibold"
          style={{ fontFamily: 'var(--font-display)', color: 'var(--text-primary)' }}
        >
          Meeting not found
        </h2>
        <Link
          to="/meetings"
          className="hover:underline mt-2 inline-block"
          style={{ color: 'var(--accent-primary)' }}
        >
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
          className="p-2 rounded-lg transition-colors"
          style={{ color: 'var(--text-secondary)' }}
        >
          <ArrowLeft className="w-5 h-5" />
        </Link>
        <div className="flex-1">
          <div className="flex items-center gap-3 mb-2">
            <span className="text-2xl">{getSentimentEmoji(meeting.sentiment_label)}</span>
            <h1
              className="text-2xl font-bold"
              style={{ fontFamily: 'var(--font-display)', color: 'var(--text-primary)' }}
            >
              {meeting.title}
            </h1>
          </div>
          <div
            className="flex flex-wrap items-center gap-4 text-sm"
            style={{ color: 'var(--text-tertiary)' }}
          >
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
          <VCButton variant="secondary" onClick={openShareModal}>
            <Share2 className="w-4 h-4" />
            Share
            {meeting.chat_posted && (
              <VCBadge color="mint" className="ml-1">posted</VCBadge>
            )}
          </VCButton>
          <VCButton variant="primary" onClick={handleSyncToCRM} disabled={syncing}>
            {syncing ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
            Sync to CRM
          </VCButton>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main content */}
        <div className="lg:col-span-2 space-y-6">
          {/* Summary */}
          <div className="vc p-5">
            <h2
              className="font-semibold mb-3"
              style={{ fontFamily: 'var(--font-display)', color: 'var(--text-primary)' }}
            >
              Summary
            </h2>
            <p style={{ color: 'var(--text-secondary)' }}>{meeting.summary || 'No summary available'}</p>
          </div>

          {/* Key Points */}
          {meeting.key_points?.length > 0 && (
            <div className="vc p-5">
              <h2
                className="font-semibold mb-3"
                style={{ fontFamily: 'var(--font-display)', color: 'var(--text-primary)' }}
              >
                Key Points
              </h2>
              <VCTimeline
                events={meeting.key_points.map((point, index) => ({
                  title: point,
                  time: `Point ${index + 1}`,
                  color: index % 3 === 0 ? 'crimson' : index % 3 === 1 ? 'mint' : 'amber',
                }))}
              />
            </div>
          )}

          {/* Decisions */}
          {meeting.decisions?.length > 0 && (
            <div className="vc p-5">
              <h2
                className="font-semibold mb-3"
                style={{ fontFamily: 'var(--font-display)', color: 'var(--text-primary)' }}
              >
                Decisions Made
              </h2>
              <VCTimeline
                events={meeting.decisions.map((decision) => ({
                  title: decision,
                  color: 'mint',
                }))}
              />
            </div>
          )}

          {/* Transcript */}
          <div className="vc p-5">
            <h2
              className="font-semibold mb-3 flex items-center gap-2"
              style={{ fontFamily: 'var(--font-display)', color: 'var(--text-primary)' }}
            >
              <FileText className="w-5 h-5" />
              Full Transcript
            </h2>
            <div
              className="rounded-lg p-4 max-h-96 overflow-y-auto scrollbar-thin"
              style={{ background: 'var(--bg-elevated)' }}
            >
              <pre
                className="whitespace-pre-wrap text-sm"
                style={{ color: 'var(--text-secondary)', fontFamily: 'var(--font-mono)' }}
              >
                {meeting.transcript || 'No transcript available'}
              </pre>
            </div>
          </div>
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          {/* Action Items */}
          <div className="vc p-5">
            <h2
              className="font-semibold mb-4 flex items-center gap-2"
              style={{ fontFamily: 'var(--font-display)', color: 'var(--text-primary)' }}
            >
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
          <div className="vc p-5">
            <h2
              className="font-semibold mb-3 flex items-center gap-2"
              style={{ fontFamily: 'var(--font-display)', color: 'var(--text-primary)' }}
            >
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
                <VCButton
                  type="submit"
                  variant="primary"
                  disabled={askingQuestion || !question.trim()}
                >
                  {askingQuestion ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Send className="w-4 h-4" />
                  )}
                </VCButton>
              </div>
            </form>

            {answer && (
              <div
                className="mt-4 p-3 rounded-lg"
                style={{
                  background: 'rgba(255,45,107,.08)',
                  borderLeft: '2px solid var(--accent-primary)'
                }}
              >
                <p className="text-sm" style={{ color: 'var(--text-primary)' }}>{answer.answer}</p>
                {answer.confidence && (
                  <p className="text-xs mt-2" style={{ color: 'var(--text-tertiary)', fontFamily: 'var(--font-mono)' }}>
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
        <div className="fixed inset-0 bg-black bg-opacity-70 flex items-center justify-center z-50">
          <div className="vc rounded-xl shadow-xl max-w-md w-full mx-4 p-6">
            <div className="flex items-center justify-between mb-4">
              <h3
                className="text-lg font-semibold"
                style={{ fontFamily: 'var(--font-display)', color: 'var(--text-primary)' }}
              >
                Share Meeting Recap
              </h3>
              <VCButton
                variant="ghost"
                onClick={() => setShowShareModal(false)}
                className="p-1"
                aria-label="Close"
              >
                <X className="w-5 h-5" />
              </VCButton>
            </div>

            <p className="text-sm mb-4" style={{ color: 'var(--text-secondary)' }}>
              Post a formatted recap of "{meeting.title}" to your team chat.
            </p>

            {meeting.chat_posted && (
              <div
                className="mb-4 p-3 text-sm rounded-lg"
                style={{
                  background: 'rgba(0,245,212,.08)',
                  color: 'var(--accent-secondary)',
                  border: '1px solid rgba(0,245,212,.18)'
                }}
              >
                This meeting has already been posted to: {meeting.posted_to_channels?.join(', ') || 'chat'}
              </div>
            )}

            <div className="mb-6">
              <label className="block text-sm font-medium mb-2" style={{ color: 'var(--text-secondary)' }}>
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
              <div
                className="mb-4 p-3 rounded-lg text-sm"
                style={
                  shareResult.success
                    ? { background: 'rgba(0,245,212,.08)', color: 'var(--accent-secondary)' }
                    : { background: 'rgba(255,45,107,.08)', color: 'var(--accent-primary)' }
                }
              >
                {shareResult.message}
              </div>
            )}

            <div className="flex gap-3">
              <VCButton
                variant="secondary"
                className="flex-1"
                onClick={() => setShowShareModal(false)}
                disabled={sharing}
              >
                Cancel
              </VCButton>
              <VCButton
                variant="primary"
                className="flex-1"
                onClick={handlePostToChat}
                disabled={sharing}
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
              </VCButton>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
