import React from 'react'
import { render, screen } from '@testing-library/react'
import { describe, test, expect, vi } from 'vitest'

// The orb draws on an SVG with animation frames; its look is not under test here.
vi.mock('../components/ui/thinking-orbs', () => ({ Orb: () => null }))

import { AgentPipeline, ToolsUsed, applyToolEvent, toolLabel } from '../components/EntoAssistant/AgentPipeline'

// The read tools declared in backend/services/entoAi/tools.js (EAI-04).
const BACKEND_TOOLS = [
  'search_meetings', 'get_meeting', 'list_action_items', 'list_tasks', 'get_task',
  'list_projects', 'get_project', 'get_calendar', 'search_everything',
]

describe('applyToolEvent', () => {
  test('start adds running steps; end marks each done or failed', () => {
    let steps = applyToolEvent([], { type: 'tool_start', turn: 1, tools: ['list_tasks', 'get_calendar'] })
    expect(steps.map((s) => s.status)).toEqual(['running', 'running'])
    steps = applyToolEvent(steps, { type: 'tool_end', turn: 1, tools: [{ name: 'list_tasks', ok: true }, { name: 'get_calendar', ok: false }] })
    expect(steps).toEqual([
      { turn: 1, name: 'list_tasks', status: 'done' },
      { turn: 1, name: 'get_calendar', status: 'failed' },
    ])
  })

  test('a step the end event does not mention stops spinning', () => {
    let steps = applyToolEvent([], { type: 'tool_start', turn: 1, tools: ['list_tasks'] })
    steps = applyToolEvent(steps, { type: 'tool_end', turn: 1, tools: [] })
    expect(steps[0]!.status).toBe('done')
  })

  test('other event types leave the list unchanged', () => {
    const steps = [{ turn: 1, name: 'list_tasks', status: 'done' as const }]
    expect(applyToolEvent(steps, { type: 'chunk' })).toBe(steps)
  })
})

test('every backend read tool has a label', () => {
  for (const name of BACKEND_TOOLS) expect(toolLabel(name)).not.toMatch(/^Looking up:/)
})

test('pipeline names the running tool, then the review stage', () => {
  const { rerender } = render(<AgentPipeline steps={[{ turn: 1, name: 'list_tasks', status: 'running' }]} />)
  expect(screen.getByText('Checking tasks…')).toBeTruthy()
  rerender(<AgentPipeline steps={[{ turn: 1, name: 'list_tasks', status: 'done' }]} />)
  expect(screen.getByText('Reviewing what it found…')).toBeTruthy()
  rerender(<AgentPipeline answering steps={[{ turn: 1, name: 'list_tasks', status: 'done' }]} />)
  expect(screen.getByText('Writing the answer…')).toBeTruthy()
})

test('chips merge repeat calls and show the record count or a failure', () => {
  render(<ToolsUsed calls={[
    { turn: 1, name: 'list_tasks', ok: true, count: 9 },
    { turn: 2, name: 'list_tasks', ok: true, count: 2 },
    { turn: 1, name: 'get_calendar', ok: false, count: 0 },
  ]} />)
  const chips = screen.getAllByRole('listitem').map((li) => li.textContent)
  expect(chips).toEqual(['Tasks11', 'Calendarfailed'])
})

test('no calls, no chip row', () => {
  const { container } = render(<ToolsUsed calls={[]} />)
  expect(container.firstChild).toBeNull()
})
