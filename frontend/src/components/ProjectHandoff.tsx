import React, { useCallback, useEffect, useState } from 'react'
import { Key, Section, Signal } from './bench'
import { useConfirm } from './vc/ConfirmDialog'
import { projectsApi } from '../services/api'

type Delivery = 'not_sent' | 'pending' | 'delivered' | 'failed'
interface Handoff {
  channelName: string | null
  channelId: string | null
  connected: boolean
  delivery: Delivery
}

const DELIVERY: Record<Delivery, { label: string; tone: 'off' | 'live' | 'brand' }> = {
  not_sent: { label: 'Not sent', tone: 'off' },
  pending: { label: 'Awaiting receipt', tone: 'off' },
  delivered: { label: 'Delivered', tone: 'live' },
  failed: { label: 'Delivery unconfirmed', tone: 'brand' },
}

export default function ProjectHandoff({ projectId }: { projectId: string }): React.ReactElement {
  const confirm = useConfirm() as (options: {
    title: string; message: string; confirmLabel: string; variant: 'primary'
  }) => Promise<boolean>
  const [handoff, setHandoff] = useState<Handoff | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const refresh = useCallback(async () => {
    setBusy(true)
    setError(null)
    try {
      setHandoff(await projectsApi.getHandoff(projectId) as unknown as Handoff)
    } catch {
      setError('Could not load the Pulse handoff.')
    } finally {
      setBusy(false)
    }
  }, [projectId])

  useEffect(() => { void refresh() }, [refresh])

  const send = async () => {
    if (busy || !handoff?.channelId) return
    const retry = handoff.delivery === 'failed'
    const label = retry ? 'Retry handoff' : 'Send project link'
    setBusy(true)
    try {
      if (!await confirm({
        title: label,
        message: 'Post the project name and link to ' + handoff.channelName + ' in Pulse?',
        confirmLabel: label,
        variant: 'primary',
      })) return
      setError(null)
      const result = await projectsApi.sendHandoff(projectId, handoff.channelId) as unknown as Handoff
      setHandoff(result)
    } catch {
      setError('Could not confirm delivery. Refresh the handoff before retrying.')
    } finally {
      setBusy(false)
    }
  }

  const status = handoff ? DELIVERY[handoff.delivery] : null

  return (
    <section className="bs-proj-handoff" aria-labelledby="project-handoff">
      <Section id="project-handoff" title="Pulse handoff" level={3} />
      <div className="bs-proj-handoff-status" role="status">
        {handoff?.channelName && <span>{handoff.channelName}</span>}
        {status && (handoff?.channelName || handoff?.delivery !== 'not_sent') && <Signal tone={status.tone}>{status.label}</Signal>}
        {handoff && !handoff.connected && <span className="bs-mut">No Pulse destination connected for this handoff.</span>}
        {!handoff && !error && <span className="bs-mut">Checking Pulse handoff</span>}
      </div>
      {error && <p role="alert" className="bs-mut">{error}</p>}
      {error || handoff?.delivery === 'pending' ? (
        <Key size="sm" onClick={() => void refresh()} disabled={busy}>Refresh handoff</Key>
      ) : handoff?.channelId && (
        <Key size="sm" onClick={() => void send()} disabled={busy}>
          {handoff.delivery === 'failed' ? 'Retry handoff' : 'Send project link'}
        </Key>
      )}
    </section>
  )
}
