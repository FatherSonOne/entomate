import React, { useState, useEffect } from 'react'
import {
  Settings as SettingsIcon, Database, Cpu, MessageSquare,
  RefreshCw, CheckCircle2, XCircle, AlertCircle, Loader2,
  Palette, Sun, Moon
} from 'lucide-react'
import { integrationsApi, checkHealth } from '../services/api'
import { useTheme, THEME_MODES } from '../context/ThemeContext'

export default function Settings() {
  const [status, setStatus] = useState(null)
  const [loading, setLoading] = useState(true)
  const [testing, setTesting] = useState(false)
  const [testingCRM, setTestingCRM] = useState(false)
  const [testingChat, setTestingChat] = useState(false)
  const [crmTestResult, setCrmTestResult] = useState(null)
  const [chatTestResult, setChatTestResult] = useState(null)

  const { mode, setThemeMode } = useTheme()

  useEffect(() => {
    loadStatus()
  }, [])

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
      return <CheckCircle2 className="w-5 h-5 text-green-500" />
    } else if (statusValue === 'not configured') {
      return <AlertCircle className="w-5 h-5 text-yellow-500" />
    } else {
      return <XCircle className="w-5 h-5 text-red-500" />
    }
  }

  const getStatusColor = (statusValue) => {
    if (statusValue === 'connected') return 'text-green-600'
    if (statusValue === 'not configured') return 'text-yellow-600'
    return 'text-red-600'
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-content-primary">Settings</h1>
        <p className="text-content-secondary">Configure your Entomate workspace</p>
      </div>

      {/* Appearance Settings */}
      <div className="card">
        <div className="p-4 border-b border-line-default">
          <div className="flex items-center gap-2">
            <Palette className="w-5 h-5 text-accent-primary" />
            <h2 className="font-semibold text-content-primary">Appearance</h2>
          </div>
          <p className="text-sm text-content-secondary mt-1">
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
                <Sun className={`w-6 h-6 ${mode === THEME_MODES.light ? 'text-accent-primary' : 'text-content-secondary'}`} />
                <span className={`text-sm font-medium ${mode === THEME_MODES.light ? 'text-accent-primary' : 'text-content-secondary'}`}>
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
                <Moon className={`w-6 h-6 ${mode === THEME_MODES.dark ? 'text-accent-primary' : 'text-content-secondary'}`} />
                <span className={`text-sm font-medium ${mode === THEME_MODES.dark ? 'text-accent-primary' : 'text-content-secondary'}`}>
                  Dark
                </span>
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* System Status */}
      <div className="card">
        <div className="p-4 border-b border-line-default flex items-center justify-between">
          <h2 className="font-semibold text-content-primary">System Status</h2>
          <button
            onClick={handleTestConnection}
            disabled={testing}
            className="btn btn-secondary btn-sm"
          >
            <RefreshCw className={`w-4 h-4 ${testing ? 'animate-spin' : ''}`} />
            {testing ? 'Testing...' : 'Test Connections'}
          </button>
        </div>

        {loading ? (
          <div className="p-8 text-center">
            <div className="spinner mx-auto mb-4" />
            <p className="text-content-secondary">Loading status...</p>
          </div>
        ) : (
          <div className="divide-y divide-line-subtle">
            {/* AI Provider */}
            <div className="p-4 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-purple-100 dark:bg-purple-900/30 rounded-lg flex items-center justify-center">
                  <Cpu className="w-5 h-5 text-purple-600 dark:text-purple-400" />
                </div>
                <div>
                  <h3 className="font-medium text-content-primary">
                    {status?.integrations?.gemini?.provider === 'openai' ? 'OpenAI' : 'Gemini AI'}
                  </h3>
                  <p className="text-sm text-content-secondary">Transcription and analysis</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                {getStatusIcon(status?.integrations?.gemini?.status || status?.health?.services?.gemini)}
                <span className={`text-sm font-medium ${getStatusColor(status?.integrations?.gemini?.status || status?.health?.services?.gemini)}`}>
                  {status?.integrations?.gemini?.status || status?.health?.services?.gemini || 'Unknown'}
                </span>
              </div>
            </div>

            {/* Database */}
            <div className="p-4 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-blue-100 dark:bg-blue-900/30 rounded-lg flex items-center justify-center">
                  <Database className="w-5 h-5 text-blue-600 dark:text-blue-400" />
                </div>
                <div>
                  <h3 className="font-medium text-content-primary">Supabase Database</h3>
                  <p className="text-sm text-content-secondary">Data storage</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                {getStatusIcon(status?.integrations?.supabase?.status || status?.health?.services?.database)}
                <span className={`text-sm font-medium ${getStatusColor(status?.integrations?.supabase?.status || status?.health?.services?.database)}`}>
                  {status?.integrations?.supabase?.status || status?.health?.services?.database || 'Unknown'}
                </span>
              </div>
            </div>

            {/* CRM - Logos Vision */}
            <div className="p-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-green-100 dark:bg-green-900/30 rounded-lg flex items-center justify-center">
                    <SettingsIcon className="w-5 h-5 text-green-600 dark:text-green-400" />
                  </div>
                  <div>
                    <h3 className="font-medium text-content-primary">CRM Integration</h3>
                    <p className="text-sm text-content-secondary">
                      Logos Vision - Task synchronization
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <div className="flex items-center gap-2">
                    {getStatusIcon(status?.integrations?.crm?.status)}
                    <span className={`text-sm font-medium ${getStatusColor(status?.integrations?.crm?.status)}`}>
                      {status?.integrations?.crm?.status || 'Not configured'}
                    </span>
                  </div>
                  {status?.integrations?.crm?.configured && (
                    <button
                      onClick={handleTestCRM}
                      disabled={testingCRM}
                      className="btn btn-secondary btn-sm"
                    >
                      {testingCRM ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Test'}
                    </button>
                  )}
                </div>
              </div>
              {crmTestResult && (
                <div className={`mt-2 ml-13 p-2 rounded text-sm ${
                  crmTestResult.connected ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'
                }`}>
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
                  <div className="w-10 h-10 bg-orange-100 dark:bg-orange-900/30 rounded-lg flex items-center justify-center">
                    <MessageSquare className="w-5 h-5 text-orange-600 dark:text-orange-400" />
                  </div>
                  <div>
                    <h3 className="font-medium text-content-primary">Chat Integration</h3>
                    <p className="text-sm text-content-secondary">
                      Pulse - Team notifications
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <div className="flex items-center gap-2">
                    {getStatusIcon(status?.integrations?.chat?.status)}
                    <span className={`text-sm font-medium ${getStatusColor(status?.integrations?.chat?.status)}`}>
                      {status?.integrations?.chat?.status || 'Not configured'}
                    </span>
                  </div>
                  {status?.integrations?.chat?.configured && (
                    <button
                      onClick={handleTestChat}
                      disabled={testingChat}
                      className="btn btn-secondary btn-sm"
                    >
                      {testingChat ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Test'}
                    </button>
                  )}
                </div>
              </div>
              {chatTestResult && (
                <div className={`mt-2 ml-13 p-2 rounded text-sm ${
                  chatTestResult.connected ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'
                }`}>
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
      <div className="card p-5">
        <h2 className="font-semibold text-content-primary mb-4">Configuration Guide</h2>

        <div className="space-y-4">
          <div className="p-4 bg-surface-subtle rounded-lg">
            <h3 className="font-medium text-content-primary mb-2">1. AI Provider (OpenAI or Gemini)</h3>
            <p className="text-sm text-content-secondary mb-2">
              Required for transcription and AI analysis. OpenAI recommended for better rate limits.
            </p>
            <div className="space-y-2">
              <div className="bg-surface p-3 rounded border border-line-default">
                <p className="text-sm font-medium text-green-700 dark:text-green-400 mb-1">OpenAI (Recommended)</p>
                <code className="text-xs bg-surface-muted px-2 py-1 rounded block mb-1 text-content-primary">
                  OPENAI_API_KEY=sk-your-key-here
                </code>
                <p className="text-xs text-content-secondary">
                  Get your key from <a href="https://platform.openai.com/api-keys" target="_blank" rel="noreferrer" className="text-highlight hover:underline">OpenAI Platform</a>
                </p>
              </div>
              <div className="bg-surface p-3 rounded border border-line-default">
                <p className="text-sm font-medium text-content-secondary mb-1">Gemini (Alternative)</p>
                <code className="text-xs bg-surface-muted px-2 py-1 rounded block mb-1 text-content-primary">
                  GEMINI_API_KEY=your_api_key_here
                </code>
                <p className="text-xs text-content-secondary">
                  Get your key from <a href="https://aistudio.google.com" target="_blank" rel="noreferrer" className="text-highlight hover:underline">Google AI Studio</a>
                </p>
              </div>
            </div>
          </div>

          <div className="p-4 bg-surface-subtle rounded-lg">
            <h3 className="font-medium text-content-primary mb-2">2. Supabase Setup</h3>
            <p className="text-sm text-content-secondary mb-2">
              Required for data storage. Create a project at Supabase.
            </p>
            <code className="text-xs bg-surface-muted px-2 py-1 rounded block mb-1 text-content-primary">
              SUPABASE_URL=your_project_url
            </code>
            <code className="text-xs bg-surface-muted px-2 py-1 rounded block text-content-primary">
              SUPABASE_ANON_KEY=your_anon_key
            </code>
          </div>

          <div className="p-4 bg-surface-subtle rounded-lg">
            <h3 className="font-medium text-content-primary mb-2">3. Logos Vision CRM (Optional)</h3>
            <p className="text-sm text-content-secondary mb-2">
              Connect to Logos Vision to sync action items as tasks and manage customer relationships.
            </p>
            <code className="text-xs bg-surface-muted px-2 py-1 rounded block mb-1 text-content-primary">
              LOGOS_VISION_URL=http://localhost:3001
            </code>
            <code className="text-xs bg-surface-muted px-2 py-1 rounded block text-content-primary">
              LOGOS_VISION_API_KEY=your_api_key
            </code>
          </div>

          <div className="p-4 bg-surface-subtle rounded-lg">
            <h3 className="font-medium text-content-primary mb-2">4. Pulse Integration (Optional)</h3>
            <p className="text-sm text-content-secondary mb-2">
              Connect to Pulse for team notifications and meeting recap sharing.
            </p>
            <code className="text-xs bg-surface-muted px-2 py-1 rounded block mb-1 text-content-primary">
              PULSE_URL=http://localhost:3002
            </code>
            <code className="text-xs bg-surface-muted px-2 py-1 rounded block text-content-primary">
              PULSE_API_KEY=your_api_key
            </code>
          </div>
        </div>
      </div>

      {/* About */}
      <div className="card p-5">
        <h2 className="font-semibold text-content-primary mb-4">About Entomate</h2>
        <div className="text-sm text-content-secondary space-y-2">
          <p><strong className="text-content-primary">Version:</strong> 1.0.0</p>
          <p><strong className="text-content-primary">Stack:</strong> React + Node.js + Supabase + Gemini AI</p>
          <p>
            Entomate is an AI-powered meeting intelligence platform that helps teams
            capture, organize, and act on meeting insights automatically.
          </p>
        </div>
      </div>
    </div>
  )
}
