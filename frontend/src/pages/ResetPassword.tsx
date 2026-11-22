import React, { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { Key, Signal, TextInput } from '../components/bench'
import { AuthFrame, AuthProblemLine } from '../components/signin/AuthFrame'
import { MIN_PASSWORD } from '../services/signInView'

interface AuthCtx {
  loading: boolean
  session: unknown
  updatePassword: (password: string) => Promise<{ error: { message?: string } | null }>
}

/**
 * Opened from the reset email. Supabase signs the user in with a recovery
 * session from the link; this page sets the new password, then opens Today.
 */
export default function ResetPassword(): React.ReactElement {
  const auth = useAuth() as unknown as AuthCtx
  const navigate = useNavigate()
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [busy, setBusy] = useState(false)
  const [problem, setProblem] = useState<string | null>(null)

  const back = <Key size="sm" onClick={() => navigate('/sign-in')}>← Sign in</Key>

  if (auth.loading) {
    return (
      <AuthFrame title="Set a new password" actions={back}>
        <Signal tone="live">Checking your link</Signal>
      </AuthFrame>
    )
  }

  if (!auth.session) {
    return (
      <AuthFrame title="Link expired" actions={back}>
        <div className="si-sent">
          <Signal tone="off">Not signed in</Signal>
          <p>This reset link has expired or was already used. Links work once, for one hour.</p>
          <div className="si-keys">
            <Key variant="primary" onClick={() => navigate('/sign-in?mode=forgot')}>Send a new link</Key>
          </div>
        </div>
      </AuthFrame>
    )
  }

  const submit = async (e: React.FormEvent): Promise<void> => {
    e.preventDefault()
    if (password.length < MIN_PASSWORD) { setProblem(`Use at least ${MIN_PASSWORD} characters.`); return }
    if (password !== confirm) { setProblem('The two passwords don’t match.'); return }
    setBusy(true); setProblem(null)
    const { error } = await auth.updatePassword(password)
    setBusy(false)
    if (error) { setProblem(error.message || 'Something went wrong. Try again.'); return }
    navigate('/dashboard', { replace: true })
  }

  return (
    <AuthFrame title="Set a new password" actions={back}>
      <form className="si-form" onSubmit={submit} noValidate>
        <div className="si-field">
          <div className="si-field-row">
            <label className="si-lbl" htmlFor="si-new">New password</label>
            <span className="si-lbl">{MIN_PASSWORD}+ characters</span>
          </div>
          <TextInput id="si-new" type="password" autoComplete="new-password" value={password} onChange={(e) => setPassword(e.target.value)} autoFocus />
        </div>
        <div className="si-field">
          <label className="si-lbl" htmlFor="si-confirm">Confirm it</label>
          <TextInput id="si-confirm" type="password" autoComplete="new-password" value={confirm} onChange={(e) => setConfirm(e.target.value)} />
        </div>
        {problem && <AuthProblemLine head="Couldn’t save it">{problem}</AuthProblemLine>}
        <Key type="submit" variant="primary" className="si-go" disabled={busy}>
          {busy ? 'Saving…' : 'Save and open Entomate'}
        </Key>
      </form>
    </AuthFrame>
  )
}
