import React, { useState } from 'react'
import { RefreshCw, Loader2, CalendarPlus } from 'lucide-react'
import { integrationsApi, meetingsApi, calendarApi } from '../services/api'
import TimecodeButton from './meetings/TimecodeButton'
import AgentNotes from './meetings/AgentNotes'
import { Key, Signal } from './bench'

/**
 * Action items of a meeting (Bench Swiss): grouped by priority under group heads,
 * a checkbox to close each one, its CRM state as an LED + word, and keys to jump
 * to where it was said, add it to the calendar or send it to the CRM.
 *
 * @param {(atMs: number) => void} [onJumpToTranscript]  When given, items with a
 *   transcript_at_ms show a timecode that jumps the transcript to where it was said.
 * @param {boolean} [timecodesPlay]  The meeting has audio: the timecodes also play it.
 * @param {number|null} [focusAtMs]  The transcript moment in view; its timecode shows pressed.
 */
export default function ActionItemsList({ items = [], onUpdate, meetingId, onJumpToTranscript, timecodesPlay = false, focusAtMs = null }) {
  const [syncing, setSyncing] = useState({})
  const [toggling, setToggling] = useState({})
  const [calSyncing, setCalSyncing] = useState({})
  const [error, setError] = useState(null)

  const syncItem = async (itemId) => {
    try {
      setSyncing(prev => ({ ...prev, [itemId]: true }))
      setError(null)

      const result = await integrationsApi.crm.syncActionItems([itemId])

      if (result.failed > 0 && result.errors?.length > 0) {
        setError(result.errors[0].error || 'Sync failed')
      }

      if (onUpdate) {
        onUpdate()
      }
    } catch (err) {
      setError(err.message)
    } finally {
      setSyncing(prev => ({ ...prev, [itemId]: false }))
    }
  }

  const syncAllPending = async () => {
    const pendingIds = items
      .filter(i => i.crm_sync_status === 'pending' || i.crm_sync_status === 'failed')
      .map(i => i.id)

    if (pendingIds.length === 0) return

    try {
      setSyncing(prev => {
        const newState = { ...prev }
        pendingIds.forEach(id => { newState[id] = true })
        return newState
      })
      setError(null)

      const result = await integrationsApi.crm.syncActionItems(pendingIds)

      if (result.failed > 0) {
        setError(`${result.failed} item(s) failed to sync`)
      }

      if (onUpdate) {
        onUpdate()
      }
    } catch (err) {
      setError(err.message)
    } finally {
      setSyncing({})
    }
  }

  const toggleStatus = async (itemId, currentStatus) => {
    const newStatus = currentStatus === 'done' ? 'open' : 'done'
    try {
      setToggling(prev => ({ ...prev, [itemId]: true }))
      await meetingsApi.updateActionItem(itemId, { status: newStatus })
      if (onUpdate) onUpdate()
    } catch (err) {
      setError(err.message || 'Failed to update status')
    } finally {
      setToggling(prev => ({ ...prev, [itemId]: false }))
    }
  }

  const syncToCalendar = async (itemId) => {
    try {
      setCalSyncing(prev => ({ ...prev, [itemId]: true }))
      await calendarApi.syncActionItem(itemId)
      if (onUpdate) onUpdate()
    } catch (err) {
      setError(err.message || 'Failed to sync to calendar')
    } finally {
      setCalSyncing(prev => ({ ...prev, [itemId]: false }))
    }
  }

  const hasPending = items.some(i => i.crm_sync_status === 'pending' || i.crm_sync_status === 'failed')
  const syncedCount = items.filter(i => i.crm_sync_status === 'synced').length
  const pendingCount = items.filter(i => i.crm_sync_status === 'pending').length
  const failedCount = items.filter(i => i.crm_sync_status === 'failed').length
  const anySyncing = Object.values(syncing).some(Boolean)

  if (!items || items.length === 0) {
    return <p className="bs-mtg-none">No action items were found in this meeting.</p>
  }

  const groups = [
    { key: 'high', label: 'High', tone: 'brand', rows: items.filter(i => i.priority === 'high') },
    { key: 'medium', label: 'Medium', tone: 'off', rows: items.filter(i => i.priority === 'medium') },
    { key: 'low', label: 'Low', tone: 'off', rows: items.filter(i => i.priority !== 'high' && i.priority !== 'medium') },
  ].filter(g => g.rows.length > 0)

  const crmSignal = (status) => {
    if (status === 'synced') return <Signal tone="mint">In CRM</Signal>
    if (status === 'failed') return <Signal tone="brand">CRM failed</Signal>
    return <Signal tone="off">Not sent</Signal>
  }

  return (
    <div className="bs-actions">
      <div className="bs-actions-head">
        <span className="bs-lbl">
          {syncedCount} in CRM{pendingCount > 0 && ` · ${pendingCount} not sent`}{failedCount > 0 && ` · ${failedCount} failed`}
        </span>
        {hasPending && (
          <Key size="sm" onClick={syncAllPending} disabled={anySyncing}>
            {anySyncing && <Loader2 className="animate-spin" aria-hidden="true" />}
            Send all to CRM
          </Key>
        )}
      </div>

      {error && (
        <p role="alert" className="bs-actions-err">
          <Signal tone="brand">Error</Signal> <span className="bs-sub">{error}</span>
        </p>
      )}

      {groups.map((group) => (
        <section key={group.key} aria-label={`${group.label} priority`}>
          <div className="bs-group">
            <Signal tone={group.tone}>{group.label} priority</Signal>
            <span className="bs-lbl">{group.rows.length}</span>
          </div>
          <ul className="bs-rows">
            {group.rows.map((item) => {
              const done = item.status === 'done'
              const canSend = item.crm_sync_status === 'pending' || item.crm_sync_status === 'failed'
              const canCal = item.due_date && !item.calendar_event_id && !done
              return (
                <li key={item.id} className="bs-row bs-action" data-done={done || undefined}>
                  <span className="bs-action-check">
                    {toggling[item.id] ? (
                      <Loader2 className="animate-spin" aria-hidden="true" />
                    ) : (
                      <input
                        type="checkbox"
                        className="bs-check"
                        checked={done}
                        onChange={() => toggleStatus(item.id, item.status)}
                        aria-label={done ? `Mark open: ${item.task_description}` : `Mark done: ${item.task_description}`}
                      />
                    )}
                  </span>
                  <div className="bs-row-text">
                    <div className="bs-action-title">{item.task_description}</div>
                    <div className="bs-action-meta">
                      {item.assigned_to_name && <span>{item.assigned_to_name}</span>}
                      {item.due_date && (
                        <span className="bs-mono">
                          Due {new Date(`${item.due_date}T00:00:00`).toLocaleDateString('en-US', { weekday: 'short', day: 'numeric', month: 'short' })}
                        </span>
                      )}
                      {crmSignal(item.crm_sync_status)}
                    </div>
                    {item.last_sync_error && item.crm_sync_status === 'failed' && (
                      <div className="bs-why"><span className="bs-led brand" aria-hidden="true" />{item.last_sync_error}</div>
                    )}
                    <div className="bs-agentnotes"><AgentNotes notes={item.agent_notes} /></div>
                  </div>
                  <div className="bs-action-keys">
                    {onJumpToTranscript && (
                      <TimecodeButton
                        atMs={item.transcript_at_ms}
                        onJump={onJumpToTranscript}
                        label={item.task_description}
                        plays={timecodesPlay}
                        active={typeof item.transcript_at_ms === 'number' && item.transcript_at_ms === focusAtMs}
                      />
                    )}
                    {canCal && (
                      <Key size="sm" onClick={() => syncToCalendar(item.id)} disabled={calSyncing[item.id]} aria-label={`Add to calendar: ${item.task_description}`}>
                        {calSyncing[item.id] ? <Loader2 className="animate-spin" aria-hidden="true" /> : <CalendarPlus aria-hidden="true" />}
                        <span className="bs-dt">Calendar</span>
                      </Key>
                    )}
                    {canSend && (
                      <Key size="sm" onClick={() => syncItem(item.id)} disabled={syncing[item.id]} aria-label={`${item.crm_sync_status === 'failed' ? 'Retry sending' : 'Send'} to CRM: ${item.task_description}`}>
                        {syncing[item.id] ? <Loader2 className="animate-spin" aria-hidden="true" /> : <RefreshCw aria-hidden="true" />}
                        <span className="bs-dt">{item.crm_sync_status === 'failed' ? 'Retry' : 'CRM'}</span>
                      </Key>
                    )}
                  </div>
                </li>
              )
            })}
          </ul>
        </section>
      ))}
    </div>
  )
}
