import React, { useEffect, useId, useState } from 'react'
import { Key, Select } from '../bench'
import { supabase } from '../../services/supabaseClient'
import './meetingIntelligence.css'

type Profile = {
  id: string
  name: string
  focus_areas: { label?: string }[] | null
}

export default function MeetingProfileField({ value, onChange, disabled = false }: {
  value: string
  onChange: (value: string) => void
  disabled?: boolean
}) {
  const id = useId()
  const [catalog, setCatalog] = useState<Profile[] | null>(null)
  const [failed, setFailed] = useState(false)
  const [attempt, setAttempt] = useState(0)

  useEffect(() => {
    let active = true
    const load = async () => {
      try {
        const { data, error } = await supabase.from('intelligence_profiles')
          .select('id, name, focus_areas').eq('is_active', true).order('name')
        if (error) throw error
        if (active) setCatalog(data || [])
      } catch {
        if (active) setFailed(true)
      }
    }
    void load()
    return () => { active = false }
  }, [attempt])

  const selected = catalog?.find(profile => profile.id === value)
  const focus = Array.isArray(selected?.focus_areas)
    ? selected.focus_areas.map(area => area?.label).filter(Boolean).slice(0, 3).join(' · ')
    : ''
  const options = [
    { value: '', label: 'General' },
    ...(value && catalog && !selected ? [{ value, label: 'Saved profile unavailable', disabled: true }] : []),
    ...(catalog || []).map(profile => ({ value: profile.id, label: profile.name })),
  ]

  return (
    <div className="mip-launch-field">
      <label className="bs-lbl" htmlFor={id}>Intelligence profile</label>
      <Select id={id} sheetLabel="Intelligence profile" value={value} options={options} onChange={onChange}
        disabled={disabled || (!catalog && !failed)} />
      {failed ? (
        <div className="mip-launch-help">
          <p role="status">Profiles couldn’t be loaded. General is available.</p>
          <Key size="sm" disabled={disabled} onClick={() => { setFailed(false); setAttempt(count => count + 1) }}>Try again</Key>
        </div>
      ) : <p className="mip-launch-help">{focus ? `First summary will focus on ${focus}.` : 'Sets the focus for the first summary and action items.'}</p>}
    </div>
  )
}
