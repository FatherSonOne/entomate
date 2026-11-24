import { describe, expect, it } from 'vitest'
import { safeAuthDestination, signInPath } from '../services/authDestination'

describe('sign-in destinations', () => {
  it('round-trips the path, query and hash through the sign-in URL', () => {
    const original = '/tasks?view=lanes&name=Open%20items#queue'
    const signIn = new URL(signInPath(original), window.location.origin)
    expect(signIn.pathname).toBe('/sign-in')
    expect(safeAuthDestination(signIn.searchParams.get('next'))).toBe(original)
  })

  it.each([
    null,
    'https://othersite.example/',
    '//othersite.example/',
    '/\\othersite.example/',
    '/.//othersite.example/',
    '/tasks\n',
    '/auth/callback',
    '/sign-in?next=%2Ftasks',
    '/reset-password',
  ])('rejects an unsafe or recursive return destination %s', (value) => {
    expect(safeAuthDestination(value)).toBeNull()
    expect(signInPath(value)).toBe('/sign-in')
  })
})
