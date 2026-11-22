import React, { useState, useMemo } from 'react'
import { Key, TextInput } from '../bench'
import { AuthProblemLine } from '../signin/AuthFrame'
import { useOrg } from '../../contexts/OrgContext'
import { tenantOrgService } from '../../services/tenantOrgService'

function explain(err) {
  const msg = err?.message || ''
  if (/duplicate|unique|slug/.test(msg)) return 'Another workspace already uses that address. Try a slightly different name.'
  if (msg.includes('already belongs')) return 'You already belong to a workspace. Refresh the page to open it.'
  return msg || 'Something went wrong. Try again.'
}

/**
 * Workspace setup form, on Bench inside the sign-in frame (OrgSetupGate).
 * New workspaces start on the Free plan: the server sets the plan
 * (create_org_for_user); paid plans come from checkout, not from this form.
 * `primary` is false when an invite is on screen, so Accept stays the one lit key.
 */
export function CreateOrgWizard({ primary = true }) {
  const { createOrg } = useOrg()
  const [name, setName] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const trimmed = name.trim()
  const slug = useMemo(() => (trimmed.length < 2 ? '' : tenantOrgService.generateSlug(trimmed)), [trimmed])

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (trimmed.length < 2) { setError('Use at least 2 characters.'); return }
    if (trimmed.length > 100) { setError('Use 100 characters or fewer.'); return }
    setSaving(true)
    setError('')
    try {
      await createOrg(trimmed)
    } catch (err) {
      setError(explain(err))
      setSaving(false)
    }
  }

  return (
    <form className="si-form" onSubmit={handleSubmit} noValidate>
      <p className="si-lede">A workspace holds your meetings, tasks and team. You’ll own it and can invite people after.</p>
      <div className="si-field">
        <div className="si-field-row">
          <label className="si-lbl" htmlFor="org-name">Workspace name</label>
          {slug && <span className="si-lbl">{slug}</span>}
        </div>
        <TextInput
          id="org-name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Acme Corp"
          maxLength={100}
          autoComplete="organization"
          aria-invalid={error ? true : undefined}
          autoFocus={primary}
        />
      </div>
      {error && <AuthProblemLine head="Couldn’t create it">{error}</AuthProblemLine>}
      <Key type="submit" variant={primary ? 'primary' : 'plain'} className="si-go" disabled={saving || trimmed.length < 2}>
        {saving ? 'Creating…' : 'Create workspace'}
      </Key>
    </form>
  )
}
