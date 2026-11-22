import React from 'react'
import { render } from '@testing-library/react'
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
})
