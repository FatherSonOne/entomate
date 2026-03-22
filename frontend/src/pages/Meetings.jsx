import React, { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { Plus, Search, Filter, Clock, Users, MessageSquare, Trash2 } from 'lucide-react'
import MeetingRecorder from '../components/MeetingRecorder'
import { meetingsApi } from '../services/api'
import { VCButton, VCBadge } from '../components/vc'

export default function Meetings() {
  const [meetings, setMeetings] = useState([])
  const [loading, setLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState('')
  const [showRecorder, setShowRecorder] = useState(false)

  useEffect(() => {
    loadMeetings()
  }, [])

  const loadMeetings = async () => {
    try {
      setLoading(true)
      const data = await meetingsApi.list({ limit: 50 })
      setMeetings(data.meetings || [])
    } catch (error) {
      console.error('Failed to load meetings:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleMeetingProcessed = (result) => {
    setShowRecorder(false)
    loadMeetings()
  }

  const handleDelete = async (id, e) => {
    e.preventDefault()
    e.stopPropagation()

    if (!confirm('Are you sure you want to delete this meeting?')) return

    try {
      await meetingsApi.delete(id)
      setMeetings(meetings.filter(m => m.id !== id))
    } catch (error) {
      console.error('Failed to delete meeting:', error)
    }
  }

  const filteredMeetings = meetings.filter(meeting =>
    meeting.title?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    meeting.summary?.toLowerCase().includes(searchQuery.toLowerCase())
  )

  const getSentimentBadgeColor = (sentiment) => {
    switch (sentiment) {
      case 'Positive': return 'mint'
      case 'Negative': return 'crimson'
      default: return 'neutral'
    }
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
      {/* Page header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1
            className="text-2xl font-bold"
            style={{ fontFamily: 'var(--font-display)', color: 'var(--text-primary)' }}
          >
            Meetings
          </h1>
          <p style={{ color: 'var(--text-secondary)' }}>View and manage your meeting recordings</p>
        </div>
        <VCButton
          variant="primary"
          onClick={() => setShowRecorder(!showRecorder)}
        >
          <Plus className="w-4 h-4" />
          New Meeting
        </VCButton>
      </div>

      {/* Recorder panel */}
      {showRecorder && (
        <MeetingRecorder onMeetingProcessed={handleMeetingProcessed} />
      )}

      {/* Search and filters */}
      <div className="flex flex-col sm:flex-row gap-4">
        <div className="relative flex-1">
          <Search
            className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5"
            style={{ color: 'var(--text-tertiary)' }}
          />
          <input
            type="text"
            placeholder="Search meetings..."
            className="input pl-10"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>
        <VCButton variant="secondary">
          <Filter className="w-4 h-4" />
          Filters
        </VCButton>
      </div>

      {/* Meetings list */}
      <div className="vc">
        {loading ? (
          <div className="p-8 text-center">
            <div className="spinner mx-auto mb-4" />
            <p style={{ color: 'var(--text-tertiary)' }}>Loading meetings...</p>
          </div>
        ) : filteredMeetings.length === 0 ? (
          <div className="p-8 text-center">
            <MessageSquare
              className="w-12 h-12 mx-auto mb-3"
              style={{ color: 'var(--text-tertiary)' }}
            />
            <h3
              className="text-lg font-medium mb-1"
              style={{ fontFamily: 'var(--font-display)', color: 'var(--text-primary)' }}
            >
              No meetings found
            </h3>
            <p style={{ color: 'var(--text-tertiary)' }}>
              {searchQuery ? 'Try a different search term' : 'Record your first meeting to get started'}
            </p>
          </div>
        ) : (
          <div className="divide-y" style={{ borderColor: 'rgba(248,240,242,.08)' }}>
            {filteredMeetings.map((meeting) => (
              <Link
                key={meeting.id}
                to={`/meetings/${meeting.id}`}
                className="block p-4 sm:p-5 hover:bg-surface-muted transition-colors"
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-xl">{getSentimentEmoji(meeting.sentiment_label)}</span>
                      <h3
                        className="text-lg font-semibold truncate"
                        style={{ color: 'var(--text-primary)' }}
                      >
                        {meeting.title}
                      </h3>
                      <VCBadge color={getSentimentBadgeColor(meeting.sentiment_label)}>
                        {meeting.sentiment_label || 'Unknown'}
                      </VCBadge>
                    </div>

                    {meeting.summary && (
                      <p className="line-clamp-2 mb-3" style={{ color: 'var(--text-secondary)' }}>
                        {meeting.summary}
                      </p>
                    )}

                    <div className="flex flex-wrap items-center gap-4 text-sm" style={{ color: 'var(--text-tertiary)' }}>
                      <span className="flex items-center gap-1">
                        <Clock className="w-4 h-4" />
                        {new Date(meeting.created_at).toLocaleDateString('en-US', {
                          month: 'short',
                          day: 'numeric',
                          year: 'numeric'
                        })}
                      </span>

                      {meeting.duration_minutes && (
                        <span>{meeting.duration_minutes} min</span>
                      )}

                      {meeting.attendees?.length > 0 && (
                        <span className="flex items-center gap-1">
                          <Users className="w-4 h-4" />
                          {meeting.attendees.length} attendees
                        </span>
                      )}

                      {meeting.key_points?.length > 0 && (
                        <VCBadge color="neutral">
                          {meeting.key_points.length} key points
                        </VCBadge>
                      )}
                    </div>
                  </div>

                  <VCButton
                    variant="ghost"
                    onClick={(e) => handleDelete(meeting.id, e)}
                    className="p-2"
                    title="Delete meeting"
                  >
                    <Trash2 className="w-5 h-5" />
                  </VCButton>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
