/** Shapes the Settings page reads from JS modules (OrgContext, tenantOrgService, AuthContext). */

export type OrgRole = 'owner' | 'admin' | 'member'

export interface OrgMember {
  id: string
  userId: string
  role: OrgRole
  joinedAt?: string | null
  userName?: string | null
  userEmail?: string | null
  userAvatarUrl?: string | null
}

export interface OrgInvite {
  id: string
  email: string
  role: OrgRole
  status: string
  createdAt?: string | null
  expiresAt?: string | null
}

export interface Org {
  id: string
  name: string
  slug?: string | null
  plan?: string | null
}

export interface OrgCtx {
  org: Org | null
  orgMembers: OrgMember[]
  myRole: OrgRole | null
  refreshOrg: () => Promise<void>
  softDeleteOrg: (id: string) => Promise<void>
  hardDeleteOrg: (id: string) => Promise<void>
}

export interface AuthUser {
  id: string
  email: string
  name?: string | null
  avatar_url?: string | null
}

export interface AuthCtx {
  user: AuthUser | null
  signOut: () => Promise<void>
}

export const canAdmin = (role: OrgRole | null | undefined): boolean => role === 'owner' || role === 'admin'

/** "2 days ago", "today": coarse, for invite and member rows. */
export function ago(iso: string | null | undefined, now: Date = new Date()): string {
  if (!iso) return ''
  const t = new Date(iso).getTime()
  if (Number.isNaN(t)) return ''
  const days = Math.floor((now.getTime() - t) / 86_400_000)
  if (days <= 0) return 'today'
  if (days === 1) return 'yesterday'
  if (days < 30) return `${days} days ago`
  const months = Math.floor(days / 30)
  return months === 1 ? 'a month ago' : `${months} months ago`
}
