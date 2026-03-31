/**
 * PermissionsSettings — View and manage browser permissions
 */

import React, { useState } from 'react'
import { Shield, Mic, Camera, Bell, Clipboard, CheckCircle2, XCircle, AlertCircle, RefreshCw, Loader2 } from 'lucide-react'
import { VCButton, VCBadge, VCIconBox } from '../vc'
import { usePermissions } from '../../hooks/usePermissions'

const ICON_MAP = {
  microphone: Mic,
  camera: Camera,
  notifications: Bell,
  clipboard: Clipboard
}

const COLOR_MAP = {
  microphone: 'crimson',
  camera: 'amber',
  notifications: 'mint',
  clipboard: 'phosphor'
}

export default function PermissionsSettings() {
  const { permissions, loading, requestPermission, refreshAll } = usePermissions()
  const [requesting, setRequesting] = useState(null)
  const [refreshing, setRefreshing] = useState(false)

  const handleRequest = async (id) => {
    setRequesting(id)
    await requestPermission(id)
    setRequesting(null)
  }

  const handleRefresh = async () => {
    setRefreshing(true)
    await refreshAll()
    setRefreshing(false)
  }

  if (loading && permissions.length === 0) {
    return (
      <div className="p-8 text-center">
        <Loader2 className="w-5 h-5 animate-spin mx-auto mb-2" style={{ color: 'var(--accent-primary)' }} />
        <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>Checking permissions...</p>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {/* Summary Banner */}
      <PermissionsSummary permissions={permissions} />

      {/* Individual Permissions */}
      {permissions.map(perm => {
        const Icon = ICON_MAP[perm.id] || Shield
        const color = COLOR_MAP[perm.id] || 'neutral'
        const isRequesting = requesting === perm.id

        return (
          <div
            key={perm.id}
            className="p-4 rounded-lg"
            style={{ background: 'var(--bg-elevated)', border: '1px solid var(--b1)' }}
          >
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-3 min-w-0">
                <VCIconBox color={color}>
                  <Icon className="w-5 h-5" />
                </VCIconBox>
                <div className="min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span
                      className="text-sm font-medium"
                      style={{ color: 'var(--text-primary)', fontFamily: 'var(--font-display)' }}
                    >
                      {perm.label}
                    </span>
                    {perm.required && <VCBadge color="crimson">Required</VCBadge>}
                    <StateIndicator state={perm.state} />
                  </div>
                  <p className="text-xs mt-0.5" style={{ color: 'var(--text-tertiary)' }}>
                    {perm.description}
                  </p>
                </div>
              </div>

              <div className="flex-shrink-0">
                {perm.state === 'granted' ? (
                  <CheckCircle2 className="w-5 h-5" style={{ color: 'var(--accent-secondary)' }} />
                ) : perm.state === 'denied' ? (
                  <div className="flex items-center gap-2">
                    <VCButton
                      variant="secondary"
                      size="sm"
                      onClick={() => handleRequest(perm.id)}
                      disabled={isRequesting}
                    >
                      {isRequesting
                        ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        : <RefreshCw className="w-3.5 h-3.5" />}
                      Retry
                    </VCButton>
                  </div>
                ) : perm.state === 'unavailable' ? (
                  <span className="text-xs" style={{ color: 'var(--text-tertiary)' }}>N/A</span>
                ) : (
                  /* prompt — show prominent Grant button */
                  <VCButton
                    variant="primary"
                    size="sm"
                    onClick={() => handleRequest(perm.id)}
                    disabled={isRequesting}
                  >
                    {isRequesting
                      ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      : <Shield className="w-3.5 h-3.5" />}
                    {isRequesting ? 'Requesting...' : 'Grant Access'}
                  </VCButton>
                )}
              </div>
            </div>

            {/* Extra guidance for denied permissions */}
            {perm.state === 'denied' && (
              <div
                className="mt-3 p-2.5 rounded-lg text-xs flex items-start gap-2"
                style={{
                  background: 'rgba(255,45,107,.05)',
                  border: '1px solid rgba(255,45,107,.12)',
                  color: 'var(--text-secondary)'
                }}
              >
                <AlertCircle className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" style={{ color: 'var(--accent-primary)' }} />
                <span>
                  This permission was denied. To re-enable it, click the <strong>lock icon</strong> in
                  your browser's address bar, find "{perm.label}", set it to "Allow", then click "Retry" above.
                </span>
              </div>
            )}
          </div>
        )
      })}

      {/* Refresh */}
      <div className="flex justify-end">
        <VCButton variant="ghost" size="sm" onClick={handleRefresh} disabled={refreshing}>
          {refreshing
            ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
            : <RefreshCw className="w-3.5 h-3.5" />}
          {refreshing ? 'Checking...' : 'Re-check Permissions'}
        </VCButton>
      </div>

      {/* Explainer */}
      <div
        className="p-4 rounded-lg text-sm"
        style={{ background: 'var(--b0)', color: 'var(--text-tertiary)' }}
      >
        <p className="font-medium mb-1" style={{ color: 'var(--text-secondary)' }}>
          About Permissions
        </p>
        <p>
          Entomate only requests permissions when you use features that need them.
          You can revoke any permission at any time through your browser settings.
          If a permission shows "Denied", click the lock icon in your address bar to reset it.
        </p>
      </div>
    </div>
  )
}

/* ── State Indicator Badge ── */
function StateIndicator({ state }) {
  const config = {
    granted:     { color: 'mint',    label: 'Granted' },
    denied:      { color: 'crimson', label: 'Denied' },
    prompt:      { color: 'amber',   label: 'Not Granted' },
    unavailable: { color: 'neutral', label: 'Unavailable' }
  }
  const c = config[state] || config.prompt
  return <VCBadge color={c.color}>{c.label}</VCBadge>
}

/* ── Summary Banner ── */
function PermissionsSummary({ permissions }) {
  const granted = permissions.filter(p => p.state === 'granted').length
  const denied = permissions.filter(p => p.state === 'denied').length
  const requiredDenied = permissions.filter(p => p.required && p.state === 'denied').length
  const total = permissions.length

  const allGood = denied === 0 && granted > 0
  const hasCritical = requiredDenied > 0

  return (
    <div
      className="p-4 rounded-lg flex items-center gap-3"
      style={{
        background: hasCritical
          ? 'rgba(255,45,107,.06)'
          : allGood
            ? 'rgba(0,245,212,.06)'
            : 'rgba(255,184,0,.06)',
        border: `1px solid ${
          hasCritical
            ? 'rgba(255,45,107,.15)'
            : allGood
              ? 'rgba(0,245,212,.15)'
              : 'rgba(255,184,0,.15)'
        }`
      }}
    >
      <Shield
        className="w-5 h-5 flex-shrink-0"
        style={{
          color: hasCritical
            ? 'var(--accent-primary)'
            : allGood
              ? 'var(--accent-secondary)'
              : 'var(--accent-tertiary)'
        }}
      />
      <div>
        <span className="text-sm font-medium block" style={{ color: 'var(--text-primary)' }}>
          {hasCritical
            ? 'Required permissions denied'
            : allGood
              ? 'All permissions granted'
              : `${granted} of ${total} permissions granted`}
        </span>
        {hasCritical && (
          <span className="text-xs" style={{ color: 'var(--accent-primary)' }}>
            Microphone access is required for meeting recording.
          </span>
        )}
      </div>
    </div>
  )
}
