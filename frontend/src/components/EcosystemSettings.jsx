import React, { useState, useEffect, useCallback } from 'react'
import {
  Globe, Link2, Unlink, RefreshCw, CheckCircle2, XCircle,
  AlertCircle, Loader2, Activity, Clock, ArrowRight, RotateCcw,
  Key, Copy, Check, Shuffle, ChevronDown
} from 'lucide-react'
import { VCButton, VCBadge, VCInput, VCIconBox } from './vc'

const API_BASE = import.meta.env.VITE_API_URL || ''

// ── App Logos (from each app's favicon.svg) ──

function EntomateLogo({ size = 24 }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64" fill="none" width={size} height={size}>
      <defs>
        <linearGradient id="ent-bg" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#1a0810"/>
          <stop offset="100%" stopColor="#0d0408"/>
        </linearGradient>
      </defs>
      <rect width="64" height="64" rx="14" fill="url(#ent-bg)"/>
      <rect x="1" y="1" width="62" height="62" rx="13" stroke="#FF2D6B" strokeWidth="1.5" strokeOpacity="0.5" fill="none"/>
      <rect x="22" y="14" width="26" height="6" rx="1.5" fill="#FF2D6B"/>
      <rect x="22" y="29" width="20" height="6" rx="1.5" fill="#FF2D6B" opacity="0.85"/>
      <rect x="22" y="44" width="26" height="6" rx="1.5" fill="#FF2D6B"/>
      <path d="M22 17 L14 17 L10 13" stroke="#FF2D6B" strokeWidth="1.5" strokeLinecap="round" fill="none"/>
      <circle cx="10" cy="13" r="2" fill="#FF2D6B" opacity="0.9"/>
      <path d="M22 32 L12 32 L8 28" stroke="#FF2D6B" strokeWidth="1.5" strokeLinecap="round" fill="none"/>
      <circle cx="8" cy="28" r="2" fill="#FF2D6B" opacity="0.9"/>
      <path d="M22 47 L14 47 L10 51" stroke="#FF2D6B" strokeWidth="1.5" strokeLinecap="round" fill="none"/>
      <circle cx="10" cy="51" r="2" fill="#FF2D6B" opacity="0.9"/>
    </svg>
  )
}

function PulseLogo({ size = 24 }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64" fill="none" width={size} height={size}>
      <defs>
        <linearGradient id="pulse-grad" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#f43f5e"/>
          <stop offset="100%" stopColor="#ec4899"/>
        </linearGradient>
      </defs>
      <rect width="64" height="64" rx="14" fill="#0f172a"/>
      <path d="M8 32 L18 32 L24 16 L32 48 L40 24 L48 40 L56 32" stroke="url(#pulse-grad)" strokeWidth="5" strokeLinecap="round" strokeLinejoin="round" fill="none"/>
    </svg>
  )
}

function LogosVisionLogo({ size = 24 }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" width={size} height={size}>
      <rect width="24" height="24" fill="#020617"/>
      <path d="M12 4L5 20H19L12 4Z" stroke="#22D3EE" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
      <path d="M12 9L9 16H15L12 9Z" fill="#22D3EE" fillOpacity="0.3"/>
    </svg>
  )
}

// Known inbound URLs for each ecosystem app
const APP_DEFAULTS = {
  pulse: {
    displayName: 'Pulse',
    apiUrl: 'https://ucaeuszgoihoyrvhewxk.supabase.co/functions/v1/ecosystem-inbound'
  },
  logos_vision: {
    displayName: 'Logos Vision',
    apiUrl: 'https://psjgmdnrehcwvppbeqjy.supabase.co/functions/v1/ecosystem-inbound'
  }
}

export default function EcosystemSettings() {
  const [status, setStatus] = useState(null)
  const [configs, setConfigs] = useState([])
  const [events, setEvents] = useState([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(null) // 'pulse' | 'logos_vision' | null
  const [testing, setTesting] = useState(null)   // app name being tested
  const [saving, setSaving] = useState(false)

  // Form state
  const [formData, setFormData] = useState({
    apiUrl: '',
    serviceToken: '',
    inboundToken: ''
  })
  const [copied, setCopied] = useState(null) // field name that was just copied
  const [showTokens, setShowTokens] = useState({}) // field name -> boolean
  const [entoExpanded, setEntoExpanded] = useState(false)

  const loadEcosystemData = useCallback(async () => {
    try {
      setLoading(true)
      const [statusRes, configRes, eventsRes] = await Promise.all([
        fetch(`${API_BASE}/api/ecosystem/status`).then(r => r.json()).catch(() => null),
        fetch(`${API_BASE}/api/ecosystem/config`).then(r => r.json()).catch(() => ({ configs: [] })),
        fetch(`${API_BASE}/api/ecosystem/events?limit=10`).then(r => r.json()).catch(() => ({ events: [] }))
      ])
      setStatus(statusRes)
      setConfigs(configRes.configs || [])
      setEvents(eventsRes.events || [])
    } catch (err) {
      console.error('Failed to load ecosystem data:', err)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    loadEcosystemData()
  }, [loadEcosystemData])

  /**
   * Generate a cryptographically secure token (64 hex chars)
   */
  const generateToken = (field) => {
    const array = new Uint8Array(32)
    crypto.getRandomValues(array)
    const token = Array.from(array, b => b.toString(16).padStart(2, '0')).join('')
    setFormData(prev => ({ ...prev, [field]: token }))
    setShowTokens(prev => ({ ...prev, [field]: true }))
  }

  const copyToClipboard = async (field) => {
    const value = formData[field]
    if (!value) return
    try {
      await navigator.clipboard.writeText(value)
      setCopied(field)
      setTimeout(() => setCopied(null), 2000)
    } catch (err) {
      console.error('Failed to copy:', err)
    }
  }

  const toggleShowToken = (field) => {
    setShowTokens(prev => ({ ...prev, [field]: !prev[field] }))
  }

  const handleConnect = (appName) => {
    setShowForm(appName)
    const existing = configs.find(c => c.app_name === appName)
    const defaults = APP_DEFAULTS[appName] || {}
    setFormData({
      apiUrl: existing?.api_url || defaults.apiUrl || '',
      serviceToken: '',
      inboundToken: ''
    })
  }

  const handleSave = async () => {
    if (!formData.apiUrl || !formData.serviceToken) return

    try {
      setSaving(true)
      const displayName = showForm === 'pulse' ? 'Pulse' : 'Logos Vision'

      const res = await fetch(`${API_BASE}/api/ecosystem/config`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          appName: showForm,
          displayName,
          apiUrl: formData.apiUrl,
          serviceToken: formData.serviceToken,
          inboundToken: formData.inboundToken || undefined,
          features: {
            sync_meetings: true,
            sync_tasks: true,
            notifications: true
          }
        })
      })

      const data = await res.json()
      if (data.success) {
        setShowForm(null)
        await loadEcosystemData()
      }
    } catch (err) {
      console.error('Failed to save config:', err)
    } finally {
      setSaving(false)
    }
  }

  const handleDisconnect = async (appName) => {
    try {
      await fetch(`${API_BASE}/api/ecosystem/config/${appName}`, { method: 'DELETE' })
      await loadEcosystemData()
    } catch (err) {
      console.error('Failed to disconnect:', err)
    }
  }

  const [testResult, setTestResult] = useState(null)

  const handleTest = async (appName) => {
    try {
      setTesting(appName)
      setTestResult(null)
      const resp = await fetch(`${API_BASE}/api/ecosystem/test/${appName}`, { method: 'POST' })
      if (!resp.ok) {
        setTestResult({ app: appName, success: false, error: `Server returned ${resp.status}` })
        return
      }
      const data = await resp.json()
      setTestResult({ app: appName, ...data })
      await loadEcosystemData()
    } catch (err) {
      console.error('Test failed:', err)
      setTestResult({ app: appName, success: false, error: err.message || 'Network error' })
    } finally {
      setTesting(null)
    }
  }

  const handleRetry = async (eventId) => {
    try {
      await fetch(`${API_BASE}/api/ecosystem/retry/${eventId}`, { method: 'POST' })
      await loadEcosystemData()
    } catch (err) {
      console.error('Retry failed:', err)
    }
  }

  const isConnected = (appName) => {
    if (appName === 'pulse') return status?.pulse
    if (appName === 'logos_vision') return status?.logosVision
    return false
  }

  const getAppConfig = (appName) => configs.find(c => c.app_name === appName)

  if (loading) {
    return (
      <div className="vc">
        <div className="p-8 text-center">
          <Loader2 className="w-6 h-6 animate-spin mx-auto mb-2" style={{ color: 'var(--accent-primary)' }} />
          <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>Loading ecosystem status...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="vc">
      {/* Header */}
      <div
        className="p-4 flex items-center justify-between"
        style={{ borderBottom: '1px solid var(--b1, rgba(248,240,242,.06))' }}
      >
        <div className="flex items-center gap-2">
          <Globe className="w-5 h-5" style={{ color: 'var(--accent-secondary, #00F5D4)' }} />
          <div>
            <h2
              className="font-semibold"
              style={{ fontFamily: 'var(--font-display)', fontWeight: 600, color: 'var(--text-primary)', fontSize: 14 }}
            >
              Ecosystem Bridge
            </h2>
            <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>
              Connect to Pulse and Logos Vision for cross-app sync
            </p>
          </div>
        </div>
        <VCButton variant="ghost" size="sm" onClick={loadEcosystemData}>
          <RefreshCw className="w-4 h-4" />
        </VCButton>
      </div>

      {/* Ecosystem Apps */}
      <div className="p-4 space-y-3">
        {/* Entomate (This App) */}
        <div
          className="rounded-lg overflow-hidden"
          style={{ background: 'var(--bg-elevated)', border: '1px solid var(--accent-secondary, #00F5D4)', borderOpacity: 0.3 }}
        >
          <button
            type="button"
            className="w-full flex items-center justify-between p-3 text-left"
            onClick={() => setEntoExpanded(prev => !prev)}
          >
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-lg overflow-hidden flex-shrink-0">
                <EntomateLogo size={36} />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <span
                    className="text-sm font-medium"
                    style={{ color: 'var(--text-primary)', fontFamily: 'var(--font-display)' }}
                  >
                    Entomate
                  </span>
                  <span
                    className="inline-flex items-center gap-1 text-xs px-1.5 py-0.5 rounded-full"
                    style={{ background: 'rgba(0,245,212,.12)', color: 'var(--accent-secondary)' }}
                  >
                    <span className="w-1.5 h-1.5 rounded-full animate-pulse" style={{ background: 'var(--accent-secondary)' }} />
                    This app
                  </span>
                </div>
                <p className="text-xs" style={{ color: 'var(--text-tertiary)' }}>Meeting intelligence & automation</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <VCBadge color="mint" live>Active</VCBadge>
              <ChevronDown
                className="w-4 h-4 transition-transform"
                style={{
                  color: 'var(--text-tertiary)',
                  transform: entoExpanded ? 'rotate(180deg)' : 'rotate(0deg)'
                }}
              />
            </div>
          </button>
          {entoExpanded && (
            <div className="px-3 pb-3 pt-0">
              <div
                className="p-2.5 rounded-lg"
                style={{ background: 'var(--b0)', border: '1px solid var(--b1)' }}
              >
                <label className="text-xs flex items-center justify-between mb-1" style={{ color: 'var(--text-tertiary)' }}>
                  <span>Inbound API URL</span>
                  <span style={{ color: 'var(--accent-secondary)' }}>read-only</span>
                </label>
                <p
                  className="text-xs break-all select-all"
                  style={{ color: 'var(--text-secondary)', fontFamily: 'var(--font-mono)', fontSize: '11px' }}
                >
                  {`${window.location.origin}/api/ecosystem`}
                </p>
                <p className="text-xs mt-2" style={{ color: 'var(--text-tertiary)' }}>
                  Other apps use this URL to send events to Entomate.
                </p>
              </div>
            </div>
          )}
        </div>

        {/* Pulse */}
        <AppConnectionCard
          name="pulse"
          displayName="Pulse"
          description="Team notifications & meeting recaps"
          logo={<PulseLogo size={36} />}
          connected={isConnected('pulse')}
          config={getAppConfig('pulse')}
          testing={testing === 'pulse'}
          testResult={testResult?.app === 'pulse' ? testResult : null}
          expanded={showForm === 'pulse'}
          onConnect={() => handleConnect('pulse')}
          onDisconnect={() => handleDisconnect('pulse')}
          onTest={() => handleTest('pulse')}
          formData={formData}
          setFormData={setFormData}
          onSave={handleSave}
          saving={saving}
          onCancel={() => setShowForm(null)}
          generateToken={generateToken}
          copyToClipboard={copyToClipboard}
          copied={copied}
          showTokens={showTokens}
          toggleShowToken={toggleShowToken}
        />

        {/* Logos Vision */}
        <AppConnectionCard
          name="logos_vision"
          displayName="Logos Vision"
          description="CRM sync — tasks, activities, contacts"
          logo={<LogosVisionLogo size={36} />}
          connected={isConnected('logos_vision')}
          config={getAppConfig('logos_vision')}
          testing={testing === 'logos_vision'}
          testResult={testResult?.app === 'logos_vision' ? testResult : null}
          expanded={showForm === 'logos_vision'}
          onConnect={() => handleConnect('logos_vision')}
          onDisconnect={() => handleDisconnect('logos_vision')}
          onTest={() => handleTest('logos_vision')}
          formData={formData}
          setFormData={setFormData}
          onSave={handleSave}
          saving={saving}
          onCancel={() => setShowForm(null)}
          generateToken={generateToken}
          copyToClipboard={copyToClipboard}
          copied={copied}
          showTokens={showTokens}
          toggleShowToken={toggleShowToken}
        />
      </div>

      {/* Event Stats */}
      {status?.stats && (
        <div
          className="px-4 pb-4"
        >
          <div className="grid grid-cols-3 gap-3">
            <StatPill label="Delivered" value={status.stats.delivered} color="mint" />
            <StatPill label="Failed" value={status.stats.failed} color="crimson" />
            <StatPill label="Pending" value={status.stats.pending} color="amber" />
          </div>
        </div>
      )}

      {/* Recent Events */}
      {events.length > 0 && (
        <div
          style={{ borderTop: '1px solid var(--b1, rgba(248,240,242,.06))' }}
        >
          <div className="p-4">
            <h3
              className="text-xs font-medium mb-3 uppercase tracking-wide"
              style={{ color: 'var(--text-tertiary)' }}
            >
              Recent Events
            </h3>
            <div className="space-y-2">
              {events.slice(0, 5).map(event => (
                <EventRow key={event.id} event={event} onRetry={handleRetry} />
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// ── Sub-components ──

function TokenField({ label, hint, field, value, onChange, onGenerate, onCopy, copied, show, onToggleShow }) {
  return (
    <div>
      <label className="text-xs mb-1 block" style={{ color: 'var(--text-secondary)' }}>
        {label}
      </label>
      <p className="text-xs mb-1.5" style={{ color: 'var(--text-tertiary)' }}>{hint}</p>
      <div className="flex gap-1.5">
        <div className="flex-1 relative">
          <VCInput
            type={show ? 'text' : 'password'}
            placeholder="Paste existing or generate new"
            value={value}
            onChange={e => onChange(e.target.value)}
            style={{ fontFamily: show ? 'var(--font-mono)' : undefined, fontSize: show ? '11px' : undefined }}
          />
        </div>
        <button
          type="button"
          onClick={onGenerate}
          className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-medium transition-all hover:scale-105"
          style={{
            background: 'var(--accent-primary)',
            color: '#fff',
            border: 'none',
            whiteSpace: 'nowrap'
          }}
          title="Generate secure token"
        >
          <Shuffle className="w-3.5 h-3.5" />
          Generate
        </button>
        {value && (
          <>
            <button
              type="button"
              onClick={onCopy}
              className="flex items-center justify-center w-8 h-8 rounded-lg transition-colors"
              style={{
                background: copied ? 'rgba(0,245,212,.15)' : 'var(--bg-surface)',
                color: copied ? 'var(--accent-secondary)' : 'var(--text-secondary)',
                border: '1px solid var(--b1)'
              }}
              title={copied ? 'Copied!' : 'Copy to clipboard'}
            >
              {copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
            </button>
            <button
              type="button"
              onClick={onToggleShow}
              className="flex items-center justify-center w-8 h-8 rounded-lg transition-colors"
              style={{
                background: 'var(--bg-surface)',
                color: 'var(--text-secondary)',
                border: '1px solid var(--b1)'
              }}
              title={show ? 'Hide token' : 'Show token'}
            >
              <Key className="w-3.5 h-3.5" />
            </button>
          </>
        )}
      </div>
      {value && show && (
        <div
          className="mt-1.5 px-2 py-1 rounded text-xs break-all"
          style={{
            background: 'var(--b0)',
            color: 'var(--accent-secondary)',
            fontFamily: 'var(--font-mono)',
            fontSize: '10px',
            letterSpacing: '0.5px'
          }}
        >
          {value}
        </div>
      )}
    </div>
  )
}

function AppConnectionCard({
  name, displayName, description, logo, connected, config, testing, testResult, expanded,
  onConnect, onDisconnect, onTest, formData, setFormData, onSave, saving, onCancel,
  generateToken, copyToClipboard, copied, showTokens, toggleShowToken
}) {
  return (
    <div
      className="rounded-lg overflow-hidden"
      style={{ background: 'var(--bg-elevated)', border: `1px solid ${expanded ? 'var(--accent-primary)' : 'var(--b1)'}` }}
    >
      {/* Card header */}
      <div className="flex items-center justify-between p-3">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg overflow-hidden flex-shrink-0">
            {logo}
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span
                className="text-sm font-medium"
                style={{ color: 'var(--text-primary)', fontFamily: 'var(--font-display)' }}
              >
                {displayName}
              </span>
              <VCBadge color={connected ? 'mint' : 'neutral'} live={connected}>
                {connected ? 'Connected' : 'Not connected'}
              </VCBadge>
            </div>
            <p className="text-xs" style={{ color: 'var(--text-tertiary)' }}>{description}</p>
            {config?.last_heartbeat && (
              <p className="text-xs mt-0.5" style={{ color: 'var(--text-tertiary)' }}>
                <Clock className="w-3 h-3 inline mr-1" />
                Last sync: {new Date(config.last_heartbeat).toLocaleString()}
              </p>
            )}
          </div>
        </div>

        <div className="flex items-center gap-2">
          {connected && (
            <>
              <VCButton variant="ghost" size="sm" onClick={onTest} disabled={testing}>
                {testing
                  ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  : testResult
                    ? (testResult.success ? <CheckCircle2 className="w-3.5 h-3.5 text-green-500" /> : <XCircle className="w-3.5 h-3.5 text-red-400" />)
                    : <ArrowRight className="w-3.5 h-3.5" />
                }
                {testing ? 'Testing' : testResult ? (testResult.success ? 'Pass' : 'Fail') : 'Test'}
              </VCButton>
              <VCButton variant="ghost" size="sm" onClick={onDisconnect}>
                <Unlink className="w-3.5 h-3.5" />
              </VCButton>
            </>
          )}
          {!connected && (
            <VCButton variant="secondary" size="sm" onClick={expanded ? onCancel : onConnect}>
              {expanded ? <ChevronDown className="w-3.5 h-3.5 rotate-180" /> : <Link2 className="w-3.5 h-3.5" />}
              {expanded ? 'Close' : 'Connect'}
            </VCButton>
          )}
        </div>
      </div>

      {/* Test result message */}
      {testResult && !testResult.success && (
        <div className="px-3 pb-2 flex items-center gap-2 text-xs" style={{ color: 'var(--text-error, #ef4444)' }}>
          <XCircle className="w-3.5 h-3.5 flex-shrink-0" />
          <span>{testResult.error || 'Connection test failed — is the target app running?'}</span>
        </div>
      )}

      {/* Inline connection form */}
      {expanded && (
        <div className="px-3 pb-3 space-y-3" style={{ borderTop: '1px solid var(--b1)' }}>
          <div className="pt-3">
            <label className="text-xs mb-1 flex items-center justify-between" style={{ color: 'var(--text-secondary)' }}>
              <span>{displayName} Inbound API URL</span>
              {formData.apiUrl === (APP_DEFAULTS[name]?.apiUrl || '') && (
                <span className="text-xs" style={{ color: 'var(--accent-secondary)' }}>auto-detected</span>
              )}
            </label>
            <VCInput
              type="url"
              placeholder="https://app.example.com/functions/v1/ecosystem-inbound"
              value={formData.apiUrl}
              onChange={e => setFormData(prev => ({ ...prev, apiUrl: e.target.value }))}
              style={{ fontFamily: 'var(--font-mono)', fontSize: '11px' }}
            />
          </div>
          <TokenField
            label="Service Token"
            hint={`Entomate sends this to ${displayName} — generate here, then paste into ${displayName}'s inbound token field`}
            field="serviceToken"
            value={formData.serviceToken}
            onChange={val => setFormData(prev => ({ ...prev, serviceToken: val }))}
            onGenerate={() => generateToken('serviceToken')}
            onCopy={() => copyToClipboard('serviceToken')}
            copied={copied === 'serviceToken'}
            show={showTokens.serviceToken}
            onToggleShow={() => toggleShowToken('serviceToken')}
          />
          <TokenField
            label="Inbound Token"
            hint={`${displayName} sends this to Entomate — generate here, then paste into ${displayName}'s service token field`}
            field="inboundToken"
            value={formData.inboundToken}
            onChange={val => setFormData(prev => ({ ...prev, inboundToken: val }))}
            onGenerate={() => generateToken('inboundToken')}
            onCopy={() => copyToClipboard('inboundToken')}
            copied={copied === 'inboundToken'}
            show={showTokens.inboundToken}
            onToggleShow={() => toggleShowToken('inboundToken')}
          />
          <div className="flex items-center gap-2 pt-1">
            <VCButton variant="primary" size="sm" onClick={onSave} disabled={saving || !formData.apiUrl || !formData.serviceToken}>
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
              {saving ? 'Saving...' : 'Save & Connect'}
            </VCButton>
            <VCButton variant="ghost" size="sm" onClick={onCancel}>
              Cancel
            </VCButton>
          </div>
        </div>
      )}
    </div>
  )
}

function StatPill({ label, value, color }) {
  const colorMap = {
    mint: 'var(--accent-secondary, #00F5D4)',
    crimson: 'var(--accent-primary, #FF2D6B)',
    amber: 'var(--accent-tertiary, #FFB800)'
  }
  return (
    <div
      className="text-center p-2 rounded-lg"
      style={{ background: 'var(--bg-elevated)', border: '1px solid var(--b1)' }}
    >
      <div className="text-lg font-bold" style={{ color: colorMap[color], fontFamily: 'var(--font-mono)' }}>
        {value || 0}
      </div>
      <div className="text-xs" style={{ color: 'var(--text-tertiary)' }}>{label}</div>
    </div>
  )
}

function EventRow({ event, onRetry }) {
  const statusColors = {
    delivered: 'mint',
    failed: 'error',
    pending: 'amber'
  }

  const directionIcon = event.direction === 'outbound' ? '↑' : '↓'
  const timeAgo = getTimeAgo(event.created_at)

  return (
    <div className="flex items-center justify-between text-xs" style={{ color: 'var(--text-secondary)' }}>
      <div className="flex items-center gap-2">
        <span style={{ fontFamily: 'var(--font-mono)' }}>{directionIcon}</span>
        <span style={{ fontFamily: 'var(--font-mono)', color: 'var(--text-primary)' }}>
          {event.event_type}
        </span>
        <span style={{ color: 'var(--text-tertiary)' }}>
          {event.direction === 'outbound' ? `→ ${event.target_app}` : `← ${event.source}`}
        </span>
        <VCBadge color={statusColors[event.status] || 'neutral'}>{event.status}</VCBadge>
      </div>
      <div className="flex items-center gap-2">
        <span style={{ color: 'var(--text-tertiary)' }}>{timeAgo}</span>
        {event.status === 'failed' && (
          <button
            onClick={() => onRetry(event.id)}
            className="hover:opacity-80 transition-opacity"
            style={{ color: 'var(--accent-primary)' }}
            title="Retry"
          >
            <RotateCcw className="w-3.5 h-3.5" />
          </button>
        )}
      </div>
    </div>
  )
}

function getTimeAgo(dateStr) {
  const diff = Date.now() - new Date(dateStr).getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 1) return 'just now'
  if (mins < 60) return `${mins}m ago`
  const hours = Math.floor(mins / 60)
  if (hours < 24) return `${hours}h ago`
  return `${Math.floor(hours / 24)}d ago`
}
