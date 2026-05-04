/**
 * MeetingIntelligencePanel (Frontend JSX version)
 * Self-contained panel for the MeetingDetail page.
 * Queries intelligence_profiles and meeting_intelligence_config directly via Supabase.
 */

import React, { useState, useEffect, useCallback } from 'react'
import { Brain, ChevronDown, ChevronUp, RefreshCw, X, Check, Sliders, Loader2 } from 'lucide-react'
import { supabase } from '../../services/supabaseClient'
import { ProfileIcon } from '../icons/AnimatedIcons'

// ==================== SUGGESTION ENGINE (inline) ====================

function evaluateKeywordRule(matchWords, searchText) {
  const matched = matchWords.filter(kw => searchText.includes(kw.toLowerCase()))
  if (matched.length === 0) return null
  const weight = matched.length / matchWords.length
  return { confidence: weight, reason: `Title contains "${matched.join('", "')}"` }
}

function suggestProfilesForMeeting(profiles, meeting) {
  const searchText = `${meeting.title || ''} ${meeting.description || ''}`.toLowerCase()
  const suggestions = []

  for (const profile of profiles) {
    const rules = Array.isArray(profile.suggest_when) ? profile.suggest_when : []
    let bestConfidence = 0
    let bestReason = ''

    for (const rule of rules) {
      const matchValues = Array.isArray(rule.match) ? rule.match : [rule.match]

      if (rule.type === 'keyword') {
        const result = evaluateKeywordRule(matchValues, searchText)
        if (result && result.confidence * rule.confidence > bestConfidence) {
          bestConfidence = result.confidence * rule.confidence
          bestReason = result.reason
        }
      } else if (rule.type === 'recurring') {
        const recurringKw = ['weekly', 'daily', 'biweekly', 'monthly', 'standup', 'sync', 'huddle']
        if (recurringKw.some(kw => searchText.includes(kw))) {
          if (rule.confidence > bestConfidence) {
            bestConfidence = rule.confidence
            bestReason = 'Recurring meeting pattern detected'
          }
        }
      } else if (rule.type === 'org_type') {
        const matched = matchValues.filter(t => searchText.includes(t.toLowerCase()))
        if (matched.length > 0 && rule.confidence > bestConfidence) {
          bestConfidence = rule.confidence
          bestReason = `Organization type: ${matched.join(', ')}`
        }
      }
    }

    if (bestConfidence >= 0.3) {
      suggestions.push({ profile, confidence: bestConfidence, reason: bestReason })
    }
  }

  return suggestions.sort((a, b) => b.confidence - a.confidence)
}

// ==================== FIELD RENDERER ====================

function FieldInput({ field, value, onChange }) {
  const style = {
    background: 'var(--bg-surface)',
    borderColor: 'var(--border-subtle)',
    color: 'var(--text-primary)',
  }

  if (field.type === 'textarea') {
    return (
      <textarea value={value || ''} onChange={e => onChange(e.target.value)}
        placeholder={field.placeholder} rows={2}
        className="w-full px-3 py-2 rounded-lg border text-sm resize-y focus:outline-none"
        style={style} />
    )
  }

  if (field.type === 'select') {
    return (
      <select value={value || ''} onChange={e => onChange(e.target.value)}
        className="w-full px-3 py-2 rounded-lg border text-sm focus:outline-none" style={style}>
        <option value="">Select...</option>
        {(field.options || []).map(opt => (
          <option key={opt.value} value={opt.value}>{opt.label}</option>
        ))}
      </select>
    )
  }

  if (field.type === 'date') {
    return (
      <input type="date" value={value || ''} onChange={e => onChange(e.target.value)}
        className="w-full px-3 py-2 rounded-lg border text-sm focus:outline-none" style={style} />
    )
  }

  return (
    <input type="text" value={value || ''} onChange={e => onChange(e.target.value)}
      placeholder={field.placeholder}
      className="w-full px-3 py-2 rounded-lg border text-sm focus:outline-none" style={style} />
  )
}

// ==================== MAIN COMPONENT ====================

export default function MeetingIntelligencePanel({
  meetingId,
  meetingTitle = '',
  meetingDescription = '',
  meetingTags = [],
  meetingParticipants = [],
}) {
  const [state, setState] = useState('loading') // loading | suggestions | configuring | saving | ready | dismissed
  const [expanded, setExpanded] = useState(true)
  const [profiles, setProfiles] = useState([])
  const [suggestions, setSuggestions] = useState([])
  const [selectedProfile, setSelectedProfile] = useState(null)
  const [fieldValues, setFieldValues] = useState({})
  const [additionalInstructions, setAdditionalInstructions] = useState('')
  const [existingConfig, setExistingConfig] = useState(null)

  // Load data on mount
  useEffect(() => {
    loadData()
  }, [meetingId])

  const loadData = async () => {
    setState('loading')
    try {
      // Load profiles and existing config in parallel
      const [profilesRes, configRes] = await Promise.all([
        supabase.from('intelligence_profiles').select('*').eq('is_active', true).order('name'),
        supabase.from('meeting_intelligence_config').select('*').eq('meeting_id', meetingId).single(),
      ])

      const allProfiles = profilesRes.data || []
      setProfiles(allProfiles)

      if (configRes.data && configRes.data.profile_id) {
        setExistingConfig(configRes.data)
        const profile = allProfiles.find(p => p.id === configRes.data.profile_id)
        if (profile) {
          setSelectedProfile(profile)
          setFieldValues(configRes.data.custom_field_values || {})
          setAdditionalInstructions(configRes.data.additional_instructions || '')
        }
        if (['context_ready', 'active', 'completed'].includes(configRes.data.status)) {
          setState('ready')
          return
        }
        if (configRes.data.profile_id) {
          setState('configuring')
          return
        }
      }

      // Run suggestions
      const results = suggestProfilesForMeeting(allProfiles, {
        title: meetingTitle,
        description: meetingDescription,
      })
      setSuggestions(results)
      setState('suggestions')
    } catch (err) {
      console.error('[MeetingIntelligencePanel] Load failed:', err)
      setState('suggestions')
    }
  }

  const selectProfile = useCallback((profile) => {
    setSelectedProfile(profile)
    setFieldValues({})
    setState('configuring')
  }, [])

  const handleAccept = useCallback(() => {
    if (suggestions.length > 0) selectProfile(suggestions[0].profile)
  }, [suggestions, selectProfile])

  const handleDismiss = useCallback(() => {
    setState('dismissed')
  }, [])

  const handleSave = useCallback(async () => {
    if (!selectedProfile) return
    setState('saving')

    try {
      await supabase.from('meeting_intelligence_config').upsert({
        meeting_id: meetingId,
        profile_id: selectedProfile.id,
        custom_field_values: fieldValues,
        additional_instructions: additionalInstructions || null,
        status: 'pending',
      }, { onConflict: 'meeting_id' })

      setExistingConfig({ profile_id: selectedProfile.id, status: 'pending' })
      setState('ready')

      // Broadcast a pre-meeting briefing to LV + Pulse so participants get
      // context. Fire-and-forget — failures here must not block save UX.
      const apiBase = import.meta.env.VITE_API_URL || ''
      fetch(`${apiBase}/api/intelligence/meeting-prep/${meetingId}/broadcast-briefing`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      }).catch(err => console.warn('[MeetingIntelligencePanel] briefing broadcast failed:', err?.message || err))
    } catch (err) {
      console.error('[MeetingIntelligencePanel] Save failed:', err)
      setState('configuring')
    }
  }, [selectedProfile, fieldValues, additionalInstructions, meetingId])

  const handleClear = useCallback(async () => {
    setSelectedProfile(null)
    setFieldValues({})
    setExistingConfig(null)

    try {
      await supabase.from('meeting_intelligence_config').delete().eq('meeting_id', meetingId)
    } catch { /* non-critical */ }

    const results = suggestProfilesForMeeting(profiles, { title: meetingTitle, description: meetingDescription })
    setSuggestions(results)
    setState('suggestions')
  }, [meetingId, profiles, meetingTitle, meetingDescription])

  // ==================== RENDER ====================

  if (state === 'loading') {
    return (
      <div className="vc p-4 flex items-center gap-2">
        <Loader2 className="w-4 h-4 animate-spin" style={{ color: 'var(--text-tertiary)' }} />
        <span className="text-sm" style={{ color: 'var(--text-tertiary)' }}>Loading intelligence...</span>
      </div>
    )
  }

  if (state === 'dismissed') {
    return (
      <button onClick={() => setState('suggestions')}
        className="text-xs px-3 py-1.5 rounded-lg border transition-all hover:opacity-80"
        style={{ borderColor: 'var(--border-subtle)', color: 'var(--text-tertiary)' }}>
        <Brain className="w-3 h-3 inline mr-1" /> Configure Intelligence Profile
      </button>
    )
  }

  return (
    <div className="vc overflow-hidden">
      {/* Header */}
      <button onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center justify-between px-5 py-3">
        <div className="flex items-center gap-2">
          <Brain className="w-4 h-4" style={{ color: 'var(--accent-primary)' }} />
          <span className="font-semibold text-sm" style={{ fontFamily: 'var(--font-display)', color: 'var(--text-primary)' }}>
            Meeting Intelligence
          </span>
          {selectedProfile && (
            <span className="text-xs px-2 py-0.5 rounded-full inline-flex items-center gap-1"
              style={{ background: 'var(--accent-primary-dim)', color: 'var(--accent-primary)' }}>
              <ProfileIcon emoji={selectedProfile.icon} size={14} /> {selectedProfile.name}
            </span>
          )}
          {state === 'ready' && (
            <span className="text-xs px-2 py-0.5 rounded-full"
              style={{ background: 'var(--accent-secondary-dim)', color: 'var(--accent-secondary)' }}>
              Ready
            </span>
          )}
        </div>
        {expanded ? <ChevronUp className="w-4 h-4" style={{ color: 'var(--text-tertiary)' }} />
                   : <ChevronDown className="w-4 h-4" style={{ color: 'var(--text-tertiary)' }} />}
      </button>

      {expanded && (
        <div className="px-5 pb-5 space-y-4">

          {/* Suggestion Banner */}
          {state === 'suggestions' && suggestions.length > 0 && (
            <div className="rounded-xl p-4 border" style={{
              background: 'var(--bg-elevated)',
              borderColor: suggestions[0].confidence >= 0.8 ? 'var(--accent-primary)' : 'var(--border-subtle)',
              boxShadow: suggestions[0].confidence >= 0.8 ? '0 0 20px var(--accent-primary-glow)' : undefined,
            }}>
              <div className="flex items-start gap-3">
                <ProfileIcon emoji={suggestions[0].profile.icon} size={28} />
                <div className="flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-semibold text-sm" style={{ color: 'var(--text-primary)' }}>
                      {suggestions[0].profile.name}
                    </span>
                    <span className="font-mono text-xs px-2 py-0.5 rounded-full"
                      style={{ background: 'var(--accent-tertiary-dim)', color: 'var(--accent-tertiary)' }}>
                      {Math.round(suggestions[0].confidence * 100)}% match
                    </span>
                  </div>
                  <p className="text-xs mt-0.5" style={{ color: 'var(--text-secondary)' }}>
                    {suggestions[0].reason}
                  </p>
                </div>
              </div>
              <div className="flex gap-2 mt-3">
                <button onClick={handleAccept}
                  className="px-4 py-1.5 rounded-lg text-sm font-medium text-white"
                  style={{ background: 'var(--accent-primary)' }}>
                  <Check className="w-3 h-3 inline mr-1" /> Accept
                </button>
                <button onClick={() => selectProfile(suggestions[0].profile)}
                  className="px-4 py-1.5 rounded-lg text-sm border"
                  style={{ borderColor: 'var(--border-subtle)', color: 'var(--text-primary)' }}>
                  <Sliders className="w-3 h-3 inline mr-1" /> Customize
                </button>
                <button onClick={handleDismiss}
                  className="px-3 py-1.5 rounded-lg text-sm"
                  style={{ color: 'var(--text-tertiary)' }}>
                  Dismiss
                </button>
              </div>
            </div>
          )}

          {/* Profile Grid */}
          {(state === 'suggestions' || state === 'configuring') && (
            <div>
              <p className="font-mono text-xs uppercase tracking-wider mb-2" style={{ color: 'var(--text-tertiary)' }}>
                {suggestions.length > 0 ? 'Or choose a profile' : 'Choose a profile'}
              </p>
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2">
                {profiles.map(profile => {
                  const isSelected = selectedProfile?.id === profile.id
                  const suggestion = suggestions.find(s => s.profile.id === profile.id)
                  return (
                    <button key={profile.id} onClick={() => selectProfile(profile)}
                      className="relative flex flex-col items-center gap-1.5 p-3 rounded-xl border text-center transition-all duration-200 hover:scale-[1.02]"
                      style={{
                        background: isSelected ? 'var(--accent-primary-dim)' : 'var(--bg-surface)',
                        borderColor: isSelected ? 'var(--accent-primary)' : suggestion ? 'var(--accent-tertiary)' : 'var(--border-subtle)',
                        boxShadow: isSelected ? '0 0 16px var(--accent-primary-glow)' : undefined,
                      }}>
                      {suggestion && (
                        <span className="absolute -top-1 -right-1 font-mono text-[10px] px-1 py-0.5 rounded-full"
                          style={{ background: 'var(--accent-tertiary)', color: '#000' }}>
                          {Math.round(suggestion.confidence * 100)}%
                        </span>
                      )}
                      <ProfileIcon emoji={profile.icon} size={22} />
                      <span className="text-xs font-medium leading-tight" style={{ color: 'var(--text-primary)' }}>
                        {profile.name}
                      </span>
                    </button>
                  )
                })}
              </div>
            </div>
          )}

          {/* Profile Description */}
          {selectedProfile && state === 'configuring' && (
            <p className="text-sm rounded-lg p-3" style={{ background: 'var(--bg-elevated)', color: 'var(--text-secondary)' }}>
              {selectedProfile.description}
            </p>
          )}

          {/* Custom Fields */}
          {selectedProfile && state === 'configuring' && (selectedProfile.custom_fields || []).length > 0 && (
            <div>
              <p className="font-mono text-xs uppercase tracking-wider mb-2" style={{ color: 'var(--text-tertiary)' }}>
                Profile Configuration
              </p>
              <div className="space-y-3">
                {(selectedProfile.custom_fields || []).map(field => (
                  <div key={field.key}>
                    <label className="flex items-center gap-1 mb-1">
                      <span className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>{field.label}</span>
                      {field.required && <span style={{ color: 'var(--accent-primary)' }}>*</span>}
                    </label>
                    <FieldInput
                      field={field}
                      value={fieldValues[field.key]}
                      onChange={val => setFieldValues(prev => ({ ...prev, [field.key]: val }))}
                    />
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Ready state */}
          {state === 'ready' && selectedProfile && (
            <div className="rounded-lg p-3 flex items-center gap-2"
              style={{ background: 'var(--accent-secondary-dim)' }}>
              <Check className="w-4 h-4" style={{ color: 'var(--accent-secondary)' }} />
              <span className="text-sm" style={{ color: 'var(--accent-secondary)' }}>
                Intelligence profile configured. Gemini will use specialized analysis for this meeting.
              </span>
            </div>
          )}

          {/* Additional Instructions */}
          {selectedProfile && (state === 'configuring' || state === 'ready') && (
            <div>
              <label className="font-mono text-xs uppercase tracking-wider" style={{ color: 'var(--text-tertiary)' }}>
                Additional Instructions (optional)
              </label>
              <textarea value={additionalInstructions}
                onChange={e => setAdditionalInstructions(e.target.value)}
                placeholder="Any specific focus or instructions..."
                rows={2} className="w-full mt-1 px-3 py-2 rounded-lg border text-sm resize-y focus:outline-none"
                style={{ background: 'var(--bg-surface)', borderColor: 'var(--border-subtle)', color: 'var(--text-primary)' }} />
            </div>
          )}

          {/* Action Buttons */}
          <div className="flex items-center gap-2">
            {state === 'configuring' && selectedProfile && (
              <button onClick={handleSave}
                className="px-4 py-2 rounded-lg text-sm font-medium text-white transition-all hover:opacity-90"
                style={{ background: 'var(--accent-primary)' }}>
                Save & Activate
              </button>
            )}
            {state === 'saving' && (
              <button disabled className="px-4 py-2 rounded-lg text-sm font-medium text-white opacity-50"
                style={{ background: 'var(--accent-primary)' }}>
                <Loader2 className="w-3 h-3 inline mr-1 animate-spin" /> Saving...
              </button>
            )}
            {selectedProfile && (
              <button onClick={handleClear}
                className="px-3 py-2 rounded-lg text-sm border transition-all hover:opacity-80"
                style={{ borderColor: 'var(--border-subtle)', color: 'var(--text-secondary)' }}>
                Clear Profile
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
