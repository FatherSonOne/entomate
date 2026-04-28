import React, { useState, useEffect, useRef } from 'react'
import { useLocation } from 'react-router-dom'
import {
  Settings as SettingsIcon, Database, Cpu, Palette, Sun, Moon, Monitor,
  Brain, ArrowLeft, Mic, Bell, Link2, RefreshCw, CheckCircle2,
  XCircle, AlertCircle, Loader2, MessageSquare, Info, Shield, CreditCard, Building2,
  Trash2, Archive
} from 'lucide-react'
import { integrationsApi, checkHealth, settingsApi } from '../services/api'
import { useOrg } from '../contexts/OrgContext'
import { TENANT_PLAN_LABELS, PLAN_BADGE_COLORS, TENANT_PLAN_LIMITS } from '../constants/plans'
import { useTheme, THEME_MODES } from '../context/ThemeContext'
import LearningDashboard from '../components/learning/LearningDashboard'
import EcosystemSettings from '../components/EcosystemSettings'
import SlackSettings from '../components/settings/SlackSettings'
import AudioSettings from '../components/settings/AudioSettings'
import NotificationSettings from '../components/settings/NotificationSettings'
import PermissionsSettings from '../components/settings/PermissionsSettings'
import BillingSettings from '../components/settings/BillingSettings'
import DataRetentionSettings from '../components/settings/DataRetentionSettings'
import { VCButton, VCIconBox, VCBadge } from '../components/vc'
import DeleteOrgDialog from '../components/settings/DeleteOrgDialog'

// ── Settings Sections ──
const SECTIONS = [
  { id: 'organization', label: 'Organization', icon: Building2 },
  { id: 'appearance', label: 'Appearance', icon: Palette },
  { id: 'audio',      label: 'Audio & Recording', icon: Mic },
  { id: 'permissions', label: 'Permissions', icon: Shield },
  { id: 'data-retention', label: 'Data & Retention', icon: Database },
  { id: 'billing',    label: 'Plan & Billing', icon: CreditCard },
  { id: 'notifications', label: 'Notifications', icon: Bell },
  { id: 'integrations', label: 'Integrations', icon: Link2 },
  { id: 'ai-learning', label: 'AI & Learning', icon: Brain },
  { id: 'system',     label: 'System Status', icon: SettingsIcon },
  { id: 'about',      label: 'About', icon: Info },
]

export default function Settings() {
  const location = useLocation()
  const [activeSection, setActiveSection] = useState('organization')
  const orgContext = useOrg()
  const DEFAULTS = {
    theme_mode: 'dark',
    reduce_motion: false,
    notifications_json: {},
    meetings_json: {},
    ai_json: {}
  }

  const [userSettings, setUserSettings] = useState(DEFAULTS)
  const settingsRef = useRef(DEFAULTS)   // always-fresh ref for async API calls
  const [settingsLoading, setSettingsLoading] = useState(true)

  // Keep ref in sync with state
  useEffect(() => { settingsRef.current = userSettings }, [userSettings])

  // System status state
  const [status, setStatus] = useState(null)
  const [statusLoading, setStatusLoading] = useState(false)
  const [testing, setTesting] = useState(false)
  const [testingCRM, setTestingCRM] = useState(false)
  const [testingChat, setTestingChat] = useState(false)
  const [crmTestResult, setCrmTestResult] = useState(null)
  const [chatTestResult, setChatTestResult] = useState(null)

  const [deleteDialogMode, setDeleteDialogMode] = useState(null) // 'soft' | 'hard' | null
  const [deleteLoading, setDeleteLoading] = useState(false)

  const { mode, setThemeMode } = useTheme()

  // Load user settings from DB — merge over defaults so nothing is ever null
  useEffect(() => {
    ;(async () => {
      try {
        setSettingsLoading(true)
        const res = await settingsApi.getUser()
        if (res?.settings) {
          setUserSettings(prev => ({ ...prev, ...res.settings }))
        }
      } catch (err) {
        console.error('Failed to load user settings:', err)
        // Keep defaults — UI still works
      } finally {
        setSettingsLoading(false)
      }
    })()
  }, [])

  // Navigate to section from external link (e.g. Dashboard → ai-learning)
  useEffect(() => {
    if (location.state?.section) {
      setActiveSection(location.state.section)
    }
  }, [location.state])

  // ── Settings persistence helpers ──

  const updateSetting = (key, value) => {
    setUserSettings(prev => ({ ...prev, [key]: value }))
    // Fire-and-forget — UI updates immediately, API saves in background
    settingsApi.updateUser({ [key]: value }).catch(err =>
      console.error(`Failed to save ${key}:`, err)
    )
  }

  const updateJsonSetting = (column, key, value) => {
    setUserSettings(prev => {
      const current = prev[column] || {}
      return { ...prev, [column]: { ...current, [key]: value } }
    })
    // Read from ref (always fresh) for the API call
    const current = settingsRef.current[column] || {}
    settingsApi.updateUser({ [column]: { ...current, [key]: value } }).catch(err =>
      console.error(`Failed to save ${column}.${key}:`, err)
    )
  }

  // ── System status handlers ──

  const API_BASE = import.meta.env.VITE_API_URL || ''

  const loadStatus = async () => {
    try {
      setStatusLoading(true)
      const [healthData, integrationStatus, ecosystemStatus] = await Promise.all([
        checkHealth().catch(() => null),
        integrationsApi.getStatus().catch(() => ({ integrations: {} })),
        fetch(`${API_BASE}/api/ecosystem/status`).then(r => r.json()).catch(() => null)
      ])
      setStatus({
        health: healthData,
        integrations: integrationStatus.integrations,
        ecosystem: ecosystemStatus
      })
    } catch (error) {
      console.error('Failed to load status:', error)
    } finally {
      setStatusLoading(false)
    }
  }

  const handleTestConnection = async () => {
    setTesting(true)
    await loadStatus()
    setTesting(false)
  }

  const handleTestCRM = async () => {
    try {
      setTestingCRM(true)
      setCrmTestResult(null)
      const result = await fetch('/api/integrations/crm/test', { method: 'POST' }).then(r => r.json())
      setCrmTestResult(result)
    } catch (error) {
      setCrmTestResult({ connected: false, message: error.message })
    } finally {
      setTestingCRM(false)
    }
  }

  const handleTestChat = async () => {
    try {
      setTestingChat(true)
      setChatTestResult(null)
      try {
        const result = await integrationsApi.chat.test()
        setChatTestResult(result)
      } catch {
        const statusResult = await integrationsApi.getStatus()
        const chatStatus = statusResult.integrations?.chat
        setChatTestResult({
          connected: chatStatus?.configured,
          provider: chatStatus?.provider,
          message: chatStatus?.configured ? 'Connected' : 'Chat not configured'
        })
      }
    } catch (error) {
      setChatTestResult({ connected: false, message: error.message })
    } finally {
      setTestingChat(false)
    }
  }

  const getStatusIcon = (s) => {
    if (s === 'connected') return <CheckCircle2 className="w-5 h-5" style={{ color: 'var(--accent-secondary, #00F5D4)' }} />
    if (s === 'not configured') return <AlertCircle className="w-5 h-5 vc-text-warning" />
    return <XCircle className="w-5 h-5" style={{ color: 'var(--accent-primary, #FF2D6B)' }} />
  }

  const getStatusColor = (s) => {
    if (s === 'connected') return { color: 'var(--accent-secondary, #00F5D4)' }
    if (s === 'not configured') return { color: 'var(--accent-tertiary, #FFB800)' }
    return { color: 'var(--accent-primary, #FF2D6B)' }
  }

  // ── Theme handler that also persists ──
  const handleThemeChange = (newMode) => {
    setThemeMode(newMode)
    updateSetting('theme_mode', newMode)
  }

  // ── If AI Learning fullscreen ──
  if (activeSection === 'ai-learning-full') {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-4">
          <VCButton variant="ghost" size="sm" onClick={() => setActiveSection('ai-learning')}>
            <ArrowLeft className="w-4 h-4" /> Back
          </VCButton>
          <div>
            <h1 className="text-2xl font-bold" style={{ color: 'var(--text-primary)', fontFamily: 'var(--font-display)' }}>
              AI Learning System
            </h1>
            <p style={{ color: 'var(--text-secondary)' }}>Review and manage AI learning patterns</p>
          </div>
        </div>
        <LearningDashboard />
      </div>
    )
  }

  // ── Main Settings Layout ──
  return (
    <div className="flex gap-6" style={{ minHeight: 'calc(100vh - 120px)' }}>
      {/* Sidebar Navigation */}
      <nav
        className="w-52 flex-shrink-0 space-y-1 pt-2"
        style={{ position: 'sticky', top: 80, alignSelf: 'flex-start' }}
      >
        <h1
          className="text-xl font-bold mb-4 px-3"
          style={{ color: 'var(--text-primary)', fontFamily: 'var(--font-display)' }}
        >
          Settings
        </h1>
        {SECTIONS.map(sec => {
          const Icon = sec.icon
          const isActive = activeSection === sec.id
          return (
            <button
              key={sec.id}
              onClick={() => {
                setActiveSection(sec.id)
                // Lazy-load system status
                if (sec.id === 'system' && !status) loadStatus()
              }}
              className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm font-medium transition-colors text-left"
              style={{
                background: isActive ? 'rgba(255,45,107,.08)' : 'transparent',
                color: isActive ? 'var(--accent-primary)' : 'var(--text-secondary)',
                border: 'none',
                cursor: 'pointer'
              }}
            >
              <Icon className="w-4 h-4" />
              {sec.label}
            </button>
          )
        })}
      </nav>

      {/* Content Panel */}
      <div className="flex-1 min-w-0 space-y-6 pb-12">

        {/* ═══════ ORGANIZATION ═══════ */}
        {activeSection === 'organization' && (
          <>
            <SectionHeader title="Organization" subtitle="Manage your organization details and plan" />

            {orgContext.org && (
              <div className="vc p-5 space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <h3
                      className="font-semibold text-base"
                      style={{ color: 'var(--text-primary)', fontFamily: 'var(--font-display)' }}
                    >
                      {orgContext.org.name}
                    </h3>
                    <p className="text-xs mt-0.5" style={{ color: 'var(--text-tertiary)', fontFamily: 'var(--font-mono)' }}>
                      {orgContext.org.slug}
                    </p>
                  </div>
                  <span className={`px-3 py-1 text-sm font-medium rounded-full ${PLAN_BADGE_COLORS[orgContext.org.plan] || PLAN_BADGE_COLORS.free}`}>
                    {TENANT_PLAN_LABELS[orgContext.org.plan] || 'Free'}
                  </span>
                </div>

                <div
                  className="p-3 rounded-lg"
                  style={{ background: 'var(--bg-elevated)', border: '1px solid var(--b1)' }}
                >
                  <div className="flex items-center justify-between">
                    <span className="text-sm" style={{ color: 'var(--text-secondary)' }}>Workflow runs/mo</span>
                    <span className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>
                      {(TENANT_PLAN_LIMITS[orgContext.org.plan] || 100) >= 50000 ? 'Unlimited' : (TENANT_PLAN_LIMITS[orgContext.org.plan] || 100).toLocaleString()}
                    </span>
                  </div>
                  <div className="flex items-center justify-between mt-2">
                    <span className="text-sm" style={{ color: 'var(--text-secondary)' }}>Team members</span>
                    <span className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>
                      {orgContext.orgMembers.length}
                    </span>
                  </div>
                  <div className="flex items-center justify-between mt-2">
                    <span className="text-sm" style={{ color: 'var(--text-secondary)' }}>Your role</span>
                    <span className="text-sm font-medium capitalize" style={{ color: 'var(--text-primary)' }}>
                      {orgContext.myRole || 'member'}
                    </span>
                  </div>
                </div>
              </div>
            )}

            {/* Danger Zone — owner/admin only */}
            {orgContext.org && (orgContext.myRole === 'owner' || orgContext.myRole === 'admin') && (
              <div
                className="p-5 space-y-4 rounded-xl"
                style={{ border: '1px solid rgba(255,45,107,.3)', background: 'rgba(255,45,107,.03)' }}
              >
                <div>
                  <h3
                    className="font-semibold text-base"
                    style={{ color: 'var(--accent-primary, #FF2D6B)', fontFamily: 'var(--font-display)' }}
                  >
                    Danger Zone
                  </h3>
                  <p className="text-xs mt-1" style={{ color: 'var(--text-tertiary)' }}>
                    These actions affect your entire organization. Your personal projects, tasks, and automations are not affected by organization deletion.
                  </p>
                </div>

                <div className="flex items-center gap-3">
                  <VCButton
                    variant="amber"
                    onClick={() => setDeleteDialogMode('soft')}
                  >
                    <Archive className="w-4 h-4" /> Archive Organization
                  </VCButton>
                  {orgContext.myRole === 'owner' && (
                    <VCButton
                      variant="danger"
                      onClick={() => setDeleteDialogMode('hard')}
                    >
                      <Trash2 className="w-4 h-4" /> Permanently Delete
                    </VCButton>
                  )}
                </div>

                <DeleteOrgDialog
                  orgName={orgContext.org.name}
                  mode={deleteDialogMode || 'soft'}
                  isOpen={deleteDialogMode !== null}
                  isLoading={deleteLoading}
                  onCancel={() => setDeleteDialogMode(null)}
                  onConfirm={async () => {
                    setDeleteLoading(true)
                    try {
                      if (deleteDialogMode === 'soft') {
                        await orgContext.softDeleteOrg(orgContext.org.id)
                      } else {
                        await orgContext.hardDeleteOrg(orgContext.org.id)
                      }
                      setDeleteDialogMode(null)
                    } catch (err) {
                      console.error('Delete org failed:', err)
                    } finally {
                      setDeleteLoading(false)
                    }
                  }}
                />
              </div>
            )}
          </>
        )}

        {/* ═══════ APPEARANCE ═══════ */}
        {activeSection === 'appearance' && (
          <>
            <SectionHeader title="Appearance" subtitle="Customize the look and feel of your workspace" />

            <div className="vc">
              <div className="p-5">
                <label
                  className="text-sm font-medium block mb-3"
                  style={{ color: 'var(--text-primary)', fontFamily: 'var(--font-display)' }}
                >
                  Theme Mode
                </label>
                <div className="grid grid-cols-3 gap-3">
                  {[
                    { key: THEME_MODES.light, label: 'Light', Icon: Sun },
                    { key: THEME_MODES.dark, label: 'Dark', Icon: Moon },
                    { key: THEME_MODES.system, label: 'System', Icon: Monitor }
                  ].map(({ key, label, Icon }) => (
                    <button
                      key={key}
                      onClick={() => handleThemeChange(key)}
                      className="flex flex-col items-center gap-2 p-4 rounded-lg transition-all"
                      style={{
                        background: mode === key ? 'rgba(255,45,107,.08)' : 'var(--bg-elevated)',
                        border: `1.5px solid ${mode === key ? 'var(--accent-primary)' : 'var(--b1)'}`,
                        cursor: 'pointer',
                        color: mode === key ? 'var(--accent-primary)' : 'var(--text-secondary)'
                      }}
                    >
                      <Icon className="w-6 h-6" />
                      <span className="text-sm font-medium">{label}</span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Reduce Motion */}
              <div className="px-5 pb-5">
                <div
                  className="flex items-center justify-between p-3 rounded-lg"
                  style={{ background: 'var(--bg-elevated)', border: '1px solid var(--b1)' }}
                >
                  <div>
                    <span className="text-sm font-medium block" style={{ color: 'var(--text-primary)' }}>Reduce Motion</span>
                    <span className="text-xs" style={{ color: 'var(--text-tertiary)' }}>Minimize animations for accessibility</span>
                  </div>
                  <button
                    role="switch"
                    aria-checked={userSettings?.reduce_motion || false}
                    onClick={() => updateSetting('reduce_motion', !userSettings?.reduce_motion)}
                    className="relative inline-flex h-5 w-9 flex-shrink-0 rounded-full transition-colors"
                    style={{
                      background: userSettings?.reduce_motion ? 'var(--accent-primary)' : 'var(--b2, #333)',
                      cursor: 'pointer',
                      border: 'none'
                    }}
                  >
                    <span
                      className="inline-block h-4 w-4 rounded-full bg-white transition-transform"
                      style={{
                        transform: userSettings?.reduce_motion ? 'translateX(16px)' : 'translateX(2px)',
                        marginTop: 2
                      }}
                    />
                  </button>
                </div>
              </div>
            </div>
          </>
        )}

        {/* ═══════ AUDIO & RECORDING ═══════ */}
        {activeSection === 'audio' && (
          <>
            <SectionHeader title="Audio & Recording" subtitle="Configure microphone, speakers, and recording preferences" />
            <AudioSettings
              meetingsJson={userSettings?.meetings_json}
              onUpdateJson={(key, value) => updateJsonSetting('meetings_json', key, value)}
            />
          </>
        )}

        {/* ═══════ PERMISSIONS ═══════ */}
        {activeSection === 'permissions' && (
          <>
            <SectionHeader title="Permissions" subtitle="Manage browser permissions Entomate needs to function" />
            <PermissionsSettings />
          </>
        )}

        {/* ═══════ DATA & RETENTION ═══════ */}
        {activeSection === 'data-retention' && (
          <>
            <SectionHeader title="Data & Retention" subtitle="Control how long Meet Mate keeps recordings and transcripts" />
            <DataRetentionSettings />
          </>
        )}

        {activeSection === 'billing' && (
          <>
            <SectionHeader title="Plan & Billing" subtitle="Manage your subscription and usage" />
            <BillingSettings />
          </>
        )}

        {/* ═══════ NOTIFICATIONS ═══════ */}
        {activeSection === 'notifications' && (
          <>
            <SectionHeader title="Notifications" subtitle="Control how and when you receive alerts" />
            <NotificationSettings
              notifications={userSettings?.notifications_json}
              onUpdate={(key, value) => updateJsonSetting('notifications_json', key, value)}
            />
          </>
        )}

        {/* ═══════ INTEGRATIONS ═══════ */}
        {activeSection === 'integrations' && (
          <>
            <SectionHeader title="Integrations" subtitle="Connect Entomate to your ecosystem" />
            <EcosystemSettings />

            <div className="vc">
              <div
                className="p-4"
                style={{ borderBottom: '1px solid var(--b1, rgba(248,240,242,.06))' }}
              >
                <div className="flex items-center gap-2">
                  <MessageSquare className="w-5 h-5" style={{ color: 'var(--accent-phosphor, #B4F8C8)' }} />
                  <h2
                    className="font-semibold"
                    style={{ fontFamily: 'var(--font-display)', fontWeight: 600, color: 'var(--text-primary)', fontSize: 14 }}
                  >
                    Slack
                  </h2>
                </div>
                <p className="text-sm mt-1" style={{ color: 'var(--text-secondary)' }}>
                  Post meeting recaps, notifications, and alerts to Slack channels
                </p>
              </div>
              <div className="p-4">
                <SlackSettings />
              </div>
            </div>
          </>
        )}

        {/* ═══════ AI & LEARNING ═══════ */}
        {activeSection === 'ai-learning' && (
          <>
            <SectionHeader title="AI & Learning" subtitle="Configure AI behavior and review learning patterns" />

            {/* AI Settings (from ai_json) */}
            <div className="vc p-5 space-y-4">
              <div className="flex items-center gap-2 mb-2">
                <Brain className="w-5 h-5" style={{ color: 'var(--accent-tertiary, #FFB800)' }} />
                <h2
                  className="font-semibold"
                  style={{ fontFamily: 'var(--font-display)', fontWeight: 600, color: 'var(--text-primary)', fontSize: 14 }}
                >
                  AI Behavior
                </h2>
              </div>

              {/* Summary Detail Level */}
              <div>
                <label className="text-sm font-medium block mb-1" style={{ color: 'var(--text-primary)' }}>
                  Summary Detail Level
                </label>
                <p className="text-xs mb-2" style={{ color: 'var(--text-tertiary)' }}>
                  How verbose should meeting summaries be?
                </p>
                <div className="grid grid-cols-3 gap-2">
                  {['brief', 'standard', 'detailed'].map(level => {
                    const current = userSettings?.ai_json?.summary_detail_level || 'standard'
                    const isSelected = current === level
                    return (
                      <button
                        key={level}
                        onClick={() => updateJsonSetting('ai_json', 'summary_detail_level', level)}
                        className="flex flex-col items-center gap-1 p-3 rounded-lg transition-all capitalize"
                        style={{
                          background: isSelected ? 'rgba(255,45,107,.08)' : 'var(--bg-elevated)',
                          border: `1.5px solid ${isSelected ? 'var(--accent-primary)' : 'var(--b1)'}`,
                          cursor: 'pointer',
                          color: isSelected ? 'var(--accent-primary)' : 'var(--text-secondary)',
                          fontSize: 13
                        }}
                      >
                        {level}
                      </button>
                    )
                  })}
                </div>
              </div>

              {/* Auto-assign threshold */}
              <div>
                <label className="text-sm font-medium block mb-1" style={{ color: 'var(--text-primary)' }}>
                  Auto-Assign Confidence Threshold
                </label>
                <p className="text-xs mb-2" style={{ color: 'var(--text-tertiary)' }}>
                  Minimum AI confidence before auto-assigning action items. Lower = more aggressive.
                </p>
                <div className="flex items-center gap-3">
                  <input
                    type="range"
                    min="0.3"
                    max="1.0"
                    step="0.05"
                    value={userSettings?.ai_json?.auto_assign_threshold ?? 0.75}
                    onChange={e => updateJsonSetting('ai_json', 'auto_assign_threshold', parseFloat(e.target.value))}
                    className="flex-1"
                    style={{ accentColor: 'var(--accent-primary)' }}
                  />
                  <span
                    className="text-sm font-mono w-10 text-right"
                    style={{ color: 'var(--accent-primary)', fontFamily: 'var(--font-mono)' }}
                  >
                    {(userSettings?.ai_json?.auto_assign_threshold ?? 0.75).toFixed(2)}
                  </span>
                </div>
              </div>

              {/* Sentiment Analysis toggle */}
              <div
                className="flex items-center justify-between p-3 rounded-lg"
                style={{ background: 'var(--bg-elevated)', border: '1px solid var(--b1)' }}
              >
                <div>
                  <span className="text-sm font-medium block" style={{ color: 'var(--text-primary)' }}>Sentiment Analysis</span>
                  <span className="text-xs" style={{ color: 'var(--text-tertiary)' }}>Analyze emotional tone of meetings</span>
                </div>
                <button
                  role="switch"
                  aria-checked={userSettings?.ai_json?.enable_sentiment ?? true}
                  onClick={() => updateJsonSetting('ai_json', 'enable_sentiment', !(userSettings?.ai_json?.enable_sentiment ?? true))}
                  className="relative inline-flex h-5 w-9 flex-shrink-0 rounded-full transition-colors"
                  style={{
                    background: (userSettings?.ai_json?.enable_sentiment ?? true) ? 'var(--accent-primary)' : 'var(--b2, #333)',
                    cursor: 'pointer',
                    border: 'none'
                  }}
                >
                  <span
                    className="inline-block h-4 w-4 rounded-full bg-white transition-transform"
                    style={{
                      transform: (userSettings?.ai_json?.enable_sentiment ?? true) ? 'translateX(16px)' : 'translateX(2px)',
                      marginTop: 2
                    }}
                  />
                </button>
              </div>
            </div>

            {/* Learning Dashboard Link */}
            <div className="vc">
              <div className="p-5">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1">
                    <h3
                      className="font-semibold mb-1"
                      style={{ fontFamily: 'var(--font-display)', color: 'var(--text-primary)', fontSize: 14 }}
                    >
                      Learning Patterns
                    </h3>
                    <p className="text-sm mb-3" style={{ color: 'var(--text-secondary)' }}>
                      View and approve AI learning patterns to improve recommendations.
                    </p>
                    <VCButton variant="primary" onClick={() => setActiveSection('ai-learning-full')}>
                      <Brain className="w-4 h-4" /> Manage Learning Patterns
                    </VCButton>
                  </div>
                </div>
              </div>
            </div>
          </>
        )}

        {/* ═══════ SYSTEM STATUS ═══════ */}
        {activeSection === 'system' && (
          <>
            <SectionHeader title="System Status" subtitle="Monitor service connections and health" />

            <div className="vc">
              <div
                className="p-4 flex items-center justify-between"
                style={{ borderBottom: '1px solid var(--b1, rgba(248,240,242,.06))' }}
              >
                <span className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>Service Health</span>
                <VCButton variant="secondary" size="sm" onClick={handleTestConnection} disabled={testing}>
                  <RefreshCw className={`w-4 h-4 ${testing ? 'animate-spin' : ''}`} />
                  {testing ? 'Testing...' : 'Test All'}
                </VCButton>
              </div>

              {statusLoading && !status ? (
                <div className="p-8 text-center">
                  <div className="spinner mx-auto mb-4" />
                  <p style={{ color: 'var(--text-secondary)' }}>Loading status...</p>
                </div>
              ) : (
                <div>
                  {/* AI Provider */}
                  <StatusRow
                    icon={<Cpu className="w-5 h-5" />}
                    iconColor="amber"
                    title={
                      status?.integrations?.gemini?.provider === 'openai' ? 'OpenAI'
                        : status?.integrations?.gemini?.provider === 'gemini' ? 'Gemini AI'
                        : 'AI Provider'
                    }
                    subtitle={
                      status?.integrations?.gemini?.configured
                        ? `Transcription & analysis (${status.integrations.gemini.provider}) — key present, not live-tested`
                        : 'Transcription and analysis'
                    }
                    status={status?.integrations?.gemini?.status || status?.health?.services?.gemini}
                    getStatusIcon={getStatusIcon}
                    getStatusColor={getStatusColor}
                  />

                  {/* Database — uses real query from /api/health */}
                  <StatusRow
                    icon={<Database className="w-5 h-5" />}
                    iconColor="mint"
                    title="Supabase Database"
                    subtitle={
                      status?.health?.services?.database === 'connected'
                        ? 'Data storage — live query successful'
                        : 'Data storage'
                    }
                    status={status?.health?.services?.database || status?.integrations?.supabase?.status}
                    getStatusIcon={getStatusIcon}
                    getStatusColor={getStatusColor}
                  />

                  {/* CRM — Logos Vision via Ecosystem Bridge */}
                  <StatusRow
                    icon={<SettingsIcon className="w-5 h-5" />}
                    iconColor="crimson"
                    title="Logos Vision CRM"
                    subtitle="Task synchronization via Ecosystem Bridge"
                    status={status?.ecosystem?.logosVision ? 'connected' : 'not configured'}
                    getStatusIcon={getStatusIcon}
                    getStatusColor={getStatusColor}
                    action={
                      <VCButton variant="ghost" size="sm" onClick={() => setActiveSection('integrations')}>
                        Configure
                      </VCButton>
                    }
                  />

                  {/* Chat — Pulse via Ecosystem Bridge */}
                  <StatusRow
                    icon={<MessageSquare className="w-5 h-5" />}
                    iconColor="phosphor"
                    title="Pulse"
                    subtitle="Team notifications & meeting recaps via Ecosystem Bridge"
                    status={status?.ecosystem?.pulse ? 'connected' : 'not configured'}
                    getStatusIcon={getStatusIcon}
                    getStatusColor={getStatusColor}
                    last
                    action={
                      <VCButton variant="ghost" size="sm" onClick={() => setActiveSection('integrations')}>
                        Configure
                      </VCButton>
                    }
                  />
                </div>
              )}
            </div>
          </>
        )}

        {/* ═══════ ABOUT ═══════ */}
        {activeSection === 'about' && (
          <>
            <SectionHeader title="About Entomate" subtitle="AI-powered meeting intelligence platform" />
            <div className="vc p-5">
              <div className="text-sm space-y-2" style={{ color: 'var(--text-secondary)' }}>
                <p><strong style={{ color: 'var(--text-primary)' }}>Version:</strong> 1.0.0</p>
                <p><strong style={{ color: 'var(--text-primary)' }}>Stack:</strong> React + Node.js + Supabase + OpenAI/Gemini</p>
                <p><strong style={{ color: 'var(--text-primary)' }}>Design System:</strong> Void Crimson</p>
                <p className="pt-2">
                  Entomate helps teams capture, organize, and act on meeting insights automatically.
                  Record meetings, get AI-powered transcriptions and summaries, extract action items,
                  and sync across your ecosystem.
                </p>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  )
}

// ── Sub-components ──

function SectionHeader({ title, subtitle }) {
  return (
    <div>
      <h2
        className="text-lg font-bold"
        style={{ color: 'var(--text-primary)', fontFamily: 'var(--font-display)' }}
      >
        {title}
      </h2>
      {subtitle && <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>{subtitle}</p>}
    </div>
  )
}

function StatusRow({ icon, iconColor, title, subtitle, status, getStatusIcon, getStatusColor, action, result, last }) {
  return (
    <div
      className="p-4"
      style={!last ? { borderBottom: '1px solid var(--b1, rgba(248,240,242,.06))' } : {}}
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <VCIconBox color={iconColor}>{icon}</VCIconBox>
          <div>
            <h3
              className="font-medium"
              style={{ fontFamily: 'var(--font-display)', fontWeight: 600, color: 'var(--text-primary)', fontSize: 14 }}
            >
              {title}
            </h3>
            <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>{subtitle}</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            {getStatusIcon(status)}
            <span className="text-sm font-medium" style={getStatusColor(status)}>
              {status || 'Unknown'}
            </span>
          </div>
          {action}
        </div>
      </div>
      {result}
    </div>
  )
}
