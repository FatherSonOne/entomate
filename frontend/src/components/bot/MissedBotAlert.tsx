/**
 * "Your bot didn't join": when auto-join is on and a calendar meeting started without
 * its bot, say so on every page while the call may still be going, with a way to send
 * the bot now. Opening the app also has the server check the calendar, so a skipped
 * scheduled run cannot quietly leave a meeting unrecorded.
 */

import React, { useCallback, useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Key, Signal } from '../bench'
import { alertsFor, dismissMissedBot, syncAutoJoin, type MissedBot } from '../../services/autoJoinHealth'

/** While the app is open, check again this often (the server throttles to every 5 min). */
const RECHECK_MS = 5 * 60 * 1000

const clock = (iso: string): string => new Date(iso).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })

export function MissedBotAlert({ enabled = true }: { enabled?: boolean }): React.ReactElement | null {
  const navigate = useNavigate()
  const [alerts, setAlerts] = useState<MissedBot[]>([])

  const check = useCallback(async (): Promise<void> => {
    const health = await syncAutoJoin()
    if (health) setAlerts(alertsFor(health))
  }, [])

  useEffect(() => {
    if (!enabled) return undefined
    void check()
    const t = window.setInterval(() => void check(), RECHECK_MS)
    return () => window.clearInterval(t)
  }, [enabled, check])

  const first = alerts[0]
  if (!first) return null

  const dismiss = async (): Promise<void> => {
    setAlerts((list) => list.filter((m) => m.key !== first.key))
    await dismissMissedBot(first.key).catch(() => {})
  }

  return (
    <div role="alert" data-testid="missed-bot" className="bs-recstat bs-missed-bot" data-tone="brand">
      <Signal tone="brand">Not recording</Signal>
      <p className="bs-recstat-text">
        Your bot did not join &ldquo;{first.title}&rdquo; ({clock(first.start)}).{' '}
        {first.reason === 'failed' ? 'It was sent but could not get in.' : 'No bot was sent.'} Nothing is recording that call.
      </p>
      <div className="bs-missed-bot-keys">
        <Key variant="primary" size="sm" onClick={() => navigate('/bot')}>Send the bot now</Key>
        <Key size="sm" onClick={() => void dismiss()}>Dismiss</Key>
      </div>
    </div>
  )
}

export default MissedBotAlert
