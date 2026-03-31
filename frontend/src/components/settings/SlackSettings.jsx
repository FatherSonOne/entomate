/**
 * SlackSettings Component — Void Crimson Design System
 * Configure Slack notification integration settings
 */

import React, { useState, useEffect } from 'react'
import {
  MessageSquare, RefreshCw, CheckCircle2, XCircle, AlertCircle,
  Loader2, Send, Hash
} from 'lucide-react'
import { VCButton, VCBadge, VCSelect, VCIconBox } from '../vc'
import slackApi from '../../services/slackApi'

export default function SlackSettings() {
  const [status, setStatus] = useState(null)
  const [channels, setChannels] = useState([])
  const [settings, setSettings] = useState({
    defaultChannel: '',
    meetingCompleted: true,
    dealWon: true,
    overdueReminder: true,
    actionItemCreated: false
  })
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [testing, setTesting] = useState(false)
  const [testResult, setTestResult] = useState(null)

  useEffect(() => {
    loadData()
  }, [])

  const loadData = async () => {
    try {
      setLoading(true)
      const [statusRes, settingsRes] = await Promise.all([
        slackApi.getStatus().catch(() => null),
        slackApi.getSettings().catch(() => ({}))
      ])
      setStatus(statusRes)
      setSettings({
        defaultChannel: settingsRes.defaultChannel || '',
        meetingCompleted: settingsRes.meetingCompleted ?? true,
        dealWon: settingsRes.dealWon ?? true,
        overdueReminder: settingsRes.overdueReminder ?? true,
        actionItemCreated: settingsRes.actionItemCreated ?? false
      })
      if (statusRes?.connected) {
        const channelRes = await slackApi.getChannels().catch(() => ({ channels: [] }))
        setChannels(channelRes.channels || [])
      }
    } catch (err) {
      console.error('Failed to load Slack data:', err)
    } finally {
      setLoading(false)
    }
  }

  const handleTestConnection = async () => {
    try {
      setTesting(true)
      setTestResult(null)
      const result = await slackApi.test()
      setTestResult(result)
      if (result.success) {
        const channelRes = await slackApi.getChannels().catch(() => ({ channels: [] }))
        setChannels(channelRes.channels || [])
      }
    } catch (err) {
      setTestResult({ success: false, error: err.message })
    } finally {
      setTesting(false)
    }
  }

  const handleSaveSettings = async () => {
    try {
      setSaving(true)
      await slackApi.updateSettings(settings)
      setTestResult({ success: true, message: 'Settings saved' })
      setTimeout(() => setTestResult(null), 3000)
    } catch (err) {
      setTestResult({ success: false, error: err.message })
    } finally {
      setSaving(false)
    }
  }

  const handleSendTest = async () => {
    try {
      setTesting(true)
      setTestResult(null)
      const result = await slackApi.sendTestNotification(settings.defaultChannel || undefined)
      setTestResult(result)
    } catch (err) {
      setTestResult({ success: false, error: err.message })
    } finally {
      setTesting(false)
    }
  }

  const handleToggle = (key) => {
    setSettings(prev => ({ ...prev, [key]: !prev[key] }))
  }

  if (loading) {
    return (
      <div className="p-8 text-center">
        <Loader2 className="w-5 h-5 animate-spin mx-auto mb-2" style={{ color: 'var(--accent-primary)' }} />
        <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>Loading Slack settings...</p>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {/* Status + Test Result Banner */}
      {testResult && (
        <div
          className="flex items-center gap-2 p-3 rounded-lg text-sm"
          style={{
            background: testResult.success ? 'rgba(0,245,212,.08)' : 'rgba(255,45,107,.08)',
            color: testResult.success ? 'var(--accent-secondary)' : 'var(--accent-primary)',
            border: `1px solid ${testResult.success ? 'rgba(0,245,212,.2)' : 'rgba(255,45,107,.2)'}`
          }}
        >
          {testResult.success
            ? <CheckCircle2 className="w-4 h-4 flex-shrink-0" />
            : <XCircle className="w-4 h-4 flex-shrink-0" />}
          <span>{testResult.success ? (testResult.message || `Connected to ${testResult.team || 'Slack'}`) : (testResult.error || 'Connection failed')}</span>
        </div>
      )}

      {/* Connection Status */}
      <div
        className="p-4 rounded-lg"
        style={{ background: 'var(--bg-elevated)', border: '1px solid var(--b1)' }}
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <VCIconBox color="phosphor">
              <MessageSquare className="w-5 h-5" />
            </VCIconBox>
            <div>
              <div className="flex items-center gap-2">
                <span
                  className="text-sm font-medium"
                  style={{ color: 'var(--text-primary)', fontFamily: 'var(--font-display)' }}
                >
                  Slack Connection
                </span>
                <VCBadge color={status?.connected ? 'mint' : 'neutral'} live={status?.connected}>
                  {status?.connected ? 'Connected' : 'Not connected'}
                </VCBadge>
              </div>
              {status?.team && (
                <p className="text-xs mt-0.5" style={{ color: 'var(--text-tertiary)' }}>
                  Workspace: {status.team}
                </p>
              )}
            </div>
          </div>
          <VCButton
            variant="secondary"
            size="sm"
            onClick={handleTestConnection}
            disabled={testing || !status?.configured}
          >
            {testing ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5" />}
            Test
          </VCButton>
        </div>

        {!status?.configured && (
          <div
            className="mt-3 p-3 rounded-lg text-sm"
            style={{ background: 'rgba(255,184,0,.06)', border: '1px solid rgba(255,184,0,.15)', color: 'var(--accent-tertiary)' }}
          >
            <p className="font-medium mb-1">Configuration Required</p>
            <p style={{ color: 'var(--text-secondary)' }}>
              Add <code style={{ fontFamily: 'var(--font-mono)', fontSize: '11px', background: 'var(--b0)', padding: '1px 4px', borderRadius: 3 }}>SLACK_BOT_TOKEN</code> to
              your backend <code style={{ fontFamily: 'var(--font-mono)', fontSize: '11px', background: 'var(--b0)', padding: '1px 4px', borderRadius: 3 }}>.env</code> file.
            </p>
          </div>
        )}
      </div>

      {/* Default Channel */}
      <div
        className="p-4 rounded-lg"
        style={{ background: 'var(--bg-elevated)', border: '1px solid var(--b1)' }}
      >
        <label
          className="text-sm font-medium block mb-1"
          style={{ color: 'var(--text-primary)', fontFamily: 'var(--font-display)' }}
        >
          Default Channel
        </label>
        <p className="text-xs mb-2" style={{ color: 'var(--text-tertiary)' }}>
          Notifications will be posted to this channel unless overridden.
        </p>
        <VCSelect
          value={settings.defaultChannel}
          onChange={e => setSettings(prev => ({ ...prev, defaultChannel: e.target.value }))}
          disabled={!status?.connected || channels.length === 0}
        >
          <option value="">Select a channel...</option>
          {channels.map(ch => (
            <option key={ch.id} value={ch.id}>
              {ch.displayName || `#${ch.name}`}{ch.isPrivate ? ' (private)' : ''}
            </option>
          ))}
        </VCSelect>
        {status?.connected && channels.length === 0 && (
          <p className="text-xs mt-1" style={{ color: 'var(--text-tertiary)' }}>
            No channels found. Invite the bot to at least one channel.
          </p>
        )}
      </div>

      {/* Notification Toggles */}
      <div
        className="p-4 rounded-lg space-y-3"
        style={{ background: 'var(--bg-elevated)', border: '1px solid var(--b1)' }}
      >
        <div>
          <span
            className="text-sm font-medium"
            style={{ color: 'var(--text-primary)', fontFamily: 'var(--font-display)' }}
          >
            Slack Notification Events
          </span>
          <p className="text-xs mt-0.5" style={{ color: 'var(--text-tertiary)' }}>
            Choose which events send Slack messages.
          </p>
        </div>

        <ToggleRow
          label="Meeting Completed"
          description="Post summary when a meeting is processed"
          checked={settings.meetingCompleted}
          onChange={() => handleToggle('meetingCompleted')}
        />
        <ToggleRow
          label="Deal Won"
          description="Celebrate when a deal is marked as won"
          checked={settings.dealWon}
          onChange={() => handleToggle('dealWon')}
        />
        <ToggleRow
          label="Overdue Reminders"
          description="Alert on overdue action items"
          checked={settings.overdueReminder}
          onChange={() => handleToggle('overdueReminder')}
        />
        <ToggleRow
          label="New Action Items"
          description="Notify when action items are created from meetings"
          checked={settings.actionItemCreated}
          onChange={() => handleToggle('actionItemCreated')}
        />
      </div>

      {/* Actions */}
      <div className="flex items-center gap-2">
        <VCButton variant="primary" size="sm" onClick={handleSaveSettings} disabled={saving}>
          {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
          {saving ? 'Saving...' : 'Save Slack Settings'}
        </VCButton>
        <VCButton
          variant="secondary"
          size="sm"
          onClick={handleSendTest}
          disabled={testing || !status?.connected}
        >
          <Send className="w-3.5 h-3.5" />
          Send Test Message
        </VCButton>
      </div>
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
