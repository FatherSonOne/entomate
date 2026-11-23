import { test, expect } from 'vitest'

// The panel header's status word: it said nothing on an error or while context loaded, because
// it followed the voice state alone (idle in both).
import { headerStatusShown, orbStateFor } from '../components/EntoAssistant/AiOrb'

const base = { isListening: false, isLoading: false, isTyping: false, error: null as string | null, streamingText: '', toolSteps: [], thoughts: [], awaitingApproval: false, hasAnswered: false }
const shown = (contextLoading: boolean, voiceState: string, signals: Partial<typeof base>) =>
  headerStatusShown({ contextLoading, voiceState, orbState: orbStateFor({ ...base, ...signals } as never) })

test('speaks when there is something to say', () => {
  expect(shown(true, 'idle', {})).toBe(true) // Loading context
  expect(shown(false, 'thinking', { isLoading: true })).toBe(true) // a typed or spoken question
  expect(shown(false, 'speaking', { isLoading: true, streamingText: 'Hi' })).toBe(true)
  expect(shown(false, 'listening', { isListening: true })).toBe(true)
  expect(shown(false, 'idle', { error: 'Failed to connect.' })).toBe(true) // Something went wrong
  expect(shown(false, 'idle', { hasAnswered: true })).toBe(true) // Done, before it settles
})

test('stays quiet at rest and while the user types', () => {
  expect(shown(false, 'idle', {})).toBe(false)
  expect(shown(false, 'idle', { isTyping: true })).toBe(false)
})
