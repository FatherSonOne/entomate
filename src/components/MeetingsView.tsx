import React, { useState, useEffect, useRef } from 'react'
import { createMeeting, updateMeeting, getMeetings, createActionItemsFromMeeting, getActionItemsByMeeting } from '../services/meetingService'
import { processMeetingAudio, transcribeAudio, summarizeMeeting, extractActionItems } from '../services/geminiService'
import { syncMeetingActionItemsToCrm, syncActionItemToCrm, getMeetingSyncStatus, type SyncResult } from '../services/crmSyncService'
import { postMeetingSummaryToPulse, notifyAssigneesAboutActionItems, getMeetingPulseSyncStatus, type PostResult } from '../services/pulseChatService'
import { onMeetingProcessed as fireAgentTriggers } from '../agents/agentTriggerService'
import { indexMeeting } from '../search/indexer'
import { LinkedRecordsPanel } from './LinkedRecordsPanel'
import { MeetingIntelligencePanel } from './intelligence/MeetingIntelligencePanel'
import { CoachingPanel, SentimentAnalysisCard } from '../phase3/components'
import type { EntomateMeeting, EntoamteActionItem } from '../lib/supabase'

// Helper to convert blob to base64
const blobToBase64 = (blob: Blob): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onloadend = () => {
      if (typeof reader.result === 'string') {
        resolve(reader.result.split(',')[1])
      } else {
        reject(new Error("Failed to read blob"))
      }
    }
    reader.onerror = reject
    reader.readAsDataURL(blob)
  })
}

interface MeetingsViewProps {
  onMeetingProcessed?: (meeting: EntomateMeeting) => void
}

export const MeetingsView: React.FC<MeetingsViewProps> = ({ onMeetingProcessed }) => {
  const [meetingTitle, setMeetingTitle] = useState("")
  const [status, setStatus] = useState<'idle' | 'recording' | 'processing' | 'complete'>('idle')
  const [duration, setDuration] = useState(0)
  const [error, setError] = useState<string | null>(null)

  // Recording state
  const mediaRecorderRef = useRef<MediaRecorder | null>(null)
  const audioChunksRef = useRef<Blob[]>([])

  // Results state
  const [processedMeeting, setProcessedMeeting] = useState<EntomateMeeting | null>(null)
  const [actionItems, setActionItems] = useState<EntoamteActionItem[]>([])
  const [syncingItems, setSyncingItems] = useState<Set<string>>(new Set())
  const [syncStatus, setSyncStatus] = useState<{ total: number; synced: number; pending: number; failed: number } | null>(null)

  // Pulse sync state
  const [pulseSynced, setPulseSynced] = useState(false)
  const [pulseSyncing, setPulseSyncing] = useState(false)

  // Past meetings
  const [pastMeetings, setPastMeetings] = useState<EntomateMeeting[]>([])
  const [selectedMeeting, setSelectedMeeting] = useState<EntomateMeeting | null>(null)
  const [viewMode, setViewMode] = useState<'record' | 'history'>('record')

  // Load past meetings on mount
  useEffect(() => {
    loadPastMeetings()
  }, [])

  const loadPastMeetings = async () => {
    const meetings = await getMeetings()
    setPastMeetings(meetings)
  }

  // Timer effect
  useEffect(() => {
    let interval: any
    if (status === 'recording') {
      interval = setInterval(() => setDuration(prev => prev + 1), 1000)
    }
    return () => clearInterval(interval)
  }, [status])

  const formatTime = (sec: number) => {
    const m = Math.floor(sec / 60).toString().padStart(2, '0')
    const s = (sec % 60).toString().padStart(2, '0')
    return `${m}:${s}`
  }

  const startRecording = async () => {
    try {
      setError(null)
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      const mediaRecorder = new MediaRecorder(stream, { mimeType: 'audio/webm' })
      mediaRecorderRef.current = mediaRecorder
      audioChunksRef.current = []

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data)
        }
      }

      mediaRecorder.start(1000) // Collect data every second
      setStatus('recording')
      setDuration(0)
    } catch (err) {
      setError('Could not access microphone. Please allow microphone access.')
      console.error('Recording error:', err)
    }
  }

  const stopRecording = async () => {
    if (!mediaRecorderRef.current) return

    return new Promise<Blob>((resolve) => {
      mediaRecorderRef.current!.onstop = () => {
        const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' })
        // Stop all tracks
        mediaRecorderRef.current!.stream.getTracks().forEach(track => track.stop())
        resolve(audioBlob)
      }
      mediaRecorderRef.current!.stop()
    })
  }

  const handleStopAndProcess = async () => {
    setStatus('processing')

    try {
      // Stop recording and get audio blob
      const audioBlob = await stopRecording()
      const audioBase64 = await blobToBase64(audioBlob)

      // Create initial meeting record in Supabase
      const title = meetingTitle || `Meeting ${new Date().toLocaleDateString()}`
      const meeting = await createMeeting({
        title,
        start_time: new Date(Date.now() - duration * 1000).toISOString(),
        end_time: new Date().toISOString(),
        duration_minutes: Math.ceil(duration / 60)
      })

      if (!meeting) {
        throw new Error('Failed to create meeting record')
      }

      // Process with Gemini AI
      const processed = await processMeetingAudio(audioBase64, 'audio/webm')

      // Update meeting with AI results
      const updatedMeeting = await updateMeeting(meeting.id, {
        transcript: processed.transcript,
        summary: processed.summary,
        key_points: processed.key_points,
        decisions: processed.decisions,
        sentiment_label: processed.sentiment_label,
        sentiment_score: processed.sentiment_score
      })

      // Create action items
      let createdItems: EntoamteActionItem[] = []
      if (processed.action_items.length > 0) {
        createdItems = await createActionItemsFromMeeting(
          meeting.id,
          processed.action_items.map(item => ({
            task_description: item.task_description,
            assigned_to_name: item.assigned_to_name,
            due_date: item.due_date,
            priority: item.priority,
            status: 'open' as const,
            crm_sync_status: 'pending' as const
          }))
        )
        setActionItems(createdItems)
      }

      setProcessedMeeting(updatedMeeting)
      setStatus('complete')

      // Auto-sync action items to Logos Vision CRM
      if (createdItems.length > 0 && updatedMeeting) {
        console.log('Syncing action items to Logos Vision CRM...')
        const syncResults = await syncMeetingActionItemsToCrm(meeting.id, updatedMeeting.title)
        console.log('Sync results:', syncResults)

        // Refresh action items to get updated sync status
        const refreshedItems = await getActionItemsByMeeting(meeting.id)
        setActionItems(refreshedItems)

        // Update sync status
        const status = await getMeetingSyncStatus(meeting.id)
        setSyncStatus(status)
      }

      // Post meeting summary to Pulse Chat
      if (updatedMeeting) {
        console.log('Posting meeting summary to Pulse...')
        setPulseSyncing(true)
        try {
          const pulseResult = await postMeetingSummaryToPulse(updatedMeeting, createdItems)
          console.log('Pulse post result:', pulseResult)
          setPulseSynced(pulseResult.success)

          // Also notify assignees about their action items
          if (createdItems.length > 0) {
            await notifyAssigneesAboutActionItems(updatedMeeting, createdItems)
          }
        } catch (pulseErr) {
          console.error('Pulse sync error:', pulseErr)
          setPulseSynced(false)
        } finally {
          setPulseSyncing(false)
        }
      }

      // Refresh past meetings list
      loadPastMeetings()

      // Fire AI Agent triggers (Phase 2)
      if (updatedMeeting) {
        console.log('Firing AI agent triggers for meeting:', updatedMeeting.id)
        fireAgentTriggers(updatedMeeting.id).catch(err => {
          console.error('Agent triggers failed:', err)
        })

        // Index meeting for RAG search (Phase 2)
        console.log('Indexing meeting for search:', updatedMeeting.id)
        indexMeeting(updatedMeeting.id).catch(err => {
          console.error('Meeting indexing failed:', err)
        })
      }

      // Callback
      if (onMeetingProcessed && updatedMeeting) {
        onMeetingProcessed(updatedMeeting)
      }

    } catch (err) {
      console.error('Processing error:', err)
      setError('Failed to process meeting. Please try again.')
      setStatus('idle')
    }
  }

  const resetView = () => {
    setStatus('idle')
    setDuration(0)
    setMeetingTitle('')
    setProcessedMeeting(null)
    setActionItems([])
    setError(null)
    setSyncStatus(null)
    setSyncingItems(new Set())
    setPulseSynced(false)
    setPulseSyncing(false)
  }

  // Handle manual Pulse sync
  const handlePulseSync = async () => {
    if (!processedMeeting || pulseSyncing) return

    setPulseSyncing(true)
    try {
      const result = await postMeetingSummaryToPulse(processedMeeting, actionItems)
      setPulseSynced(result.success)

      if (actionItems.length > 0) {
        await notifyAssigneesAboutActionItems(processedMeeting, actionItems)
      }
    } catch (err) {
      console.error('Pulse sync error:', err)
      setPulseSynced(false)
    } finally {
      setPulseSyncing(false)
    }
  }

  // Handle manual sync retry for a single action item
  const handleSyncItem = async (item: EntoamteActionItem) => {
    if (item.crm_sync_status === 'synced') return

    setSyncingItems(prev => new Set(prev).add(item.id))

    try {
      const result = await syncActionItemToCrm(item, processedMeeting?.title)

      // Refresh action items
      if (processedMeeting) {
        const refreshedItems = await getActionItemsByMeeting(processedMeeting.id)
        setActionItems(refreshedItems)

        const status = await getMeetingSyncStatus(processedMeeting.id)
        setSyncStatus(status)
      }
    } catch (err) {
      console.error('Failed to sync item:', err)
    } finally {
      setSyncingItems(prev => {
        const next = new Set(prev)
        next.delete(item.id)
        return next
      })
    }
  }

  // Handle sync all pending/failed items
  const handleSyncAll = async () => {
    if (!processedMeeting) return

    const itemsToSync = actionItems.filter(i => i.crm_sync_status !== 'synced')
    setSyncingItems(new Set(itemsToSync.map(i => i.id)))

    try {
      await syncMeetingActionItemsToCrm(processedMeeting.id, processedMeeting.title)

      // Refresh
      const refreshedItems = await getActionItemsByMeeting(processedMeeting.id)
      setActionItems(refreshedItems)

      const status = await getMeetingSyncStatus(processedMeeting.id)
      setSyncStatus(status)
    } catch (err) {
      console.error('Failed to sync items:', err)
    } finally {
      setSyncingItems(new Set())
    }
  }

  // Render past meeting details
  const renderMeetingDetails = (meeting: EntomateMeeting) => (
    <div className="space-y-6">
      <div className="flex justify-between items-start">
        <div>
          <h3 className="text-2xl font-bold">{meeting.title}</h3>
          <p className="text-gray-500 font-mono text-sm">
            {new Date(meeting.created_at).toLocaleDateString()} • {meeting.duration_minutes} min
          </p>
        </div>
        <button
          onClick={() => setSelectedMeeting(null)}
          className="text-gray-400 hover:text-gray-600"
        >
          <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
        </button>
      </div>

      {/* Meeting Intelligence Panel */}
      <MeetingIntelligencePanel
        meetingId={meeting.id}
        meetingTitle={meeting.title}
        meetingTags={(meeting as any).tags}
        meetingParticipants={meeting.attendees || (meeting as any).participants}
      />

      {meeting.summary && (
        <div className="bg-gray-50 p-4 rounded-xl">
          <h4 className="font-mono text-xs uppercase text-gray-400 mb-2">Summary</h4>
          <p className="text-gray-800">{meeting.summary}</p>
        </div>
      )}

      {meeting.key_points && meeting.key_points.length > 0 && (
        <div>
          <h4 className="font-mono text-xs uppercase text-gray-400 mb-2">Key Points</h4>
          <ul className="space-y-2">
            {meeting.key_points.map((point, i) => (
              <li key={i} className="flex items-start gap-2">
                <span className="text-[#2563EB]">•</span>
                <span>{point}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {meeting.decisions && meeting.decisions.length > 0 && (
        <div>
          <h4 className="font-mono text-xs uppercase text-gray-400 mb-2">Decisions</h4>
          <ul className="space-y-2">
            {meeting.decisions.map((decision, i) => (
              <li key={i} className="flex items-start gap-2">
                <span className="text-blue-500">✓</span>
                <span>{decision}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {meeting.transcript && (
        <div>
          <h4 className="font-mono text-xs uppercase text-gray-400 mb-2">Transcript</h4>
          <div className="bg-gray-50 p-4 rounded-xl max-h-64 overflow-y-auto">
            <pre className="whitespace-pre-wrap text-sm text-gray-700 font-mono">{meeting.transcript}</pre>
          </div>
        </div>
      )}

      {/* Sentiment Analysis Card */}
      {meeting.sentiment_label && (
        <SentimentAnalysisCard
          meetingId={meeting.id}
          overallSentiment={meeting.sentiment_label as 'positive' | 'negative' | 'neutral'}
          sentimentScore={meeting.sentiment_score ?? 0.5}
        />
      )}

      {/* Knowledge Graph - Linked Records */}
      <div className="mt-6">
        <LinkedRecordsPanel
          entityType="meeting"
          entityId={meeting.id}
          title="Linked Records"
        />
      </div>
    </div>
  )

  return (
    <div className="flex flex-col h-full gap-6">
      {/* Tab Switcher */}
      <div className="flex gap-2 p-1 bg-gray-100 rounded-full w-fit">
        <button
          onClick={() => { setViewMode('record'); setSelectedMeeting(null) }}
          className={`px-4 py-2 rounded-full text-xs font-bold font-mono uppercase ${viewMode === 'record' ? 'bg-black text-white' : 'text-gray-500'}`}
        >
          Record
        </button>
        <button
          onClick={() => setViewMode('history')}
          className={`px-4 py-2 rounded-full text-xs font-bold font-mono uppercase ${viewMode === 'history' ? 'bg-black text-white' : 'text-gray-500'}`}
        >
          History ({pastMeetings.length})
        </button>
      </div>

      {viewMode === 'record' ? (
        <>
          {/* Recording Card */}
          <div className={`cmf-card transition-all duration-500 ${
            status === 'idle' ? 'dark' :
            status === 'recording' ? 'bg-[#2563EB] text-white' :
            status === 'processing' ? 'bg-gray-100 text-black' :
            'bg-white border border-gray-100 text-black'
          }`}>
            {status === 'idle' && (
              <>
                <div className="mb-8">
                  <span className="font-mono text-xs uppercase tracking-widest text-gray-400 mb-2 block">New Recording</span>
                  <h3 className="text-3xl font-bold">Record Meeting</h3>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-bold mb-2 text-gray-400">Meeting Title (optional)</label>
                    <input
                      value={meetingTitle}
                      onChange={(e) => setMeetingTitle(e.target.value)}
                      placeholder="Q3 Planning Meeting"
                      className="w-full bg-[#262626] border-none rounded-xl p-4 text-white placeholder-gray-600 font-mono text-sm focus:ring-1 focus:ring-gray-500 outline-none"
                    />
                  </div>
                  <div className="flex items-end">
                    <button
                      onClick={startRecording}
                      className="w-full py-4 bg-[#2563EB] text-white rounded-full font-bold hover:bg-[#1d4ed8] transition-colors flex items-center justify-center gap-2"
                    >
                      <div className="w-3 h-3 bg-white rounded-full"></div>
                      Start Recording
                    </button>
                  </div>
                </div>
                {error && (
                  <p className="mt-4 text-red-400 text-sm">{error}</p>
                )}
              </>
            )}

            {status === 'recording' && (
              <>
                <div className="flex justify-between items-start mb-8">
                  <div>
                    <span className="font-mono text-xs uppercase tracking-widest opacity-70 mb-2 block">Live Session</span>
                    <h3 className="text-3xl font-bold">Recording in Progress</h3>
                  </div>
                  <div className="flex items-center gap-2 bg-white/20 px-3 py-1 rounded-full">
                    <div className="w-2 h-2 bg-white rounded-full animate-pulse"></div>
                    <span className="font-mono text-sm font-bold">{formatTime(duration)}</span>
                  </div>
                </div>
                <div className="flex items-end justify-between h-32">
                  <div className="font-mono text-sm opacity-80">
                    {meetingTitle || 'Untitled Meeting'}<br/>
                    Recording audio from microphone...
                  </div>
                  <button
                    onClick={handleStopAndProcess}
                    className="px-8 py-3 bg-white text-[#2563EB] rounded-full font-bold hover:bg-gray-100 transition-colors"
                  >
                    Stop & Process
                  </button>
                </div>
              </>
            )}

            {status === 'processing' && (
              <>
                <div className="flex justify-between items-start mb-8">
                  <div>
                    <span className="font-mono text-xs uppercase tracking-widest text-gray-500 mb-2 block">Processing</span>
                    <h3 className="text-3xl font-bold">Analyzing Meeting...</h3>
                  </div>
                  <div className="w-6 h-6 border-2 border-[#2563EB] border-t-transparent rounded-full animate-spin"></div>
                </div>
                <div className="space-y-2 text-gray-600 font-mono text-sm">
                  <p>→ Transcribing audio with Gemini AI...</p>
                  <p>→ Extracting key points and decisions...</p>
                  <p>→ Identifying action items...</p>
                </div>
              </>
            )}

            {status === 'complete' && processedMeeting && (
              <>
                <div className="flex justify-between items-start mb-6">
                  <div>
                    <span className="font-mono text-xs uppercase tracking-widest text-gray-400 mb-2 block">Complete</span>
                    <h3 className="text-2xl font-bold">{processedMeeting.title}</h3>
                  </div>
                  <button
                    onClick={resetView}
                    className="px-4 py-2 bg-[#2563EB] text-white rounded-full text-sm font-bold"
                  >
                    New Recording
                  </button>
                </div>
                {renderMeetingDetails(processedMeeting)}

                {actionItems.length > 0 && (
                  <div className="mt-6 pt-6 border-t">
                    <div className="flex justify-between items-center mb-3">
                      <h4 className="font-mono text-xs uppercase text-gray-400">
                        Action Items ({actionItems.length})
                        {syncStatus && (
                          <span className="ml-2 text-[10px] normal-case">
                            • {syncStatus.synced} synced to CRM
                            {syncStatus.failed > 0 && <span className="text-red-500"> • {syncStatus.failed} failed</span>}
                          </span>
                        )}
                      </h4>
                      {syncStatus && (syncStatus.pending > 0 || syncStatus.failed > 0) && (
                        <button
                          onClick={handleSyncAll}
                          disabled={syncingItems.size > 0}
                          className="text-xs px-3 py-1 bg-blue-500 text-white rounded-full hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1"
                        >
                          {syncingItems.size > 0 ? (
                            <>
                              <span className="w-3 h-3 border border-white border-t-transparent rounded-full animate-spin"></span>
                              Syncing...
                            </>
                          ) : (
                            <>Sync to CRM</>
                          )}
                        </button>
                      )}
                    </div>
                    <div className="space-y-2">
                      {actionItems.map((item) => (
                        <div key={item.id} className="flex items-start gap-3 p-3 bg-gray-50 rounded-lg">
                          <input type="checkbox" className="mt-1" checked={item.status === 'completed'} readOnly />
                          <div className="flex-1">
                            <p className="font-medium">{item.task_description}</p>
                            <div className="flex flex-wrap gap-3 text-xs text-gray-500 mt-1">
                              {item.assigned_to_name && <span>→ {item.assigned_to_name}</span>}
                              {item.due_date && <span>Due: {item.due_date}</span>}
                              <span className={`px-2 py-0.5 rounded ${
                                item.priority === 'high' ? 'bg-red-100 text-red-600' :
                                item.priority === 'medium' ? 'bg-yellow-100 text-yellow-600' :
                                'bg-gray-100 text-gray-600'
                              }`}>{item.priority}</span>
                            </div>
                          </div>
                          {/* CRM Sync Status */}
                          <div className="flex items-center gap-2">
                            {syncingItems.has(item.id) ? (
                              <span className="w-4 h-4 border-2 border-blue-500 border-t-transparent rounded-full animate-spin"></span>
                            ) : item.crm_sync_status === 'synced' ? (
                              <span className="text-green-500 text-xs flex items-center gap-1" title="Synced to Logos Vision CRM">
                                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path><polyline points="22 4 12 14.01 9 11.01"></polyline></svg>
                                CRM
                              </span>
                            ) : item.crm_sync_status === 'failed' ? (
                              <button
                                onClick={() => handleSyncItem(item)}
                                className="text-red-500 text-xs flex items-center gap-1 hover:text-red-600"
                                title="Sync failed - click to retry"
                              >
                                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"></circle><line x1="15" y1="9" x2="9" y2="15"></line><line x1="9" y1="9" x2="15" y2="15"></line></svg>
                                Retry
                              </button>
                            ) : (
                              <button
                                onClick={() => handleSyncItem(item)}
                                className="text-gray-400 text-xs flex items-center gap-1 hover:text-blue-500"
                                title="Sync to Logos Vision CRM"
                              >
                                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 12a9 9 0 0 1-9 9m9-9a9 9 0 0 0-9-9m9 9H3m9 9a9 9 0 0 1-9-9m9 9c1.66 0 3-4.03 3-9s-1.34-9-3-9m0 18c-1.66 0-3-4.03-3-9s1.34-9 3-9"></path></svg>
                                Sync
                              </button>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Pulse Chat Sync Status */}
                <div className="mt-6 pt-6 border-t">
                  <div className="flex justify-between items-center">
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-xs uppercase text-gray-400">Pulse Chat</span>
                      {pulseSyncing ? (
                        <span className="flex items-center gap-1 text-xs text-blue-500">
                          <span className="w-3 h-3 border-2 border-blue-500 border-t-transparent rounded-full animate-spin"></span>
                          Posting...
                        </span>
                      ) : pulseSynced ? (
                        <span className="flex items-center gap-1 text-xs text-green-500">
                          <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path><polyline points="22 4 12 14.01 9 11.01"></polyline></svg>
                          Posted to channel
                        </span>
                      ) : (
                        <span className="text-xs text-gray-400">Not posted</span>
                      )}
                    </div>
                    {!pulseSynced && !pulseSyncing && (
                      <button
                        onClick={handlePulseSync}
                        className="text-xs px-3 py-1 bg-purple-500 text-white rounded-full hover:bg-purple-600 flex items-center gap-1"
                      >
                        <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path></svg>
                        Post to Pulse
                      </button>
                    )}
                  </div>
                </div>
              </>
            )}
          </div>

          {/* Real-time Coaching Panel - shown during recording */}
          {status === 'recording' && (
            <CoachingPanel
              meetingId={processedMeeting?.id || 'live-recording'}
              userId="current-user"
              onSessionStart={() => console.log('Coaching session started')}
              onSessionEnd={() => console.log('Coaching session ended')}
            />
          )}
        </>
      ) : (
        /* History View */
        <div className="flex-1 bg-white border border-gray-100 rounded-[24px] p-8 overflow-hidden flex flex-col">
          {selectedMeeting ? (
            renderMeetingDetails(selectedMeeting)
          ) : (
            <>
              <div className="flex justify-between items-center mb-6">
                <h4 className="font-mono text-xs uppercase tracking-wider text-gray-500">Past Meetings</h4>
                <button
                  onClick={loadPastMeetings}
                  className="text-xs text-gray-400 hover:text-gray-600"
                >
                  Refresh
                </button>
              </div>

              {pastMeetings.length === 0 ? (
                <div className="flex-1 flex items-center justify-center text-gray-400">
                  <p>No meetings recorded yet</p>
                </div>
              ) : (
                <div className="space-y-3 overflow-y-auto">
                  {pastMeetings.map(meeting => (
                    <div
                      key={meeting.id}
                      onClick={() => setSelectedMeeting(meeting)}
                      className="p-5 border border-gray-100 rounded-2xl hover:border-gray-300 transition-all cursor-pointer group"
                    >
                      <div className="flex justify-between items-center">
                        <div>
                          <div className="flex items-center gap-2 mb-1">
                            <span className="font-mono text-xs text-gray-400">
                              {new Date(meeting.created_at).toLocaleDateString()}
                            </span>
                            {meeting.duration_minutes && (
                              <span className="px-2 py-0.5 bg-gray-100 rounded text-[10px] font-bold text-gray-500">
                                {meeting.duration_minutes} min
                              </span>
                            )}
                            {meeting.sentiment_label && (
                              <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                                meeting.sentiment_label === 'positive' ? 'bg-green-100 text-green-600' :
                                meeting.sentiment_label === 'negative' ? 'bg-red-100 text-red-600' :
                                'bg-gray-100 text-gray-600'
                              }`}>
                                {meeting.sentiment_label}
                              </span>
                            )}
                          </div>
                          <h5 className="font-bold text-lg">{meeting.title}</h5>
                          {meeting.summary && (
                            <p className="text-gray-500 text-sm mt-1 line-clamp-2">{meeting.summary}</p>
                          )}
                        </div>
                        <div className="opacity-0 group-hover:opacity-100 transition-opacity">
                          <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="9 18 15 12 9 6"></polyline></svg>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </>
          )}
        </div>
      )}
    </div>
  )
}

export default MeetingsView
