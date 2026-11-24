const OAUTH_DESTINATION_KEY = 'entomate.oauth.destination'

export function safeAuthDestination(value: string | null): string | null {
  if (!value?.startsWith('/') || value.startsWith('//') || /[\\\x00-\x20\x7f]/.test(value)) return null
  const origin = window.location.origin
  const url = new URL(value, origin)
  if (url.origin !== origin || url.pathname.startsWith('//') ||
      /^\/(?:sign-in|auth|reset-password)(?:\/|$)/i.test(url.pathname)) return null
  return url.pathname + url.search + url.hash
}

export function signInPath(value: string | null): string {
  const next = safeAuthDestination(value)
  return next ? `/sign-in?${new URLSearchParams({ next })}` : '/sign-in'
}

export function rememberOAuthDestination(value: string | null): void {
  try {
    if (value) sessionStorage.setItem(OAUTH_DESTINATION_KEY, value)
    else sessionStorage.removeItem(OAUTH_DESTINATION_KEY)
  } catch {
    // OAuth can still proceed when browser storage is unavailable.
  }
}

export function readOAuthDestination(): string | null {
  try { return safeAuthDestination(sessionStorage.getItem(OAUTH_DESTINATION_KEY)) } catch { return null }
}
