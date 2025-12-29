import React, { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { Plus, Search, Filter, Clock, Users, MessageSquare, Trash2 } from 'lucide-react'
import MeetingRecorder from '../components/MeetingRecorder'
import { meetingsApi } from '../services/api'

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

  const getSentimentColor = (sentiment) => {
    switch (sentiment) {
      case 'Positive': return 'badge-success'
      case 'Negative': return 'badge-error'
      default: return 'badge-gray'
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
          <h1 className="text-2xl font-bold text-gray-900">Meetings</h1>
          <p className="text-gray-600">View and manage your meeting recordings</p>
        </div>
        <button
          onClick={() => setShowRecorder(!showRecorder)}
          className="btn btn-primary"
        >
          <Plus className="w-4 h-4" />
          New Meeting
        </button>
      </div>

      {/* Recorder panel */}
      {showRecorder && (
        <MeetingRecorder onMeetingProcessed={handleMeetingProcessed} />
      )}

      {/* Search and filters */}
      <div className="flex flex-col sm:flex-row gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
          <input
            type="text"
            placeholder="Search meetings..."
            className="input pl-10"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>
        <button className="btn btn-secondary">
          <Filter className="w-4 h-4" />
          Filters
        </button>
      </div>

      {/* Meetings list */}
      <div className="card">
        {loading ? (
          <div className="p-8 text-center">
            <div className="spinner mx-auto mb-4" />
            <p className="text-gray-500">Loading meetings...</p>
          </div>
        ) : filteredMeetings.length === 0 ? (
          <div className="p-8 text-center">
            <MessageSquare className="w-12 h-12 text-gray-300 mx-auto mb-3" />
            <h3 className="text-lg font-medium text-gray-900 mb-1">No meetings found</h3>
            <p className="text-gray-500">
              {searchQuery ? 'Try a different search term' : 'Record your first meeting to get started'}
            </p>
          </div>
        ) : (
          <div className="divide-y divide-gray-200">
            {filteredMeetings.map((meeting) => (
              <Link
                key={meeting.id}
                to={`/meetings/${meeting.id}`}
                className="block p-4 sm:p-5 hover:bg-gray-50 transition-colors"
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-xl">{getSentimentEmoji(meeting.sentiment_label)}</span>
                      <h3 className="text-lg font-semibold text-gray-900 truncate">
                        {meeting.title}
                      </h3>
                      <span className={`badge ${getSentimentColor(meeting.sentiment_label)}`}>
                        {meeting.sentiment_label || 'Unknown'}
                      </span>
                    </div>

                    {meeting.summary && (
                      <p className="text-gray-600 line-clamp-2 mb-3">
                        {meeting.summary}
                      </p>
                    )}

                    <div className="flex flex-wrap items-center gap-4 text-sm text-gray-500">
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
                        <span className="badge badge-info">
                          {meeting.key_points.length} key points
                        </span>
                      )}
                    </div>
                  </div>

                  <button
                    onClick={(e) => handleDelete(meeting.id, e)}
                    className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                  >
                    <Trash2 className="w-5 h-5" />
                  </button>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
