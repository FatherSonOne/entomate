import { supabase } from './supabaseClient'

/**
 * fetch() that adds the signed-in user's Supabase token.
 * Use it for direct fetch calls to the backend; the axios client in api.js
 * already does this for its own requests.
 */
export async function authFetch(url, options = {}) {
  let token = null
  try {
    const { data: { session } } = await supabase.auth.getSession()
    token = session?.access_token || null
  } catch (error) {
    console.debug('authFetch: no session', error.message)
  }
  const headers = { ...(options.headers || {}) }
  if (token) headers.Authorization = `Bearer ${token}`
  return fetch(url, { ...options, headers })
}
