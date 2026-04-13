import React, { useState, useEffect, useCallback } from 'react'
import { useParams, Link } from 'react-router-dom'
import {
  ArrowLeft, Clock, Users, FileText, CheckSquare, MessageSquare,
  Send, Loader2, RefreshCw, Share2, X, Pencil, Check, CalendarPlus
} from 'lucide-react'
import { meetingsApi, integrationsApi, calendarApi } from '../services/api'
import ActionItemsList from '../components/ActionItemsList'
import ChatChannelSelector from '../components/ChatChannelSelector'
import { VCButton, VCBadge, VCTimeline } from '../components/vc'
import { useToast } from '../components/vc/ToastProvider'
import EcosystemSyncStatus from '../components/EcosystemSyncStatus'
import MeetingIntelligencePanel from '../components/intelligence/MeetingIntelligencePanel'
import { getSentimentIcon } from '../utils/meetingHelpers'

export default function MeetingDetail() {
  const { id } = useParams()
  const toast = useToast()
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
  const [calendarSyncing, setCalendarSyncing] = useState(false)

  // Inline edit state
  const [editingTitle, setEditingTitle] = useState(false)
  const [editTitle, setEditTitle] = useState('')
  const [editingSummary, setEditingSummary] = useState(false)
  const [editSummary, setEditSummary] = useState('')
  const [editingKeyPoints, setEditingKeyPoints] = useState(false)
  const [editKeyPoints, setEditKeyPoints] = useState('')
  const [saving, setSaving] = useState(false)

  const loadMeeting = useCallback(async () => {
    try {
      setLoading(true)
      const data = await meetingsApi.get(id)
      setMeeting(data)
    } catch (error) {
      console.error('Failed to load meeting:', error)
    } finally {
      setLoading(false)
    }
  }, [id])

  useEffect(() => {
    loadMeeting()
  }, [loadMeeting])

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

  // Inline edit handlers
  const startEditTitle = () => {
    setEditTitle(meeting.title || '')
    setEditingTitle(true)
  }

  const saveTitle = async () => {
    if (!editTitle.trim() || editTitle === meeting.title) {
      setEditingTitle(false)
      return
    }
    try {
      setSaving(true)
      await meetingsApi.update(id, { title: editTitle.trim() })
      setMeeting(prev => ({ ...prev, title: editTitle.trim() }))
      setEditingTitle(false)
      toast.success('Saved', 'Title updated')
    } catch (err) {
      toast.error('Error', 'Failed to update title')
    } finally {
      setSaving(false)
    }
  }

  const startEditSummary = () => {
    setEditSummary(meeting.summary || '')
    setEditingSummary(true)
  }

  const saveSummary = async () => {
    if (editSummary === meeting.summary) {
      setEditingSummary(false)
      return
    }
    try {
      setSaving(true)
      await meetingsApi.update(id, { summary: editSummary })
      setMeeting(prev => ({ ...prev, summary: editSummary }))
      setEditingSummary(false)
      toast.success('Saved', 'Summary updated')
    } catch (err) {
      toast.error('Error', 'Failed to update summary')
    } finally {
      setSaving(false)
    }
  }

  const startEditKeyPoints = () => {
    setEditKeyPoints((meeting.key_points || []).join('\n'))
    setEditingKeyPoints(true)
  }

  const saveKeyPoints = async () => {
    const points = editKeyPoints.split('\n').map(p => p.trim()).filter(Boolean)
    try {
      setSaving(true)
      await meetingsApi.update(id, { key_points: points })
      setMeeting(prev => ({ ...prev, key_points: points }))
      setEditingKeyPoints(false)
      toast.success('Saved', 'Key points updated')
    } catch (err) {
      toast.error('Error', 'Failed to update key points')
    } finally {
      setSaving(false)
    }
  }

  // Calendar sync handler (4.2)
  const handleAddToCalendar = async () => {
    try {
      setCalendarSyncing(true)
      await calendarApi.syncMeeting(id)
      toast.success('Synced', 'Meeting added to Google Calendar')
    } catch (err) {
      toast.error('Error', err.message || 'Failed to sync to calendar')
    } finally {
      setCalendarSyncing(false)
    }
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
            <span className="flex items-center">{getSentimentIcon(meeting.sentiment_label, 28)}</span>
            {editingTitle ? (
              <div className="flex items-center gap-2 flex-1">
                <input
                  type="text"
                  className="input text-2xl font-bold flex-1"
                  style={{ fontFamily: 'var(--font-display)' }}
                  value={editTitle}
                  onChange={(e) => setEditTitle(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') saveTitle()
                    if (e.key === 'Escape') setEditingTitle(false)
                  }}
                  autoFocus
                  disabled={saving}
                />
                <VCButton variant="primary" onClick={saveTitle} disabled={saving}>
                  {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
                </VCButton>
                <VCButton variant="ghost" onClick={() => setEditingTitle(false)} disabled={saving}>
                  <X className="w-4 h-4" />
                </VCButton>
              </div>
            ) : (
              <h1
                className="text-2xl font-bold cursor-pointer group flex items-center gap-2"
                style={{ fontFamily: 'var(--font-display)', color: 'var(--text-primary)' }}
                onClick={startEditTitle}
                title="Click to edit"
              >
                {meeting.title}
                <Pencil className="w-4 h-4 opacity-0 group-hover:opacity-50 transition-opacity" />
              </h1>
            )}
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
          <VCButton variant="secondary" onClick={handleAddToCalendar} disabled={calendarSyncing}>
            {calendarSyncing ? <Loader2 className="w-4 h-4 animate-spin" /> : <CalendarPlus className="w-4 h-4" />}
            Add to Calendar
          </VCButton>
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

      {/* Meeting Intelligence Panel */}
      <MeetingIntelligencePanel
        meetingId={meeting.id}
        meetingTitle={meeting.title}
        meetingDescription={meeting.description}
        meetingTags={meeting.tags}
        meetingParticipants={meeting.attendees || meeting.participants}
      />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main content */}
        <div className="lg:col-span-2 space-y-6">
          {/* Summary */}
          <div className="vc p-5">
            <div className="flex items-center justify-between mb-3">
              <h2
                className="font-semibold"
                style={{ fontFamily: 'var(--font-display)', color: 'var(--text-primary)' }}
              >
                Summary
              </h2>
              {!editingSummary && (
                <VCButton variant="ghost" onClick={startEditSummary} className="p-1">
                  <Pencil className="w-4 h-4" />
                </VCButton>
              )}
            </div>
            {editingSummary ? (
              <div className="space-y-2">
                <textarea
                  className="input w-full min-h-[120px]"
                  value={editSummary}
                  onChange={(e) => setEditSummary(e.target.value)}
                  disabled={saving}
                  autoFocus
                />
                <div className="flex gap-2 justify-end">
                  <VCButton variant="ghost" onClick={() => setEditingSummary(false)} disabled={saving}>Cancel</VCButton>
                  <VCButton variant="primary" onClick={saveSummary} disabled={saving}>
                    {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Save'}
                  </VCButton>
                </div>
              </div>
            ) : (
              <p style={{ color: 'var(--text-secondary)' }}>{meeting.summary || 'No summary available'}</p>
            )}
          </div>

          {/* Key Points */}
          {(meeting.key_points?.length > 0 || editingKeyPoints) && (
            <div className="vc p-5">
              <div className="flex items-center justify-between mb-3">
                <h2
                  className="font-semibold"
                  style={{ fontFamily: 'var(--font-display)', color: 'var(--text-primary)' }}
                >
                  Key Points
                </h2>
                {!editingKeyPoints && (
                  <VCButton variant="ghost" onClick={startEditKeyPoints} className="p-1">
                    <Pencil className="w-4 h-4" />
                  </VCButton>
                )}
              </div>
              {editingKeyPoints ? (
                <div className="space-y-2">
                  <textarea
                    className="input w-full min-h-[150px]"
                    value={editKeyPoints}
                    onChange={(e) => setEditKeyPoints(e.target.value)}
                    placeholder="One key point per line"
                    disabled={saving}
                    autoFocus
                  />
                  <p className="text-xs" style={{ color: 'var(--text-tertiary)' }}>One key point per line</p>
                  <div className="flex gap-2 justify-end">
                    <VCButton variant="ghost" onClick={() => setEditingKeyPoints(false)} disabled={saving}>Cancel</VCButton>
                    <VCButton variant="primary" onClick={saveKeyPoints} disabled={saving}>
                      {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Save'}
                    </VCButton>
                  </div>
                </div>
              ) : (
                <VCTimeline
                  events={meeting.key_points.map((point, index) => ({
                    title: point,
                    time: `Point ${index + 1}`,
                    color: index % 3 === 0 ? 'crimson' : index % 3 === 1 ? 'mint' : 'amber',
                  }))}
                />
              )}
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

          {/* Audio Playback */}
          {meeting.audio_file_url && (
            <div className="vc p-5">
              <h2
                className="font-semibold mb-3 flex items-center gap-2"
                style={{ fontFamily: 'var(--font-display)', color: 'var(--text-primary)' }}
              >
                Recording
              </h2>
              <audio
                controls
                src={meeting.audio_file_url}
                className="w-full"
                style={{ borderRadius: '8px' }}
              >
                Your browser does not support the audio element.
              </audio>
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

          {/* Ecosystem Sync Status */}
          <EcosystemSyncStatus meetingId={id} />

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
        <div className="vc-confirm-overlay" onClick={() => setShowShareModal(false)}>
          <div className="vc rounded-xl shadow-xl max-w-md w-full mx-4 p-6" onClick={(e) => e.stopPropagation()}>
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
