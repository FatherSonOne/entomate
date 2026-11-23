import React, { useState } from 'react'
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react'
import { describe, test, expect, vi, beforeEach } from 'vitest'

// The orb draws on an SVG with animation frames; its look is not under test here.
vi.mock('../components/ui/thinking-orbs', () => ({ Orb: () => null }))

const api = vi.hoisted(() => ({
  actions: { confirm: vi.fn(), reject: vi.fn(), undo: vi.fn(), edit: vi.fn(), list: vi.fn() },
  plans: { confirm: vi.fn(), reject: vi.fn(), undo: vi.fn() },
  signals: vi.fn(),
}))
vi.mock('../services/api', () => ({ entoAiApi: api }))

import PlanCard, { derivePlanState, groupProposals } from '../components/EntoAssistant/PlanCard'
import type { EntoProposal, ProposalStatus } from '../components/EntoAssistant/ProposalCard'
import { useProposals } from '../components/EntoAssistant/useProposals'
import EntoAIProactiveChecker from '../components/EntoAssistant/EntoAIProactiveChecker'

const step = (i: number, status: ProposalStatus = 'proposed', planId = 'plan-1'): EntoProposal => ({
  id: `s${i}`,
  toolName: i === 0 ? 'create_project' : 'create_task',
  riskClass: 'write',
  status,
  summary: i === 0 ? 'Create project "Q1 launch"' : `Create task "T${i}" · in the new project`,
  payload: {},
  result: null,
  editable: [],
  confirmToken: null,
  view: status === 'executed' ? { path: '/tasks', label: 'Tasks' } : null,
  planId,
  stepOrder: i,
})
const withStatus = (steps: EntoProposal[], status: ProposalStatus) => steps.map((s) => ({ ...s, status }))

describe('derivePlanState', () => {
  test.each([
    [['proposed', 'proposed'], false, 'proposed'],
    [['proposed', 'proposed'], true, 'working'],
    [['executed', 'executed'], false, 'executed'],
    [['executed', 'failed'], false, 'partial'],
    [['undone', 'undone'], false, 'undone'],
    [['undone', 'failed'], false, 'undone'],
    [['rejected', 'rejected'], false, 'dismissed'],
    [['executed', 'confirmed'], false, 'review_required'],
    [['failed', 'proposed'], false, 'failed'],
  ] as const)('%j (working %s) → %s', (statuses, working, expected) => {
    expect(derivePlanState(statuses.map((s, i) => step(i, s)), working)).toBe(expected)
  })
})

test('groupProposals keeps singles, makes one ordered group per plan, at the first step', () => {
  const single = { ...step(9), id: 'x', planId: null, stepOrder: null }
  const groups = groupProposals([single, step(2), step(0), step(1)])
  expect(groups.map((g) => g.kind)).toEqual(['single', 'plan'])
  const plan = groups[1]
  expect(plan?.kind === 'plan' ? plan.steps.map((s) => s.id) : null).toEqual(['s0', 's1', 's2'])
})

/** The panel's wiring in miniature: one message holding one plan. */
function Harness({ initial }: { initial: EntoProposal[] }) {
  const [list, setList] = useState(initial)
  const ui = useProposals({
    replaceProposal: (_idx, next) => setList((prev) => prev.map((p) => (p.id === next.id ? next : p))),
    navigate: vi.fn(),
    onClose: vi.fn(),
  })
  return (
    <PlanCard
      steps={list}
      isWorking={ui.resolvingPlanId === 'plan-1'}
      error={ui.planErrors['plan-1'] || null}
      onConfirm={() => ui.handleConfirmPlan(0, 'plan-1')}
      onDismiss={() => ui.handleRejectPlan(0, 'plan-1')}
      onUndo={() => ui.handleUndoPlan(0, 'plan-1')}
      onViewStep={ui.handleView}
    />
  )
}

describe('PlanCard + useProposals', () => {
  const steps = [step(0), step(1), step(2)]
  beforeEach(() => vi.clearAllMocks())

  test('Confirm plan makes ONE plan call (never a per-step confirm) and paints every step', async () => {
    api.plans.confirm.mockResolvedValue({ ok: true, proposals: withStatus(steps, 'executed').map((s) => ({ ...s, view: { path: '/tasks', label: 'Tasks' } })) })
    render(<Harness initial={steps} />)
    expect(screen.getByText('3-step plan')).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'Confirm plan' }))
    await waitFor(() => expect(screen.getByText(/Plan complete/)).toBeTruthy())
    expect(api.plans.confirm).toHaveBeenCalledTimes(1)
    expect(api.plans.confirm).toHaveBeenCalledWith('plan-1')
    expect(api.actions.confirm).not.toHaveBeenCalled()
    expect(screen.getAllByRole('button', { name: /View/ })).toHaveLength(3)
  })

  test('Undo plan calls the plan undo and shows Undone', async () => {
    api.plans.undo.mockResolvedValue({ ok: true, proposals: withStatus(steps, 'undone') })
    render(<Harness initial={withStatus(steps, 'executed')} />)
    fireEvent.click(screen.getByRole('button', { name: /Undo plan/ }))
    await waitFor(() => expect(screen.getByText('Undone')).toBeTruthy())
    expect(api.plans.undo).toHaveBeenCalledWith('plan-1')
    expect(api.actions.undo).not.toHaveBeenCalled()
  })

  test('a step that stopped the plan: Stopped partway, the error, and Undo plan offered', async () => {
    api.plans.confirm.mockResolvedValue({
      ok: false,
      error: 'Step 3 stopped the plan: insert failed',
      proposals: [{ ...steps[0], status: 'executed' }, { ...steps[1], status: 'executed' }, { ...steps[2], status: 'failed' }],
    })
    render(<Harness initial={steps} />)
    fireEvent.click(screen.getByRole('button', { name: 'Confirm plan' }))
    await waitFor(() => expect(screen.getByText('Stopped partway')).toBeTruthy())
    expect(screen.getByRole('alert').textContent).toMatch(/Step 3 stopped the plan/)
    expect(screen.getByRole('button', { name: /Undo plan/ })).toBeTruthy()
  })

  test('Dismiss calls the plan reject; no Confirm afterwards', async () => {
    api.plans.reject.mockResolvedValue({ ok: true, proposals: withStatus(steps, 'rejected') })
    render(<Harness initial={steps} />)
    fireEvent.click(screen.getByRole('button', { name: 'Dismiss' }))
    await waitFor(() => expect(screen.getByText('Dismissed')).toBeTruthy())
    expect(screen.queryByRole('button', { name: 'Confirm plan' })).toBeNull()
  })
})

describe('EntoAIProactiveChecker', () => {
  beforeEach(() => vi.clearAllMocks())

  test('reports the server signals, and keeps them when a later read fails', async () => {
    const seen: unknown[] = []
    const onSignals = (s: unknown) => seen.push(s)
    api.signals.mockResolvedValueOnce({ signals: [{ id: 'task:1', label: 'x', query: 'q' }], total: 4 })
    const { rerender } = render(<EntoAIProactiveChecker onSignals={onSignals} refreshKey={false} />)
    await waitFor(() => expect(seen).toHaveLength(1))
    expect(seen[0]).toEqual({ signals: [{ id: 'task:1', label: 'x', query: 'q' }], total: 4 })

    api.signals.mockRejectedValueOnce(new Error('502'))
    await act(async () => { rerender(<EntoAIProactiveChecker onSignals={onSignals} refreshKey />) })
    await waitFor(() => expect(api.signals).toHaveBeenCalledTimes(2))
    expect(seen).toHaveLength(1) // a failed read is not "nothing waiting"
  })
})
