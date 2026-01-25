import { useEffect } from 'react'
import { useAuth } from '@clerk/clerk-react'
import { setTokenGetter } from '../services/api'

/**
 * Provider component that sets up Clerk token getter for API service
 * This should be placed inside ClerkProvider but outside routes
 */
export default function ClerkAuthProvider({ children }) {
  const { getToken, isSignedIn } = useAuth()

  useEffect(() => {
    // Set the token getter function
    const tokenGetter = async () => {
      if (!isSignedIn) {
        return null
      }
      try {
        return await getToken()
      } catch (error) {
        console.error('Error getting token:', error)
        return null
      }
    }

    setTokenGetter(tokenGetter)

    // Clear token getter on unmount
    return () => {
      setTokenGetter(null)
    }
  }, [getToken, isSignedIn])

  return children
}

