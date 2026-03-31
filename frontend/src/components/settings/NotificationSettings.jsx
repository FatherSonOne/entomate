/**
 * NotificationSettings — Manage notification preferences
 * Persists to user_settings.notifications_json via useSettings
 */

import React from 'react'
import { Bell, Mail, MessageSquare, Monitor, Smartphone } from 'lucide-react'
import { VCIconBox } from '../vc'

export default function NotificationSettings({ notifications, onUpdate }) {
  const n = notifications || {}

  const toggle = (key) => {
    onUpdate(key, !n[key])
  }

  return (
    <div className="space-y-4">
      {/* Email Notifications */}
      <NotifGroup
        icon={<Mail className="w-5 h-5" />}
        iconColor="crimson"
        title="Email Notifications"
        description="Receive email digests and alerts"
      >
        <ToggleRow
          label="Meeting Summaries"
          description="Email summary after each meeting is processed"
          checked={n.email_meeting_summary ?? true}
          onChange={() => toggle('email_meeting_summary')}
        />
        <ToggleRow
          label="Overdue Reminders"
          description="Email when action items pass their due date"
          checked={n.email_overdue_reminder ?? true}
          onChange={() => toggle('email_overdue_reminder')}
        />
        <ToggleRow
          label="Weekly Digest"
          description="Summary of meetings, tasks, and progress each week"
          checked={n.email_weekly_digest ?? false}
          onChange={() => toggle('email_weekly_digest')}
        />
      </NotifGroup>

      {/* In-App Notifications */}
      <NotifGroup
        icon={<Monitor className="w-5 h-5" />}
        iconColor="mint"
        title="In-App Notifications"
        description="Notifications inside the Entomate app"
      >
        <ToggleRow
          label="Task Assignments"
          description="When an AI agent assigns a task to you"
          checked={n.inapp_task_assigned ?? true}
          onChange={() => toggle('inapp_task_assigned')}
        />
        <ToggleRow
          label="Meeting Ready"
          description="When a meeting finishes processing"
          checked={n.inapp_meeting_ready ?? true}
          onChange={() => toggle('inapp_meeting_ready')}
        />
        <ToggleRow
          label="Agent Suggestions"
          description="When AI agents have new suggestions"
          checked={n.inapp_agent_suggestions ?? true}
          onChange={() => toggle('inapp_agent_suggestions')}
        />
      </NotifGroup>

      {/* Browser Push */}
      <NotifGroup
        icon={<Bell className="w-5 h-5" />}
        iconColor="amber"
        title="Browser Push Notifications"
        description="Desktop alerts even when Entomate isn't in focus"
      >
        <ToggleRow
          label="Enable Push Notifications"
          description="Requires browser permission"
          checked={n.browser_push ?? false}
          onChange={() => toggle('browser_push')}
        />
      </NotifGroup>

      {/* Quiet Hours */}
      <div
        className="p-4 rounded-lg"
        style={{ background: 'var(--bg-elevated)', border: '1px solid var(--b1)' }}
      >
        <div className="flex items-center gap-3 mb-3">
          <VCIconBox color="phosphor">
            <Smartphone className="w-5 h-5" />
          </VCIconBox>
          <div>
            <span
              className="text-sm font-medium block"
              style={{ color: 'var(--text-primary)', fontFamily: 'var(--font-display)' }}
            >
              Quiet Hours
            </span>
            <span className="text-xs" style={{ color: 'var(--text-tertiary)' }}>
              Pause non-urgent notifications during specific hours
            </span>
          </div>
        </div>

        <ToggleRow
          label="Enable Quiet Hours"
          description="Silence notifications during the window below"
          checked={n.quiet_hours_enabled ?? false}
          onChange={() => toggle('quiet_hours_enabled')}
        />

        {n.quiet_hours_enabled && (
          <div className="flex items-center gap-3 mt-3 pl-3">
            <label className="text-xs" style={{ color: 'var(--text-secondary)' }}>From</label>
            <input
              type="time"
              value={n.quiet_hours_start || '22:00'}
              onChange={e => onUpdate('quiet_hours_start', e.target.value)}
              className="vinput"
              style={{ width: 110, fontSize: 12 }}
            />
            <label className="text-xs" style={{ color: 'var(--text-secondary)' }}>To</label>
            <input
              type="time"
              value={n.quiet_hours_end || '08:00'}
              onChange={e => onUpdate('quiet_hours_end', e.target.value)}
              className="vinput"
              style={{ width: 110, fontSize: 12 }}
            />
          </div>
        )}
      </div>
    </div>
  )
}

/* ── Notification Group Card ── */
function NotifGroup({ icon, iconColor, title, description, children }) {
  return (
    <div
      className="p-4 rounded-lg space-y-3"
      style={{ background: 'var(--bg-elevated)', border: '1px solid var(--b1)' }}
    >
      <div className="flex items-center gap-3">
        <VCIconBox color={iconColor}>{icon}</VCIconBox>
        <div>
          <span
            className="text-sm font-medium block"
            style={{ color: 'var(--text-primary)', fontFamily: 'var(--font-display)' }}
          >
            {title}
          </span>
          <span className="text-xs" style={{ color: 'var(--text-tertiary)' }}>
            {description}
          </span>
        </div>
      </div>
      {children}
    </div>
  )
}

/* ── Toggle Row ── */
function ToggleRow({ label, description, checked, onChange }) {
  return (
    <div
      className="flex items-center justify-between p-3 rounded-lg"
      style={{ background: 'var(--b0)' }}
    >
      <div className="flex-1 mr-3">
        <span className="text-sm font-medium block" style={{ color: 'var(--text-primary)' }}>{label}</span>
        <span className="text-xs" style={{ color: 'var(--text-tertiary)' }}>{description}</span>
      </div>
      <button
        role="switch"
        aria-checked={checked}
        onClick={onChange}
        className="relative inline-flex h-5 w-9 flex-shrink-0 rounded-full transition-colors"
        style={{
          background: checked ? 'var(--accent-primary, #FF2D6B)' : 'var(--b2, #333)',
          cursor: 'pointer',
          border: 'none'
        }}
      >
        <span
          className="inline-block h-4 w-4 rounded-full bg-white transition-transform"
          style={{
            transform: checked ? 'translateX(16px)' : 'translateX(2px)',
            marginTop: 2
          }}
        />
      </button>
    </div>
  )
}
