import React from 'react'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { describe, it, expect, beforeAll, vi } from 'vitest'

vi.mock('../services/api', () => ({ default: {}, workflowsApi: {}, meetingsApi: {}, integrationsApi: {} }))
import WorkflowCanvas from '../components/workflow/WorkflowCanvas'

// React Flow measures its container; jsdom has no ResizeObserver.
beforeAll(() => {
  globalThis.ResizeObserver ??= class {
    observe() {}
    unobserve() {}
    disconnect() {}
  }
})

describe('WorkflowCanvas', () => {
  // Regression: the keyboard-shortcut effect listed handleSave in its deps
  // before handleSave was declared, so the first render threw a TDZ
  // ReferenceError ("Cannot access '_t' before initialization" in prod).
  it('renders without a temporal-dead-zone ReferenceError', () => {
    const workflow = { id: 'wf_1', name: 'Test', nodes: [], connections: [] }
    expect(() =>
      render(<WorkflowCanvas workflow={workflow} onSave={() => {}} onChange={() => {}} />)
    ).not.toThrow()
  })

  it('shows a named meeting trigger and saves the executor format', async () => {
    const node = {
      id: 'trigger',
      type: 'trigger',
      subtype: 'meeting_processed',
      position: { x: 100, y: 100 },
      config: { fixture: true },
    }
    const onSave = vi.fn()
    render(<WorkflowCanvas draft workflow={{ name: 'Test', nodes: [node], connections: [] }} onSave={onSave} />)

    const trigger = screen.getByTestId('rf__node-trigger')
    expect(trigger).toHaveAttribute('aria-label', 'Meeting Processed')
    expect(trigger).toHaveTextContent('Meeting Processed')
    expect(trigger).toHaveClass('react-flow__node-meeting_processed')

    fireEvent.click(screen.getByRole('button', { name: 'Save' }))
    await waitFor(() => expect(onSave).toHaveBeenCalledWith({
      nodes: [expect.objectContaining(node)],
      connections: [],
    }))
  })
})
