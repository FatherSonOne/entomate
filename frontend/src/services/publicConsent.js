const apiOrigin = (import.meta.env.VITE_API_URL || '').replace(/\/+$/, '')

// Consent links work without a session. Submit once and let the user retry
// explicitly if the service is unavailable.
export async function requestConsent(path, options) {
  const response = await fetch(`${apiOrigin}/api/consent${path}`, {
    credentials: 'omit',
    cache: 'no-store',
    ...options,
  })
  if (!response.headers.get('content-type')?.includes('application/json')) {
    throw new Error('Expected a JSON response from the consent service')
  }
  return { status: response.status, ok: response.ok, data: await response.json() }
}
