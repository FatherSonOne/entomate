import React from 'react'
import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { describe, test, expect, vi, beforeEach, afterEach } from 'vitest'
import { firstNameOf, linesForHour, welcomeGreeting } from '../components/EntoAssistant/welcomeGreeting'

// EAI-02c: the welcome greeting ported from Logos AI. The unit cases are LV's own
// (`welcomeGreeting.test.ts`) minus the org-group intro; the panel cases render the real panel.
const auth = vi.hoisted(() => ({ user: { id: 'user-a', email: 'a@example.com', name: 'Frank Messana' } as { id: string; email: string; name?: string } }))
vi.mock('../components/ui/thinking-orbs', async (orig) => ({ ...(await orig<object>()), Orb: () => null }))
vi.mock('../contexts/AuthContext', () => ({ useAuth: () => ({ user: auth.user }) }))
vi.mock('../components/EntoAssistant/useAssistantContext', () => ({
  default: () => ({ context: { data: {} }, section: 'tasks', sectionSummary: '', sectionLabel: 'Tasks', isLoading: false, isReady: true }),
}))
vi.mock('../services/entoAssistantService', () => ({
  getStarter: () => ({ title: 'Ask about your tasks', prompts: [] }),
  streamQuery: vi.fn(),
}))
vi.mock('../components/bench/useMediaQuery', () => ({ useMediaQuery: () => false, PHONE_QUERY: '' }))
const api = vi.hoisted(() => ({
  latestThread: vi.fn(),
  threads: { list: vi.fn(), get: vi.fn(), remove: vi.fn() },
  actions: { list: vi.fn(), confirm: vi.fn(), reject: vi.fn(), undo: vi.fn(), edit: vi.fn() },
  plans: { confirm: vi.fn(), reject: vi.fn(), undo: vi.fn() },
  signals: vi.fn(),
}))
vi.mock('../services/api', () => ({ entoAiApi: api }))

import EntoAssistant from '../components/EntoAssistant/EntoAssistant'

const at = (hour: number) => new Date(2026, 10, 23, hour, 15)

describe('welcomeGreeting (ported from Logos AI)', () => {
  test('greets by first name, and fits the time of day', () => {
    expect(welcomeGreeting({ now: at(9), name: 'Frank Messana', pick: 0 })).toBe('Good morning, Frank')
    expect(welcomeGreeting({ now: at(14), name: 'Frank Messana', pick: 0 })).toBe('Good afternoon, Frank')
    expect(welcomeGreeting({ now: at(19), name: 'Frank Messana', pick: 0 })).toBe('Good evening, Frank')
    expect(welcomeGreeting({ now: at(23), name: 'Frank Messana', pick: 0 })).toBe('Working late, Frank?')
    expect(welcomeGreeting({ now: at(3), name: 'Frank', pick: 0 })).toBe('Working late, Frank?')
  })

  test("varies between visits, including a let's-get-to-work line", () => {
    const titles = [0, 1, 2].map((pick) => welcomeGreeting({ now: at(10), name: 'Frank', pick }))
    expect(new Set(titles).size).toBe(3)
    expect(titles).toContain("Let's get to work, Frank")
  })

  test('reads cleanly with no name', () => {
    for (const hour of [9, 14, 19, 23]) {
      for (let pick = 0; pick < linesForHour(hour).length; pick += 1) {
        const title = welcomeGreeting({ now: at(hour), name: '  ', pick })
        expect(title).not.toMatch(/,\s*[?.]|,\s*$|null|undefined/)
      }
    }
  })

  test('takes the first word of a name', () => {
    expect(firstNameOf('Frank Messana')).toBe('Frank')
    expect(firstNameOf(null)).toBeNull()
    expect(firstNameOf('')).toBeNull()
  })
})

describe('welcome greeting in the panel', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.useFakeTimers({ toFake: ['Date'] })
    vi.setSystemTime(at(9))
    vi.spyOn(Math, 'random').mockReturnValue(0)
    window.matchMedia = window.matchMedia || ((q: string) => ({ matches: false, media: q, addEventListener() {}, removeEventListener() {}, addListener() {}, removeListener() {} }) as unknown as MediaQueryList)
    Element.prototype.scrollIntoView = vi.fn()
    api.latestThread.mockResolvedValue(null)
    auth.user = { id: 'user-a', email: 'a@example.com', name: 'Frank Messana' }
  })
  afterEach(() => {
    vi.useRealTimers()
    vi.restoreAllMocks()
  })

  const panel = (isOpen: boolean) => <MemoryRouter><EntoAssistant isOpen={isOpen} onClose={() => {}} /></MemoryRouter>

  test('the title greets the user and the page line stays under it', async () => {
    render(panel(true))
    expect((await screen.findByRole('heading', { level: 3 })).textContent).toBe('Good morning, Frank')
    expect(screen.getByText('Ask about your tasks.')).toBeTruthy()
  })

  test('a user with no name gets the greeting without one, never the email', async () => {
    auth.user = { id: 'user-a', email: 'a@example.com' }
    render(panel(true))
    expect((await screen.findByRole('heading', { level: 3 })).textContent).toBe('Good morning')
  })

  test('the panel stays mounted, so reopening it draws the greeting again', async () => {
    const { rerender } = render(panel(true))
    expect((await screen.findByRole('heading', { level: 3 })).textContent).toBe('Good morning, Frank')
    rerender(panel(false))
    vi.setSystemTime(at(19))
    rerender(panel(true))
    expect((await screen.findByRole('heading', { level: 3 })).textContent).toBe('Good evening, Frank')
  })
})
