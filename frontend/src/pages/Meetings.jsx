import React, { useState, useEffect, useCallback, useRef } from 'react'
import { Link } from 'react-router-dom'
import {
  Plus, Search, Clock, Users, MessageSquare, Trash2, AlertTriangle,
  RefreshCw, Loader2, CheckSquare, Square, Download, X
} from 'lucide-react'
import MeetingRecorder from '../components/MeetingRecorder'
import { meetingsApi, settingsApi } from '../services/api'
import { VCButton, VCBadge } from '../components/vc'
import { useConfirm } from '../components/vc/ConfirmDialog'
import { useToast } from '../components/vc/ToastProvider'
import { getSentimentEmoji, getSentimentBadgeColor } from '../utils/meetingHelpers'
import { MeetingCardSkeleton } from '../components/LoadingSkeletons'

export default function Meetings() {
  const confirm = useConfirm()
  const toast = useToast()
  const PAGE_SIZE = 20
  const [meetings, setMeetings] = useState([])
  const [loading, setLoading] = useState(true)
  const [loadingMore, setLoadingMore] = useState(false)
  const [hasMore, setHasMore] = useState(false)
  const [error, setError] = useState(null)
  const [searchQuery, setSearchQuery] = useState('')
  const [showRecorder, setShowRecorder] = useState(false)
  const [audioInputDeviceId, setAudioInputDeviceId] = useState('')
  const [selectionMode, setSelectionMode] = useState(false)
  const [selectedIds, setSelectedIds] = useState(new Set())
  const [bulkDeleting, setBulkDeleting] = useState(false)

  const searchTimer = useRef(null)

  useEffect(() => {
    loadMeetings()
    // Load user's preferred audio device
    settingsApi.getUser().then(res => {
      const deviceId = res?.settings?.meetings_json?.audioInputDeviceId
      if (deviceId) setAudioInputDeviceId(deviceId)
    }).catch(() => {})
  }, [])

  // Debounced server-side search
  useEffect(() => {
    if (searchTimer.current) clearTimeout(searchTimer.current)
    searchTimer.current = setTimeout(() => {
      loadMeetings(searchQuery)
    }, 300)
    return () => clearTimeout(searchTimer.current)
  }, [searchQuery])

  const loadMeetings = async (search = '') => {
    try {
      setLoading(true)
      setError(null)
      const params = { limit: PAGE_SIZE, offset: 0 }
      if (search.trim()) params.search = search.trim()
      const data = await meetingsApi.list(params)
      setMeetings(data.meetings || [])
      setHasMore(data.hasMore || false)
    } catch (err) {
      console.error('Failed to load meetings:', err)
      setError('Failed to load meetings. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  const loadMoreMeetings = async () => {
    try {
      setLoadingMore(true)
      const params = { limit: PAGE_SIZE, offset: meetings.length }
      if (searchQuery.trim()) params.search = searchQuery.trim()
      const data = await meetingsApi.list(params)
      setMeetings(prev => [...prev, ...(data.meetings || [])])
      setHasMore(data.hasMore || false)
    } catch (err) {
      console.error('Failed to load more meetings:', err)
    } finally {
      setLoadingMore(false)
    }
  }

  const handleMeetingProcessed = (result) => {
    setShowRecorder(false)
    loadMeetings()
  }

  const handleDelete = async (id, e) => {
    e.preventDefault()
    e.stopPropagation()

    const ok = await confirm({ title: 'Delete Meeting', message: 'Are you sure you want to delete this meeting?', confirmLabel: 'Delete', variant: 'danger' })
    if (!ok) return

    try {
      await meetingsApi.delete(id)
      setMeetings(meetings.filter(m => m.id !== id))
      toast.success('Deleted', 'Meeting removed successfully')
    } catch (err) {
      console.error('Failed to delete meeting:', err)
      toast.error('Error', 'Failed to delete meeting')
    }
  }

  const toggleSelect = (id, e) => {
    e.preventDefault()
    e.stopPropagation()
    setSelectedIds(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const toggleSelectAll = () => {
    if (selectedIds.size === filteredMeetings.length) {
      setSelectedIds(new Set())
    } else {
      setSelectedIds(new Set(filteredMeetings.map(m => m.id)))
    }
  }

  const exitSelectionMode = () => {
    setSelectionMode(false)
    setSelectedIds(new Set())
  }

  const handleBulkDelete = async () => {
    if (selectedIds.size === 0) return

    const ok = await confirm({
      title: 'Delete Selected',
      message: `Are you sure you want to delete ${selectedIds.size} meeting(s)?`,
      confirmLabel: 'Delete All',
      variant: 'danger'
    })
    if (!ok) return

    try {
      setBulkDeleting(true)
      await Promise.all([...selectedIds].map(id => meetingsApi.delete(id)))
      setMeetings(prev => prev.filter(m => !selectedIds.has(m.id)))
      toast.success('Deleted', `${selectedIds.size} meeting(s) removed`)
      exitSelectionMode()
    } catch (err) {
      toast.error('Error', 'Some meetings failed to delete')
    } finally {
      setBulkDeleting(false)
    }
  }

  const handleBulkExport = () => {
    const selected = meetings.filter(m => selectedIds.has(m.id))
    const markdown = selected.map(m => {
      let md = `# ${m.title}\n`
      md += `**Date:** ${new Date(m.created_at).toLocaleDateString()}\n`
      if (m.duration_minutes) md += `**Duration:** ${m.duration_minutes} min\n`
      if (m.attendees?.length) md += `**Attendees:** ${m.attendees.join(', ')}\n`
      md += `**Sentiment:** ${m.sentiment_label || 'Unknown'}\n\n`
      if (m.summary) md += `## Summary\n${m.summary}\n\n`
      if (m.key_points?.length) {
        md += `## Key Points\n${m.key_points.map(p => `- ${p}`).join('\n')}\n\n`
      }
      if (m.decisions?.length) {
        md += `## Decisions\n${m.decisions.map(d => `- ${d}`).join('\n')}\n\n`
      }
      return md
    }).join('\n---\n\n')

    const blob = new Blob([markdown], { type: 'text/markdown' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `meetings-export-${new Date().toISOString().split('T')[0]}.md`
    a.click()
    URL.revokeObjectURL(url)
    toast.success('Exported', `${selected.length} meeting(s) exported`)
  }

  // Search is now server-side — no client-side filtering needed
  const filteredMeetings = meetings

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
        <div className="flex gap-2">
          {selectionMode ? (
            <>
              <VCButton variant="ghost" onClick={toggleSelectAll}>
                {selectedIds.size === filteredMeetings.length ? <CheckSquare className="w-4 h-4" /> : <Square className="w-4 h-4" />}
                {selectedIds.size === filteredMeetings.length ? 'Deselect All' : 'Select All'}
              </VCButton>
              <VCButton variant="secondary" onClick={handleBulkExport} disabled={selectedIds.size === 0}>
                <Download className="w-4 h-4" />
                Export ({selectedIds.size})
              </VCButton>
              <VCButton variant="danger" onClick={handleBulkDelete} disabled={selectedIds.size === 0 || bulkDeleting}>
                {bulkDeleting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
                Delete ({selectedIds.size})
              </VCButton>
              <VCButton variant="ghost" onClick={exitSelectionMode}>
                <X className="w-4 h-4" />
              </VCButton>
            </>
          ) : (
            <>
              {meetings.length > 0 && (
                <VCButton variant="secondary" onClick={() => setSelectionMode(true)}>
                  <CheckSquare className="w-4 h-4" />
                  Select
                </VCButton>
              )}
              <VCButton
                variant="primary"
                onClick={() => setShowRecorder(!showRecorder)}
              >
                <Plus className="w-4 h-4" />
                New Meeting
              </VCButton>
            </>
          )}
        </div>
      </div>

      {/* Recorder panel */}
      {showRecorder && (
        <MeetingRecorder onMeetingProcessed={handleMeetingProcessed} audioInputDeviceId={audioInputDeviceId} />
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
            aria-label="Search meetings"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>
        {searchQuery && (
          <VCButton variant="ghost" onClick={() => setSearchQuery('')}>
            Clear
          </VCButton>
        )}
      </div>

      {/* Meetings list */}
      <div className="vc">
        {loading ? (
          <div className="p-4">
            <MeetingCardSkeleton count={4} />
          </div>
        ) : error ? (
          <div className="p-8 text-center">
            <AlertTriangle className="w-12 h-12 mx-auto mb-3 vc-text-warning" />
            <h3
              className="text-lg font-medium mb-1"
              style={{ fontFamily: 'var(--font-display)', color: 'var(--text-primary)' }}
            >
              Something went wrong
            </h3>
            <p style={{ color: 'var(--text-tertiary)' }} className="mb-4">{error}</p>
            <VCButton variant="secondary" onClick={loadMeetings}>
              <RefreshCw className="w-4 h-4" />
              Retry
            </VCButton>
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
          <>
            <div className="divide-y" style={{ borderColor: 'rgba(248,240,242,.08)' }}>
              {filteredMeetings.map((meeting) => (
                <div key={meeting.id} className="relative">
                  <Link
                    to={selectionMode ? '#' : `/meetings/${meeting.id}`}
                    onClick={selectionMode ? (e) => toggleSelect(meeting.id, e) : undefined}
                    className="block p-4 sm:p-5 hover:bg-surface-muted transition-colors"
                    style={selectedIds.has(meeting.id) ? { background: 'rgba(255,45,107,.06)' } : {}}
                  >
                    <div className="flex items-start justify-between gap-4">
                      {selectionMode && (
                        <button
                          onClick={(e) => toggleSelect(meeting.id, e)}
                          className="mt-1 flex-shrink-0"
                        >
                          {selectedIds.has(meeting.id) ? (
                            <CheckSquare className="w-5 h-5" style={{ color: 'var(--accent-primary)' }} />
                          ) : (
                            <Square className="w-5 h-5" style={{ color: 'var(--text-tertiary)' }} />
                          )}
                        </button>
                      )}
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

                      {!selectionMode && (
                        <VCButton
                          variant="ghost"
                          onClick={(e) => handleDelete(meeting.id, e)}
                          className="p-2"
                          title="Delete meeting"
                          aria-label="Delete meeting"
                        >
                          <Trash2 className="w-5 h-5" />
                        </VCButton>
                      )}
                    </div>
                  </Link>
                </div>
              ))}
            </div>
            {hasMore && (
              <div className="p-4 text-center">
                <VCButton
                  variant="secondary"
                  onClick={loadMoreMeetings}
                  disabled={loadingMore}
                >
                  {loadingMore ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Loading...
                    </>
                  ) : (
                    'Load More'
                  )}
                </VCButton>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}
