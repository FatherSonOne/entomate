// useEntitlements.js — React hook for Entomate feature gating
import { useState, useEffect, useCallback, useMemo } from 'react'
import billingService from '../services/billingService'
import { supabase } from '../services/supabaseClient'

export function useEntitlements() {
  const [entitlements, setEntitlements] = useState(null)
  const [isLoading, setIsLoading] = useState(true)
  const [workspaceId, setWorkspaceId] = useState(null)

  // Get the user's workspace ID
  useEffect(() => {
    const getWorkspaceId = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      const { data } = await supabase
        .from('workspace_members')
        .select('workspace_id')
        .eq('user_id', user.id)
        .limit(1)
        .single()

      if (data) setWorkspaceId(data.workspace_id)
    }
    getWorkspaceId()
  }, [])

  const fetchEntitlements = useCallback(async () => {
    if (!workspaceId) {
      setEntitlements(null)
      setIsLoading(false)
      return
    }
    try {
      setIsLoading(true)
      const data = await billingService.getEntitlements(workspaceId)
      setEntitlements(data)
    } catch (err) {
      console.error('Failed to load entitlements:', err)
    } finally {
      setIsLoading(false)
    }
  }, [workspaceId])

  useEffect(() => {
    fetchEntitlements()
  }, [fetchEntitlements])

  const canUse = useCallback((feature) => {
    if (!entitlements) return false
    return billingService.canUseFeature(entitlements, feature)
  }, [entitlements])

  const isAtLimit = useCallback((metric) => {
    if (!entitlements) return false
    return billingService.isAtLimit(entitlements, metric)
  }, [entitlements])

  const entTier = useMemo(() => {
    return entitlements?.apps?.entomate || 'free'
  }, [entitlements])

  const isTrialing = entitlements?.is_trialing || false

  const trialDaysLeft = useMemo(() => {
    if (!entitlements?.trial_ends_at) return 0
    const diff = new Date(entitlements.trial_ends_at).getTime() - Date.now()
    return Math.max(0, Math.ceil(diff / (1000 * 60 * 60 * 24)))
  }, [entitlements])

  return {
    entitlements,
    isLoading,
    workspaceId,
    canUse,
    isAtLimit,
    entTier,
    isTrialing,
    trialDaysLeft,
    refresh: fetchEntitlements,
  }
}
