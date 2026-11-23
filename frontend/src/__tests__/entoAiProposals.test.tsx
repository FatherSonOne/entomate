import React, { useState } from 'react'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { describe, test, expect, vi, beforeEach } from 'vitest'

// The orb draws on an SVG with animation frames; its look is not under test here.
vi.mock('../components/ui/thinking-orbs', () => ({ Orb: () => null }))

const actions = vi.hoisted(() => ({
  confirm: vi.fn(),
  reject: vi.fn(),
  undo: vi.fn(),
  edit: vi.fn(),
  list: vi.fn(),
}))
vi.mock('../services/api', () => ({ entoAiApi: { actions } }))

import ProposalCard, { tokensMatch } from '../components/EntoAssistant/ProposalCard'
import type { EntoProposal } from '../components/EntoAssistant/ProposalCard'
import { useProposals } from '../components/EntoAssistant/useProposals'

const base: EntoProposal = {
  id: 'p1',
  toolName: 'create_task',
  riskClass: 'write',
  status: 'proposed',
  summary: 'Create task "Write the brief"',
  payload: { title: 'Write the brief', dueDate: null },
  result: null,
  editable: [{ key: 'title', label: 'Title', type: 'text' }, { key: 'dueDate', label: 'Due date', type: 'date' }],
  confirmToken: null,
  view: null,
}

/** The panel's wiring in miniature: one message, its proposals, the hook. */
function Harness({ proposal, navigate = vi.fn(), onClose = vi.fn() }: { proposal: EntoProposal; navigate?: (p: string) => void; onClose?: () => void }) {
  const [list, setList] = useState([proposal])
  const ui = useProposals({
    replaceProposal: (_idx, next) => setList((prev) => prev.map((p) => (p.id === next.id ? next : p))),
    navigate,
    onClose,
  })
  const p = list[0]!
  return (
    <ProposalCard
      proposal={p}
      isResolving={ui.resolvingId === p.id}
      isEditing={ui.editingId === p.id}
      editDraft={ui.editDraft}
      editError={ui.editError}
      onStartEdit={() => ui.handleStartEdit(p)}
      onEditField={ui.handleEditField}
      onSaveEdit={() => ui.handleSaveEdit(0, p)}
      onCancelEdit={ui.handleCancelEdit}
      isConfirming={ui.confirmingId === p.id}
      confirmText={ui.confirmText}
      confirmError={ui.confirmError}
      onConfirmTextChange={ui.handleConfirmTextChange}
      onCancelConfirm={ui.handleCancelConfirm}
      actionError={ui.actionErrors[p.id] || null}
      onConfirm={() => ui.handleConfirm(0, p)}
      onReject={() => ui.handleReject(0, p)}
      onUndo={() => ui.handleUndo(0, p)}
      onView={() => ui.handleView(p)}
    />
  )
}

const status = () => screen.getByTestId('ento-proposal').getAttribute('data-status')

beforeEach(() => {
  for (const fn of Object.values(actions)) fn.mockReset()
})

describe('ProposalCard + useProposals (EAI-05)', () => {
  test('a proposal shows its summary and Confirm / Edit / Dismiss, and nothing is done yet', () => {
    render(<Harness proposal={base} />)
    expect(screen.getByText('Create task "Write the brief"')).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Confirm' })).toBeTruthy()
    expect(screen.getByRole('button', { name: /Edit/ })).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Dismiss' })).toBeTruthy()
    expect(screen.queryByText('Done')).toBeNull()
  })

  test('no Edit button when the verb has no editable fields', () => {
    render(<Harness proposal={{ ...base, editable: [] }} />)
    expect(screen.queryByRole('button', { name: /Edit/ })).toBeNull()
  })

  test('Confirm calls the server once and paints the executed state it returns', async () => {
    actions.confirm.mockResolvedValue({ ok: true, proposal: { ...base, status: 'executed', view: { path: '/tasks', label: 'Tasks' } } })
    render(<Harness proposal={base} />)
    fireEvent.click(screen.getByRole('button', { name: 'Confirm' }))
    await waitFor(() => expect(status()).toBe('executed'))
    expect(actions.confirm).toHaveBeenCalledTimes(1)
    expect(actions.confirm).toHaveBeenCalledWith('p1', undefined)
    expect(screen.getByRole('button', { name: /Undo/ })).toBeTruthy()
    expect(screen.getByRole('button', { name: /View Tasks/ })).toBeTruthy()
  })

  test('View goes to where the work landed and closes the panel', () => {
    const navigate = vi.fn()
    const onClose = vi.fn()
    render(<Harness proposal={{ ...base, status: 'executed', view: { path: '/meetings/m1', label: 'the meeting' } }} navigate={navigate} onClose={onClose} />)
    fireEvent.click(screen.getByRole('button', { name: /View the meeting/ }))
    expect(navigate).toHaveBeenCalledWith('/meetings/m1')
    expect(onClose).toHaveBeenCalled()
  })

  test('a refused undo keeps the card executed and says why', async () => {
    const executed = { ...base, status: 'executed' as const }
    actions.undo.mockResolvedValue({
      ok: false,
      error: 'The task changed after Entomate AI made this change, so undo was not run.',
      proposal: { ...executed, result: { undoError: 'The task changed after Entomate AI made this change, so undo was not run.' } },
    })
    render(<Harness proposal={executed} />)
    fireEvent.click(screen.getByRole('button', { name: /Undo/ }))
    await waitFor(() => expect(screen.getByRole('status').textContent).toMatch(/changed after Entomate AI/))
    expect(status()).toBe('executed')
  })

  test('a successful undo shows Undone', async () => {
    actions.undo.mockResolvedValue({ ok: true, proposal: { ...base, status: 'undone' } })
    render(<Harness proposal={{ ...base, status: 'executed' }} />)
    fireEvent.click(screen.getByRole('button', { name: /Undo/ }))
    await waitFor(() => expect(status()).toBe('undone'))
    expect(screen.getByText(/Undone/)).toBeTruthy()
  })

  test('a 409 from another tab paints the server state, not a stale Confirm', async () => {
    actions.confirm.mockResolvedValue({ ok: false, error: 'This proposal was already resolved', proposal: { ...base, status: 'executed' } })
    render(<Harness proposal={base} />)
    fireEvent.click(screen.getByRole('button', { name: 'Confirm' }))
    await waitFor(() => expect(status()).toBe('executed'))
  })

  test('Edit sends only the editable keys and shows the server summary', async () => {
    actions.edit.mockResolvedValue({ ok: true, proposal: { ...base, summary: 'Create task "Final" · due 2026-12-01', payload: { title: 'Final', dueDate: '2026-12-01' } } })
    render(<Harness proposal={base} />)
    fireEvent.click(screen.getByRole('button', { name: /Edit/ }))
    const [title] = screen.getAllByRole('textbox')
    fireEvent.change(title!, { target: { value: 'Final' } })
    fireEvent.click(screen.getByRole('button', { name: 'Save' }))
    await waitFor(() => expect(screen.getByText('Create task "Final" · due 2026-12-01')).toBeTruthy())
    expect(actions.edit).toHaveBeenCalledWith('p1', { title: 'Final', dueDate: '' })
  })

  test('an edit the server refuses keeps the form open with its message', async () => {
    actions.edit.mockResolvedValue({ ok: false, error: 'dueDate must be a date as YYYY-MM-DD' })
    render(<Harness proposal={base} />)
    fireEvent.click(screen.getByRole('button', { name: /Edit/ }))
    fireEvent.click(screen.getByRole('button', { name: 'Save' }))
    await waitFor(() => expect(screen.getByText('dueDate must be a date as YYYY-MM-DD')).toBeTruthy())
    expect(screen.getByRole('button', { name: 'Save' })).toBeTruthy()
  })

  test('a sensitive verb: the first Confirm only opens the gate; Confirm stays off until the token matches', async () => {
    actions.confirm.mockResolvedValue({ ok: true, proposal: { ...base, riskClass: 'sensitive', status: 'executed' } })
    render(<Harness proposal={{ ...base, riskClass: 'sensitive', confirmToken: 'Board deck' }} />)
    fireEvent.click(screen.getByRole('button', { name: 'Confirm' }))
    expect(actions.confirm).not.toHaveBeenCalled()
    const confirm = screen.getByRole('button', { name: 'Confirm' }) as HTMLButtonElement
    expect(confirm.disabled).toBe(true)
    fireEvent.change(screen.getByPlaceholderText('Board deck'), { target: { value: '  board DECK ' } })
    expect(confirm.disabled).toBe(false)
    fireEvent.click(confirm)
    await waitFor(() => expect(actions.confirm).toHaveBeenCalledWith('p1', '  board DECK '))
  })

  test('a confirm left without its record says "needs review", never "failed"', () => {
    render(<Harness proposal={{ ...base, status: 'confirmed' }} />)
    expect(screen.getByRole('status').textContent).toMatch(/Needs review/)
    expect(screen.queryByRole('button', { name: 'Confirm' })).toBeNull()
  })

  test('tokensMatch ignores case and spaces, never matches an empty token', () => {
    expect(tokensMatch('Board deck', ' board   DECK')).toBe(true)
    expect(tokensMatch('Board deck', 'Board')).toBe(false)
    expect(tokensMatch(null, '')).toBe(false)
  })
})
