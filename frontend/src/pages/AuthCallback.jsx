import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../services/supabaseClient'
import EnhancedLoadingScreen from '../components/EnhancedLoadingScreen'
import { readOAuthDestination, rememberOAuthDestination, signInPath } from '../services/authDestination'

/**
 * OAuth callback handler
 * Supabase redirects here after Google auth completes.
 * The session tokens are in the URL hash — supabase-js picks them up automatically.
 */
export default function AuthCallback() {
  const navigate = useNavigate()
  const [destination] = useState(readOAuthDestination)

  useEffect(() => {
    let active = true
    const handleCallback = async () => {
      try {
        const { data: { session }, error } = await supabase.auth.getSession()

        if (error) console.error('Auth callback error:', error)
        if (active) navigate(session && !error ? destination ?? '/dashboard' : signInPath(destination), { replace: true })
      } catch (err) {
        console.error('Auth callback exception:', err)
        if (active) navigate(signInPath(destination), { replace: true })
      } finally {
        if (active) rememberOAuthDestination(null)
      }
    }

    handleCallback()
    return () => { active = false }
  }, [destination, navigate])

  return <EnhancedLoadingScreen stage="signin" />
}
