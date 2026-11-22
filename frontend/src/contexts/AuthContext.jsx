import React, { createContext, useContext, useState, useEffect, useRef, useMemo, useCallback } from 'react'
import { authService } from '../services/authService'
import { setMonitoringUser } from '../services/monitoring'

const AuthContext = createContext(undefined)

export const useAuth = () => {
  const context = useContext(AuthContext)
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider')
  }
  return context
}

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null)
  const [session, setSession] = useState(null)
  const [loading, setLoading] = useState(true)

  // Track user-initiated sign-out vs session expiry
  const isUserSignOut = useRef(false)
  const prevUserRef = useRef(null)

  useEffect(() => {
    prevUserRef.current = user
  }, [user])

  // Error reports carry the user id only (no email or name)
  useEffect(() => {
    setMonitoringUser(user?.id)
  }, [user?.id])

  useEffect(() => {
    let isMounted = true

    // Check active session on mount
    const checkSession = async () => {
      try {
        const session = await authService.getSession()
        if (!isMounted) return
        setSession(session)

        if (session?.user) {
          setUser(authService.toAuthUser(session.user))
        }
      } catch (error) {
        console.error('Error checking session:', error)
      } finally {
        if (isMounted) setLoading(false)
      }
    }

    checkSession()

    // Listen for auth changes
    const { data: { subscription } } = authService.onAuthStateChange(
      async (event, session) => {
        if (!isMounted) return
        setSession(session)

        if (event === 'SIGNED_OUT') {
          isUserSignOut.current = false
        }

        // A reset link that fell back to the site URL still lands on the reset page.
        if (event === 'PASSWORD_RECOVERY' && window.location.pathname !== '/reset-password') {
          window.location.replace('/reset-password')
          return
        }

        if (session?.user) {
          setUser(authService.toAuthUser(session.user))
        } else {
          setUser(null)
        }

        setLoading(false)
      }
    )

    return () => {
      isMounted = false
      subscription.unsubscribe()
    }
  }, [])

  const signIn = useCallback(async (email, password) => {
    const { user: authUser, error } = await authService.signIn(email, password)
    if (authUser && !error) {
      setUser(authService.toAuthUser(authUser))
    }
    return { error }
  }, [])

  const signInWithOAuth = useCallback(async (provider) => {
    const { error } = await authService.signInWithOAuth(provider)
    return { error }
  }, [])

  const signUp = useCallback(async (email, password, metadata) => {
    const { user: authUser, session: newSession, error } = await authService.signUp(email, password, metadata)
    // Without a session the account waits for email confirmation: stay signed out.
    if (authUser && newSession && !error) {
      setUser(authService.toAuthUser(authUser))
    }
    return { error, needsConfirmation: !error && !!authUser && !newSession }
  }, [])

  const resetPassword = useCallback((email) => authService.resetPassword(email), [])
  const updatePassword = useCallback((password) => authService.updatePassword(password), [])

  const signOut = useCallback(async () => {
    isUserSignOut.current = true
    await authService.signOut()
    setUser(null)
    setSession(null)
  }, [])

  // Compatibility shim — components that used Clerk's getToken() can use this
  const getToken = useCallback(async () => {
    if (!session?.access_token) {
      const freshSession = await authService.getSession()
      return freshSession?.access_token || null
    }
    return session.access_token
  }, [session])

  const value = useMemo(() => ({
    user,
    session,
    loading,
    isSignedIn: !!user,
    signIn,
    signInWithOAuth,
    signUp,
    resetPassword,
    updatePassword,
    signOut,
    getToken
  }), [user, session, loading, signIn, signInWithOAuth, signUp, resetPassword, updatePassword, signOut, getToken])

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  )
}
