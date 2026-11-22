import { describe, expect, it } from 'vitest'
import { classifyError, errorCopy, errorReport } from '../services/errorKinds'

const withStatus = (status: number): Error => Object.assign(new Error('x'), { status })

describe('classifyError', () => {
  it('reads a failed page chunk as a stale deploy, or offline when there is no connection', () => {
    const e = new TypeError('Failed to fetch dynamically imported module: /assets/Tasks-abc.js')
    expect(classifyError(e, true)).toBe('stale-deploy')
    expect(classifyError(e, false)).toBe('offline')
  })
  it('sorts HTTP statuses', () => {
    expect(classifyError(withStatus(401), true)).toBe('session')
    expect(classifyError(withStatus(403), true)).toBe('permission')
    expect(classifyError(withStatus(404), true)).toBe('not-found')
    expect(classifyError(withStatus(502), true)).toBe('server')
  })
  it('sorts Supabase and network messages', () => {
    expect(classifyError(new Error('JWT expired'), true)).toBe('session')
    expect(classifyError(new Error('new row violates row-level security policy'), true)).toBe('permission')
    expect(classifyError(new TypeError('Failed to fetch'), true)).toBe('network')
  })
  it('falls back to a page error for render bugs', () => {
    const e = new TypeError("Cannot read properties of undefined (reading 'consent_at')")
    expect(classifyError(e, true)).toBe('render')
    expect(errorCopy('render').primary).toBe('retry')
  })
  it('puts the message in the copied report', () => {
    expect(errorReport(new Error('boom'), 'render')).toContain('Error: Error: boom')
  })
})
