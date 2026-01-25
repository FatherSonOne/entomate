import { useAuth } from '@clerk/clerk-react'

/**
 * Hook to get the current auth token from Clerk
 * Returns null if not authenticated
 */
export function useAuthToken() {
  const { getToken, isSignedIn } = useAuth()
  
  const getAuthToken = async () => {
    if (!isSignedIn) {
      return null
    }
    try {
      return await getToken()
    } catch (error) {
      console.error('Error getting auth token:', error)
      return null
    }
  }
  
  return { getAuthToken, isSignedIn }
}

