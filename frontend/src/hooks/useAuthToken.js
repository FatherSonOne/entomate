import { useAuth } from '../contexts/AuthContext'

/**
 * Hook to get the current auth token from Supabase
 * Returns null if not authenticated
 */
export function useAuthToken() {
  const { session, isSignedIn } = useAuth()

  const getAuthToken = async () => {
    if (!isSignedIn || !session) {
      return null
    }
    return session.access_token || null
  }

  return { getAuthToken, isSignedIn }
}
