import { describe, test, expect, vi, afterEach } from 'vitest'

vi.mock('../services/supabaseClient', () => ({
  supabase: { auth: { getSession: async () => ({ data: { session: { access_token: 'tok' } } }) } },
}))

import { entoAiApi } from '../services/api'

function sseResponse(chunks: string[], status = 200) {
  const encoder = new TextEncoder()
  const body = new ReadableStream({
    start(controller) {
      for (const c of chunks) controller.enqueue(encoder.encode(c))
      controller.close()
    },
  })
  return new Response(body, { status })
}

const ev = (o: object) => `data: ${JSON.stringify(o)}\n\n`

afterEach(() => vi.unstubAllGlobals())

describe('entoAiApi.queryStream', () => {
  test('events split across reads still arrive whole and in order', async () => {
    const all = ev({ type: 'start' }) + ev({ type: 'tool_start', turn: 1, tools: ['list_tasks'] })
      + ev({ type: 'tool_end', turn: 1, tools: [{ name: 'list_tasks', ok: true, count: 9 }] })
      + ev({ type: 'answering' }) + ev({ type: 'chunk', content: 'You have 9.' })
      + ev({ type: 'complete', answer: 'You have 9.', tools: [] })
    // Cut the stream every 7 bytes, so most events straddle a read.
    const chunks = all.match(/[\s\S]{1,7}/g) as string[]
    const fetchMock = vi.fn(async (_url: string, _init?: RequestInit) => sseResponse(chunks))
    vi.stubGlobal('fetch', fetchMock)
    const seen: string[] = []
    await entoAiApi.queryStream({ question: 'q' }, {
      onStart: () => seen.push('start'),
      onToolEvent: (e: { type: string }) => seen.push(e.type),
      onAnswering: () => seen.push('answering'),
      onChunk: (c: string) => seen.push(`chunk:${c}`),
      onComplete: () => seen.push('complete'),
      onError: () => seen.push('error'),
    })
    expect(seen).toEqual(['start', 'tool_start', 'tool_end', 'answering', 'chunk:You have 9.', 'complete'])
    expect(fetchMock.mock.calls[0]![1]).toMatchObject({ headers: { Authorization: 'Bearer tok' } })
  })

  test('a failure before the stream starts rejects, so the panel can fall back', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response('{}', { status: 404 })))
    const onError = vi.fn()
    await expect(entoAiApi.queryStream({ question: 'q' }, { onError })).rejects.toThrow(/404/)
    expect(onError).not.toHaveBeenCalled()
  })

  test('a stream cut off after start reports an error instead of hanging', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => sseResponse([ev({ type: 'start' }), ev({ type: 'tool_start', turn: 1, tools: ['x'] })])))
    const onError = vi.fn()
    await entoAiApi.queryStream({ question: 'q' }, { onError })
    expect(onError).toHaveBeenCalledWith(expect.objectContaining({ message: expect.stringMatching(/cut off/) }))
  })
})

describe('streamQuery fallback', () => {
  test('404 from the tool endpoint falls back to the assistant endpoint', async () => {
    const urls: string[] = []
    vi.stubGlobal('fetch', vi.fn(async (url: string) => {
      urls.push(url)
      if (url.includes('/api/ento-ai/')) return new Response('{}', { status: 404 })
      return sseResponse([ev({ type: 'chunk', content: 'ok' }), ev({ type: 'complete', answer: 'ok' })])
    }))
    const { streamQuery } = await import('../services/entoAssistantService')
    const onComplete = vi.fn()
    await streamQuery('q', { section: 'tasks' }, { onComplete, onError: vi.fn() })
    expect(urls.map((u) => u.replace(/^.*\/api\//, '/api/'))).toEqual(['/api/ento-ai/query', '/api/assistant/query'])
    expect(onComplete).toHaveBeenCalled()
  })

  test('429 says to wait and does not hit the fallback', async () => {
    const fetchMock = vi.fn(async () => new Response('{}', { status: 429 }))
    vi.stubGlobal('fetch', fetchMock)
    const { streamQuery } = await import('../services/entoAssistantService')
    const onError = vi.fn()
    await streamQuery('q', { section: 'tasks' }, { onError })
    expect(fetchMock).toHaveBeenCalledTimes(1)
    expect(onError.mock.calls[0]![0].message).toMatch(/Wait a minute/)
  })
})
