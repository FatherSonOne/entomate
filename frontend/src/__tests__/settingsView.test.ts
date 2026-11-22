import { describe, expect, it } from 'vitest'
import {
  findSettings, initials, readUrlState, resolveSection, serviceState, writeUrlState,
} from '../services/settingsView'

describe('settingsView', () => {
  it('maps the old 13 tabs onto the five sections', () => {
    expect(resolveSection('organization')).toEqual({ section: 'workspace' })
    expect(resolveSection('auto-join')).toEqual({ section: 'recording' })
    expect(resolveSection('ai-learning-full')).toEqual({ section: 'agents', drawer: 'learning' })
    expect(resolveSection('billing')).toEqual({ section: 'workspace', drawer: 'billing' })
    expect(resolveSection('connections')).toEqual({ section: 'connections' })
    expect(resolveSection('appearance')).toEqual({ section: 'appearance' })
    expect(resolveSection('nope')).toBeNull()
    expect(resolveSection(null)).toBeNull()
  })

  it('reads section, drawer and query from the URL, accepting legacy ?section=', () => {
    expect(readUrlState(new URLSearchParams('s=agents&dr=learning&q=mic'))).toEqual({ section: 'agents', drawer: 'learning', query: 'mic' })
    expect(readUrlState(new URLSearchParams('section=billing'))).toEqual({ section: 'workspace', drawer: 'billing', query: '' })
    expect(readUrlState(new URLSearchParams('dr=bogus'))).toEqual({ section: null, drawer: null, query: '' })
  })

  it('writes URL state without dropping unrelated keys', () => {
    const p = writeUrlState(new URLSearchParams('connected=true&section=audio'), { section: 'recording', drawer: null })
    expect(p.get('connected')).toBe('true')
    expect(p.get('s')).toBe('recording')
    expect(p.has('section')).toBe(false)
    expect(p.has('dr')).toBe(false)
  })

  it('finds settings by any word, all terms required', () => {
    expect(findSettings('').length).toBe(0)
    expect(findSettings('mic').map((e) => e.label)).toContain('Microphone')
    expect(findSettings('invite').map((e) => e.label)).toEqual(['Team members'])
    expect(findSettings('gdpr consent').map((e) => e.label)).toEqual(['Consent rules'])
    expect(findSettings('loading screen').map((e) => e.label)).toEqual(['Logo and loading screen'])
    expect(findSettings('zzz')).toEqual([])
  })

  it('normalises service status strings', () => {
    expect(serviceState('connected')).toBe('up')
    expect(serviceState(true)).toBe('up')
    expect(serviceState('not configured')).toBe('unset')
    expect(serviceState(undefined)).toBe('unset')
    expect(serviceState('error')).toBe('down')
    expect(serviceState('weird')).toBe('unknown')
  })

  it('builds initials from a name or an email', () => {
    expect(initials('Dana Ruiz')).toBe('DR')
    expect(initials('', 'jo.kim@x.org')).toBe('JK')
    expect(initials(null)).toBe('?')
  })
})
