import { useLayoutEffect, useRef } from 'react'
import { useAuth } from '../contexts/AuthContext'
import { authService } from '../services/authService'
import { connectLogoAccount } from '../services/logoSystem'
import { supabase } from '../services/supabaseClient'

const LOGO_METADATA_KEY = 'entomate_logo'

async function requestAccountLogo(userId, logoId) {
  const session = await authService.getSession()
  if (session?.user?.id !== userId) throw new Error('Logo account has changed')

  if (logoId === undefined) {
    const { data, error } = await supabase.auth.getUser(session.access_token)
    if (error || data.user?.id !== userId) throw error ?? new Error('Logo account has changed')
    return data.user.user_metadata?.[LOGO_METADATA_KEY]
  }

  // Bind the write to the captured user's token even if the active session changes in flight.
  const response = await fetch(new URL('/auth/v1/user', import.meta.env.VITE_SUPABASE_URL), {
    method: 'PUT',
    headers: {
      apikey: import.meta.env.VITE_SUPABASE_ANON_KEY,
      Authorization: `Bearer ${session.access_token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ data: { [LOGO_METADATA_KEY]: logoId } }),
  })
  if (!response.ok) throw new Error('Account logo could not be saved')
  const user = await response.json()
  if (user.id !== userId) throw new Error('Logo account has changed')
  return user.user_metadata?.[LOGO_METADATA_KEY]
}

export default function AccountLogoSync() {
  const { session } = useAuth()
  const userId = session?.user?.id
  const sessionLogo = useRef()
  sessionLogo.current = session?.user?.user_metadata?.[LOGO_METADATA_KEY]

  // Refresh on identity changes, outside Supabase's auth event callback.
  useLayoutEffect(() => {
    if (!userId) return undefined
    return connectLogoAccount(userId, sessionLogo.current, (logoId) => requestAccountLogo(userId, logoId))
  }, [userId])

  return null
}
