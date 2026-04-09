import { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../services/supabaseClient'
import EnhancedLoadingScreen from '../components/EnhancedLoadingScreen'

/**
 * OAuth callback handler
 * Supabase redirects here after Google auth completes.
 * The session tokens are in the URL hash — supabase-js picks them up automatically.
 */
export default function AuthCallback() {
  const navigate = useNavigate()

  useEffect(() => {
    const handleCallback = async () => {
      try {
        const { data: { session }, error } = await supabase.auth.getSession()

        if (error) {
          console.error('Auth callback error:', error)
          navigate('/sign-in', { replace: true })
          return
        }

        if (session) {
          navigate('/dashboard', { replace: true })
        } else {
          navigate('/sign-in', { replace: true })
        }
      } catch (err) {
        console.error('Auth callback exception:', err)
        navigate('/sign-in', { replace: true })
      }
    }

    handleCallback()
  }, [navigate])

  return <EnhancedLoadingScreen autoAnimate />
}
