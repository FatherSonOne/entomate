import { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../services/supabaseClient'

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
        // supabase-js automatically extracts tokens from the URL hash
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

  return (
    <div style={{
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      minHeight: '100vh',
      background: '#080808',
      color: 'rgba(255,248,250,0.6)',
      fontFamily: "'Space Grotesk', sans-serif",
    }}>
      <div style={{ textAlign: 'center' }}>
        <div style={{
          width: 40,
          height: 40,
          border: '3px solid rgba(220,38,38,0.3)',
          borderTopColor: '#dc2626',
          borderRadius: '50%',
          animation: 'spin 0.8s linear infinite',
          margin: '0 auto 16px',
        }} />
        <p>Signing you in...</p>
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      </div>
    </div>
  )
}
