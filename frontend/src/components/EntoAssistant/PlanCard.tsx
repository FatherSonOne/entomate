/**
 * PlanCard — one card per plan_id (EAI-06). Ported from Logos AI's PlanCard (P4).
 *
 * Presentational only: it owns no state and calls no service. Every decision it makes is
 * derived from `steps` plus the `isWorking` flag the parent passes down.
 *
 * The one rule this component encodes, and the reason plans are not just a list of
 * proposals: a plan is confirmed as a WHOLE. `onConfirm` fires once for the plan, never per
 * step. Confirming steps one by one would skip the binding ({{step0.result.projectId}}), so a
 * later step would run without the id an earlier step made. The server refuses a lone step too.
 *
 * Not ported: Logos AI's per-tool "cannot be undone" note. Every Entomate verb is undoable.
 */
import React from 'react'
import { ListTodo, Check, AlertCircle, RotateCcw, ArrowUpRight } from 'lucide-react'
import { Orb } from '../ui/thinking-orbs'
import type { EntoProposal } from './ProposalCard'

export type PlanUiState =
  | 'proposed'
  | 'working'
  | 'executed'
  | 'partial'
  | 'failed'
  | 'undone'
  | 'dismissed'
  | 'review_required'

/**
 * Collapse a plan's step statuses into one card state. `working` wins while the plan call is
 * in flight (the parent's resolvingPlanId, not a row status).
 */
export function derivePlanState(steps: EntoProposal[], isWorking: boolean): PlanUiState {
  if (isWorking) return 'working'
  const st = steps.map((s) => s.status)
  if (st.some((s) => s === 'confirmed')) return 'review_required'
  if (st.every((s) => s === 'undone')) return 'undone'
  if (st.every((s) => s === 'proposed')) return 'proposed'
  if (st.every((s) => s === 'executed')) return 'executed'
  if (st.every((s) => s === 'rejected')) return 'dismissed'
  if (st.some((s) => s === 'executed')) return 'partial'
  if (st.some((s) => s === 'undone')) return 'undone'
  return 'failed' // A mixed resolved plan must never offer confirmation again.
}

/** A message's proposals in render order: a single stays a single; a plan's steps become one group. */
export type ProposalGroup = { kind: 'single'; proposal: EntoProposal } | { kind: 'plan'; planId: string; steps: EntoProposal[] }

export function groupProposals(proposals: EntoProposal[]): ProposalGroup[] {
  const groups: ProposalGroup[] = []
  const plans = new Map<string, EntoProposal[]>()
  for (const p of proposals) {
    if (!p.planId) {
      groups.push({ kind: 'single', proposal: p })
      continue
    }
    let steps = plans.get(p.planId)
    if (!steps) {
      steps = []
      plans.set(p.planId, steps)
      groups.push({ kind: 'plan', planId: p.planId, steps })
    }
    steps.push(p)
  }
  for (const steps of plans.values()) steps.sort((a, b) => (a.stepOrder ?? 0) - (b.stepOrder ?? 0))
  return groups
}

interface PlanCardProps {
  /** Sorted by stepOrder (groupProposals does it). */
  steps: EntoProposal[]
  isWorking: boolean
  /** The last refusal for this plan (a step that stopped it, an undo that was refused). */
  error: string | null
  onConfirm: () => void
  onDismiss: () => void
  onUndo: () => void
  onViewStep: (step: EntoProposal) => void
}

const PlanCard: React.FC<PlanCardProps> = ({ steps, isWorking, error, onConfirm, onDismiss, onUndo, onViewStep }) => {
  const state = derivePlanState(steps, isWorking)
  // The step in flight while the plan runs (the first one not yet done).
  const workingIdx = isWorking ? steps.findIndex((s) => s.status === 'proposed') : -1

  return (
    <div className={`la-plan la-plan-${state}`} data-testid="ento-plan" data-state={state}>
      <div className="la-plan-head">
        <span className="la-proposal-chip">
          <ListTodo size={15} />
        </span>
        <span className="la-proposal-summary">{steps.length}-step plan</span>
        {(state === 'proposed' || state === 'working') && (
          <Orb state={state === 'working' ? 'working' : 'waiting'} className="la-card-orb" />
        )}
      </div>
      <ol className="la-plan-steps">
        {steps.map((s, i) => (
          <li
            key={s.id}
            className={`la-plan-step la-plan-step-${s.status}${i === workingIdx ? ' la-plan-step-working' : ''}`}
            data-status={s.status}
          >
            <span className="la-plan-step-num">
              {s.status === 'executed' || s.status === 'undone' ? (
                <Check size={12} />
              ) : s.status === 'failed' ? (
                <AlertCircle size={12} />
              ) : (
                i + 1
              )}
            </span>
            <span className="la-plan-step-label">{s.summary ?? s.toolName}</span>
            {s.status === 'executed' && s.view && (
              <button
                type="button"
                className="la-plan-step-view"
                onClick={() => onViewStep(s)}
                title="Go to what this step made"
              >
                View <ArrowUpRight size={11} />
              </button>
            )}
          </li>
        ))}
      </ol>
      {error && <p className="la-proposal-edit-error" role="alert">{error}</p>}
      <div className="la-proposal-actions la-plan-actions">
        {state === 'proposed' && (
          <>
            <button type="button" className="la-proposal-btn la-proposal-confirm" onClick={onConfirm}>
              Confirm plan
            </button>
            <button type="button" className="la-proposal-btn la-proposal-reject" onClick={onDismiss}>
              Dismiss
            </button>
          </>
        )}
        {state === 'working' && <span className="la-proposal-status">Working…</span>}
        {state === 'executed' && (
          <>
            <span className="la-proposal-status la-proposal-status-done">
              <Check size={12} /> Plan complete
            </span>
            <button type="button" className="la-proposal-btn la-proposal-undo" onClick={onUndo}>
              <RotateCcw size={12} /> Undo plan
            </button>
          </>
        )}
        {state === 'partial' && (
          <>
            <span className="la-proposal-status la-proposal-status-failed">Stopped partway</span>
            <button type="button" className="la-proposal-btn la-proposal-undo" onClick={onUndo}>
              <RotateCcw size={12} /> Undo plan
            </button>
          </>
        )}
        {state === 'failed' && <span className="la-proposal-status la-proposal-status-failed">Couldn't complete</span>}
        {state === 'undone' && <span className="la-proposal-status la-proposal-status-dismissed">Undone</span>}
        {state === 'dismissed' && <span className="la-proposal-status la-proposal-status-dismissed">Dismissed</span>}
        {state === 'review_required' && (
          <span className="la-proposal-status la-proposal-status-failed" role="status">
            Needs review — a step or its record is unresolved. Do not repeat or undo this plan.
          </span>
        )}
      </div>
    </div>
  )
}

export default PlanCard
