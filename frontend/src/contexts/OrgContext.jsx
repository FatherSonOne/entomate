import React, { createContext, useContext, useState, useEffect, useMemo, useCallback } from 'react'
import { useAuth } from './AuthContext'
import { tenantOrgService } from '../services/tenantOrgService'

// ============================================
// OrgContext — provides the current tenant organization to all components
// ============================================

const OrgContext = createContext(undefined)

export const useOrg = () => {
  const context = useContext(OrgContext)
  if (context === undefined) {
    throw new Error('useOrg must be used within an OrgProvider')
  }
  return context
}

export const useOrgSafe = () => {
  return useContext(OrgContext) ?? null
}

export const OrgProvider = ({ children }) => {
  const { user, loading: authLoading } = useAuth()

  const [org, setOrg] = useState(null)
  const [orgMembers, setOrgMembers] = useState([])
  const [myRole, setMyRole] = useState(null)
  const [pendingInvite, setPendingInvite] = useState(null)
  const [deletedOrg, setDeletedOrg] = useState(null)
  const [loading, setLoading] = useState(true)

  const fetchOrg = useCallback(async () => {
    if (!user) {
      setOrg(null)
      setOrgMembers([])
      setMyRole(null)
      setPendingInvite(null)
      setLoading(false)
      return
    }

    setLoading(true)
    try {
      const fetchedOrg = await tenantOrgService.getCurrentOrg()

      if (!fetchedOrg) {
        // No active org — check for soft-deleted org first
        const deleted = await tenantOrgService.getDeletedOrg().catch(() => null)
        if (deleted) {
          setOrg(null)
          setDeletedOrg(deleted)
          setOrgMembers([])
          setMyRole(null)
          setPendingInvite(null)
          setLoading(false)
          return
        }

        // No deleted org — check for pending team invite
        const teamInvite = await tenantOrgService.getPendingInviteForUser().catch(() => null)
        setOrg(null)
        setDeletedOrg(null)
        setOrgMembers([])
        setMyRole(null)
        setPendingInvite(teamInvite)
        setLoading(false)
        return
      }

      setDeletedOrg(null)

      setOrg(fetchedOrg)
      setPendingInvite(null)

      // Fetch members
      const members = await tenantOrgService.getOrgMembers(fetchedOrg.id)
      setOrgMembers(members)

      // Determine current user's role
      const myMembership = members.find(m => m.userId === user.id)
      setMyRole(myMembership?.role ?? null)
    } catch (error) {
      console.error('OrgContext: Failed to fetch org data', error)
      setOrg(null)
      setOrgMembers([])
      setMyRole(null)
      setPendingInvite(null)
    } finally {
      setLoading(false)
    }
  }, [user])

  useEffect(() => {
    if (authLoading) return
    fetchOrg()
  }, [authLoading, fetchOrg])

  const refreshOrg = useCallback(async () => {
    await fetchOrg()
  }, [fetchOrg])

  const createOrg = useCallback(async (name, plan) => {
    const slug = tenantOrgService.generateSlug(name)
    await tenantOrgService.createOrgViaRpc(name, slug, plan || 'free')
    await fetchOrg()
  }, [fetchOrg])

  const softDeleteOrg = useCallback(async (orgId) => {
    await tenantOrgService.softDeleteOrg(orgId)
    await fetchOrg()
  }, [fetchOrg])

  const hardDeleteOrg = useCallback(async (orgId) => {
    await tenantOrgService.hardDeleteOrg(orgId)
    setDeletedOrg(null)
    await fetchOrg()
  }, [fetchOrg])

  const restoreOrg = useCallback(async (orgId) => {
    await tenantOrgService.restoreOrg(orgId)
    setDeletedOrg(null)
    await fetchOrg()
  }, [fetchOrg])

  const value = useMemo(() => ({
    org,
    orgMembers,
    myRole,
    loading,
    pendingInvite,
    deletedOrg,
    refreshOrg,
    createOrg,
    softDeleteOrg,
    hardDeleteOrg,
    restoreOrg,
  }), [org, orgMembers, myRole, loading, pendingInvite, deletedOrg, refreshOrg, createOrg, softDeleteOrg, hardDeleteOrg, restoreOrg])

  return (
    <OrgContext.Provider value={value}>
      {children}
    </OrgContext.Provider>
  )
}
