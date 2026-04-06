import { supabase } from './supabaseClient'
import { TENANT_PLAN_AI_LIMITS } from '../constants/plans'

// ============================================
// Tenant Organization Service
// CRUD for multi-tenant organizations, members, and AI usage tracking
// ============================================

// --- Helpers ---

function mapDbToOrg(row) {
  return {
    id: row.id,
    name: row.name,
    slug: row.slug,
    plan: row.plan,
    aiMonthlyLimit: row.ai_monthly_limit,
    aiCustomApiKeyActive: row.ai_custom_api_key_active || false,
    stripeCustomerId: row.stripe_customer_id || null,
    stripeSubscriptionId: row.stripe_subscription_id || null,
    settings: row.settings || {},
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

function mapDbToMember(row) {
  return {
    id: row.id,
    orgId: row.org_id,
    userId: row.user_id,
    role: row.role,
    invitedBy: row.invited_by || null,
    joinedAt: row.joined_at,
    userName: row.user_name,
    userEmail: row.user_email,
    userAvatarUrl: row.user_avatar_url,
  }
}

function mapDbToInvite(row) {
  return {
    id: row.id,
    orgId: row.org_id,
    email: row.email,
    role: row.role,
    token: row.token,
    invitedBy: row.invited_by,
    status: row.status,
    expiresAt: row.expires_at,
    createdAt: row.created_at,
  }
}

function mapDbToAiUsage(row) {
  return {
    id: row.id,
    orgId: row.org_id,
    month: row.month,
    requestCount: row.request_count,
    tokensInput: row.tokens_input,
    tokensOutput: row.tokens_output,
    estimatedCost: row.estimated_cost,
  }
}

function getCurrentMonth() {
  const now = new Date()
  const year = now.getFullYear()
  const month = String(now.getMonth() + 1).padStart(2, '0')
  return `${year}-${month}`
}

// --- Organization ---

async function getCurrentOrg() {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null

  const { data, error } = await supabase
    .from('org_members')
    .select('org_id, tenant_organizations(*)')
    .eq('user_id', user.id)
    .limit(1)
    .maybeSingle()

  if (error) throw error
  if (!data || !data.tenant_organizations) return null

  return mapDbToOrg(data.tenant_organizations)
}

async function updateOrg(orgId, updates) {
  const dbUpdates = {}
  if (updates.name !== undefined) dbUpdates.name = updates.name
  if (updates.slug !== undefined) dbUpdates.slug = updates.slug
  if (updates.settings !== undefined) dbUpdates.settings = updates.settings

  const { data, error } = await supabase
    .from('tenant_organizations')
    .update(dbUpdates)
    .eq('id', orgId)
    .select()
    .single()

  if (error) throw error
  return mapDbToOrg(data)
}

// --- Members ---

async function getOrgMembers(orgId) {
  const { data, error } = await supabase
    .from('org_members')
    .select('*')
    .eq('org_id', orgId)
    .order('joined_at', { ascending: true })

  if (error) throw error
  return (data || []).map(mapDbToMember)
}

// --- AI Usage ---

async function getAiUsage(orgId, month) {
  const targetMonth = month || getCurrentMonth()

  const { data, error } = await supabase
    .from('org_ai_usage_monthly')
    .select('*')
    .eq('org_id', orgId)
    .eq('month', targetMonth)
    .maybeSingle()

  if (error) throw error
  if (!data) return null
  return mapDbToAiUsage(data)
}

async function incrementAiUsage(orgId) {
  const month = getCurrentMonth()

  const { error: rpcError } = await supabase.rpc('increment_ai_usage', {
    p_org_id: orgId,
    p_month: month,
  })

  if (rpcError) {
    // Fallback: read-then-upsert
    const existing = await getAiUsage(orgId, month)

    if (existing) {
      const { error } = await supabase
        .from('org_ai_usage_monthly')
        .update({ request_count: existing.requestCount + 1 })
        .eq('id', existing.id)
      if (error) throw error
    } else {
      const { error } = await supabase
        .from('org_ai_usage_monthly')
        .insert({ org_id: orgId, month, request_count: 1, tokens_input: 0, tokens_output: 0, estimated_cost: 0 })
      if (error) throw error
    }
  }
}

async function checkAiQuota(orgId) {
  const { data: orgData, error: orgError } = await supabase
    .from('tenant_organizations')
    .select('plan, ai_monthly_limit')
    .eq('id', orgId)
    .single()

  if (orgError) throw orgError

  const limit = orgData.ai_monthly_limit || TENANT_PLAN_AI_LIMITS[orgData.plan] || 100

  const usage = await getAiUsage(orgId)
  const used = usage?.requestCount || 0

  return { allowed: used < limit, used, limit }
}

// --- Organization Creation ---

function generateSlug(name) {
  const base = name
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
  const rand = Math.random().toString(36).substring(2, 6)
  return `${base}-${rand}`
}

async function createOrgViaRpc(name, slug, plan = 'free') {
  const { error } = await supabase.rpc('create_org_for_user', {
    p_name: name,
    p_slug: slug,
    p_plan: plan,
  })

  if (error) throw error

  const org = await getCurrentOrg()
  if (!org) throw new Error('Organization created but could not be fetched')
  return org
}

// --- Member Management ---

async function sendOrgInviteEmail(email, token, options = {}) {
  const { orgName = 'your team', inviterName, personalMessage } = options

  try {
    const { error } = await supabase.functions.invoke('send-email', {
      body: {
        to: email,
        subject: `You're invited to join ${orgName} on Entomate`,
        html: `
          <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; max-width: 520px; margin: 0 auto;">
            <div style="background: linear-gradient(135deg, #FF2D6B, #FF6B8A); padding: 32px; border-radius: 12px 12px 0 0; text-align: center;">
              <h1 style="color: white; margin: 0; font-size: 22px;">Entomate</h1>
              <p style="color: rgba(255,255,255,0.85); margin: 8px 0 0; font-size: 14px;">AI-Powered Meeting Intelligence</p>
            </div>
            <div style="background: #1a1a2e; padding: 32px; border-radius: 0 0 12px 12px; color: #e0e0e0;">
              <h2 style="color: #fff; margin: 0 0 16px; font-size: 18px;">You've been invited!</h2>
              <p style="margin: 0 0 12px; line-height: 1.6;">
                ${inviterName ? `<strong style="color: #FF6B8A;">${inviterName}</strong> has` : 'You have been'}
                invited you to join <strong style="color: #FF6B8A;">${orgName}</strong> on Entomate.
              </p>
              ${personalMessage ? `<p style="margin: 0 0 12px; padding: 12px; background: rgba(255,45,107,0.08); border-radius: 8px; font-style: italic; color: #ccc;">"${personalMessage}"</p>` : ''}
              <a href="${typeof window !== 'undefined' ? window.location.origin : ''}/auth/callback?invite=${token}"
                 style="display: inline-block; background: #FF2D6B; color: white; padding: 12px 28px; border-radius: 8px; text-decoration: none; font-weight: 600; margin: 16px 0;">
                Accept Invitation
              </a>
              <p style="margin: 16px 0 0; font-size: 12px; color: #888;">
                This invite expires in 7 days. If you didn't expect this, you can ignore it.
              </p>
            </div>
          </div>
        `,
      },
    })
    if (error) console.warn('Invite email sending failed (non-fatal):', error.message)
  } catch (err) {
    console.warn('Invite email sending failed (non-fatal):', err.message)
  }
}

async function inviteMember(orgId, email, role, options = {}) {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Not authenticated')

  const { data, error } = await supabase
    .from('org_invites')
    .insert({
      org_id: orgId,
      email: email.toLowerCase().trim(),
      role,
      invited_by: user.id,
    })
    .select()
    .single()

  if (error) throw error

  const invite = mapDbToInvite(data)

  // Best-effort email sending
  await sendOrgInviteEmail(invite.email, invite.token, {
    orgName: options.orgName,
    inviterName: options.inviterName,
    personalMessage: options.personalMessage,
  })

  return invite
}

async function getOrgInvites(orgId) {
  const { data, error } = await supabase
    .from('org_invites')
    .select('*')
    .eq('org_id', orgId)
    .eq('status', 'pending')
    .order('created_at', { ascending: false })

  if (error) throw error
  return (data || []).map(mapDbToInvite)
}

async function revokeInvite(inviteId) {
  const { error } = await supabase
    .from('org_invites')
    .update({ status: 'revoked' })
    .eq('id', inviteId)
  if (error) throw error
}

async function acceptInvite(token) {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Not authenticated')

  const { data: invite, error: findError } = await supabase
    .from('org_invites')
    .select('*')
    .eq('token', token)
    .eq('status', 'pending')
    .single()

  if (findError || !invite) throw new Error('Invalid or expired invite')

  if (new Date(invite.expires_at) < new Date()) {
    await supabase.from('org_invites').update({ status: 'expired' }).eq('id', invite.id)
    throw new Error('This invite has expired')
  }

  const { data: member, error: memberError } = await supabase
    .from('org_members')
    .insert({
      org_id: invite.org_id,
      user_id: user.id,
      role: invite.role,
      invited_by: invite.invited_by,
    })
    .select()
    .single()

  if (memberError) throw memberError

  await supabase.from('org_invites').update({ status: 'accepted' }).eq('id', invite.id)

  return mapDbToMember(member)
}

async function updateMemberRole(memberId, newRole) {
  const { data: currentMember, error: fetchError } = await supabase
    .from('org_members')
    .select('id, org_id, role')
    .eq('id', memberId)
    .single()

  if (fetchError) throw fetchError

  if (currentMember.role === 'owner' && newRole !== 'owner') {
    const { count, error: countError } = await supabase
      .from('org_members')
      .select('id', { count: 'exact', head: true })
      .eq('org_id', currentMember.org_id)
      .eq('role', 'owner')

    if (countError) throw countError
    if ((count ?? 0) <= 1) {
      throw new Error('Cannot demote the last owner. Promote another member to owner first.')
    }
  }

  const { data, error } = await supabase
    .from('org_members')
    .update({ role: newRole })
    .eq('id', memberId)
    .select()
    .single()

  if (error) throw error
  return mapDbToMember(data)
}

async function removeMember(memberId) {
  const { data: member, error: fetchError } = await supabase
    .from('org_members')
    .select('id, org_id, role')
    .eq('id', memberId)
    .single()

  if (fetchError) throw fetchError

  if (member.role === 'owner') {
    const { count, error: countError } = await supabase
      .from('org_members')
      .select('id', { count: 'exact', head: true })
      .eq('org_id', member.org_id)
      .eq('role', 'owner')

    if (countError) throw countError
    if ((count ?? 0) <= 1) {
      throw new Error('Cannot remove the last owner. Transfer ownership first.')
    }
  }

  const { error } = await supabase.from('org_members').delete().eq('id', memberId)
  if (error) throw error
}

// --- Usage History ---

async function getAiUsageHistory(orgId, months = 6) {
  const { data, error } = await supabase
    .from('org_ai_usage_monthly')
    .select('*')
    .eq('org_id', orgId)
    .order('month', { ascending: false })
    .limit(months)

  if (error) throw error
  return (data || []).map(mapDbToAiUsage)
}

async function updateOrgPlan(orgId, newPlan) {
  const planLimitDefaults = {
    free: 100,
    starter: 500,
    pro: 2000,
    business: 10000,
    ecosystem: 10000,
  }

  const { data, error } = await supabase
    .from('tenant_organizations')
    .update({
      plan: newPlan,
      ai_monthly_limit: planLimitDefaults[newPlan] || 100,
    })
    .eq('id', orgId)
    .select()
    .single()

  if (error) throw error
  return mapDbToOrg(data)
}

async function setDevModeQuota(orgId, enabled, currentPlan) {
  const planDefaults = {
    free: 100, starter: 500, pro: 2000, business: 10000, ecosystem: 10000,
  }
  const limit = enabled ? 99999 : (planDefaults[currentPlan] || 100)

  const { error } = await supabase
    .from('tenant_organizations')
    .update({ ai_monthly_limit: limit })
    .eq('id', orgId)

  if (error) throw error
}

async function getPendingInviteForUser() {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user?.email) return null

  const { data, error } = await supabase
    .from('org_invites')
    .select('*')
    .eq('email', user.email)
    .eq('status', 'pending')
    .gt('expires_at', new Date().toISOString())
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (error || !data) return null
  return mapDbToInvite(data)
}

// --- Organization Deletion ---

async function softDeleteOrg(orgId) {
  const { error } = await supabase.rpc('soft_delete_org', { p_org_id: orgId })
  if (error) throw error
}

async function hardDeleteOrg(orgId) {
  const { error } = await supabase.rpc('hard_delete_org', { p_org_id: orgId })
  if (error) throw error
}

async function restoreOrg(orgId) {
  const { error } = await supabase.rpc('restore_org', { p_org_id: orgId })
  if (error) throw error
}

async function getDeletedOrg() {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null

  const { data, error } = await supabase
    .from('tenant_organizations')
    .select('*')
    .not('deleted_at', 'is', null)
    .limit(1)
    .maybeSingle()

  if (error) return null
  if (!data) return null

  return {
    ...mapDbToOrg(data),
    deletedAt: data.deleted_at,
    deletedBy: data.deleted_by,
  }
}

// --- Exported service object ---

export const tenantOrgService = {
  getCurrentOrg,
  updateOrg,
  getOrgMembers,
  getAiUsage,
  incrementAiUsage,
  checkAiQuota,
  createOrgViaRpc,
  generateSlug,
  inviteMember,
  getOrgInvites,
  revokeInvite,
  acceptInvite,
  updateMemberRole,
  removeMember,
  getAiUsageHistory,
  updateOrgPlan,
  setDevModeQuota,
  getPendingInviteForUser,
  softDeleteOrg,
  hardDeleteOrg,
  restoreOrg,
  getDeletedOrg,
}
