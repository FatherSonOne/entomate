import React, { useEffect, useId, useRef, useState } from 'react'
import {
  ArrowLeft, Check, ChevronRight, ClipboardList, FileCheck2, Handshake, Landmark,
  ListChecks, MessageCircle, Route, Target,
} from 'lucide-react'
import { Key, TextArea, TextInput } from '../bench'
import { supabase } from '../../services/supabaseClient'
import './meetingIntelligence.css'

const presets = {
  'board-meeting': [Landmark, 'Motions, votes and governance decisions'],
  'client-check-in': [MessageCircle, 'Client feedback, open issues and renewal risks'],
  'grant-specialist': [ClipboardList, 'Deliverables, budgets and reporting requirements'],
  'internal-standup': [ListChecks, 'Progress, blockers and commitments'],
  'sales-discovery': [Target, 'Buyer needs, objections and next steps'],
  'strategic-planning': [Route, 'Priorities, trade-offs and milestones'],
  'vendor-negotiation': [Handshake, 'Pricing, terms and concessions'],
}

function descriptionFor(profile) {
  return presets[profile.slug]?.[1] || profile.description
}

function ProfileMark({ profile }) {
  const Icon = presets[profile.slug]?.[0] || FileCheck2
  return <span className="mip-mark"><Icon aria-hidden="true" size={19} strokeWidth={1.65} /></span>
}

function suggestProfile(profiles, title, description) {
  const normalize = value => ` ${value.toLowerCase().replace(/[^\p{L}\p{N}]+/gu, ' ').trim()} `
  const text = normalize(`${title || ''} ${description || ''}`)
  let best
  let score = 0
  for (const profile of profiles) {
    for (const rule of Array.isArray(profile.suggest_when) ? profile.suggest_when : []) {
      const count = [rule.match].flat().filter(word => typeof word === 'string' && word.trim() && text.includes(normalize(word))).length
      const nextScore = Number(rule.confidence) * count
      if (nextScore > score) {
        best = profile.id
        score = nextScore
      }
    }
  }
  return best
}

function ProfileField({ field, value, onChange }) {
  const id = useId()
  const props = {
    id, value: value ?? '', required: Boolean(field.required),
    onChange: event => onChange(event.target.value),
  }

  return (
    <div className="mip-field">
      <label htmlFor={id}>{field.label}{field.required && <span> (required)</span>}</label>
      {field.type === 'select' ? (
        <select className="bs-input" {...props}>
          <option value="">Choose an option</option>
          {(field.options || []).map(option => <option key={option.value} value={option.value}>{option.label}</option>)}
        </select>
      ) : field.type === 'textarea' ? (
        <TextArea rows={2} placeholder={field.placeholder} maxLength={2000} {...props} />
      ) : (
        <TextInput type={field.type === 'date' ? 'date' : 'text'} placeholder={field.placeholder} maxLength={500} {...props} />
      )}
    </div>
  )
}

export default function MeetingIntelligencePanel({ meetingId, meetingTitle, meetingDescription, canRewrite, onRewrite }) {
  const [data, setData] = useState(null)
  const [reload, setReload] = useState(0)
  const [loadError, setLoadError] = useState(false)
  const [draft, setDraft] = useState(null)
  const [browsing, setBrowsing] = useState(false)
  const [busy, setBusy] = useState('')
  const [message, setMessage] = useState(null)
  const heading = useRef(null)
  const moveFocus = useRef(false)
  const notesId = useId()

  useEffect(() => {
    let current = true
    const load = async () => {
      try {
        const [catalog, settings] = await Promise.all([
          supabase.from('intelligence_profiles')
            .select('id, name, slug, description, custom_fields, focus_areas, suggest_when, is_active')
            .order('name'),
          supabase.from('meeting_intelligence_config')
            .select('profile_id, custom_field_values, additional_instructions')
            .eq('meeting_id', meetingId).maybeSingle(),
        ])
        if (catalog.error || settings.error) throw catalog.error || settings.error
        if (current) setData({ profiles: catalog.data || [], saved: settings.data })
      } catch {
        if (current) setLoadError(true)
      }
    }
    load()
    return () => { current = false }
  }, [meetingId, reload])

  const savedProfile = data?.profiles.find(profile => profile.id === data.saved?.profile_id)
  const view = draft ? 'setup' : data?.saved?.profile_id && !browsing ? 'saved' : 'catalog'
  useEffect(() => {
    if (moveFocus.current) {
      heading.current?.focus()
      moveFocus.current = false
    }
  }, [view])

  function openProfile(profile) {
    const settings = data.saved?.profile_id === profile.id ? data.saved : null
    moveFocus.current = true
    setMessage(null)
    setDraft({ profile, values: settings?.custom_field_values || {}, notes: settings?.additional_instructions || '' })
  }

  async function saveProfile(event) {
    event.preventDefault()
    if (busy) return
    const fields = draft.profile.custom_fields || []
    if (fields.some(field => field.required && !String(draft.values[field.key] ?? '').trim())) {
      setMessage({ error: true, text: 'Fill in the required profile fields.' })
      return
    }
    setBusy('save')
    setMessage(null)
    try {
      const values = {
        profile_id: draft.profile.id,
        custom_field_values: draft.values,
        additional_instructions: draft.notes.trim() || null,
      }
      const switching = data.saved?.profile_id !== draft.profile.id
      const { error } = await supabase.from('meeting_intelligence_config').upsert({
        meeting_id: meetingId, ...values,
        ...(switching ? { status: 'pending', assembled_context: {}, context_assembled_at: null, composed_prompt: null } : {}),
      }, { onConflict: 'meeting_id' })
      if (error) throw error
      moveFocus.current = true
      setData({ ...data, saved: values })
      setDraft(null)
      setBrowsing(false)
      setMessage({ text: 'Profile saved.' })
    } catch {
      setMessage({ error: true, text: 'The profile could not be saved. Your changes are still here. Try again.' })
    } finally {
      setBusy('')
    }
  }

  async function removeProfile() {
    if (busy) return
    setBusy('remove')
    setMessage(null)
    try {
      const { data: removed, error } = await supabase.from('meeting_intelligence_config')
        .delete().eq('meeting_id', meetingId).select('meeting_id').maybeSingle()
      if (error || !removed) throw error || new Error('Profile settings were not removed')
      moveFocus.current = true
      setData({ ...data, saved: null })
      setMessage({ text: 'Profile removed.' })
    } catch {
      setMessage({ error: true, text: 'The profile could not be removed. Try again.' })
    } finally {
      setBusy('')
    }
  }

  async function rewrite() {
    if (busy) return
    setBusy('rewrite')
    setMessage(null)
    try {
      await onRewrite()
      setMessage({ text: 'Summary updated. Open the Minutes tab to read it.' })
    } catch {
      setMessage({ error: true, text: 'The summary could not be rewritten. Try again.' })
    } finally {
      setBusy('')
    }
  }

  const fields = draft?.profile.custom_fields || []
  const activeProfiles = data?.profiles.filter(profile => profile.is_active) || []
  const suggestedId = view === 'catalog' && suggestProfile(activeProfiles, meetingTitle, meetingDescription)
  const focus = (draft?.profile || savedProfile)?.focus_areas
  const focusLabels = Array.isArray(focus) ? focus.map(area => area?.label).filter(Boolean) : []

  return (
    <div className="mip">
      {loadError ? (
        <div className="mip-notice">
          <p role="alert">Intelligence profiles couldn’t be loaded.</p>
          <Key onClick={() => { setLoadError(false); setReload(value => value + 1) }}>Try again</Key>
        </div>
      ) : !data ? (
        <p className="mip-notice" role="status">Loading profiles…</p>
      ) : view === 'catalog' ? (
        <>
          {browsing && (
            <Key size="sm" icon={<ArrowLeft aria-hidden="true" />} onClick={() => { moveFocus.current = true; setBrowsing(false) }}>
              Back to saved profile
            </Key>
          )}
          <header className="mip-heading">
            <h2 ref={heading} tabIndex={-1}>Choose a meeting profile</h2>
            <p>Tell Entomate what to listen for when it writes the summary and finds action items.</p>
          </header>
          {activeProfiles.length ? (
            <ul className="mip-list">
              {activeProfiles.map(profile => (
                <li key={profile.id}>
                  <button type="button" className="mip-option" onClick={() => openProfile(profile)}>
                    <ProfileMark profile={profile} />
                    <span className="mip-option-text">
                      <strong>{profile.name}</strong>
                      <span>{descriptionFor(profile)}</span>
                    </span>
                    {profile.id === savedProfile?.id ? <span className="mip-label">Saved</span>
                      : profile.id === suggestedId ? <span className="mip-label">Suggested</span> : null}
                    <ChevronRight className="mip-chevron" size={16} aria-hidden="true" />
                  </button>
                </li>
              ))}
            </ul>
          ) : <p className="mip-notice">There are no active profiles available for this meeting.</p>}
        </>
      ) : view === 'setup' ? (
        <form className="mip-form" onSubmit={saveProfile}>
          <Key size="sm" disabled={Boolean(busy)} icon={<ArrowLeft aria-hidden="true" />}
            onClick={() => { moveFocus.current = true; setDraft(null); setMessage(null) }}>
            {browsing || !savedProfile ? 'Back to profiles' : 'Back to saved profile'}
          </Key>
          <div className="mip-profile">
            <ProfileMark profile={draft.profile} />
            <header className="mip-heading">
              <h2 ref={heading} tabIndex={-1}>{draft.profile.name}</h2>
              <p>{draft.profile.description || descriptionFor(draft.profile)}</p>
            </header>
          </div>
          {focusLabels.length > 0 && <p className="mip-focus"><strong>Analysis focus</strong>{focusLabels.join(' · ')}</p>}
          <fieldset className="mip-fields" disabled={Boolean(busy)}>
            {fields.map(field => (
              <ProfileField key={field.key} field={field} value={draft.values[field.key]}
                onChange={value => setDraft({ ...draft, values: { ...draft.values, [field.key]: value } })} />
            ))}
            <div className="mip-field">
              <label htmlFor={notesId}>Additional instructions <span>(optional)</span></label>
              <TextArea id={notesId} rows={3} maxLength={2000} value={draft.notes}
                placeholder="What should the AI pay particular attention to?"
                onChange={event => setDraft({ ...draft, notes: event.target.value })} />
            </div>
          </fieldset>
          <p className="mip-help">People with access to this meeting can see these details.</p>
          <div className="mip-actions">
            <Key type="submit" variant="primary" disabled={Boolean(busy)}>{busy === 'save' ? 'Saving…' : 'Save profile'}</Key>
          </div>
        </form>
      ) : (
        <>
          <div className="mip-profile">
            {savedProfile && <ProfileMark profile={savedProfile} />}
            <header className="mip-heading">
              <h2 ref={heading} tabIndex={-1}>{savedProfile?.name || 'Saved profile unavailable'}</h2>
              <p>{savedProfile?.is_active ? <><Check size={14} aria-hidden="true" /> Saved for this meeting</>
                : 'Choose an active profile to guide the next summary.'}</p>
            </header>
          </div>
          {focusLabels.length > 0 && <p className="mip-focus"><strong>Analysis focus</strong>{focusLabels.join(' · ')}</p>}
          <p className="mip-help">{canRewrite && savedProfile?.is_active
            ? 'Rewrite summary updates the summary, key points and decisions from the transcript. It keeps existing action items.'
            : 'An active profile guides the next summary and initial action-item extraction.'}</p>
          <div className="mip-actions">
            {canRewrite && savedProfile?.is_active && (
              <Key variant="primary" onClick={rewrite} disabled={Boolean(busy)}>{busy === 'rewrite' ? 'Rewriting…' : 'Rewrite summary'}</Key>
            )}
            {savedProfile?.is_active && <Key onClick={() => openProfile(savedProfile)} disabled={Boolean(busy)}>Edit details</Key>}
            <Key onClick={() => { moveFocus.current = true; setBrowsing(true); setMessage(null) }} disabled={Boolean(busy)}>Change profile</Key>
            <Key onClick={removeProfile} disabled={Boolean(busy)}>{busy === 'remove' ? 'Removing…' : 'Remove profile'}</Key>
          </div>
        </>
      )}
      {message && <p className="mip-notice" role={message.error ? 'alert' : 'status'}>{message.text}</p>}
    </div>
  )
}
