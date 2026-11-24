import React, { useEffect, useRef, useState } from 'react'
import { calendarApi } from '../../services/api'
import { Key, Signal } from '../bench'

const RETURN_URL = '/settings?s=connections&dr=calendar'

interface CalendarStatus { configured?: boolean; connected?: boolean }
interface Calendar { id?: string; summary?: string; primary?: boolean }

interface Props {
  status: CalendarStatus | null | undefined
  oauthError: string | null
  onDisconnect: () => Promise<void>
}

export default function CalendarConnectionSettings({ status, oauthError, onDisconnect }: Props): React.ReactElement {
  const [primary, setPrimary] = useState<Calendar>()
  const [busy, setBusy] = useState(false)
  const [confirmDisconnect, setConfirmDisconnect] = useState(false)
  const [error, setError] = useState('')
  const accountButton = useRef<HTMLButtonElement>(null)
  const focusAccountButton = () => requestAnimationFrame(() => accountButton.current?.focus())
  const connected = status?.connected === true

  useEffect(() => {
    if (!connected) return
    let active = true
    calendarApi.getCalendars()
      .then((result) => {
        if (active) setPrimary(result?.calendars?.find((calendar) => calendar.primary))
      })
      .catch(() => { /* You can still switch if Google cannot return the current calendar. */ })
    return () => { active = false }
  }, [connected])

  const connect = async () => {
    setBusy(true)
    setError('')
    try {
      const result = await calendarApi.getAuthUrl(RETURN_URL)
      if (!result?.authUrl) throw new Error('Missing calendar authorization link')
      window.location.assign(result.authUrl)
    } catch {
      setError('Could not open the Google account picker. Try again.')
      setBusy(false)
    }
  }

  const disconnect = async () => {
    setBusy(true)
    setError('')
    try {
      await calendarApi.disconnect()
      setPrimary(undefined)
      setConfirmDisconnect(false)
      await onDisconnect()
    } catch {
      setError('Could not disconnect Google Calendar. Try again.')
    } finally {
      setBusy(false)
      focusAccountButton()
    }
  }

  return (
    <>
      <p className="bs-set-note">
        Choose the Google account whose primary calendar Entomate should use. You can connect your work calendar while staying signed in to Entomate with your personal account.
      </p>
      {status === undefined && <p className="bs-set-note" role="status">Checking Google Calendar…</p>}
      {status === null && <p className="bs-set-note" role="status">Google Calendar status is unavailable.</p>}
      {status?.configured === false && <p className="bs-set-note">Google Calendar is unavailable on this server.</p>}
      {oauthError === 'cancelled' && <p className="bs-set-note" role="status">Google authorization was canceled.</p>}
      {oauthError === 'failed' && <p className="bs-set-note" role="alert">Google Calendar could not be connected. Try choosing your account again.</p>}
      {error && <p className="bs-set-note" role="alert">{error}</p>}
      {status?.configured && (
        <>
          <div className="bs-set-row">
            <div className="bs-set-l">
              <b>Primary calendar</b>
              {connected && primary && <span style={{ overflowWrap: 'anywhere' }}>{primary.id || primary.summary}</span>}
            </div>
            <Signal tone={connected ? 'live' : 'off'}>{connected ? 'Connected' : 'Not connected'}</Signal>
          </div>
          {connected && (
            <p className="bs-set-note">
              Switching or disconnecting turns off bot auto-join and withdraws future bots scheduled from this calendar.
            </p>
          )}
          <div className="bs-set-keys">
            <Key ref={accountButton} variant="primary" disabled={busy || confirmDisconnect} onClick={() => { void connect() }}>
              {connected ? 'Switch Google account' : 'Choose Google account'}
            </Key>
            {connected && !confirmDisconnect && (
              <Key disabled={busy} onClick={() => setConfirmDisconnect(true)}>Disconnect</Key>
            )}
            {confirmDisconnect && (
              <>
                <Key autoFocus variant="danger" disabled={busy} onClick={() => { void disconnect() }}>Confirm disconnect</Key>
                <Key disabled={busy} onClick={() => { setConfirmDisconnect(false); focusAccountButton() }}>Cancel</Key>
              </>
            )}
          </div>
        </>
      )}
    </>
  )
}
