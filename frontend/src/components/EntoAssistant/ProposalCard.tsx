/**
 * ProposalCard — one write the agent proposed (EAI-05, D6), with its inline edit form and
 * its typed-confirm gate. Ported from Logos AI's ProposalCard (S3 / S7a / S8a); the SMS and
 * portal branches are not ported, because Entomate has no such verbs.
 *
 * Presentational only: it owns no state and calls no service, so useProposals stays the one
 * place where a write is dispatched. The server sends everything the card needs:
 * `editable` (which fields the Edit form shows), `confirmToken` (sensitive verbs only) and
 * `view` (where an executed action's work landed).
 *
 * For a sensitive verb the parent flips `isConfirming` instead of executing, and Confirm
 * stays disabled until the typed text matches. Keep BOTH this check and the server's: this
 * one is the affordance, the server's (actionLog.confirm) is the guard.
 */
import React from 'react'
import { Sparkles, Check, RotateCcw, ArrowUpRight, Pencil } from 'lucide-react'
import { Orb } from '../ui/thinking-orbs'

export type ProposalStatus = 'proposed' | 'confirmed' | 'executed' | 'rejected' | 'failed' | 'undone'

export interface EditableField {
  key: string
  label: string
  type: 'text' | 'textarea' | 'date' | 'number'
}

export interface EntoProposal {
  id: string
  toolName: string
  riskClass: 'safe' | 'write' | 'sensitive'
  status: ProposalStatus
  summary: string | null
  canUndo?: boolean
  payload: Record<string, unknown>
  result: Record<string, unknown> | null
  editable: EditableField[]
  confirmToken: string | null
  view: { path: string; label: string } | null
  /** EAI-06: set on a plan's steps; PlanCard renders them as one card. */
  planId?: string | null
  stepOrder?: number | null
}

/** Case, outer spaces and inner runs of spaces do not count (the server applies the same rule). */
export function tokensMatch(expected: string | null | undefined, typed: string): boolean {
  const norm = (s: string) => s.trim().replace(/\s+/g, ' ').toLowerCase()
  return !!expected && norm(expected) === norm(typed)
}

interface ProposalCardProps {
  proposal: EntoProposal
  /** A call for THIS proposal is in flight: every control is disabled. */
  isResolving: boolean
  isEditing: boolean
  editDraft: Record<string, string>
  editError: string | null
  onStartEdit: () => void
  onEditField: (key: string, value: string) => void
  onSaveEdit: () => void
  onCancelEdit: () => void
  isConfirming: boolean
  confirmText: string
  confirmError: string | null
  onConfirmTextChange: (value: string) => void
  onCancelConfirm: () => void
  /** The last refusal for this card (an undo the server would not run, a failed confirm). */
  actionError: string | null
  onConfirm: () => void
  onReject: () => void
  onUndo: () => void
  onView: () => void
}

function resultText(result: EntoProposal['result'], key: string): string | null {
  const v = result?.[key]
  return typeof v === 'string' && v ? v : null
}

const ProposalCard: React.FC<ProposalCardProps> = ({
  proposal,
  isResolving,
  isEditing,
  editDraft,
  editError,
  onStartEdit,
  onEditField,
  onSaveEdit,
  onCancelEdit,
  isConfirming,
  confirmText,
  confirmError,
  onConfirmTextChange,
  onCancelConfirm,
  actionError,
  onConfirm,
  onReject,
  onUndo,
  onView,
}) => {
  const undoError = actionError || resultText(proposal.result, 'undoError')
  return (
    <div
      className={`la-proposal la-proposal-${proposal.status}${isResolving ? ' la-proposal-working' : ''}`}
      data-testid="ento-proposal"
      data-status={proposal.status}
    >
      {isEditing ? (
        <div className="la-proposal-edit">
          {proposal.editable.map((f) => (
            <label key={f.key} className="la-proposal-edit-field">
              <span className="la-proposal-edit-label">{f.label}</span>
              {f.type === 'textarea' ? (
                <textarea
                  className="la-proposal-edit-input"
                  rows={3}
                  value={editDraft[f.key] ?? ''}
                  onChange={(e) => onEditField(f.key, e.target.value)}
                />
              ) : (
                <input
                  className="la-proposal-edit-input"
                  type={f.type === 'number' ? 'number' : f.type === 'date' ? 'date' : 'text'}
                  value={editDraft[f.key] ?? ''}
                  onChange={(e) => onEditField(f.key, e.target.value)}
                />
              )}
            </label>
          ))}
          {editError && <p className="la-proposal-edit-error">{editError}</p>}
          <div className="la-proposal-actions">
            <button type="button" className="la-proposal-btn la-proposal-confirm" onClick={onSaveEdit} disabled={isResolving}>
              {isResolving ? 'Saving…' : 'Save'}
            </button>
            <button type="button" className="la-proposal-btn la-proposal-reject" onClick={onCancelEdit} disabled={isResolving}>
              Cancel
            </button>
          </div>
        </div>
      ) : (
        <div className="la-proposal-head">
          <span className="la-proposal-chip">
            <Sparkles size={15} />
          </span>
          <span className="la-proposal-summary">{proposal.summary ?? 'Proposed change'}</span>
          {/* Waiting on the user's Confirm, or working once they acted. Resolved cards show neither. */}
          {(isResolving || proposal.status === 'proposed') && (
            <Orb state={isResolving ? 'working' : 'waiting'} className="la-card-orb" />
          )}
        </div>
      )}

      {proposal.status === 'proposed' && !isEditing && (
        isConfirming ? (
          <div className="la-proposal-confirm-gate">
            <p className="la-proposal-confirm-warning">This change is hard to take back. Check it before you confirm.</p>
            <label className="la-proposal-edit-field">
              <span className="la-proposal-edit-label">
                Type <strong>{proposal.confirmToken}</strong> to confirm
              </span>
              <input
                className="la-proposal-edit-input"
                type="text"
                autoFocus
                value={confirmText}
                placeholder={proposal.confirmToken ?? ''}
                onChange={(e) => onConfirmTextChange(e.target.value)}
              />
            </label>
            {confirmError && <p className="la-proposal-edit-error">{confirmError}</p>}
            <div className="la-proposal-actions">
              <button
                type="button"
                className="la-proposal-btn la-proposal-confirm"
                onClick={onConfirm}
                disabled={isResolving || !tokensMatch(proposal.confirmToken, confirmText)}
              >
                {isResolving ? 'Working…' : 'Confirm'}
              </button>
              <button type="button" className="la-proposal-btn la-proposal-reject" onClick={onCancelConfirm} disabled={isResolving}>
                Cancel
              </button>
            </div>
          </div>
        ) : (
          <>
            {actionError && <p className="la-proposal-edit-error" role="alert">{actionError}</p>}
            <div className="la-proposal-actions">
              <button type="button" className="la-proposal-btn la-proposal-confirm" onClick={onConfirm} disabled={isResolving}>
                {isResolving ? 'Working…' : 'Confirm'}
              </button>
              {proposal.editable.length > 0 && (
                <button type="button" className="la-proposal-btn la-proposal-edit-btn" onClick={onStartEdit} disabled={isResolving}>
                  <Pencil size={12} /> Edit
                </button>
              )}
              <button type="button" className="la-proposal-btn la-proposal-reject" onClick={onReject} disabled={isResolving}>
                Dismiss
              </button>
            </div>
          </>
        )
      )}

      {proposal.status === 'executed' && (
        <>
          {undoError && <p className="la-proposal-sent-note" role="status">{undoError}</p>}
          <div className="la-proposal-actions">
            <span className="la-proposal-status la-proposal-status-done">
              <Check size={12} /> Done
            </span>
            {proposal.view && (
              <button type="button" className="la-proposal-btn la-proposal-view" onClick={onView}>
                View {proposal.view.label} <ArrowUpRight size={12} />
              </button>
            )}
            {proposal.canUndo !== false && (
              <button type="button" className="la-proposal-btn la-proposal-undo" onClick={onUndo} disabled={isResolving}>
                <RotateCcw size={12} />
                {isResolving ? 'Undoing…' : 'Undo'}
              </button>
            )}
          </div>
        </>
      )}

      {proposal.status === 'undone' && (
        <span className="la-proposal-status la-proposal-status-dismissed">
          Undone{resultText(proposal.result, 'undoNote') ? ` · ${resultText(proposal.result, 'undoNote')}` : ''}
        </span>
      )}
      {proposal.status === 'confirmed' && (
        <span className="la-proposal-status la-proposal-status-failed" role="status">
          Needs review — the change may have been made, but its record was not saved. Check it before you repeat it.
        </span>
      )}
      {proposal.status === 'rejected' && (
        <span className="la-proposal-status la-proposal-status-dismissed">Dismissed</span>
      )}
      {proposal.status === 'failed' && (
        <span className="la-proposal-status la-proposal-status-failed" role="status">
          Couldn't complete{resultText(proposal.result, 'error') ? ` — ${resultText(proposal.result, 'error')}` : ''}
        </span>
      )}
    </div>
  )
}

export default ProposalCard
