import { describe, test, expect, vi, beforeEach } from 'vitest'

// A broken main path used to hide behind answers from the older paths: each switch is now
// reported, and the answer says which path gave it.
const api = vi.hoisted(() => ({
  entoAi: vi.fn(),
  assistant: vi.fn(),
  search: vi.fn(),
}))
vi.mock('../services/api', () => ({
  meetingsApi: {}, tasksApi: {}, projectsApi: {}, dashboardApi: {}, calendarApi: {}, workflowsApi: {},
  entoAiApi: { queryStream: api.entoAi },
  assistantApi: { queryStream: api.assistant },
  searchApi: { askStream: api.search },
}))
const mon = vi.hoisted(() => ({ reportError: vi.fn() }))
vi.mock('../services/monitoring', () => ({ reportError: mon.reportError }))
type Report = [Error, { source: string; extra: Record<string, unknown> }]
const reports = () => mon.reportError.mock.calls as unknown as Report[]
const report = (i: number) => reports()[i] as Report

import { streamQuery } from '../services/entoAssistantService'

type Cb = { onComplete: (r: unknown) => void; onError: (e: unknown) => void }
const failing = (status?: number, message = 'failed') => Object.assign(new Error(message), status ? { status } : {})
const answers = (answer: string) => async (_body: unknown, cb: Cb) => { cb.onComplete({ answer }) }

async function ask() {
  const onComplete = vi.fn()
  const onError = vi.fn()
  await streamQuery('what is due?', { section: 'dashboard' }, { onComplete, onError })
  // The search path is loaded with a dynamic import: let it settle.
  await vi.waitFor(() => expect(onComplete.mock.calls.length + onError.mock.calls.length).toBeGreaterThan(0))
  return { onComplete, onError }
}

beforeEach(() => {
  vi.clearAllMocks()
  ;(streamQuery as unknown as { _useFallback: boolean })._useFallback = false
})

describe('panel fallback paths', () => {
  test('the main path answering sends no report and no fallback mark', async () => {
    api.entoAi.mockImplementation(answers('Two tasks.'))
    const { onComplete } = await ask()
    expect(onComplete).toHaveBeenCalledWith({ answer: 'Two tasks.' })
    expect(mon.reportError).not.toHaveBeenCalled()
    expect(api.assistant).not.toHaveBeenCalled()
  })

  test('a 503 on the main path is reported and the assistant answer is marked', async () => {
    api.entoAi.mockRejectedValue(failing(503))
    api.assistant.mockImplementation(answers('Two tasks.'))
    const { onComplete } = await ask()
    expect(onComplete).toHaveBeenCalledWith({ answer: 'Two tasks.', fallback: 'assistant' })
    expect(mon.reportError).toHaveBeenCalledTimes(1)
    const [err, ctx] = report(0)
    expect(err).toBeInstanceOf(Error)
    expect((err as { status?: number }).status).toBeUndefined() // reportError drops errors with a 4xx status
    expect(ctx).toEqual({
      source: 'ask-entomate:fallback',
      extra: { from: '/api/ento-ai/query', to: 'assistant', status: 503, cause: 'server' },
    })
  })

  test('an undeployed main route (404) is reported too', async () => {
    api.entoAi.mockRejectedValue(failing(404))
    api.assistant.mockImplementation(answers('ok'))
    await ask()
    expect(report(0)[1].extra).toMatchObject({ status: 404, cause: 'not-found' })
  })

  test('a signed-out user falls back without a report', async () => {
    api.entoAi.mockRejectedValue(failing(401))
    api.assistant.mockImplementation(answers('ok'))
    const { onComplete } = await ask()
    expect(onComplete).toHaveBeenCalledWith({ answer: 'ok', fallback: 'assistant' })
    expect(mon.reportError).not.toHaveBeenCalled()
  })

  test('the assistant path failing in its stream ends on search, with two reports', async () => {
    api.entoAi.mockRejectedValue(failing(503))
    api.assistant.mockImplementation(async (_b: unknown, cb: Cb) => { cb.onError(failing(500)) })
    api.search.mockImplementation(answers('From search.'))
    const { onComplete } = await ask()
    expect(onComplete).toHaveBeenCalledWith({ answer: 'From search.', fallback: 'search' })
    expect(reports().map((c) => c[1].extra.to)).toEqual(['assistant', 'search'])
    expect(report(1)[1].extra).toMatchObject({ from: '/api/assistant/query', status: 500 })
  })

  test('the assistant path unreachable ends on search', async () => {
    api.entoAi.mockRejectedValue(failing(503))
    api.assistant.mockRejectedValue(failing(undefined, 'Failed to fetch'))
    api.search.mockImplementation(answers('From search.'))
    const { onComplete } = await ask()
    expect(onComplete).toHaveBeenCalledWith({ answer: 'From search.', fallback: 'search' })
    expect(report(1)[1].extra).toMatchObject({ to: 'search', cause: 'network' })
  })

  test('a rate limit stops without a fallback or a report', async () => {
    api.entoAi.mockRejectedValue(failing(429))
    const { onError, onComplete } = await ask()
    expect(onError).toHaveBeenCalledTimes(1)
    expect(onComplete).not.toHaveBeenCalled()
    expect(api.assistant).not.toHaveBeenCalled()
    expect(mon.reportError).not.toHaveBeenCalled()
  })
})
