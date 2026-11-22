import { describe, expect, it } from 'vitest'
import { describeAuthError, validate, viewFromParam } from '../services/signInView'

const empty = { name: '', email: '', password: '' }

describe('signInView', () => {
  it('reads the mode param', () => {
    expect(viewFromParam('signup')).toBe('signup')
    expect(viewFromParam('forgot')).toBe('forgot')
    expect(viewFromParam('sent')).toBe('signin')
    expect(viewFromParam(null)).toBe('signin')
  })

  it('validates per view', () => {
    expect(validate('signin', { ...empty, email: 'bad' })).toMatch(/valid email/)
    expect(validate('signin', { ...empty, email: 'a@b.co' })).toMatch(/password/)
    expect(validate('signin', { ...empty, email: 'a@b.co', password: 'x' })).toBeNull()
    expect(validate('signup', { ...empty, email: 'a@b.co', password: 'longenough' })).toMatch(/name/)
    expect(validate('signup', { name: 'Dana', email: 'a@b.co', password: '123' })).toMatch(/6 characters/)
    expect(validate('forgot', { ...empty, email: 'a@b.co' })).toBeNull()
  })

  it('explains auth errors with a next step', () => {
    const bad = describeAuthError('signin', 'Invalid login credentials')
    expect(bad.detail).toMatch(/don't match/)
    expect(bad.offerReset).toBe(true)
    expect(describeAuthError('signup', 'User already registered').detail).toMatch(/already exists/)
    expect(describeAuthError('forgot', 'Email rate limit exceeded').detail).toMatch(/Too many/)
    expect(describeAuthError('signin', '').detail).toMatch(/Try again/)
  })
})

describe('signInRotation', () => {
  it('rotates without repeating', async () => {
    const { nextIndex, SIGNIN_TAGLINES } = await import('../services/signInRotation')
    const n = SIGNIN_TAGLINES.length
    expect(nextIndex(0, n, 3)).toBe(1)
    expect(nextIndex(n - 1, n, 3)).toBe(0)
    expect(nextIndex(-1, n, 3)).toBe(3)
    expect(nextIndex(Number.NaN, n, 2)).toBe(2)
  })
})
