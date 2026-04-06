// billingService.js — Stripe-backed billing for Entomate (QntmEcos ecosystem)
import { supabase } from './supabaseClient'

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL

async function callEdgeFunction(name, body) {
  const { data: { session } } = await supabase.auth.getSession()
  if (!session) throw new Error('Not authenticated')

  const res = await fetch(`${SUPABASE_URL}/functions/v1/${name}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${session.access_token}`,
    },
    body: body ? JSON.stringify(body) : undefined,
  })

  const data = await res.json()
  if (!res.ok) throw new Error(data.error || 'Edge function call failed')
  return data
}

const billingService = {
  async getAvailablePlans() {
    const { data, error } = await supabase
      .from('plans')
      .select('*')
      .eq('is_active', true)
      .or('app.eq.entomate,app.eq.bundle')
      .order('tier')

    if (error) throw error
    return data || []
  },

  async getEntitlements(workspaceId) {
    const { data, error } = await supabase
      .from('entitlements')
      .select('*')
      .eq('workspace_id', workspaceId)
      .single()

    if (error || !data) {
      return {
        workspace_id: workspaceId,
        apps: {},
        max_users: 5,
        max_workflows: 5,
        max_workflow_runs_mo: 500,
        max_integrations: 3,
        features: {},
        is_trialing: false,
        trial_ends_at: null,
      }
    }

    // Fetch current usage
    const now = new Date()
    const periodStart = new Date(now.getFullYear(), now.getMonth(), 1)
      .toISOString().split('T')[0]

    const { data: usageRecords } = await supabase
      .from('usage_records')
      .select('metric, quantity')
      .eq('workspace_id', workspaceId)
      .eq('period_start', periodStart)

    const usage = {}
    if (usageRecords) {
      for (const record of usageRecords) {
        usage[record.metric] = record.quantity
      }
    }

    return { ...data, usage }
  },

  async getSubscription(workspaceId) {
    const { data } = await supabase
      .from('subscriptions')
      .select('*')
      .eq('workspace_id', workspaceId)
      .in('status', ['active', 'trialing', 'past_due'])
      .order('created_at', { ascending: false })
      .limit(1)
      .single()

    return data || null
  },

  async createCheckout({ workspaceId, planId, billingCycle }) {
    const { checkout_url } = await callEdgeFunction('billing-checkout', {
      workspace_id: workspaceId,
      plan_id: planId,
      billing_cycle: billingCycle,
      success_url: `${window.location.origin}/settings?billing=success`,
      cancel_url: `${window.location.origin}/settings?billing=canceled`,
    })
    return checkout_url
  },

  async openCustomerPortal(workspaceId) {
    const { portal_url } = await callEdgeFunction('billing-portal', {
      workspace_id: workspaceId,
      return_url: `${window.location.origin}/settings`,
    })
    return portal_url
  },

  async getInvoices(workspaceId) {
    const { data, error } = await supabase
      .from('invoices')
      .select('*')
      .eq('workspace_id', workspaceId)
      .order('created_at', { ascending: false })
      .limit(24)

    if (error) throw error
    return data || []
  },

  getEntomateTier(entitlements) {
    return entitlements?.apps?.entomate || 'free'
  },

  canUseFeature(entitlements, feature) {
    return !!entitlements?.features?.[feature]
  },

  isAtLimit(entitlements, metric) {
    const usage = entitlements?.usage?.[metric] || 0
    let limit = null
    switch (metric) {
      case 'workflow_runs': limit = entitlements?.max_workflow_runs_mo; break
    }
    if (limit === null) return false
    return usage >= limit
  },
}

export default billingService
