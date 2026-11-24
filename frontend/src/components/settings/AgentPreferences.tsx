import React, { useEffect, useRef, useState } from 'react'
import { settingsApi } from '../../services/api'
import { priorityWord } from '../../services/tasksView'
import type { WorkPriority } from '../../services/tasksView'
import { Key } from '../bench'

type Agent = 'Owner' | 'Priority'
type Decision = 'approve' | 'dismiss' | 'disable'
interface PreferenceScope {
  scopeKey: string
  meetingTitle: string
  itemTitle: string
  evidence: { from: string; to: string; correctedAt: string }[]
}
type Preference = PreferenceScope & ({ memberId: string; memberName: string | null } | { value: WorkPriority; label: string })
interface Preferences { suggested: Preference[]; active: Preference[] }
interface Props { workspaceId: string; canReview: boolean }

export default function AgentPreferences({ initialAgent = 'Owner', ...props }: Props & { initialAgent?: Agent }) {
  const [agent, setAgent] = useState<Agent>(initialAgent)
  return (
    <>
      <div className="bs-agent-pref-actions" role="group" aria-label="Meeting agent">
        {(['Owner', 'Priority'] as const).map(name => (
          <Key key={name} size="sm" variant={name === agent ? 'primary' : 'plain'} aria-pressed={name === agent} onClick={() => setAgent(name)}>{name}</Key>
        ))}
      </div>
      <PreferenceList key={`${props.workspaceId}:${agent}`} {...props} agent={agent} />
    </>
  )
}

function PreferenceList({ workspaceId, canReview, agent }: Props & { agent: Agent }) {
  const load = agent === 'Priority' ? settingsApi.getPriorityPreferences : settingsApi.getOwnerPreferences
  const [data, setData] = useState<Preferences | null>(null)
  const [revision, setRevision] = useState(0)
  const [busy, setBusy] = useState(false)
  const [loadError, setLoadError] = useState(false)
  const [message, setMessage] = useState('')
  const [decisionError, setDecisionError] = useState('')
  const statusRef = useRef<HTMLParagraphElement>(null)

  useEffect(() => {
    if (message) statusRef.current?.focus({ preventScroll: true })
  }, [message])

  useEffect(() => {
    let cancelled = false
    load(workspaceId).then((result) => {
      if (!cancelled) setData(result as unknown as Preferences)
    }).catch(() => {
      if (!cancelled) setLoadError(true)
    })
    return () => { cancelled = true }
  }, [workspaceId, revision, load])

  const reload = () => {
    setLoadError(false)
    setData(null)
    setRevision(value => value + 1)
  }

  const review = async (preference: Preference, decision: Decision) => {
    setBusy(true)
    setDecisionError('')
    setMessage('')
    try {
      if ('value' in preference) {
        await settingsApi.decidePriorityPreference(workspaceId, preference.scopeKey, preference.value, decision)
      } else {
        await settingsApi.decideOwnerPreference(workspaceId, preference.scopeKey, preference.memberId, decision)
      }
      setMessage({ approve: 'Preference approved.', dismiss: 'Suggestion dismissed.', disable: 'Preference turned off.' }[decision])
      reload()
    } catch (cause) {
      const stale = (cause as { status?: number })?.status === 409
      setDecisionError(stale ? 'This preference changed while you were reviewing it.' : 'Could not save that decision. Try again.')
      if (stale) reload()
    } finally {
      setBusy(false)
    }
  }

  return (
    <div>
      <p className="bs-set-note">Entomate can suggest a preference when the same {agent} correction recurs on the same action item across at least three meetings with the same title.</p>
      <p className="bs-set-note">{agent === 'Owner' ? 'Approved preferences apply to matching action items that need an owner.' : 'Approved preferences set the priority on matching action items.'} Workspace owners and admins can approve, dismiss, or turn them off.</p>
      {message && <p ref={statusRef} className="bs-set-note" role="status" tabIndex={-1}>{message}</p>}
      {decisionError && <p className="bs-set-note bs-set-err" role="alert">{decisionError}</p>}
      {loadError ? (
        <div><p className="bs-set-note bs-set-err" role="alert">Could not load {agent} preferences.</p><Key size="sm" onClick={reload}>Try again</Key></div>
      ) : !data ? <p className="bs-set-note" role="status">Loading {agent} preferences…</p> : (
        <>
          {([
            { title: 'Suggested preferences', rows: data.suggested, empty: 'No suggestions to review.', active: false },
            { title: 'Active preferences', rows: data.active, empty: 'No approved preferences yet.', active: true },
          ]).map(group => (
            <section key={group.title} aria-label={group.title}>
              <div className="bs-set-sub"><h2 className="bs-h3">{group.title}</h2></div>
              {group.rows.length === 0 ? <p className="bs-set-note">{group.empty}</p> : (
                <ul className="bs-agent-pref-list">
                  {group.rows.map(preference => (
                    <li key={preference.scopeKey} className="bs-agent-pref">
                      <div className="bs-agent-pref-scope"><b>{preference.itemTitle}</b><span>{preference.meetingTitle}</span></div>
                      {'value' in preference ? <p className="bs-set-note">Set priority to <strong>{preference.label}</strong></p> : (
                        <p className="bs-set-note">{preference.memberName ? <>Prefer <strong>{preference.memberName}</strong></> : 'Paused because the preferred owner is unavailable.'}</p>
                      )}
                      <details>
                        <summary tabIndex={0}>Supporting corrections</summary>
                        <ul>
                          {preference.evidence.map(({ from, to, correctedAt }, i) => (
                            <li key={`${correctedAt}-${i}`}>
                              <time dateTime={correctedAt}>{new Date(correctedAt).toLocaleDateString(undefined, { dateStyle: 'medium' })}</time>
                              <span>{'value' in preference ? `${priorityWord(from as WorkPriority)} changed to ${priorityWord(to as WorkPriority)}` : `${from} changed to ${to}`}</span>
                            </li>
                          ))}
                        </ul>
                      </details>
                      {canReview && (
                        <div className="bs-agent-pref-actions">
                          {group.active ? <Key size="sm" disabled={busy} onClick={() => { void review(preference, 'disable') }}>Turn off</Key> : (
                            <>
                              <Key size="sm" variant="primary" disabled={busy} onClick={() => { void review(preference, 'approve') }}>Approve</Key>
                              <Key size="sm" disabled={busy} onClick={() => { void review(preference, 'dismiss') }}>Dismiss</Key>
                            </>
                          )}
                        </div>
                      )}
                    </li>
                  ))}
                </ul>
              )}
            </section>
          ))}
        </>
      )}
    </div>
  )
}
