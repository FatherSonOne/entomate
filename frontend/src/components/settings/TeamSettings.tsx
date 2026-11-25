/**
 * Settings › Workspace › Team (new in the Ledger pass, 2026-11-22).
 * Members come from OrgContext; pending invites, invite, role change and remove
 * go through tenantOrgService (org_invites / org_members, guarded by RLS).
 */
import React, { useCallback, useEffect, useState } from 'react'
import { tenantOrgService } from '../../services/tenantOrgService'
import { useOrg } from '../../contexts/OrgContext'
import { useAuth } from '../../contexts/AuthContext'
import { Drawer, Key, Select, Signal, Switch, TextInput } from '../bench'
import ProfileAvatar from '../ProfileAvatar'
import { getProfilePhotoUrls, PROFILE_PHOTO_REFRESH_MS } from '../../services/profilePhotos'
import { initials } from '../../services/settingsView'
import { ago, canAdmin } from './settingsTypes'
import type { AuthCtx, OrgCtx, OrgInvite, OrgMember, OrgRole } from './settingsTypes'

interface OrgService {
  getOrgInvites: (orgId: string) => Promise<OrgInvite[]>
  inviteMember: (orgId: string, email: string, role: OrgRole, options?: { orgName?: string; inviterName?: string }) => Promise<OrgInvite>
  revokeInvite: (id: string) => Promise<void>
  updateMemberRole: (memberId: string, role: OrgRole) => Promise<OrgMember>
  removeMember: (memberId: string) => Promise<void>
}
const svc = tenantOrgService as unknown as OrgService

const ROLE_LABEL: Record<OrgRole, string> = { owner: 'Owner', admin: 'Admin', member: 'Member' }
const ROLE_OPTIONS = [
  { value: 'member', label: 'Member' },
  { value: 'admin', label: 'Admin' },
] as const
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

export interface TeamSettingsProps {
  inviteOpen: boolean
  onInviteOpen: (open: boolean) => void
}

export default function TeamSettings({ inviteOpen, onInviteOpen }: TeamSettingsProps): React.ReactElement {
  const { org, orgMembers, myRole, refreshOrg } = useOrg() as unknown as OrgCtx
  const { user, profilePhotoUrl } = useAuth() as unknown as AuthCtx
  const [photos, setPhotos] = useState<Record<string, string>>({})
  const admin = canAdmin(myRole)
  const [invites, setInvites] = useState<OrgInvite[]>([])
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState<string | null>(null)
  const [email, setEmail] = useState('')
  const [role, setRole] = useState<'member' | 'admin'>('member')
  const [confirmRemove, setConfirmRemove] = useState<string | null>(null)

  const loadInvites = useCallback(async () => {
    if (!org?.id || !admin) return
    try { setInvites(await svc.getOrgInvites(org.id)) } catch { /* invites are optional; members still show */ }
  }, [org?.id, admin])

  useEffect(() => { void loadInvites() }, [loadInvites])

  useEffect(() => {
    const ids = orgMembers.filter((member) => member.userId !== user?.id).map((member) => member.userId)
    let live = true
    const load = async () => {
      try {
        const urls = await getProfilePhotoUrls(ids)
        if (live) setPhotos(urls)
      } catch { /* the roster can still show initials */ }
    }
    void load()
    const timer = window.setInterval(load, PROFILE_PHOTO_REFRESH_MS)
    return () => { live = false; window.clearInterval(timer) }
  }, [orgMembers, user?.id])

  const run = async (key: string, fn: () => Promise<unknown>): Promise<boolean> => {
    setBusy(key)
    setError(null)
    try { await fn(); return true } catch (err) {
      setError(err instanceof Error ? err.message : 'That didn’t work. Try again.')
      return false
    } finally { setBusy(null) }
  }

  const sendInvite = async (): Promise<void> => {
    if (!org?.id || !EMAIL_RE.test(email.trim())) { setError('Enter an email address.'); return }
    const ok = await run('invite', () => svc.inviteMember(org.id, email, role, { orgName: org.name, inviterName: user?.name ?? undefined }))
    if (ok) { setEmail(''); setRole('member'); onInviteOpen(false); await loadInvites() }
  }

  if (!org) return <p className="bs-set-note">Join or create a workspace to invite your team.</p>

  return (
    <>
      <div className="bs-set-sub">
        <span className="bs-h3">Team</span>
        {admin && <Key size="sm" variant="primary" onClick={() => onInviteOpen(true)}>Invite</Key>}
      </div>
      <ul className="bs-set-team" aria-label="Members">
        {orgMembers.map((m) => {
          const me = m.userId === user?.id
          const editable = admin && m.role !== 'owner' && !me
          const memberName = (me && user?.name) || m.userName
          return (
            <li key={m.id} className="bs-set-mem">
              <ProfileAvatar className="bs-set-ava" src={me ? profilePhotoUrl : photos[m.userId]}
                fallback={initials(memberName, m.userEmail)} />
              <div className="bs-set-mem-who">
                <b>{memberName || m.userEmail || 'Member'}{me && <span className="bs-mut"> · you</span>}</b>
                {m.userEmail && <span className="bs-set-mem-mail">{m.userEmail}</span>}
              </div>
              <div className="bs-set-mem-role">
                {editable ? (
                  <Select
                    size="sm"
                    className="bs-set-select bs-set-select--sm"
                    label={`Role for ${m.userName || m.userEmail || 'member'}`}
                    value={m.role}
                    disabled={busy === m.id}
                    onChange={(v) => { void run(m.id, () => svc.updateMemberRole(m.id, v as OrgRole)).then((ok) => { if (ok) void refreshOrg() }) }}
                    options={ROLE_OPTIONS}
                  />
                ) : <span className="bs-mono">{ROLE_LABEL[m.role]}</span>}
              </div>
              <div className="bs-set-mem-act">
                {editable && (confirmRemove === m.id ? (
                  <>
                    <Key size="sm" className="bs-set-warn" disabled={busy === m.id} onClick={() => { void run(m.id, () => svc.removeMember(m.id)).then((ok) => { setConfirmRemove(null); if (ok) void refreshOrg() }) }}>Remove</Key>
                    <Key size="sm" onClick={() => setConfirmRemove(null)}>Keep</Key>
                  </>
                ) : <Key size="sm" onClick={() => setConfirmRemove(m.id)}>Remove…</Key>)}
              </div>
            </li>
          )
        })}
        {invites.map((inv) => (
          <li key={inv.id} className="bs-set-mem bs-set-mem--pending">
            <span className="bs-set-ava" aria-hidden="true" />
            <div className="bs-set-mem-who">
              <b>{inv.email}</b>
              <span className="bs-set-mem-mail">Invited {ago(inv.createdAt)} · {ROLE_LABEL[inv.role] ?? 'Member'}</span>
            </div>
            <div className="bs-set-mem-role"><Signal tone="off">Invited</Signal></div>
            <div className="bs-set-mem-act">
              <Key size="sm" disabled={busy === inv.id} onClick={() => { void run(inv.id, () => svc.revokeInvite(inv.id)).then(() => loadInvites()) }}>Revoke</Key>
            </div>
          </li>
        ))}
      </ul>
      {error && <p className="bs-set-note bs-set-err" role="alert">{error}</p>}

      <Drawer
        open={inviteOpen}
        onClose={() => onInviteOpen(false)}
        label={`Invite to ${org.name}`}
        footer={<><Key onClick={() => onInviteOpen(false)}>Cancel</Key><Key variant="primary" disabled={busy === 'invite'} onClick={() => { void sendInvite() }}>{busy === 'invite' ? 'Sending…' : 'Send invite'}</Key></>}
      >
        <label className="bs-set-fld">
          <span className="bs-lbl">Email</span>
          <TextInput type="email" autoFocus value={email} placeholder="name@company.com" onChange={(e) => setEmail(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') void sendInvite() }} />
        </label>
        <div className="bs-set-fld">
          <span className="bs-lbl">Role</span>
          <Switch label="Role" value={role} onChange={setRole} options={[{ value: 'member', label: 'Member' }, { value: 'admin', label: 'Admin' }]} />
          <span className="bs-set-help">Admins can send the bot, change retention and consent, and manage billing.</span>
        </div>
        {error && <p className="bs-set-note bs-set-err" role="alert">{error}</p>}
      </Drawer>
    </>
  )
}
