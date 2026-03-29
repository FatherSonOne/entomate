// Auth Service — Handles all authentication operations using Supabase Auth
// Pattern mirrors Logos Vision / Pulse for consistency across the Trifecto
import { supabase } from './supabaseClient'

export const authService = {
  // Sign in with OAuth provider (Google)
  async signInWithOAuth(provider) {
    const googleParams = provider === 'google' ? {
      access_type: 'offline',
      prompt: 'select_account',
    } : undefined

    const { error } = await supabase.auth.signInWithOAuth({
      provider,
      options: {
        redirectTo: `${window.location.origin}/auth/callback`,
        queryParams: googleParams,
      }
    })

    return { error }
  },

  // Sign in with email and password
  async signIn(email, password) {
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password
    })
    return { user: data.user, error }
  },

  // Sign up with email and password
  async signUp(email, password, metadata) {
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: metadata || {}
      }
    })
    return { user: data.user, error }
  },

  // Sign out — comprehensive cleanup
  async signOut() {
    try {
      // Clear auth-related local storage
      const keysToRemove = []
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i)
        if (key && (
          key.includes('supabase') ||
          key.includes('google') ||
          key.includes('oauth') ||
          key.includes('auth') ||
          key.includes('token')
        )) {
          keysToRemove.push(key)
        }
      }
      keysToRemove.forEach(key => localStorage.removeItem(key))
      sessionStorage.clear()

      const { error } = await supabase.auth.signOut({ scope: 'global' })
      return { error }
    } catch (err) {
      console.error('Error during sign out:', err)
      const { error } = await supabase.auth.signOut({ scope: 'global' })
      return { error }
    }
  },

  // Get current session
  async getSession() {
    const { data } = await supabase.auth.getSession()
    return data.session
  },

  // Get current user
  async getCurrentUser() {
    const { data } = await supabase.auth.getUser()
    return data.user
  },

  // Listen to auth state changes
  onAuthStateChange(callback) {
    return supabase.auth.onAuthStateChange(callback)
  },

  // Convert Supabase User to a simple AuthUser shape
  toAuthUser(user) {
    if (!user) return null
    return {
      id: user.id,
      email: user.email || '',
      name: user.user_metadata?.name || user.user_metadata?.full_name,
      avatar_url: user.user_metadata?.avatar_url || user.user_metadata?.picture,
      role: user.user_metadata?.role || 'member'
    }
  }
}
