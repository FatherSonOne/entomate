import React, { useCallback, useEffect, useId, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { Key, Section } from '../bench'
import { liveRoomsApi } from '../../services/api'
import { formatClock } from '../../services/meetingTranscriptService'
import { smoothScrollBehavior } from '../bench/motion'

const EMPTY = { summary: [], decisions: [], actions: [], throughMs: null }
const REFRESH_MS = 30_000

export function LiveMeetingInsights({
  roomId, live = false, transcriptRevision = 0, beforeRefresh, onSource, onTask, disabled = false,
}) {
  const anchorId = useId()
  const [insights, setInsights] = useState(EMPTY)
  const [loading, setLoading] = useState(true)
  const [request, setRequest] = useState(null)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [source, setSource] = useState(null)
  const sourcePanel = useRef(null)
  const inFlight = useRef(false)
  const mounted = useRef(false)
  const revision = useRef(transcriptRevision)
  const lastRefresh = useRef(0)

  useEffect(() => { revision.current = transcriptRevision }, [transcriptRevision])

  useEffect(() => {
    let active = true
    mounted.current = true
    setLoading(true)
    liveRoomsApi.insights(roomId).then(data => {
      if (active) setInsights(data)
    }).catch(err => {
      if (active) setError(err.message || 'The live meeting notes could not be loaded.')
    }).finally(() => { if (active) setLoading(false) })
    return () => { active = false; mounted.current = false }
  }, [roomId])

  const refresh = useCallback(async (manual = false) => {
    const through = revision.current
    if (disabled || loading || inFlight.current || (!manual && through <= lastRefresh.current)) return
    inFlight.current = true
    setRequest('refresh')
    setError('')
    try {
      await beforeRefresh?.()
      const data = await liveRoomsApi.refreshInsights(roomId)
      lastRefresh.current = through
      if (mounted.current) setInsights(data)
    } catch (err) {
      // Try again automatically only once new transcript lines arrive. The host can retry anytime.
      lastRefresh.current = through
      if (mounted.current) setError(err.message || 'The summary could not be updated.')
    } finally {
      inFlight.current = false
      if (mounted.current) setRequest(null)
    }
  }, [beforeRefresh, disabled, loading, roomId])

  useEffect(() => {
    if (!live || disabled || loading) return undefined
    const timer = window.setInterval(() => void refresh(), REFRESH_MS)
    return () => window.clearInterval(timer)
  }, [disabled, live, loading, refresh])

  useEffect(() => {
    if (!source || !sourcePanel.current) return
    sourcePanel.current.focus({ preventScroll: true })
    sourcePanel.current.scrollIntoView?.({ behavior: smoothScrollBehavior(), block: 'nearest' })
  }, [source])

  async function approve(draft) {
    if (disabled || inFlight.current) return
    inFlight.current = true
    setRequest(draft.id)
    setError('')
    setNotice('')
    try {
      const saved = await liveRoomsApi.approveAction(roomId, draft.id)
      if (mounted.current) {
        setInsights(saved.insights)
        setNotice(`Task created. ${draft.text}`)
        onTask?.()
      }
    } catch (err) {
      if (mounted.current) setError(err.message || 'The task could not be created. Try again.')
    } finally {
      inFlight.current = false
      if (mounted.current) setRequest(null)
    }
  }

  function sourceLink(line) {
    const clock = formatClock(line.atMs)
    const target = onSource ? `transcript-line-${line.id}` : anchorId
    return <a href={`#${target}`} className="bs-key tc" aria-label={`View transcript at ${clock}, ${line.speaker}`} onClick={event => {
      event.preventDefault()
      if (onSource) onSource(line)
      else setSource({ ...line })
    }}>{clock}</a>
  }

  function points(title, items, empty, actions = false) {
    return (
      <section aria-label={title}>
        <h3 className="bs-lbl">{title}</h3>
        {items.length ? <ul className="space-y-2">
          {items.map(point => (
            <li key={point.id} className="flex flex-wrap items-start gap-2 text-sm">
              {sourceLink(point.source)}
              <div className="min-w-0 flex-1 break-words">
                <p>{point.text}</p>
                {actions && point.owner && <p className="text-xs text-content-secondary">Owner · {point.owner}</p>}
              </div>
              {actions && (point.taskId ? (
                <Link className="bs-key sm" to={`/tasks?item=${encodeURIComponent(`action:${point.taskId}`)}`}
                  target={live ? '_blank' : undefined} rel={live ? 'noopener noreferrer' : undefined}>Open task</Link>
              ) : (
                <Key size="sm" disabled={disabled || loading || Boolean(request)}
                  onClick={() => void approve(point)}
                  aria-label={`Approve and create task for ${point.text}`}>
                  {request === point.id ? 'Creating task…' : 'Approve and create task'}
                </Key>
              ))}
            </li>
          ))}
        </ul> : <p className="bs-mut text-sm">{empty}</p>}
      </section>
    )
  }

  return (
    <section className="bs-cell space-y-3" aria-label="Live meeting insights">
      <Section title={live ? 'Summary so far' : 'Summary from the live transcript'} level={3}
        aside={<Key size="sm" disabled={disabled || loading || Boolean(request)} onClick={() => void refresh(true)}>
          {request === 'refresh' ? 'Updating…' : 'Refresh summary'}
        </Key>} />
      {loading ? <p role="status" className="bs-mut">Loading live notes…</p> : (
        <>
          {insights.throughMs != null && <p className="bs-mut text-xs">Updated through {formatClock(insights.throughMs)}</p>}
          {points('Summary', insights.summary, 'The summary will appear here after transcript lines are saved.')}
          {points('Draft decisions', insights.decisions, 'No decisions drafted yet.')}
          {points('Draft action items', insights.actions, 'No action items drafted yet.', true)}
        </>
      )}
      {source && (
        <section id={anchorId} ref={sourcePanel} tabIndex={-1} aria-label="Transcript source" className="rounded-lg border border-line p-3">
          <h3 className="bs-lbl">Transcript source · {formatClock(source.atMs)}</h3>
          <p className="text-sm"><b>{source.speaker}</b> {source.text}</p>
        </section>
      )}
      {error && <p role="alert" className="text-sm text-semantic-error">{error}</p>}
      {notice && <p role="status" className="text-sm">{notice}</p>}
    </section>
  )
}
