import React, { useState } from 'react'
import { Link, Navigate, useSearchParams } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { Key, Signal, Switch, TextInput } from '../components/bench'
import { AuthFrame, AuthProblemLine } from '../components/signin/AuthFrame'
import {
  MIN_PASSWORD,
  PRIMARY_LABEL,
  VIEW_TITLE,
  describeAuthError,
  sentCopy,
  validate,
  viewFromParam,
  type AuthProblem,
  type SentReason,
  type SignInFields,
  type SignInView,
} from '../services/signInView'

interface AuthResult {
  error: { message?: string } | null
  needsConfirmation?: boolean
}

interface AuthCtx {
  isSignedIn: boolean
  loading: boolean
  signInWithOAuth: (provider: 'google') => Promise<AuthResult>
  signIn: (email: string, password: string) => Promise<AuthResult>
  signUp: (email: string, password: string, metadata: { name: string }) => Promise<AuthResult>
  resetPassword: (email: string) => Promise<AuthResult>
}

type Busy = null | 'google' | 'form' | 'resend'

const GoogleG = (): React.ReactElement => (
  <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true">
    <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 01-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4" />
    <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
    <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05" />
    <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
  </svg>
)

export default function SignInPage(): React.ReactElement {
  const auth = useAuth() as unknown as AuthCtx
  const [params] = useSearchParams()
  const [view, setView] = useState<SignInView>(() => viewFromParam(params.get('mode')))
  const [fields, setFields] = useState<SignInFields>({ name: '', email: '', password: '' })
  const [busy, setBusy] = useState<Busy>(null)
  const [problem, setProblem] = useState<AuthProblem | null>(null)
  const [sent, setSent] = useState<{ reason: SentReason; at: string } | null>(null)

  if (!auth.loading && auth.isSignedIn) return <Navigate to="/dashboard" replace />

  const go = (next: SignInView): void => { setView(next); setProblem(null) }
  const set = (key: keyof SignInFields) => (e: React.ChangeEvent<HTMLInputElement>): void =>
    setFields((f) => ({ ...f, [key]: e.target.value }))
  const fail = (v: SignInView, message: string | undefined): void => setProblem(describeAuthError(v, message))
  const stamp = (): string => new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })

  const google = async (): Promise<void> => {
    setBusy('google'); setProblem(null)
    try {
      const { error } = await auth.signInWithOAuth('google')
      if (error) throw error
      // The browser leaves for Google; keep the key down until it does.
    } catch (e) {
      fail(view, (e as Error).message)
      setBusy(null)
    }
  }

  const sendReset = async (email: string, mode: Busy): Promise<void> => {
    setBusy(mode); setProblem(null)
    try {
      const { error } = await auth.resetPassword(email)
      if (error) throw error
      setSent({ reason: 'reset', at: stamp() }); setView('sent')
    } catch (e) {
      fail('forgot', (e as Error).message)
    } finally {
      setBusy(null)
    }
  }

  const submit = async (e: React.FormEvent): Promise<void> => {
    e.preventDefault()
    const invalid = validate(view, fields)
    if (invalid) { setProblem({ head: describeAuthError(view, '').head, detail: invalid, offerReset: false }); return }
    const email = fields.email.trim()
    if (view === 'forgot') { await sendReset(email, 'form'); return }
    setBusy('form'); setProblem(null)
    try {
      if (view === 'signup') {
        const { error, needsConfirmation } = await auth.signUp(email, fields.password, { name: fields.name.trim() })
        if (error) throw error
        if (needsConfirmation) { setSent({ reason: 'confirm', at: stamp() }); setView('sent') }
      } else {
        const { error } = await auth.signIn(email, fields.password)
        if (error) throw error
      }
      // Signed in: the redirect above takes over on the next render.
    } catch (err) {
      fail(view, (err as Error).message)
    } finally {
      setBusy(null)
    }
  }

  const actions = view === 'signin' || view === 'signup'
    ? (
      <Switch
        className="si-mode"
        label="Sign in or create an account"
        value={view}
        onChange={go}
        options={[{ value: 'signin', label: 'Sign in' }, { value: 'signup', label: 'Create account' }]}
      />
    )
    : <Key size="sm" onClick={() => go('signin')}>← Sign in</Key>

  const terms = (
    <p className="si-fine">
      By continuing you agree to the <Link to="/terms">Terms</Link> and <Link to="/privacy">Privacy policy</Link>.
    </p>
  )

  const problemLine = problem && (
    <AuthProblemLine head={problem.head}>
      {problem.detail}
      {problem.offerReset && view !== 'forgot' && (
        <> <button type="button" className="si-link is-brand" onClick={() => go('forgot')}>Reset your password</button>.</>
      )}
    </AuthProblemLine>
  )

  let body: React.ReactNode
  if (view === 'sent' && sent) {
    body = (
      <div className="si-sent" aria-live="polite">
        <Signal tone="mint">Sent · {sent.at}</Signal>
        <p>We sent a link to</p>
        <p className="si-addr">{fields.email.trim()}</p>
        <p>{sentCopy(sent.reason)} It can take a minute. Nothing there? Check spam{sent.reason === 'reset' ? ', or send it again' : ''}.</p>
        {problemLine}
        <div className="si-keys">
          {sent.reason === 'reset' && (
            <Key onClick={() => sendReset(fields.email.trim(), 'resend')} disabled={busy !== null}>
              {busy === 'resend' ? 'Sending…' : 'Send again'}
            </Key>
          )}
          <Key onClick={() => go(sent.reason === 'reset' ? 'forgot' : 'signup')}>Use another email</Key>
        </div>
      </div>
    )
  } else if (view === 'forgot') {
    body = (
      <form className="si-form" onSubmit={submit} noValidate>
        <p className="si-lede">Enter the email you sign in with. We’ll send a link to set a new password.</p>
        <div className="si-field">
          <label className="si-lbl" htmlFor="si-email">Email</label>
          <TextInput id="si-email" type="email" autoComplete="email" value={fields.email} onChange={set('email')} placeholder="you@company.com" autoFocus />
        </div>
        {problemLine}
        <Key type="submit" variant="primary" className="si-go" disabled={busy !== null}>
          {busy === 'form' ? PRIMARY_LABEL.forgot.busy : PRIMARY_LABEL.forgot.idle}
        </Key>
        <p className="si-fine">Signed up with Google? There’s no password to reset: use Continue with Google.</p>
      </form>
    )
  } else {
    const signup = view === 'signup'
    const label = PRIMARY_LABEL[signup ? 'signup' : 'signin']
    body = (
      <div className="si-form">
        <Key className="si-google" onClick={google} disabled={busy !== null} data-down={busy === 'google' ? 'true' : undefined} icon={<GoogleG />}>
          {busy === 'google' ? 'Opening Google…' : signup ? 'Sign up with Google' : 'Continue with Google'}
        </Key>
        {busy === 'google' && <Signal tone="live">Waiting for Google · you’ll come straight back</Signal>}
        <div className="si-or"><span className="si-lbl">or with email</span></div>
        <form className="si-form" onSubmit={submit} noValidate>
          {signup && (
            <div className="si-field">
              <label className="si-lbl" htmlFor="si-name">Full name</label>
              <TextInput id="si-name" autoComplete="name" value={fields.name} onChange={set('name')} placeholder="Dana Reyes" />
            </div>
          )}
          <div className="si-field">
            <label className="si-lbl" htmlFor="si-email">Email</label>
            <TextInput id="si-email" type="email" autoComplete="email" value={fields.email} onChange={set('email')} placeholder="you@company.com" />
          </div>
          <div className="si-field">
            <div className="si-field-row">
              <label className="si-lbl" htmlFor="si-password">Password</label>
              {signup
                ? <span className="si-lbl">{MIN_PASSWORD}+ characters</span>
                : <button type="button" className="si-link" onClick={() => go('forgot')}>Forgot password?</button>}
            </div>
            <TextInput
              id="si-password"
              type="password"
              autoComplete={signup ? 'new-password' : 'current-password'}
              value={fields.password}
              onChange={set('password')}
              placeholder="••••••••"
              aria-invalid={problem?.offerReset ? true : undefined}
            />
          </div>
          {problemLine}
          <Key type="submit" variant="primary" className="si-go" disabled={busy !== null}>
            {busy === 'form' ? label.busy : label.idle}
          </Key>
          {terms}
        </form>
      </div>
    )
  }

  return (
    <AuthFrame title={view === 'sent' && !sent ? VIEW_TITLE.signin : VIEW_TITLE[view]} actions={actions}>
      {body}
    </AuthFrame>
  )
}
