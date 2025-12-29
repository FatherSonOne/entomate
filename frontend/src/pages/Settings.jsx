import React, { useState, useEffect } from 'react'
import {
  Settings as SettingsIcon, Database, Cpu, MessageSquare,
  RefreshCw, CheckCircle2, XCircle, AlertCircle, Loader2,
  Palette, Sun, Moon, Monitor, Check
} from 'lucide-react'
import { integrationsApi, checkHealth } from '../services/api'
import { useTheme, HIGHLIGHT_COLORS, THEME_MODES, DESIGN_THEMES } from '../context/ThemeContext'
import ThemeToggle from '../components/ThemeToggle'

export default function Settings() {
  const [status, setStatus] = useState(null)
  const [loading, setLoading] = useState(true)
  const [testing, setTesting] = useState(false)
  const [testingCRM, setTestingCRM] = useState(false)
  const [testingChat, setTestingChat] = useState(false)
  const [crmTestResult, setCrmTestResult] = useState(null)
  const [chatTestResult, setChatTestResult] = useState(null)

  const { mode, highlightColor, designTheme, setThemeMode, setAccentColor, setDesignTheme, isDark } = useTheme()

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
        <h1 className="text-2xl font-bold text-nothing-900 dark:text-nothing-100">Settings</h1>
        <p className="text-nothing-600 dark:text-nothing-400">Configure your Entomate workspace</p>
      </div>

      {/* Appearance Settings - CMF Nothing Style */}
      <div className="card">
        <div className="p-4 border-b border-nothing-200 dark:border-nothing-700">
          <div className="flex items-center gap-2">
            <Palette className="w-5 h-5 text-highlight" />
            <h2 className="font-semibold text-nothing-900 dark:text-nothing-100">Appearance</h2>
          </div>
          <p className="text-sm text-nothing-500 dark:text-nothing-400 mt-1">
            Customize the look and feel of your workspace
          </p>
        </div>

        <div className="p-5 space-y-6">
          {/* Theme Mode */}
          <div>
            <label className="label">Theme Mode</label>
            <div className="grid grid-cols-3 gap-3 mt-2">
              <button
                onClick={() => setThemeMode(THEME_MODES.light)}
                className={`flex flex-col items-center gap-2 p-4 rounded-lg border-2 transition-all ${
                  mode === THEME_MODES.light
                    ? 'border-highlight bg-highlight-light'
                    : 'border-nothing-200 dark:border-nothing-700 hover:border-nothing-300 dark:hover:border-nothing-600'
                }`}
              >
                <Sun className={`w-6 h-6 ${mode === THEME_MODES.light ? 'text-highlight' : 'text-nothing-500'}`} />
                <span className={`text-sm font-medium ${mode === THEME_MODES.light ? 'text-highlight' : 'text-nothing-600 dark:text-nothing-400'}`}>
                  Light
                </span>
              </button>

              <button
                onClick={() => setThemeMode(THEME_MODES.dark)}
                className={`flex flex-col items-center gap-2 p-4 rounded-lg border-2 transition-all ${
                  mode === THEME_MODES.dark
                    ? 'border-highlight bg-highlight-light'
                    : 'border-nothing-200 dark:border-nothing-700 hover:border-nothing-300 dark:hover:border-nothing-600'
                }`}
              >
                <Moon className={`w-6 h-6 ${mode === THEME_MODES.dark ? 'text-highlight' : 'text-nothing-500'}`} />
                <span className={`text-sm font-medium ${mode === THEME_MODES.dark ? 'text-highlight' : 'text-nothing-600 dark:text-nothing-400'}`}>
                  Dark
                </span>
              </button>

              <button
                onClick={() => setThemeMode(THEME_MODES.system)}
                className={`flex flex-col items-center gap-2 p-4 rounded-lg border-2 transition-all ${
                  mode === THEME_MODES.system
                    ? 'border-highlight bg-highlight-light'
                    : 'border-nothing-200 dark:border-nothing-700 hover:border-nothing-300 dark:hover:border-nothing-600'
                }`}
              >
                <Monitor className={`w-6 h-6 ${mode === THEME_MODES.system ? 'text-highlight' : 'text-nothing-500'}`} />
                <span className={`text-sm font-medium ${mode === THEME_MODES.system ? 'text-highlight' : 'text-nothing-600 dark:text-nothing-400'}`}>
                  System
                </span>
              </button>
            </div>
          </div>

          {/* Design Theme */}
          <div>
            <label className="label">Design Theme</label>
            <p className="text-sm text-content-tertiary mb-4">
              Choose a design inspired by popular developer tools
            </p>
            <div className="grid grid-cols-1 gap-3">
              {Object.entries(DESIGN_THEMES).map(([key, theme]) => (
                <button
                  key={key}
                  onClick={() => setDesignTheme(key)}
                  className={`flex items-center gap-4 p-4 rounded-lg border-2 transition-all ${
                    designTheme === key
                      ? 'border-accent-primary bg-accent-primary-dim'
                      : 'border-line-default hover:border-line-strong hover:bg-surface-muted'
                  }`}
                >
                  <div
                    className="w-6 h-6 rounded-full border-2"
                    style={{
                      backgroundColor: theme.preview.bg,
                      borderColor: theme.preview.accent
                    }}
                  />
                  <div className="text-left flex-1">
                    <div className="font-medium text-content-primary">{theme.name}</div>
                    <div className="text-content-tertiary text-sm">{theme.description}</div>
                  </div>
                  {designTheme === key && (
                    <Check className="w-5 h-5 text-accent-primary" />
                  )}
                </button>
              ))}
            </div>
          </div>

          {/* Theme Preview */}
          <div className="card p-4">
            <p className="text-sm text-content-tertiary mb-3">Preview</p>
            <div className="flex flex-wrap items-center gap-3">
              <button className="btn btn-primary">Primary Button</button>
              <button className="btn btn-secondary">Secondary</button>
              <span className="badge badge-highlight">Badge</span>
              <span className="badge badge-success">Success</span>
              <span className="badge badge-warning">Warning</span>
            </div>
          </div>

          {/* Quick Toggle */}
          <div className="card p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="font-medium text-content-primary">Quick Toggle</p>
                <p className="text-sm text-content-tertiary">
                  Switch between light and dark mode, or change themes
                </p>
              </div>
              <ThemeToggle />
            </div>
          </div>
        </div>
      </div>

      {/* System Status */}
      <div className="card">
        <div className="p-4 border-b border-nothing-200 dark:border-nothing-700 flex items-center justify-between">
          <h2 className="font-semibold text-nothing-900 dark:text-nothing-100">System Status</h2>
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
            <p className="text-nothing-500 dark:text-nothing-400">Loading status...</p>
          </div>
        ) : (
          <div className="divide-y divide-nothing-100 dark:divide-nothing-800">
            {/* AI Provider */}
            <div className="p-4 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-purple-100 dark:bg-purple-900/30 rounded-lg flex items-center justify-center">
                  <Cpu className="w-5 h-5 text-purple-600 dark:text-purple-400" />
                </div>
                <div>
                  <h3 className="font-medium text-nothing-900 dark:text-nothing-100">
                    {status?.integrations?.gemini?.provider === 'openai' ? 'OpenAI' : 'Gemini AI'}
                  </h3>
                  <p className="text-sm text-nothing-500 dark:text-nothing-400">Transcription and analysis</p>
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
                  <h3 className="font-medium text-nothing-900 dark:text-nothing-100">Supabase Database</h3>
                  <p className="text-sm text-nothing-500 dark:text-nothing-400">Data storage</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                {getStatusIcon(status?.integrations?.supabase?.status || status?.health?.services?.database)}
                <span className={`text-sm font-medium ${getStatusColor(status?.integrations?.supabase?.status || status?.health?.services?.database)}`}>
                  {status?.integrations?.supabase?.status || status?.health?.services?.database || 'Unknown'}
                </span>
              </div>
            </div>

            {/* CRM */}
            <div className="p-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-green-100 dark:bg-green-900/30 rounded-lg flex items-center justify-center">
                    <SettingsIcon className="w-5 h-5 text-green-600 dark:text-green-400" />
                  </div>
                  <div>
                    <h3 className="font-medium text-nothing-900 dark:text-nothing-100">CRM Integration</h3>
                    <p className="text-sm text-nothing-500 dark:text-nothing-400">
                      {status?.integrations?.crm?.provider || 'HubSpot'} - Task synchronization
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

            {/* Chat */}
            <div className="p-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-orange-100 dark:bg-orange-900/30 rounded-lg flex items-center justify-center">
                    <MessageSquare className="w-5 h-5 text-orange-600 dark:text-orange-400" />
                  </div>
                  <div>
                    <h3 className="font-medium text-nothing-900 dark:text-nothing-100">Chat Integration</h3>
                    <p className="text-sm text-nothing-500 dark:text-nothing-400">
                      {status?.integrations?.chat?.provider === 'slack' ? 'Slack' :
                       status?.integrations?.chat?.provider === 'teams' ? 'Microsoft Teams' :
                       status?.integrations?.chat?.provider === 'discord' ? 'Discord' :
                       status?.integrations?.chat?.provider || 'Slack'}
                      {status?.integrations?.chat?.mode === 'webhook' ? ' (Webhook)' :
                       status?.integrations?.chat?.mode === 'bot' ? ' (Bot)' : ''}
                      {' - Team notifications'}
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
        <h2 className="font-semibold text-nothing-900 dark:text-nothing-100 mb-4">Configuration Guide</h2>

        <div className="space-y-4">
          <div className="p-4 bg-nothing-50 dark:bg-nothing-800/50 rounded-lg">
            <h3 className="font-medium text-nothing-900 dark:text-nothing-100 mb-2">1. AI Provider (OpenAI or Gemini)</h3>
            <p className="text-sm text-nothing-600 dark:text-nothing-400 mb-2">
              Required for transcription and AI analysis. OpenAI recommended for better rate limits.
            </p>
            <div className="space-y-2">
              <div className="bg-white dark:bg-nothing-900 p-3 rounded border border-nothing-200 dark:border-nothing-700">
                <p className="text-sm font-medium text-green-700 dark:text-green-400 mb-1">OpenAI (Recommended)</p>
                <code className="text-xs bg-nothing-200 dark:bg-nothing-800 px-2 py-1 rounded block mb-1 text-nothing-800 dark:text-nothing-200">
                  OPENAI_API_KEY=sk-your-key-here
                </code>
                <p className="text-xs text-nothing-500 dark:text-nothing-400">
                  Get your key from <a href="https://platform.openai.com/api-keys" target="_blank" rel="noreferrer" className="text-highlight hover:underline">OpenAI Platform</a>
                </p>
              </div>
              <div className="bg-white dark:bg-nothing-900 p-3 rounded border border-nothing-200 dark:border-nothing-700">
                <p className="text-sm font-medium text-nothing-700 dark:text-nothing-300 mb-1">Gemini (Alternative)</p>
                <code className="text-xs bg-nothing-200 dark:bg-nothing-800 px-2 py-1 rounded block mb-1 text-nothing-800 dark:text-nothing-200">
                  GEMINI_API_KEY=your_api_key_here
                </code>
                <p className="text-xs text-nothing-500 dark:text-nothing-400">
                  Get your key from <a href="https://aistudio.google.com" target="_blank" rel="noreferrer" className="text-highlight hover:underline">Google AI Studio</a>
                </p>
              </div>
            </div>
          </div>

          <div className="p-4 bg-nothing-50 dark:bg-nothing-800/50 rounded-lg">
            <h3 className="font-medium text-nothing-900 dark:text-nothing-100 mb-2">2. Supabase Setup</h3>
            <p className="text-sm text-nothing-600 dark:text-nothing-400 mb-2">
              Required for data storage. Create a project at Supabase.
            </p>
            <code className="text-xs bg-nothing-200 dark:bg-nothing-800 px-2 py-1 rounded block mb-1 text-nothing-800 dark:text-nothing-200">
              SUPABASE_URL=your_project_url
            </code>
            <code className="text-xs bg-nothing-200 dark:bg-nothing-800 px-2 py-1 rounded block text-nothing-800 dark:text-nothing-200">
              SUPABASE_ANON_KEY=your_anon_key
            </code>
          </div>

          <div className="p-4 bg-nothing-50 dark:bg-nothing-800/50 rounded-lg">
            <h3 className="font-medium text-nothing-900 dark:text-nothing-100 mb-2">3. CRM Integration (Optional)</h3>
            <p className="text-sm text-nothing-600 dark:text-nothing-400 mb-2">
              Connect to sync action items as tasks.
            </p>
            <code className="text-xs bg-nothing-200 dark:bg-nothing-800 px-2 py-1 rounded block text-nothing-800 dark:text-nothing-200">
              CRM_API_KEY=your_crm_api_key
            </code>
          </div>

          <div className="p-4 bg-nothing-50 dark:bg-nothing-800/50 rounded-lg">
            <h3 className="font-medium text-nothing-900 dark:text-nothing-100 mb-2">4. Chat Integration (Optional)</h3>
            <p className="text-sm text-nothing-600 dark:text-nothing-400 mb-2">
              Connect to post meeting recaps to your team chat. Supports Slack, Microsoft Teams, and Discord.
            </p>

            <div className="space-y-3 mt-3">
              <div className="bg-white dark:bg-nothing-900 p-3 rounded border border-nothing-200 dark:border-nothing-700">
                <p className="text-sm font-medium text-nothing-800 dark:text-nothing-200 mb-1">Slack</p>
                <code className="text-xs bg-nothing-200 dark:bg-nothing-800 px-2 py-1 rounded block mb-1 text-nothing-800 dark:text-nothing-200">
                  CHAT_PROVIDER=slack
                </code>
                <code className="text-xs bg-nothing-200 dark:bg-nothing-800 px-2 py-1 rounded block mb-1 text-nothing-800 dark:text-nothing-200">
                  SLACK_BOT_TOKEN=xoxb-your-token
                </code>
                <p className="text-xs text-nothing-500 dark:text-nothing-400">
                  Or use a webhook: <code className="bg-nothing-200 dark:bg-nothing-800 px-1 text-nothing-800 dark:text-nothing-200">SLACK_WEBHOOK_URL=https://hooks.slack.com/...</code>
                </p>
              </div>

              <div className="bg-white dark:bg-nothing-900 p-3 rounded border border-nothing-200 dark:border-nothing-700">
                <p className="text-sm font-medium text-nothing-800 dark:text-nothing-200 mb-1">Microsoft Teams</p>
                <code className="text-xs bg-nothing-200 dark:bg-nothing-800 px-2 py-1 rounded block mb-1 text-nothing-800 dark:text-nothing-200">
                  CHAT_PROVIDER=teams
                </code>
                <code className="text-xs bg-nothing-200 dark:bg-nothing-800 px-2 py-1 rounded block text-nothing-800 dark:text-nothing-200">
                  TEAMS_WEBHOOK_URL=https://outlook.office.com/webhook/...
                </code>
              </div>

              <div className="bg-white dark:bg-nothing-900 p-3 rounded border border-nothing-200 dark:border-nothing-700">
                <p className="text-sm font-medium text-nothing-800 dark:text-nothing-200 mb-1">Discord</p>
                <code className="text-xs bg-nothing-200 dark:bg-nothing-800 px-2 py-1 rounded block mb-1 text-nothing-800 dark:text-nothing-200">
                  CHAT_PROVIDER=discord
                </code>
                <code className="text-xs bg-nothing-200 dark:bg-nothing-800 px-2 py-1 rounded block mb-1 text-nothing-800 dark:text-nothing-200">
                  DISCORD_BOT_TOKEN=your-bot-token
                </code>
                <p className="text-xs text-nothing-500 dark:text-nothing-400">
                  Or use a webhook: <code className="bg-nothing-200 dark:bg-nothing-800 px-1 text-nothing-800 dark:text-nothing-200">DISCORD_WEBHOOK_URL=https://discord.com/api/webhooks/...</code>
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* About */}
      <div className="card p-5">
        <h2 className="font-semibold text-nothing-900 dark:text-nothing-100 mb-4">About Entomate</h2>
        <div className="text-sm text-nothing-600 dark:text-nothing-400 space-y-2">
          <p><strong className="text-nothing-900 dark:text-nothing-100">Version:</strong> 1.0.0</p>
          <p><strong className="text-nothing-900 dark:text-nothing-100">Stack:</strong> React + Node.js + Supabase + Gemini AI</p>
          <p>
            Entomate is an AI-powered meeting intelligence platform that helps teams
            capture, organize, and act on meeting insights automatically.
          </p>
        </div>
      </div>
    </div>
  )
}
