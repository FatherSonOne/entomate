import React, { useState, useEffect } from 'react'
import {
  Zap, Plus, Play, Pause, Trash2, Clock, CheckCircle2,
  AlertCircle, Settings, Bot, Sparkles, History, RefreshCw,
  ChevronDown, ChevronUp, XCircle, Eye, Wrench, Calendar,
  TrendingUp, AlertTriangle, BarChart2, FileText, MessageSquare,
  GitBranch, Database, Globe, Layers, Presentation, UserPlus,
  AlertOctagon, Users
} from 'lucide-react'

// Map icon name strings to Lucide components for workflow templates
const ICON_MAP = {
  'trending-up': TrendingUp,
  'alert-triangle': AlertTriangle,
  'bar-chart-2': BarChart2,
  'refresh-cw': RefreshCw,
  'alert-circle': AlertCircle,
  'file-text': FileText,
  'message-square': MessageSquare,
  'calendar': Calendar,
  'git-branch': GitBranch,
  'database': Database,
  'globe': Globe,
  'layers': Layers,
  'presentation': Presentation,
  'user-plus': UserPlus,
  'alert-octagon': AlertOctagon,
  'users': Users,
  'zap': Zap,
  'bot': Bot,
  'sparkles': Sparkles,
  'settings': Settings
}

// Render icon - handles both emoji strings and Lucide icon names
const renderTemplateIcon = (iconName, className = "w-6 h-6") => {
  if (!iconName) return <span className="text-2xl">💼</span>

  // Check if it's an emoji (starts with non-alphanumeric or is a single character)
  if (/^[\u{1F300}-\u{1F9FF}]/u.test(iconName) || iconName.length <= 2) {
    return <span className="text-2xl">{iconName}</span>
  }

  // Look up Lucide icon component
  const IconComponent = ICON_MAP[iconName]
  if (IconComponent) {
    return <IconComponent className={`${className} text-emerald-600`} />
  }

  // Fallback to default
  return <span className="text-2xl">💼</span>
}
import { automationsApi } from '../services/api'
import AutomationBuilder from '../components/AutomationBuilder'

export default function Automations() {
  const [automations, setAutomations] = useState([])
  const [templates, setTemplates] = useState([])
  const [loading, setLoading] = useState(true)
  const [showCreate, setShowCreate] = useState(false)
  const [showBuilder, setShowBuilder] = useState(false)
  const [showHistory, setShowHistory] = useState(false)
  const [executionLogs, setExecutionLogs] = useState([])
  const [loadingLogs, setLoadingLogs] = useState(false)
  const [selectedCategory, setSelectedCategory] = useState('all')
  const [schedulerStatus, setSchedulerStatus] = useState([])
  const [testingId, setTestingId] = useState(null)
  const [testResult, setTestResult] = useState(null)

  useEffect(() => {
    loadData()
  }, [])

  const loadData = async () => {
    try {
      setLoading(true)
      const [automationsData, templatesData] = await Promise.all([
        automationsApi.list(),
        automationsApi.getTemplates()
      ])
      setAutomations(automationsData.automations || [])
      setTemplates(templatesData.templates || [])
    } catch (error) {
      console.error('Failed to load data:', error)
    } finally {
      setLoading(false)
    }
  }

  const loadExecutionLogs = async () => {
    try {
      setLoadingLogs(true)
      // Load logs for all automations
      const allLogs = []
      for (const automation of automations.slice(0, 5)) {
        try {
          const logs = await automationsApi.getLogs(automation.id, { limit: 10 })
          allLogs.push(...(logs.logs || []).map(log => ({
            ...log,
            automationName: automation.name
          })))
        } catch (e) {
          // Skip if logs fail
        }
      }
      // Sort by date
      allLogs.sort((a, b) => new Date(b.created_at) - new Date(a.created_at))
      setExecutionLogs(allLogs.slice(0, 20))
    } catch (error) {
      console.error('Failed to load logs:', error)
    } finally {
      setLoadingLogs(false)
    }
  }

  const handleCreateFromTemplate = async (template) => {
    try {
      await automationsApi.create({
        name: template.name,
        description: template.description,
        triggerType: template.trigger_type || template.triggerType,
        triggerConfig: template.trigger_config || template.triggerConfig || {},
        actions: template.actions,
        enabled: true
      })
      setShowCreate(false)
      loadData()
    } catch (error) {
      console.error('Failed to create automation:', error)
    }
  }

  const handleToggle = async (id, currentEnabled) => {
    try {
      await automationsApi.toggle(id, !currentEnabled)
      setAutomations(automations.map(a =>
        a.id === id ? { ...a, enabled: !currentEnabled } : a
      ))
    } catch (error) {
      console.error('Failed to toggle automation:', error)
    }
  }

  const handleExecute = async (id) => {
    try {
      const result = await automationsApi.execute(id, {})
      alert(`Automation executed! ${result.success ? 'Success' : 'Failed'}`)
      loadData()
    } catch (error) {
      console.error('Failed to execute automation:', error)
    }
  }

  const handleDelete = async (id) => {
    if (!confirm('Delete this automation?')) return

    try {
      await automationsApi.delete(id)
      setAutomations(automations.filter(a => a.id !== id))
    } catch (error) {
      console.error('Failed to delete automation:', error)
    }
  }

  const handleTest = async (id) => {
    try {
      setTestingId(id)
      setTestResult(null)
      const result = await automationsApi.test(id, {
        // Sample data for testing
        meeting: { title: 'Test Meeting', summary: 'Test summary' },
        actionItem: { task_description: 'Test task', priority: 'medium' }
      })
      setTestResult({ id, ...result })
    } catch (error) {
      setTestResult({ id, success: false, error: error.message })
    } finally {
      setTestingId(null)
    }
  }

  const handleBuilderSave = async (automationData) => {
    try {
      await automationsApi.create(automationData)
      setShowBuilder(false)
      loadData()
    } catch (error) {
      console.error('Failed to create automation:', error)
      alert('Failed to create automation: ' + error.message)
    }
  }

  const handleBuilderTest = async (automationData) => {
    // Create a temporary automation to test
    try {
      const tempResult = await automationsApi.create({
        ...automationData,
        name: `[TEST] ${automationData.name}`,
        enabled: false
      })

      // Test it
      const testRes = await automationsApi.test(tempResult.automation.id, {
        meeting: { title: 'Test Meeting', summary: 'Test summary' },
        actionItem: { task_description: 'Test task', priority: 'medium' }
      })

      // Delete the temp automation
      await automationsApi.delete(tempResult.automation.id)

      return testRes
    } catch (error) {
      return { success: false, error: error.message }
    }
  }

  const loadSchedulerStatus = async () => {
    try {
      const status = await automationsApi.getSchedulerStatus()
      setSchedulerStatus(status.scheduled || [])
    } catch (error) {
      console.error('Failed to load scheduler status:', error)
    }
  }

  const getTriggerIcon = (type) => {
    switch (type) {
      case 'meeting_ended': return '🎙️'
      case 'meeting_processed': return '📝'
      case 'deal_created': return '💰'
      case 'task_completed': return '✅'
      case 'action_item_created': return '📋'
      case 'scheduled': return '🕐'
      default: return '⚡'
    }
  }

  const getCategoryIcon = (category) => {
    switch (category) {
      case 'ai': return <Sparkles className="w-4 h-4 text-purple-500" />
      case 'integration': return <RefreshCw className="w-4 h-4 text-blue-500" />
      default: return <Zap className="w-4 h-4 text-yellow-500" />
    }
  }

  const filteredTemplates = selectedCategory === 'all'
    ? templates
    : templates.filter(t => t.category === selectedCategory)

  const aiTemplates = templates.filter(t => t.category === 'ai')
  const integrationTemplates = templates.filter(t => t.category === 'integration' || !t.category)
  const crmTemplates = templates.filter(t => t.category === 'crm')

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Automations & AI Agents</h1>
          <p className="text-gray-600">Automate workflows with triggers, actions, and AI agents</p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => { setShowHistory(!showHistory); if (!showHistory) loadExecutionLogs(); }}
            className={`btn ${showHistory ? 'btn-primary' : 'btn-secondary'}`}
          >
            <History className="w-4 h-4" />
            History
          </button>
          <button
            onClick={() => { loadSchedulerStatus(); }}
            className="btn btn-secondary"
            title="View scheduled automations"
          >
            <Calendar className="w-4 h-4" />
          </button>
          <button
            onClick={() => setShowCreate(!showCreate)}
            className="btn btn-secondary"
          >
            <Plus className="w-4 h-4" />
            From Template
          </button>
          <button
            onClick={() => setShowBuilder(true)}
            className="btn btn-primary"
          >
            <Wrench className="w-4 h-4" />
            Build Custom
          </button>
        </div>
      </div>

      {/* Execution History */}
      {showHistory && (
        <div className="card">
          <div className="p-4 border-b border-gray-200 flex items-center justify-between">
            <h3 className="font-semibold text-gray-900 flex items-center gap-2">
              <History className="w-5 h-5" />
              Recent Execution History
            </h3>
            <button onClick={loadExecutionLogs} className="btn btn-ghost btn-sm">
              <RefreshCw className={`w-4 h-4 ${loadingLogs ? 'animate-spin' : ''}`} />
            </button>
          </div>
          <div className="max-h-64 overflow-y-auto">
            {loadingLogs ? (
              <div className="p-4 text-center text-gray-500">Loading...</div>
            ) : executionLogs.length === 0 ? (
              <div className="p-4 text-center text-gray-500">No execution history yet</div>
            ) : (
              <div className="divide-y divide-gray-100">
                {executionLogs.map((log, idx) => (
                  <div key={idx} className="p-3 flex items-center gap-3">
                    {log.success ? (
                      <CheckCircle2 className="w-5 h-5 text-green-500 flex-shrink-0" />
                    ) : (
                      <XCircle className="w-5 h-5 text-red-500 flex-shrink-0" />
                    )}
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-900">{log.automationName || 'Unknown'}</p>
                      <p className="text-xs text-gray-500">
                        {new Date(log.created_at).toLocaleString()}
                        {log.duration_ms && ` • ${log.duration_ms}ms`}
                      </p>
                    </div>
                    {log.error_message && (
                      <span className="text-xs text-red-500 truncate max-w-32">{log.error_message}</span>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Automation Builder */}
      {showBuilder && (
        <AutomationBuilder
          onSave={handleBuilderSave}
          onCancel={() => setShowBuilder(false)}
          onTest={handleBuilderTest}
        />
      )}

      {/* Scheduler Status */}
      {schedulerStatus.length > 0 && (
        <div className="card">
          <div className="p-4 border-b border-gray-200 flex items-center justify-between">
            <h3 className="font-semibold text-gray-900 flex items-center gap-2">
              <Calendar className="w-5 h-5 text-blue-500" />
              Scheduled Automations
            </h3>
            <button onClick={() => setSchedulerStatus([])} className="btn btn-ghost btn-sm">
              <XCircle className="w-4 h-4" />
            </button>
          </div>
          <div className="divide-y divide-gray-100">
            {schedulerStatus.map((scheduled) => (
              <div key={scheduled.id} className="p-3 flex items-center gap-3">
                <Clock className="w-5 h-5 text-blue-500 flex-shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-900">{scheduled.name}</p>
                  <p className="text-xs text-gray-500 font-mono">
                    {scheduled.cronExpression}
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-xs text-gray-500">Next run:</p>
                  <p className="text-sm text-gray-700">
                    {scheduled.nextRun ? new Date(scheduled.nextRun).toLocaleString() : 'N/A'}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Create from templates */}
      {showCreate && (
        <div className="card p-5">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold text-gray-900">Choose a Template</h3>
            <div className="flex gap-2 flex-wrap">
              <button
                onClick={() => setSelectedCategory('all')}
                className={`btn btn-sm ${selectedCategory === 'all' ? 'btn-primary' : 'btn-ghost'}`}
              >
                All
              </button>
              <button
                onClick={() => setSelectedCategory('ai')}
                className={`btn btn-sm ${selectedCategory === 'ai' ? 'btn-primary' : 'btn-ghost'}`}
              >
                <Sparkles className="w-3 h-3" /> AI
              </button>
              <button
                onClick={() => setSelectedCategory('integration')}
                className={`btn btn-sm ${selectedCategory === 'integration' ? 'btn-primary' : 'btn-ghost'}`}
              >
                <RefreshCw className="w-3 h-3" /> Integration
              </button>
              <button
                onClick={() => setSelectedCategory('crm')}
                className={`btn btn-sm ${selectedCategory === 'crm' ? 'btn-primary' : 'btn-ghost'}`}
              >
                💼 CRM
              </button>
            </div>
          </div>

          {/* AI Agent Templates Section */}
          {(selectedCategory === 'all' || selectedCategory === 'ai') && aiTemplates.length > 0 && (
            <div className="mb-6">
              <h4 className="text-sm font-medium text-purple-600 mb-3 flex items-center gap-2">
                <Bot className="w-4 h-4" />
                AI-Powered Automations
              </h4>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {aiTemplates.map((template) => (
                  <div
                    key={template.id}
                    className="border border-purple-200 bg-purple-50 rounded-lg p-4 hover:border-purple-400 cursor-pointer transition-colors"
                    onClick={() => handleCreateFromTemplate(template)}
                  >
                    <div className="flex items-start gap-3">
                      <span className="text-2xl">{template.icon || '🤖'}</span>
                      <div>
                        <h4 className="font-medium text-gray-900">{template.name}</h4>
                        <p className="text-sm text-gray-600 mt-1">{template.description}</p>
                        <div className="flex items-center gap-2 mt-2">
                          <span className="badge badge-purple text-xs">AI Agent</span>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* CRM Templates Section */}
          {(selectedCategory === 'all' || selectedCategory === 'crm') && crmTemplates.length > 0 && (
            <div className="mb-6">
              <h4 className="text-sm font-medium text-emerald-600 mb-3 flex items-center gap-2">
                <Users className="w-4 h-4" />
                CRM Workflows (Logos Vision)
              </h4>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {crmTemplates.map((template) => (
                  <div
                    key={template.id}
                    className="border border-emerald-200 bg-emerald-50 rounded-lg p-4 hover:border-emerald-400 cursor-pointer transition-colors"
                    onClick={() => handleCreateFromTemplate(template)}
                  >
                    <div className="flex items-start gap-3">
                      {renderTemplateIcon(template.icon)}
                      <div>
                        <h4 className="font-medium text-gray-900">{template.name}</h4>
                        <p className="text-sm text-gray-600 mt-1">{template.description}</p>
                        <div className="flex items-center gap-2 mt-2 flex-wrap">
                          <span className="badge badge-success text-xs">CRM</span>
                          {template.isWorkflowTemplate && (
                            <span className="text-xs text-emerald-600">
                              {template.nodeCount} nodes
                            </span>
                          )}
                          <span className="text-xs text-gray-400">
                            {template.actions?.length || 0} action{(template.actions?.length || 0) !== 1 ? 's' : ''}
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Standard Templates Section */}
          {(selectedCategory === 'all' || selectedCategory === 'integration') && integrationTemplates.length > 0 && (
            <div>
              <h4 className="text-sm font-medium text-blue-600 mb-3 flex items-center gap-2">
                <RefreshCw className="w-4 h-4" />
                Integration Automations
              </h4>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {integrationTemplates.map((template) => (
                  <div
                    key={template.id}
                    className="border border-gray-200 rounded-lg p-4 hover:border-primary-500 hover:bg-primary-50 cursor-pointer transition-colors"
                    onClick={() => handleCreateFromTemplate(template)}
                  >
                    <div className="flex items-start gap-3">
                      <span className="text-2xl">{template.icon || getTriggerIcon(template.trigger_type || template.triggerType)}</span>
                      <div>
                        <h4 className="font-medium text-gray-900">{template.name}</h4>
                        <p className="text-sm text-gray-500 mt-1">{template.description}</p>
                        <div className="flex items-center gap-2 mt-2">
                          <span className="badge badge-info text-xs">
                            {(template.trigger_type || template.triggerType)?.replace(/_/g, ' ')}
                          </span>
                          <span className="text-xs text-gray-400">
                            {template.actions?.length || 0} action{(template.actions?.length || 0) !== 1 ? 's' : ''}
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          <button
            onClick={() => setShowCreate(false)}
            className="btn btn-secondary mt-4"
          >
            Cancel
          </button>
        </div>
      )}

      {/* Automations list */}
      <div className="card">
        <div className="p-4 border-b border-gray-200 flex items-center justify-between">
          <h2 className="font-semibold text-gray-900">Active Automations</h2>
          <span className="text-sm text-gray-500">
            {automations.filter(a => a.enabled).length} active of {automations.length}
          </span>
        </div>

        {loading ? (
          <div className="p-8 text-center">
            <div className="spinner mx-auto mb-4" />
            <p className="text-gray-500">Loading automations...</p>
          </div>
        ) : automations.length === 0 ? (
          <div className="p-8 text-center">
            <Zap className="w-12 h-12 text-gray-300 mx-auto mb-3" />
            <h3 className="text-lg font-medium text-gray-900 mb-1">No automations yet</h3>
            <p className="text-gray-500 mb-4">Create your first automation from a template above</p>
            <button
              onClick={() => setShowCreate(true)}
              className="btn btn-primary"
            >
              <Plus className="w-4 h-4" />
              Create Automation
            </button>
          </div>
        ) : (
          <div className="divide-y divide-gray-100">
            {automations.map((automation) => (
              <div key={automation.id} className="p-4">
                <div className="flex items-start gap-4">
                  <span className="text-2xl">{getTriggerIcon(automation.trigger_type)}</span>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h3 className="font-medium text-gray-900">{automation.name}</h3>
                      <span className={`badge ${
                        automation.enabled ? 'badge-success' : 'badge-gray'
                      }`}>
                        {automation.enabled ? 'Active' : 'Paused'}
                      </span>
                      {automation.actions?.some(a => ['auto_assign', 'auto_prioritize', 'suggest_deadline', 'run_agent'].includes(a.type)) && (
                        <span className="badge badge-purple flex items-center gap-1">
                          <Bot className="w-3 h-3" /> AI
                        </span>
                      )}
                    </div>
                    {automation.description && (
                      <p className="text-sm text-gray-500 mt-1">{automation.description}</p>
                    )}
                    <div className="flex items-center gap-4 mt-2 text-xs text-gray-400 flex-wrap">
                      <span className="flex items-center gap-1">
                        <Clock className="w-3 h-3" />
                        Trigger: {automation.trigger_type?.replace(/_/g, ' ')}
                      </span>
                      <span>
                        {automation.actions?.length || 0} action{(automation.actions?.length || 0) !== 1 ? 's' : ''}
                      </span>
                      {automation.execution_count > 0 && (
                        <span className="flex items-center gap-1">
                          <CheckCircle2 className="w-3 h-3" />
                          Run {automation.execution_count} time{automation.execution_count !== 1 ? 's' : ''}
                        </span>
                      )}
                      {automation.last_executed_at && (
                        <span>
                          Last: {new Date(automation.last_executed_at).toLocaleDateString()}
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => handleToggle(automation.id, automation.enabled)}
                      className={`btn btn-icon ${
                        automation.enabled ? 'btn-secondary' : 'btn-ghost'
                      }`}
                      title={automation.enabled ? 'Pause' : 'Resume'}
                    >
                      {automation.enabled ? (
                        <Pause className="w-4 h-4" />
                      ) : (
                        <Play className="w-4 h-4" />
                      )}
                    </button>

                    <button
                      onClick={() => handleTest(automation.id)}
                      disabled={testingId === automation.id}
                      className="btn btn-icon btn-ghost"
                      title="Test (dry run)"
                    >
                      {testingId === automation.id ? (
                        <div className="spinner w-4 h-4" />
                      ) : (
                        <Eye className="w-4 h-4" />
                      )}
                    </button>

                    <button
                      onClick={() => handleExecute(automation.id)}
                      className="btn btn-icon btn-ghost"
                      title="Run now"
                    >
                      <Zap className="w-4 h-4" />
                    </button>

                    <button
                      onClick={() => handleDelete(automation.id)}
                      className="btn btn-icon btn-ghost text-red-600 hover:bg-red-50"
                      title="Delete"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                {/* Test Result */}
                {testResult && testResult.id === automation.id && (
                  <div className={`mt-3 p-3 rounded-lg ${
                    testResult.success ? 'bg-green-50 border border-green-200' : 'bg-red-50 border border-red-200'
                  }`}>
                    <div className="flex items-start gap-2">
                      {testResult.success ? (
                        <CheckCircle2 className="w-5 h-5 text-green-500 flex-shrink-0" />
                      ) : (
                        <AlertCircle className="w-5 h-5 text-red-500 flex-shrink-0" />
                      )}
                      <div className="flex-1">
                        <p className={`font-medium text-sm ${testResult.success ? 'text-green-700' : 'text-red-700'}`}>
                          {testResult.success ? 'Test passed!' : 'Test failed'}
                        </p>
                        {testResult.error && (
                          <p className="text-xs text-red-600 mt-1">{testResult.error}</p>
                        )}
                        {testResult.actionResults && (
                          <div className="mt-2 space-y-1">
                            {testResult.actionResults.map((result, idx) => (
                              <div key={idx} className="text-xs text-gray-600">
                                • {result.type}: {result.preview || 'OK'}
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                      <button
                        onClick={() => setTestResult(null)}
                        className="text-gray-400 hover:text-gray-600"
                      >
                        <XCircle className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* AI Agents Info */}
      <div className="card p-5 bg-gradient-to-br from-purple-50 to-blue-50">
        <div className="flex items-start gap-4">
          <div className="w-12 h-12 bg-purple-100 rounded-lg flex items-center justify-center flex-shrink-0">
            <Bot className="w-6 h-6 text-purple-600" />
          </div>
          <div>
            <h3 className="font-semibold text-gray-900 mb-2">AI-Powered Agents</h3>
            <p className="text-sm text-gray-600 mb-3">
              Our AI agents can automatically analyze tasks and make intelligent decisions:
            </p>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div className="bg-white/60 rounded-lg p-3">
                <h4 className="font-medium text-gray-900 text-sm mb-1">Assignment Agent</h4>
                <p className="text-xs text-gray-500">
                  Determines the best person to assign tasks based on skills and workload
                </p>
              </div>
              <div className="bg-white/60 rounded-lg p-3">
                <h4 className="font-medium text-gray-900 text-sm mb-1">Priority Agent</h4>
                <p className="text-xs text-gray-500">
                  Analyzes context to set appropriate priority levels
                </p>
              </div>
              <div className="bg-white/60 rounded-lg p-3">
                <h4 className="font-medium text-gray-900 text-sm mb-1">Deadline Agent</h4>
                <p className="text-xs text-gray-500">
                  Suggests realistic due dates based on task complexity
                </p>
              </div>
              <div className="bg-white/60 rounded-lg p-3">
                <h4 className="font-medium text-gray-900 text-sm mb-1">Follow-up Detector</h4>
                <p className="text-xs text-gray-500">
                  Identifies follow-up tasks from meeting discussions
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* How it works */}
      <div className="card p-5">
        <h3 className="font-semibold text-gray-900 mb-4">How Automations Work</h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="text-center">
            <div className="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-3">
              <span className="text-xl">1</span>
            </div>
            <h4 className="font-medium text-gray-900 mb-1">Trigger</h4>
            <p className="text-sm text-gray-500">
              An event happens (meeting ends, deal created, action item created)
            </p>
          </div>
          <div className="text-center">
            <div className="w-12 h-12 bg-yellow-100 rounded-full flex items-center justify-center mx-auto mb-3">
              <span className="text-xl">2</span>
            </div>
            <h4 className="font-medium text-gray-900 mb-1">Conditions</h4>
            <p className="text-sm text-gray-500">
              Check if conditions are met (optional filters)
            </p>
          </div>
          <div className="text-center">
            <div className="w-12 h-12 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-3">
              <span className="text-xl">3</span>
            </div>
            <h4 className="font-medium text-gray-900 mb-1">Actions</h4>
            <p className="text-sm text-gray-500">
              Execute actions (AI analysis, CRM sync, notifications)
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
