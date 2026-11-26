import React, { useCallback, useEffect, useId, useLayoutEffect, useRef, useState } from 'react'
import { RefreshCw, Settings } from 'lucide-react'
import ReactMarkdown from 'react-markdown'
import api, { meetingsApi } from '../../services/api'
import { Key } from '../bench'
import { useToast } from '../vc/ToastProvider'
import MeetingPrepCard from './MeetingPrepCard'
import DealRiskAlertCard from './DealRiskAlertCard'
import ActionItemStatusCard from './ActionItemStatusCard'
import QuickScheduleModal from './QuickScheduleModal'
import QuickTaskModal from './QuickTaskModal'
import ReassignModal from './ReassignModal'

const PREFS_KEY = 'entomate_intelligence_prefs'
const CARD_OPTIONS = [
  ['showMeetingPrep', 'Meeting preparation'],
  ['showDealRisks', 'Deal risk alerts'],
  ['showActionItems', 'Action item tracking'],
]
const RISK_LEVELS = ['low', 'medium', 'high', 'critical']
const DEFAULT_PREFS = {
  showMeetingPrep: true,
  showDealRisks: true,
  showActionItems: true,
  dealRiskFilter: ['medium', 'high', 'critical'],
  timeHorizon: { meetings: 24 },
}

function readPreferences() {
  try {
    const saved = JSON.parse(localStorage.getItem(PREFS_KEY))
    if (saved && typeof saved === 'object') {
      const hours = saved.timeHorizon?.meetings
      return {
        ...DEFAULT_PREFS,
        ...saved,
        dealRiskFilter: Array.isArray(saved.dealRiskFilter)
          ? RISK_LEVELS.filter(level => saved.dealRiskFilter.includes(level))
          : DEFAULT_PREFS.dealRiskFilter,
        timeHorizon: {
          ...saved.timeHorizon,
          meetings: Number.isInteger(hours) && hours >= 1 && hours <= 168 ? hours : DEFAULT_PREFS.timeHorizon.meetings,
        },
      }
    }
  } catch { /* An unreadable preference can use the defaults. */ }
  return DEFAULT_PREFS
}

export default function IntelligenceDashboard() {
  const toast = useToast()
  const [preferences, setPreferences] = useState(readPreferences)
  const [intelligence, setIntelligence] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [showCustomize, setShowCustomize] = useState(false)
  const [quickAction, setQuickAction] = useState(null)
  const [brief, setBrief] = useState(null)
  const requestRef = useRef(null)
  const viewHeading = useRef(null)
  const customizeKey = useRef(null)
  const restoreCustomizeFocus = useRef(false)

  const loadIntelligence = useCallback(async () => {
    requestRef.current?.abort()
    const request = new AbortController()
    requestRef.current = request
    setLoading(true)
    setError(null)
    try {
      const result = await api.intelligence.getDashboard({
        riskFilter: preferences.dealRiskFilter.join(','),
        meetingHours: preferences.timeHorizon.meetings,
      }, request.signal)
      if (!result?.success || !result.data) throw new Error(result?.error || 'Could not load briefings.')
      if (!request.signal.aborted) setIntelligence(result.data)
    } catch (err) {
      if (!request.signal.aborted) setError(err.message || 'Could not load briefings.')
    } finally {
      if (!request.signal.aborted) setLoading(false)
    }
  }, [preferences])

  useEffect(() => {
    void loadIntelligence()
    const interval = setInterval(loadIntelligence, 5 * 60 * 1000)
    return () => {
      clearInterval(interval)
      requestRef.current?.abort()
    }
  }, [loadIntelligence])

  useLayoutEffect(() => {
    if (showCustomize || brief) viewHeading.current?.focus()
    else if (restoreCustomizeFocus.current) {
      restoreCustomizeFocus.current = false
      customizeKey.current?.focus()
    }
  }, [showCustomize, brief])

  const savePreferences = (next) => {
    try { localStorage.setItem(PREFS_KEY, JSON.stringify(next)) } catch { /* Apply for this visit. */ }
    setPreferences(next)
    setShowCustomize(false)
  }

  const handleMeetingAction = async (action, meeting) => {
    if (action === 'scheduleFollowUp') {
      setQuickAction({ type: 'schedule', context: { title: `Follow-up: ${meeting.title}`, relatedId: meeting.id } })
    } else if (action === 'prepareBrief') {
      const pending = { loading: true }
      setBrief(pending)
      try {
        const result = await api.intelligence.generateMeetingBrief(meeting.id)
        if (!result?.success || !result.data?.brief) throw new Error('Could not prepare this meeting brief.')
        setBrief(current => current === pending ? { content: result.data.brief } : current)
      } catch (err) {
        setBrief(current => current === pending ? { error: err.message } : current)
      }
    }
  }

  const handleRiskAction = (action, dealId) => {
    if (action === 'scheduleCall') {
      setQuickAction({ type: 'schedule', context: { title: 'Follow-up call', relatedId: dealId } })
    } else if (action === 'createTask') {
      setQuickAction({ type: 'task', context: { description: `Follow-up task for deal ${dealId}`, priority: 'high', source: 'deal_risk', relatedId: dealId } })
    }
  }

  const handleActionItemAction = async (action, itemId, currentAssignee) => {
    if (action === 'reassign') {
      setQuickAction({ type: 'reassign', itemId, currentAssignee })
      return
    }
    try {
      if (action === 'nudge') {
        await meetingsApi.nudgeActionItem(itemId)
        toast.success('Nudge sent')
      } else if (action === 'complete') {
        await meetingsApi.updateActionItem(itemId, { status: 'done' })
        toast.success('Action item completed')
        void loadIntelligence()
      }
    } catch (err) {
      toast.error('Could not update the action item', err.message)
    }
  }

  if (showCustomize) {
    return <BriefingPreferences headingRef={viewHeading} preferences={preferences} onSave={savePreferences} onCancel={() => setShowCustomize(false)} />
  }

  if (brief) {
    return (
      <section className="bs-briefings">
        <div className="bs-briefings-bar">
          <h2 ref={viewHeading} tabIndex={-1}>Meeting brief</h2>
          <Key size="sm" onClick={() => setBrief(null)}>Back</Key>
        </div>
        {brief.loading && <p className="bs-today-empty" role="status">Preparing brief…</p>}
        {brief.error && <p role="alert">{brief.error}</p>}
        {brief.content && <div className="bs-briefings-document"><ReactMarkdown>{brief.content}</ReactMarkdown></div>}
      </section>
    )
  }

  const meetings = preferences.showMeetingPrep ? intelligence?.meetingPrep?.cards || [] : []
  const risks = preferences.showDealRisks ? intelligence?.dealRisks?.cards || [] : []
  const actionItems = preferences.showActionItems ? intelligence?.actionItems : null
  const showActionItems = actionItems?.summary?.total > 0

  return (
    <div className="bs-briefings">
      <div className="bs-briefings-bar">
        <p className="bs-today-empty">Meeting prep, deal risks, and action items.</p>
        <div className="bs-briefings-keys">
          <Key size="sm" iconOnly icon={<RefreshCw aria-hidden="true" />} aria-label="Refresh briefings" title="Refresh briefings" disabled={loading} onClick={loadIntelligence} />
          <Key size="sm" iconOnly icon={<Settings aria-hidden="true" />} aria-label="Customize briefings" title="Customize briefings" ref={customizeKey}
            onClick={() => { restoreCustomizeFocus.current = true; setShowCustomize(true) }} />
        </div>
      </div>

      {error && (
        <div className="bs-briefings-bar">
          <p role="alert">{error}</p>
          <Key size="sm" onClick={loadIntelligence}>Retry</Key>
        </div>
      )}
      {loading && !intelligence && <p className="bs-today-empty" role="status">Loading briefings…</p>}
      {!loading && !error && !meetings.length && !risks.length && !showActionItems && (
        <p className="bs-briefings-empty" role="status">No briefings match your preferences.</p>
      )}
      {meetings.length > 0 && (
        <section className="bs-briefings-section">
          <h2>Meeting preparation</h2>
          {meetings.map(meeting => <MeetingPrepCard key={meeting.meeting.id} data={meeting} onAction={handleMeetingAction} />)}
        </section>
      )}
      {risks.length > 0 && (
        <section className="bs-briefings-section">
          <h2>Deal risk alerts</h2>
          {risks.map(risk => <DealRiskAlertCard key={risk.deal.id} data={risk} onAction={handleRiskAction} />)}
        </section>
      )}
      {showActionItems && <ActionItemStatusCard data={actionItems} onAction={handleActionItemAction} />}

      {quickAction?.type === 'schedule' && <QuickScheduleModal isOpen context={quickAction.context} onClose={() => setQuickAction(null)} />}
      {quickAction?.type === 'task' && <QuickTaskModal isOpen context={quickAction.context} onClose={() => setQuickAction(null)} />}
      {quickAction?.type === 'reassign' && <ReassignModal isOpen itemId={quickAction.itemId} currentAssignee={quickAction.currentAssignee}
        onClose={() => setQuickAction(null)} onReassigned={loadIntelligence} />}
    </div>
  )
}

function BriefingPreferences({ headingRef, preferences, onSave, onCancel }) {
  const hoursId = useId()
  const [draft, setDraft] = useState(preferences)
  const updateRisk = (level, checked) => setDraft(current => ({
    ...current,
    dealRiskFilter: checked ? [...current.dealRiskFilter, level] : current.dealRiskFilter.filter(risk => risk !== level),
  }))

  return (
    <form className="bs-briefings" onSubmit={event => {
      event.preventDefault()
      onSave({ ...draft, timeHorizon: { ...draft.timeHorizon, meetings: Number(draft.timeHorizon.meetings) } })
    }}>
      <h2 ref={headingRef} tabIndex={-1}>Briefing preferences</h2>
      <fieldset>
        <legend className="bs-lbl">Show cards</legend>
        {CARD_OPTIONS.map(([name, label]) => (
          <label key={name}>
            <input type="checkbox" checked={draft[name]} onChange={event => setDraft({ ...draft, [name]: event.target.checked })} />
            {label}
          </label>
        ))}
      </fieldset>
      <fieldset>
        <legend className="bs-lbl">Deal risk levels</legend>
        {RISK_LEVELS.map(level => (
          <label key={level} className="capitalize">
            <input type="checkbox" checked={draft.dealRiskFilter.includes(level)} onChange={event => updateRisk(level, event.target.checked)} />
            {level}
          </label>
        ))}
      </fieldset>
      <div className="bs-briefings-hours">
        <label htmlFor={hoursId}>Meetings (hours ahead)</label>
        <input id={hoursId} className="bs-input" type="number" required min="1" max="168" value={draft.timeHorizon.meetings}
          onChange={event => setDraft({ ...draft, timeHorizon: { ...draft.timeHorizon, meetings: event.target.value } })} />
      </div>
      <div className="bs-briefings-keys">
        <Key onClick={onCancel}>Cancel</Key>
        <Key type="submit" variant="primary">Save preferences</Key>
      </div>
    </form>
  )
}
