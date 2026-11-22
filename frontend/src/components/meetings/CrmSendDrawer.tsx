import React, { useEffect, useState } from 'react'
import { Loader2 } from 'lucide-react'
import { Drawer, Key, Signal } from '../bench'
import { integrationsApi } from '../../services/api'

// api.js unwraps responses to their body; this is the slice this drawer calls.
const crmApi = (integrationsApi as unknown as {
  crm: {
    status: () => Promise<CrmStatus>
    syncActionItems: (ids: string[]) => Promise<SyncResult>
  }
}).crm

/** The action item fields this drawer reads. */
export interface CrmActionItem {
  id: string
  task_description?: string | null
  assigned_to_name?: string | null
  due_date?: string | null
  crm_sync_status?: string | null
}

interface CrmStatus {
  connected: boolean
  provider: string | null
}

interface SyncResult {
  synced: number
  failed: number
  skipped: number
  errors?: Array<{ itemId: string; error: string }>
}

export interface CrmSendDrawerProps {
  open: boolean
  onClose: () => void
  items: CrmActionItem[]
  /** Called after a send so the page can reload sync states. */
  onSent: () => void
}

const PROVIDER_NAMES: Record<string, string> = { hubspot: 'HubSpot', salesforce: 'Salesforce', pipedrive: 'Pipedrive', logos: 'Logos Vision' }

const providerName = (p: string | null | undefined): string =>
  !p ? 'CRM' : PROVIDER_NAMES[p.toLowerCase()] ?? p.charAt(0).toUpperCase() + p.slice(1)

const sendable = (i: CrmActionItem): boolean => i.crm_sync_status !== 'synced'

const plural = (n: number, one: string, many: string): string => `${n} ${n === 1 ? one : many}`

function statusSignal(status: string | null | undefined): React.ReactElement {
  if (status === 'synced') return <Signal tone="mint">In CRM</Signal>
  if (status === 'failed') return <Signal tone="brand">Failed</Signal>
  return <Signal tone="off">Not sent</Signal>
}

/**
 * Send a meeting's action items to the CRM, after showing exactly what goes.
 * Items already in the CRM are listed but not sent again. With no CRM
 * connected, nothing is sent: the drawer says so instead of pretending.
 */
export default function CrmSendDrawer({ open, onClose, items, onSent }: CrmSendDrawerProps): React.ReactElement | null {
  const [status, setStatus] = useState<CrmStatus | null>(null)
  const [statusError, setStatusError] = useState(false)
  const [sending, setSending] = useState(false)
  const [result, setResult] = useState<SyncResult | null>(null)
  const [sendError, setSendError] = useState<string | null>(null)

  useEffect(() => {
    if (!open) return
    setResult(null)
    setSendError(null)
    setStatusError(false)
    let alive = true
    crmApi.status()
      .then((s) => { if (alive) setStatus(s) })
      .catch(() => { if (alive) setStatusError(true) })
    return () => { alive = false }
  }, [open])

  const toSend = items.filter(sendable)
  const already = items.length - toSend.length
  const connected = status?.connected === true

  const send = async (): Promise<void> => {
    setSending(true)
    setSendError(null)
    try {
      const res = await crmApi.syncActionItems(toSend.map((i) => i.id))
      setResult(res)
      onSent()
    } catch (err) {
      setSendError(err instanceof Error ? err.message : 'The action items could not be sent.')
    } finally {
      setSending(false)
    }
  }

  const canSend = connected && toSend.length > 0 && !sending && !result
  const provider = providerName(status?.provider)

  return (
    <Drawer
      open={open}
      onClose={onClose}
      label="Send to CRM"
      footer={result ? (
        <Key variant="primary" onClick={onClose}>Done</Key>
      ) : (
        <>
          <Key onClick={onClose} disabled={sending}>Cancel</Key>
          <Key variant="primary" onClick={() => void send()} disabled={!canSend}>
            {sending && <Loader2 className="animate-spin" aria-hidden="true" />}
            {sending ? 'Sending' : toSend.length > 0 ? `Send ${plural(toSend.length, 'item', 'items')}` : 'Nothing to send'}
          </Key>
        </>
      )}
    >
      <div className="bs-mtg-share">
        <p className="bs-sub">
          Each action item becomes a task in {connected ? provider : 'your CRM'}, with its owner and due date.
          {already > 0 && ` ${plural(already, 'item is', 'items are')} already there and won't be sent again.`}
        </p>

        <div className="bs-mtg-share-field">
          <span className="bs-lbl">Destination</span>
          {status === null && !statusError && <Signal tone="off">Checking connection</Signal>}
          {statusError && <Signal tone="brand">Couldn't check the CRM connection</Signal>}
          {status && connected && <Signal tone="mint">{provider} connected</Signal>}
          {status && !connected && (
            <p className="bs-sub"><Signal tone="brand">No CRM connected</Signal> Nothing will be sent until a CRM is set up for this workspace.</p>
          )}
        </div>

        <ul className="bs-rows bs-crm-list" aria-label="Action items">
          {items.map((i) => (
            <li key={i.id} className="bs-row">
              <span className="bs-row-text">
                <span className="bs-crm-task">{i.task_description || 'Untitled action item'}</span>
                <span className="bs-crm-meta">
                  {i.assigned_to_name || 'No owner'}
                  {i.due_date && ` · Due ${new Date(`${i.due_date}T00:00:00`).toLocaleDateString('en-US', { day: 'numeric', month: 'short' })}`}
                </span>
              </span>
              {statusSignal(i.crm_sync_status)}
            </li>
          ))}
        </ul>

        {result && (
          <p role="status">
            <Signal tone={result.failed > 0 ? 'brand' : 'mint'}>
              {result.failed > 0
                ? `${result.synced} sent · ${result.failed} failed`
                : `Sent to ${provider} · ${plural(result.synced, 'item', 'items')}`}
            </Signal>
            {result.errors && result.errors.length > 0 && (
              <span className="bs-sub"> {result.errors[0]!.error}</span>
            )}
          </p>
        )}
        {sendError && <p role="alert"><Signal tone="brand">Not sent</Signal> <span className="bs-sub">{sendError}</span></p>}
      </div>
    </Drawer>
  )
}
