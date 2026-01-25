import React, { useState, useEffect } from 'react'
import {
  Zap, Plus, Play, Pause, Trash2, Clock, CheckCircle2,
  AlertCircle, Settings, Bot, Sparkles, History, RefreshCw,
  ChevronDown, ChevronUp, XCircle, Eye, Wrench, Calendar,
  TrendingUp, AlertTriangle, BarChart2, FileText, MessageSquare,
  GitBranch, Database, Globe, Layers, Presentation, UserPlus,
  AlertOctagon, Users, Workflow, Activity
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
  if (!iconName) return <Workflow className={className} />

  // Check if it's an emoji (starts with non-alphanumeric or is a single character)
  if (/^[\u{1F300}-\u{1F9FF}]/u.test(iconName) || iconName.length <= 2) {
    return <span className="text-2xl">{iconName}</span>
  }

  // Look up Lucide icon component
  const IconComponent = ICON_MAP[iconName]
  if (IconComponent) {
    return <IconComponent className={className} />
  }

  // Fallback to default
  return <Workflow className={className} />
}
import { automationsApi } from '../services/api'
import AutomationBuilder from '../components/AutomationBuilder'
import { GuideCard, PageHeader, Skeleton } from '../components/SharedUI'

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
  const [wizardStep, setWizardStep] = useState(0) // 0: Choose Template, 1: Configure, 2: Monitor

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
      if (automationsData.automations && automationsData.automations.length > 0) {
        setWizardStep(2) // If automations exist, show monitor step
      }
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
      setWizardStep(1)
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
      setWizardStep(1)
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
      case 'meeting_ended': return <Presentation size={20} />
      case 'meeting_processed': return <FileText size={20} />
      case 'deal_created': return <TrendingUp size={20} />
      case 'task_completed': return <CheckCircle2 size={20} />
      case 'action_item_created': return <BarChart2 size={20} />
      case 'scheduled': return <Clock size={20} />
      default: return <Zap size={20} />
    }
  }

  const getCategoryIcon = (category) => {
    switch (category) {
      case 'ai': return <Sparkles className="w-4 h-4" />
      case 'integration': return <RefreshCw className="w-4 h-4" />
      default: return <Zap className="w-4 h-4" />
    }
  }

  const filteredTemplates = selectedCategory === 'all'
    ? templates
    : templates.filter(t => t.category === selectedCategory)

  const aiTemplates = templates.filter(t => t.category === 'ai')
  const integrationTemplates = templates.filter(t => t.category === 'integration' || !t.category)
  const crmTemplates = templates.filter(t => t.category === 'crm')

  return (
    <div className="animate-fade-in max-w-7xl mx-auto">
      <PageHeader 
        title="Workflow Automations" 
        subtitle="Build intelligent workflows with triggers, conditions, and AI-powered actions."
        actions={
          <div className="flex gap-2">
            <button
              onClick={() => { setShowHistory(!showHistory); if (!showHistory) loadExecutionLogs(); }}
              className={`btn ${showHistory ? 'btn-primary' : 'btn-secondary'}`}
            >
              <History size={16} />
              History
            </button>
            <button
              onClick={() => {
                setShowCreate(!showCreate)
                setWizardStep(0)
              }}
              className="btn btn-secondary"
            >
              <Plus size={16} />
              Template
            </button>
            <button
              onClick={() => {
                setShowBuilder(true)
                setWizardStep(1)
              }}
              className="btn btn-primary"
            >
              <Wrench size={16} />
              Custom Build
            </button>
          </div>
        }
      />

      <GuideCard 
        title="Automation Workflow" 
        steps={['Choose Template', 'Configure Actions', 'Monitor Performance']} 
        activeStep={wizardStep} 
      />

      {/* Execution History */}
      {showHistory && (
        <div className="card mb-6 animate-fade-in">
          <div className="p-4 border-b border-line-subtle flex items-center justify-between">
            <h3 className="font-bold text-content-primary flex items-center gap-2">
              <History size={20} />
              Execution History
            </h3>
            <button onClick={loadExecutionLogs} className="btn btn-ghost btn-sm">
              <RefreshCw size={16} className={loadingLogs ? 'animate-spin' : ''} />
            </button>
          </div>
          <div className="max-h-96 overflow-y-auto">
            {loadingLogs ? (
              <Skeleton className="h-20" count={3} />
            ) : executionLogs.length === 0 ? (
              <div className="p-8 text-center text-content-tertiary">No execution history yet</div>
            ) : (
              <div className="divide-y divide-line-subtle">
                {executionLogs.map((log, idx) => (
                  <div key={idx} className="p-3 flex items-center gap-3 hover:bg-surface-muted transition-colors">
                    {log.success ? (
                      <CheckCircle2 size={18} className="text-green-500 flex-shrink-0" />
                    ) : (
                      <XCircle size={18} className="text-red-500 flex-shrink-0" />
                    )}
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-content-primary">{log.automationName || 'Unknown'}</p>
                      <p className="text-xs text-content-tertiary font-mono">
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
        <div className="mb-6 animate-fade-in">
          <AutomationBuilder
            onSave={handleBuilderSave}
            onCancel={() => setShowBuilder(false)}
            onTest={handleBuilderTest}
          />
        </div>
      )}

      {/* Scheduler Status */}
      {schedulerStatus.length > 0 && (
        <div className="card mb-6 animate-fade-in">
          <div className="p-4 border-b border-line-subtle flex items-center justify-between">
            <h3 className="font-bold text-content-primary flex items-center gap-2">
              <Calendar size={20} className="text-accent-secondary" />
              Scheduled Automations
            </h3>
            <button onClick={() => setSchedulerStatus([])} className="btn btn-ghost btn-sm">
              <XCircle size={16} />
            </button>
          </div>
          <div className="divide-y divide-line-subtle">
            {schedulerStatus.map((scheduled) => (
              <div key={scheduled.id} className="p-3 flex items-center gap-3">
                <Clock size={18} className="text-accent-secondary flex-shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-content-primary">{scheduled.name}</p>
                  <p className="text-xs text-content-tertiary font-mono">
                    {scheduled.cronExpression}
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-xs text-content-tertiary">Next run:</p>
                  <p className="text-sm text-content-secondary font-mono">
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
        <div className="card p-6 mb-6 animate-fade-in">
          <div className="flex items-center justify-between mb-6">
            <h3 className="font-bold text-content-primary text-lg">Choose a Template</h3>
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
                <Sparkles size={14} /> AI
              </button>
              <button
                onClick={() => setSelectedCategory('integration')}
                className={`btn btn-sm ${selectedCategory === 'integration' ? 'btn-primary' : 'btn-ghost'}`}
              >
                <RefreshCw size={14} /> Integration
              </button>
              <button
                onClick={() => setSelectedCategory('crm')}
                className={`btn btn-sm ${selectedCategory === 'crm' ? 'btn-primary' : 'btn-ghost'}`}
              >
                <Users size={14} /> CRM
              </button>
            </div>
          </div>

          {/* AI Agent Templates Section */}
          {(selectedCategory === 'all' || selectedCategory === 'ai') && aiTemplates.length > 0 && (
            <div className="mb-6">
              <h4 className="text-sm font-bold text-accent-tertiary mb-3 flex items-center gap-2">
                <Bot size={16} />
                AI-Powered Automations
              </h4>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {aiTemplates.map((template) => (
                  <div
                    key={template.id}
                    className="card p-4 hover:border-accent-tertiary cursor-pointer transition-all group"
                    onClick={() => handleCreateFromTemplate(template)}
                  >
                    <div className="flex items-start gap-3">
                      <div className="p-2 bg-accent-tertiary/10 rounded-md group-hover:bg-accent-tertiary group-hover:text-white transition-colors">
                        <Bot size={20} />
                      </div>
                      <div className="flex-1">
                        <h4 className="font-bold text-content-primary mb-1">{template.name}</h4>
                        <p className="text-sm text-content-secondary mb-2">{template.description}</p>
                        <div className="flex items-center gap-2">
                          <span className="text-xs px-2 py-1 bg-accent-tertiary/10 text-accent-tertiary rounded-sm border border-accent-tertiary/20 font-mono">
                            AI Agent
                          </span>
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
              <h4 className="text-sm font-bold text-accent-secondary mb-3 flex items-center gap-2">
                <Users size={16} />
                CRM Workflows
              </h4>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {crmTemplates.map((template) => (
                  <div
                    key={template.id}
                    className="card p-4 hover:border-accent-secondary cursor-pointer transition-all group"
                    onClick={() => handleCreateFromTemplate(template)}
                  >
                    <div className="flex items-start gap-3">
                      <div className="p-2 bg-accent-secondary/10 rounded-md group-hover:bg-accent-secondary group-hover:text-white transition-colors">
                        {renderTemplateIcon(template.icon, "w-5 h-5")}
                      </div>
                      <div className="flex-1">
                        <h4 className="font-bold text-content-primary mb-1">{template.name}</h4>
                        <p className="text-sm text-content-secondary mb-2">{template.description}</p>
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-xs px-2 py-1 bg-accent-secondary/10 text-accent-secondary rounded-sm border border-accent-secondary/20 font-mono">
                            CRM
                          </span>
                          {template.isWorkflowTemplate && (
                            <span className="text-xs text-content-tertiary font-mono">
                              {template.nodeCount} nodes
                            </span>
                          )}
                          <span className="text-xs text-content-tertiary font-mono">
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
              <h4 className="text-sm font-bold text-accent-primary mb-3 flex items-center gap-2">
                <RefreshCw size={16} />
                Integration Automations
              </h4>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {integrationTemplates.map((template) => (
                  <div
                    key={template.id}
                    className="card p-4 hover:border-accent-primary cursor-pointer transition-all group"
                    onClick={() => handleCreateFromTemplate(template)}
                  >
                    <div className="flex items-start gap-3">
                      <div className="p-2 bg-accent-primary/10 rounded-md group-hover:bg-accent-primary group-hover:text-white transition-colors">
                        {getTriggerIcon(template.trigger_type || template.triggerType)}
                      </div>
                      <div className="flex-1">
                        <h4 className="font-bold text-content-primary mb-1">{template.name}</h4>
                        <p className="text-sm text-content-secondary mb-2">{template.description}</p>
                        <div className="flex items-center gap-2">
                          <span className="text-xs px-2 py-1 bg-accent-primary/10 text-accent-primary rounded-sm border border-accent-primary/20 font-mono">
                            {(template.trigger_type || template.triggerType)?.replace(/_/g, ' ')}
                          </span>
                          <span className="text-xs text-content-tertiary font-mono">
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
        <div className="p-4 border-b border-line-subtle flex items-center justify-between">
          <h2 className="font-bold text-content-primary">Active Automations</h2>
          <span className="text-sm text-content-tertiary font-mono">
            {automations.filter(a => a.enabled).length} active / {automations.length} total
          </span>
        </div>

        {loading ? (
          <Skeleton className="h-24" count={4} />
        ) : automations.length === 0 ? (
          <div className="p-12 text-center border-dashed border-2 m-4 rounded-lg">
            <Zap className="w-16 h-16 text-content-muted mx-auto mb-4 opacity-50" />
            <h3 className="text-xl font-bold text-content-primary mb-2">No automations yet</h3>
            <p className="text-content-secondary mb-6">Create your first automation from a template or build a custom workflow</p>
            <button
              onClick={() => setShowCreate(true)}
              className="btn btn-primary"
            >
              <Plus size={16} />
              Create Automation
            </button>
          </div>
        ) : (
          <div className="divide-y divide-line-subtle">
            {automations.map((automation) => (
              <div key={automation.id} className="p-4 hover:bg-surface-muted transition-colors group">
                <div className="flex items-start gap-4">
                  <div className="p-2 bg-accent-primary/10 rounded-md group-hover:bg-accent-primary group-hover:text-white transition-colors">
                    {getTriggerIcon(automation.trigger_type)}
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap mb-1">
                      <h3 className="font-bold text-content-primary">{automation.name}</h3>
                      <span className={`text-xs px-2 py-1 rounded-sm border font-mono ${
                        automation.enabled 
                          ? 'text-green-500 bg-green-500/10 border-green-500/20' 
                          : 'text-content-tertiary bg-surface-muted border-line-subtle'
                      }`}>
                        {automation.enabled ? 'Active' : 'Paused'}
                      </span>
                      {automation.actions?.some(a => ['auto_assign', 'auto_prioritize', 'suggest_deadline', 'run_agent'].includes(a.type)) && (
                        <span className="text-xs px-2 py-1 bg-accent-tertiary/10 text-accent-tertiary rounded-sm border border-accent-tertiary/20 font-mono flex items-center gap-1">
                          <Bot size={12} /> AI
                        </span>
                      )}
                    </div>
                    {automation.description && (
                      <p className="text-sm text-content-secondary mb-2">{automation.description}</p>
                    )}
                    <div className="flex items-center gap-4 text-xs text-content-tertiary flex-wrap font-mono">
                      <span className="flex items-center gap-1">
                        <Clock size={12} />
                        {automation.trigger_type?.replace(/_/g, ' ')}
                      </span>
                      <span>
                        {automation.actions?.length || 0} action{(automation.actions?.length || 0) !== 1 ? 's' : ''}
                      </span>
                      {automation.execution_count > 0 && (
                        <span className="flex items-center gap-1">
                          <Activity size={12} />
                          {automation.execution_count}x
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
                      className="btn btn-icon btn-ghost"
                      title={automation.enabled ? 'Pause' : 'Resume'}
                    >
                      {automation.enabled ? (
                        <Pause size={16} />
                      ) : (
                        <Play size={16} />
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
                        <Eye size={16} />
                      )}
                    </button>

                    <button
                      onClick={() => handleExecute(automation.id)}
                      className="btn btn-icon btn-ghost"
                      title="Run now"
                    >
                      <Zap size={16} />
                    </button>

                    <button
                      onClick={() => handleDelete(automation.id)}
                      className="btn btn-icon btn-ghost text-red-500 hover:bg-red-500/10"
                      title="Delete"
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                </div>

                {/* Test Result */}
                {testResult && testResult.id === automation.id && (
                  <div className={`mt-3 p-3 rounded-lg border ${
                    testResult.success 
                      ? 'bg-green-500/10 border-green-500/20' 
                      : 'bg-red-500/10 border-red-500/20'
                  }`}>
                    <div className="flex items-start gap-2">
                      {testResult.success ? (
                        <CheckCircle2 size={18} className="text-green-500 flex-shrink-0" />
                      ) : (
                        <AlertCircle size={18} className="text-red-500 flex-shrink-0" />
                      )}
                      <div className="flex-1">
                        <p className={`font-medium text-sm ${testResult.success ? 'text-green-500' : 'text-red-500'}`}>
                          {testResult.success ? 'Test passed!' : 'Test failed'}
                        </p>
                        {testResult.error && (
                          <p className="text-xs text-red-500 mt-1 font-mono">{testResult.error}</p>
                        )}
                        {testResult.actionResults && (
                          <div className="mt-2 space-y-1">
                            {testResult.actionResults.map((result, idx) => (
                              <div key={idx} className="text-xs text-content-secondary font-mono">
                                • {result.type}: {result.preview || 'OK'}
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                      <button
                        onClick={() => setTestResult(null)}
                        className="text-content-tertiary hover:text-content-primary"
                      >
                        <XCircle size={16} />
                      </button>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
