import React, { useState, useEffect } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import {
  Settings as SettingsIcon, Database, Cpu, MessageSquare,
  RefreshCw, CheckCircle2, XCircle, AlertCircle, Loader2,
  Palette, Sun, Moon, Brain, ArrowLeft
} from 'lucide-react'
import { integrationsApi, checkHealth } from '../services/api'
import { useTheme, THEME_MODES } from '../context/ThemeContext'
import LearningDashboard from '../components/learning/LearningDashboard'
import EcosystemSettings from '../components/EcosystemSettings'
import { VCButton, VCIconBox } from '../components/vc'

export default function Settings() {
  const location = useLocation()
  const navigate = useNavigate()
  const [status, setStatus] = useState(null)
  const [loading, setLoading] = useState(true)
  const [testing, setTesting] = useState(false)
  const [testingCRM, setTestingCRM] = useState(false)
  const [testingChat, setTestingChat] = useState(false)
  const [crmTestResult, setCrmTestResult] = useState(null)
  const [chatTestResult, setChatTestResult] = useState(null)
  const [activeSection, setActiveSection] = useState('settings')

  const { mode, setThemeMode } = useTheme()

  useEffect(() => {
    loadStatus()
  }, [])

  useEffect(() => {
    // Check if navigated from Dashboard with ai-learning section
    if (location.state?.section === 'ai-learning') {
      setActiveSection('ai-learning')
    }
  }, [location.state])

  const loadStatus = async () => {
    try {
      setLoading(true)
      const [healthData, integrationStatus] = await Promise.all([
        checkHealth().catch(() => null),
        integrationsApi.getStatus().catch(() => ({ integrations: {} }))
      ])
      setStatus({
        health: healthData,
        integrations: integrationStatus.integrations
      })
    } catch (error) {
      console.error('Failed to load status:', error)
    } finally {
      setLoading(false)
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
      const result = await fetch('/api/integrations/crm/test', { method: 'POST' })
        .then(r => r.json())
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
        // Fallback: check general status endpoint
        const statusResult = await integrationsApi.getStatus()
        const chatStatus = statusResult.integrations?.chat
        setChatTestResult({
          connected: chatStatus?.configured,
          provider: chatStatus?.provider,
          mode: chatStatus?.mode,
          message: chatStatus?.configured ? 'Connected' : 'Chat not configured'
        })
      }
    } catch (error) {
      setChatTestResult({ connected: false, message: error.message })
    } finally {
      setTestingChat(false)
    }
  }

  const getStatusIcon = (statusValue) => {
    if (statusValue === 'connected') {
      return <CheckCircle2 className="w-5 h-5" style={{ color: 'var(--accent-secondary, #00F5D4)' }} />
    } else if (statusValue === 'not configured') {
      return <AlertCircle className="w-5 h-5 vc-text-warning" />
    } else {
      return <XCircle className="w-5 h-5" style={{ color: 'var(--accent-primary, #FF2D6B)' }} />
    }
  }

  const getStatusColor = (statusValue) => {
    if (statusValue === 'connected') return { color: 'var(--accent-secondary, #00F5D4)' }
    if (statusValue === 'not configured') return { color: 'var(--accent-tertiary, #FFB800)' }
    return { color: 'var(--accent-primary, #FF2D6B)' }
  }

  // If AI Learning section is active, show LearningDashboard
  if (activeSection === 'ai-learning') {
    return (
      <div className="space-y-6">
        {/* Header with back button */}
        <div className="flex items-center gap-4">
          <VCButton
            variant="ghost"
            size="sm"
            onClick={() => setActiveSection('settings')}
          >
            <ArrowLeft className="w-4 h-4" />
            Back to Settings
          </VCButton>
          <div>
            <h1
              className="text-2xl font-bold"
              style={{ color: 'var(--text-primary)', fontFamily: 'var(--font-display)' }}
            >
              AI Learning System
            </h1>
            <p style={{ color: 'var(--text-secondary)' }}>Review and manage AI learning patterns</p>
          </div>
        </div>

        <LearningDashboard />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1
          className="text-2xl font-bold"
          style={{ color: 'var(--text-primary)', fontFamily: 'var(--font-display)' }}
        >
          Settings
        </h1>
        <p style={{ color: 'var(--text-secondary)' }}>Configure your Entomate workspace</p>
      </div>

      {/* AI Learning Section */}
      <div className="vc">
        <div
          className="p-4"
          style={{ borderBottom: '1px solid var(--b1, rgba(248,240,242,.06))' }}
        >
          <div className="flex items-center gap-2">
            <Brain className="w-5 h-5" style={{ color: 'var(--accent-tertiary, #FFB800)' }} />
            <h2
              className="font-semibold"
              style={{ fontFamily: 'var(--font-display)', fontWeight: 600, color: 'var(--text-primary)', fontSize: 14 }}
            >
              AI Learning
            </h2>
          </div>
          <p className="text-sm mt-1" style={{ color: 'var(--text-secondary)' }}>
            Manage AI agent learning patterns and improve recommendations
          </p>
        </div>

        <div className="p-5">
          <div className="flex items-start justify-between gap-4">
            <div className="flex-1">
              <p className="text-sm mb-4" style={{ color: 'var(--text-secondary)' }}>
                View and approve AI learning patterns to continuously improve agent recommendations for task assignment, priority detection, and deadline suggestions.
              </p>
              <VCButton
                variant="primary"
                onClick={() => setActiveSection('ai-learning')}
              >
                <Brain className="w-4 h-4" />
                Manage Learning Patterns
              </VCButton>
            </div>
          </div>
        </div>
      </div>

      {/* Appearance Settings */}
      <div className="vc">
        <div
          className="p-4"
          style={{ borderBottom: '1px solid var(--b1, rgba(248,240,242,.06))' }}
        >
          <div className="flex items-center gap-2">
            <Palette className="w-5 h-5" style={{ color: 'var(--accent-primary, #FF2D6B)' }} />
            <h2
              className="font-semibold"
              style={{ fontFamily: 'var(--font-display)', fontWeight: 600, color: 'var(--text-primary)', fontSize: 14 }}
            >
              Appearance
            </h2>
          </div>
          <p className="text-sm mt-1" style={{ color: 'var(--text-secondary)' }}>
            Customize the look and feel of your workspace
          </p>
        </div>

        <div className="p-5">
          {/* Theme Mode */}
          <div>
            <label className="label">Theme Mode</label>
            <div className="grid grid-cols-2 gap-3 mt-2">
              <button
                onClick={() => setThemeMode(THEME_MODES.light)}
                className={`flex flex-col items-center gap-2 p-4 rounded-lg border-2 transition-all ${
                  mode === THEME_MODES.light
                    ? 'border-accent-primary bg-accent-primary-dim'
                    : 'border-line-default hover:border-line-strong'
                }`}
              >
                <Sun
                  className="w-6 h-6"
                  style={{ color: mode === THEME_MODES.light ? 'var(--accent-primary, #FF2D6B)' : 'var(--text-secondary)' }}
                />
                <span
                  className="text-sm font-medium"
                  style={{ color: mode === THEME_MODES.light ? 'var(--accent-primary, #FF2D6B)' : 'var(--text-secondary)' }}
                >
                  Light
                </span>
              </button>

              <button
                onClick={() => setThemeMode(THEME_MODES.dark)}
                className={`flex flex-col items-center gap-2 p-4 rounded-lg border-2 transition-all ${
                  mode === THEME_MODES.dark
                    ? 'border-accent-primary bg-accent-primary-dim'
                    : 'border-line-default hover:border-line-strong'
                }`}
              >
                <Moon
                  className="w-6 h-6"
                  style={{ color: mode === THEME_MODES.dark ? 'var(--accent-primary, #FF2D6B)' : 'var(--text-secondary)' }}
                />
                <span
                  className="text-sm font-medium"
                  style={{ color: mode === THEME_MODES.dark ? 'var(--accent-primary, #FF2D6B)' : 'var(--text-secondary)' }}
                >
                  Dark
                </span>
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Ecosystem Bridge */}
      <EcosystemSettings />

      {/* System Status */}
      <div className="vc">
        <div
          className="p-4 flex items-center justify-between"
          style={{ borderBottom: '1px solid var(--b1, rgba(248,240,242,.06))' }}
        >
          <h2
            className="font-semibold"
            style={{ fontFamily: 'var(--font-display)', fontWeight: 600, color: 'var(--text-primary)', fontSize: 14 }}
          >
            System Status
          </h2>
          <VCButton
            variant="secondary"
            size="sm"
            onClick={handleTestConnection}
            disabled={testing}
          >
            <RefreshCw className={`w-4 h-4 ${testing ? 'animate-spin' : ''}`} />
            {testing ? 'Testing...' : 'Test Connections'}
          </VCButton>
        </div>

        {loading ? (
          <div className="p-8 text-center">
            <div className="spinner mx-auto mb-4" />
            <p style={{ color: 'var(--text-secondary)' }}>Loading status...</p>
          </div>
        ) : (
          <div>
            {/* AI Provider */}
            <div
              className="p-4 flex items-center justify-between"
              style={{ borderBottom: '1px solid var(--b1, rgba(248,240,242,.06))' }}
            >
              <div className="flex items-center gap-3">
                <VCIconBox color="amber">
                  <Cpu className="w-5 h-5" />
                </VCIconBox>
                <div>
                  <h3
                    className="font-medium"
                    style={{ fontFamily: 'var(--font-display)', fontWeight: 600, color: 'var(--text-primary)', fontSize: 14 }}
                  >
                    {status?.integrations?.gemini?.provider === 'openai' ? 'OpenAI' : 'Gemini AI'}
                  </h3>
                  <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>Transcription and analysis</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                {getStatusIcon(status?.integrations?.gemini?.status || status?.health?.services?.gemini)}
                <span
                  className="text-sm font-medium"
                  style={getStatusColor(status?.integrations?.gemini?.status || status?.health?.services?.gemini)}
                >
                  {status?.integrations?.gemini?.status || status?.health?.services?.gemini || 'Unknown'}
                </span>
              </div>
            </div>

            {/* Database */}
            <div
              className="p-4 flex items-center justify-between"
              style={{ borderBottom: '1px solid var(--b1, rgba(248,240,242,.06))' }}
            >
              <div className="flex items-center gap-3">
                <VCIconBox color="mint">
                  <Database className="w-5 h-5" />
                </VCIconBox>
                <div>
                  <h3
                    className="font-medium"
                    style={{ fontFamily: 'var(--font-display)', fontWeight: 600, color: 'var(--text-primary)', fontSize: 14 }}
                  >
                    Supabase Database
                  </h3>
                  <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>Data storage</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                {getStatusIcon(status?.integrations?.supabase?.status || status?.health?.services?.database)}
                <span
                  className="text-sm font-medium"
                  style={getStatusColor(status?.integrations?.supabase?.status || status?.health?.services?.database)}
                >
                  {status?.integrations?.supabase?.status || status?.health?.services?.database || 'Unknown'}
                </span>
              </div>
            </div>

            {/* CRM - Logos Vision */}
            <div
              className="p-4"
              style={{ borderBottom: '1px solid var(--b1, rgba(248,240,242,.06))' }}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <VCIconBox color="crimson">
                    <SettingsIcon className="w-5 h-5" />
                  </VCIconBox>
                  <div>
                    <h3
                      className="font-medium"
                      style={{ fontFamily: 'var(--font-display)', fontWeight: 600, color: 'var(--text-primary)', fontSize: 14 }}
                    >
                      CRM Integration
                    </h3>
                    <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>
                      Logos Vision - Task synchronization
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <div className="flex items-center gap-2">
                    {getStatusIcon(status?.integrations?.crm?.status)}
                    <span
                      className="text-sm font-medium"
                      style={getStatusColor(status?.integrations?.crm?.status)}
                    >
                      {status?.integrations?.crm?.status || 'Not configured'}
                    </span>
                  </div>
                  {status?.integrations?.crm?.configured && (
                    <VCButton
                      variant="secondary"
                      size="sm"
                      onClick={handleTestCRM}
                      disabled={testingCRM}
                    >
                      {testingCRM ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Test'}
                    </VCButton>
                  )}
                </div>
              </div>
              {crmTestResult && (
                <div
                  className="mt-2 ml-13 p-2 rounded text-sm"
                  style={{
                    background: crmTestResult.connected ? 'rgba(0,245,212,.08)' : 'rgba(255,45,107,.08)',
                    color: crmTestResult.connected ? 'var(--accent-secondary, #00F5D4)' : 'var(--accent-primary, #FF2D6B)',
                  }}
                >
                  {crmTestResult.connected
                    ? `Connected to ${crmTestResult.provider || 'CRM'}`
                    : crmTestResult.message || 'Connection failed'}
                </div>
              )}
            </div>

            {/* Chat - Pulse */}
            <div className="p-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <VCIconBox color="phosphor">
                    <MessageSquare className="w-5 h-5" />
                  </VCIconBox>
                  <div>
                    <h3
                      className="font-medium"
                      style={{ fontFamily: 'var(--font-display)', fontWeight: 600, color: 'var(--text-primary)', fontSize: 14 }}
                    >
                      Chat Integration
                    </h3>
                    <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>
                      Pulse - Team notifications
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <div className="flex items-center gap-2">
                    {getStatusIcon(status?.integrations?.chat?.status)}
                    <span
                      className="text-sm font-medium"
                      style={getStatusColor(status?.integrations?.chat?.status)}
                    >
                      {status?.integrations?.chat?.status || 'Not configured'}
                    </span>
                  </div>
                  {status?.integrations?.chat?.configured && (
                    <VCButton
                      variant="secondary"
                      size="sm"
                      onClick={handleTestChat}
                      disabled={testingChat}
                    >
                      {testingChat ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Test'}
                    </VCButton>
                  )}
                </div>
              </div>
              {chatTestResult && (
                <div
                  className="mt-2 ml-13 p-2 rounded text-sm"
                  style={{
                    background: chatTestResult.connected ? 'rgba(0,245,212,.08)' : 'rgba(255,45,107,.08)',
                    color: chatTestResult.connected ? 'var(--accent-secondary, #00F5D4)' : 'var(--accent-primary, #FF2D6B)',
                  }}
                >
                  {chatTestResult.connected
                    ? `Connected to ${chatTestResult.team || chatTestResult.provider || 'Chat'}${chatTestResult.user ? ` as ${chatTestResult.user}` : ''}`
                    : chatTestResult.message || 'Connection failed'}
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Configuration Guide */}
      <div className="vc p-5">
        <h2
          className="font-semibold mb-4"
          style={{ fontFamily: 'var(--font-display)', fontWeight: 600, color: 'var(--text-primary)', fontSize: 14 }}
        >
          Configuration Guide
        </h2>

        <div className="space-y-4">
          <div className="p-4 rounded-lg" style={{ background: 'var(--bg-elevated)' }}>
            <h3
              className="font-medium mb-2"
              style={{ fontFamily: 'var(--font-display)', fontWeight: 600, color: 'var(--text-primary)', fontSize: 14 }}
            >
              1. AI Provider (OpenAI or Gemini)
            </h3>
            <p className="text-sm mb-2" style={{ color: 'var(--text-secondary)' }}>
              Required for transcription and AI analysis. OpenAI recommended for better rate limits.
            </p>
            <div className="space-y-2">
              <div
                className="p-3 rounded"
                style={{ background: 'var(--bg-elevated)', border: '1px solid var(--b1)' }}
              >
                <p className="text-sm font-medium mb-1" style={{ color: 'var(--accent-secondary, #00F5D4)' }}>OpenAI (Recommended)</p>
                <code
                  className="text-xs px-2 py-1 rounded block mb-1"
                  style={{ background: 'var(--b0)', color: 'var(--text-primary)', fontFamily: 'var(--font-mono)' }}
                >
                  OPENAI_API_KEY=sk-your-key-here
                </code>
                <p className="text-xs" style={{ color: 'var(--text-secondary)' }}>
                  Get your key from <a href="https://platform.openai.com/api-keys" target="_blank" rel="noreferrer" style={{ color: 'var(--accent-primary, #FF2D6B)' }} className="hover:underline">OpenAI Platform</a>
                </p>
              </div>
              <div
                className="p-3 rounded"
                style={{ background: 'var(--bg-elevated)', border: '1px solid var(--b1)' }}
              >
                <p className="text-sm font-medium mb-1" style={{ color: 'var(--text-secondary)' }}>Gemini (Alternative)</p>
                <code
                  className="text-xs px-2 py-1 rounded block mb-1"
                  style={{ background: 'var(--b0)', color: 'var(--text-primary)', fontFamily: 'var(--font-mono)' }}
                >
                  GEMINI_API_KEY=your_api_key_here
                </code>
                <p className="text-xs" style={{ color: 'var(--text-secondary)' }}>
                  Get your key from <a href="https://aistudio.google.com" target="_blank" rel="noreferrer" style={{ color: 'var(--accent-primary, #FF2D6B)' }} className="hover:underline">Google AI Studio</a>
                </p>
              </div>
            </div>
          </div>

          <div className="p-4 rounded-lg" style={{ background: 'var(--bg-elevated)' }}>
            <h3
              className="font-medium mb-2"
              style={{ fontFamily: 'var(--font-display)', fontWeight: 600, color: 'var(--text-primary)', fontSize: 14 }}
            >
              2. Supabase Setup
            </h3>
            <p className="text-sm mb-2" style={{ color: 'var(--text-secondary)' }}>
              Required for data storage. Create a project at Supabase.
            </p>
            <code
              className="text-xs px-2 py-1 rounded block mb-1"
              style={{ background: 'var(--b0)', color: 'var(--text-primary)', fontFamily: 'var(--font-mono)' }}
            >
              SUPABASE_URL=your_project_url
            </code>
            <code
              className="text-xs px-2 py-1 rounded block"
              style={{ background: 'var(--b0)', color: 'var(--text-primary)', fontFamily: 'var(--font-mono)' }}
            >
              SUPABASE_ANON_KEY=your_anon_key
            </code>
          </div>

          <div className="p-4 rounded-lg" style={{ background: 'var(--bg-elevated)' }}>
            <h3
              className="font-medium mb-2"
              style={{ fontFamily: 'var(--font-display)', fontWeight: 600, color: 'var(--text-primary)', fontSize: 14 }}
            >
              3. Logos Vision CRM (Optional)
            </h3>
            <p className="text-sm mb-2" style={{ color: 'var(--text-secondary)' }}>
              Connect to Logos Vision to sync action items as tasks and manage customer relationships.
            </p>
            <code
              className="text-xs px-2 py-1 rounded block mb-1"
              style={{ background: 'var(--b0)', color: 'var(--text-primary)', fontFamily: 'var(--font-mono)' }}
            >
              LOGOS_VISION_URL=http://localhost:3001
            </code>
            <code
              className="text-xs px-2 py-1 rounded block"
              style={{ background: 'var(--b0)', color: 'var(--text-primary)', fontFamily: 'var(--font-mono)' }}
            >
              LOGOS_VISION_API_KEY=your_api_key
            </code>
          </div>

          <div className="p-4 rounded-lg" style={{ background: 'var(--bg-elevated)' }}>
            <h3
              className="font-medium mb-2"
              style={{ fontFamily: 'var(--font-display)', fontWeight: 600, color: 'var(--text-primary)', fontSize: 14 }}
            >
              4. Pulse Integration (Optional)
            </h3>
            <p className="text-sm mb-2" style={{ color: 'var(--text-secondary)' }}>
              Connect to Pulse for team notifications and meeting recap sharing.
            </p>
            <code
              className="text-xs px-2 py-1 rounded block mb-1"
              style={{ background: 'var(--b0)', color: 'var(--text-primary)', fontFamily: 'var(--font-mono)' }}
            >
              PULSE_URL=http://localhost:3002
            </code>
            <code
              className="text-xs px-2 py-1 rounded block"
              style={{ background: 'var(--b0)', color: 'var(--text-primary)', fontFamily: 'var(--font-mono)' }}
            >
              PULSE_API_KEY=your_api_key
            </code>
          </div>
        </div>
      </div>

      {/* About */}
      <div className="vc p-5">
        <h2
          className="font-semibold mb-4"
          style={{ fontFamily: 'var(--font-display)', fontWeight: 600, color: 'var(--text-primary)', fontSize: 14 }}
        >
          About Entomate
        </h2>
        <div className="text-sm space-y-2" style={{ color: 'var(--text-secondary)' }}>
          <p><strong style={{ color: 'var(--text-primary)' }}>Version:</strong> 1.0.0</p>
          <p><strong style={{ color: 'var(--text-primary)' }}>Stack:</strong> React + Node.js + Supabase + Gemini AI</p>
          <p>
            Entomate is an AI-powered meeting intelligence platform that helps teams
            capture, organize, and act on meeting insights automatically.
          </p>
        </div>
      </div>
    </div>
  )
}
