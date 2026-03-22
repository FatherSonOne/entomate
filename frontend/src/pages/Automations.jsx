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
import { VCButton, VCBadge } from '../components/vc'

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
            <VCButton
              variant={showHistory ? 'primary' : 'secondary'}
              onClick={() => { setShowHistory(!showHistory); if (!showHistory) loadExecutionLogs(); }}
            >
              <History size={16} />
              History
            </VCButton>
            <VCButton
              variant="secondary"
              onClick={() => {
                setShowCreate(!showCreate)
                setWizardStep(0)
              }}
            >
              <Plus size={16} />
              Template
            </VCButton>
            <VCButton
              variant="primary"
              onClick={() => {
                setShowBuilder(true)
                setWizardStep(1)
              }}
            >
              <Wrench size={16} />
              Custom Build
            </VCButton>
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
        <div className="vc mb-6 animate-fade-in">
          <div className="p-4 flex items-center justify-between" style={{ borderBottom: '1px solid rgba(248,240,242,.08)' }}>
            <h3 className="font-bold flex items-center gap-2" style={{ color: 'var(--text-primary)' }}>
              <History size={20} />
              Execution History
            </h3>
            <VCButton variant="ghost" size="sm" onClick={loadExecutionLogs}>
              <RefreshCw size={16} className={loadingLogs ? 'animate-spin' : ''} />
            </VCButton>
          </div>
          <div className="max-h-96 overflow-y-auto">
            {loadingLogs ? (
              <Skeleton className="h-20" count={3} />
            ) : executionLogs.length === 0 ? (
              <div className="p-8 text-center" style={{ color: 'var(--text-tertiary)' }}>No execution history yet</div>
            ) : (
              <div style={{ borderTop: '1px solid rgba(248,240,242,.08)' }}>
                {executionLogs.map((log, idx) => (
                  <div key={idx} className="p-3 flex items-center gap-3 transition-colors hover:bg-black/20" style={{ borderBottom: '1px solid rgba(248,240,242,.06)' }}>
                    {log.success ? (
                      <CheckCircle2 size={18} className="flex-shrink-0" style={{ color: 'var(--accent-secondary)' }} />
                    ) : (
                      <XCircle size={18} className="flex-shrink-0" style={{ color: 'var(--accent-primary)' }} />
                    )}
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>{log.automationName || 'Unknown'}</p>
                      <p className="text-xs" style={{ fontFamily: 'var(--font-mono)', color: 'var(--text-tertiary)' }}>
                        {new Date(log.created_at).toLocaleString()}
                        {log.duration_ms && ` • ${log.duration_ms}ms`}
                      </p>
                    </div>
                    {log.error_message && (
                      <span className="text-xs truncate max-w-32" style={{ color: 'var(--accent-primary)' }}>{log.error_message}</span>
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
        <div className="vc mb-6 animate-fade-in">
          <div className="p-4 flex items-center justify-between" style={{ borderBottom: '1px solid rgba(248,240,242,.08)' }}>
            <h3 className="font-bold flex items-center gap-2" style={{ color: 'var(--text-primary)' }}>
              <Calendar size={20} style={{ color: 'var(--accent-secondary)' }} />
              Scheduled Automations
            </h3>
            <VCButton variant="ghost" size="sm" onClick={() => setSchedulerStatus([])}>
              <XCircle size={16} />
            </VCButton>
          </div>
          <div>
            {schedulerStatus.map((scheduled) => (
              <div key={scheduled.id} className="p-3 flex items-center gap-3" style={{ borderBottom: '1px solid rgba(248,240,242,.06)' }}>
                <Clock size={18} className="flex-shrink-0" style={{ color: 'var(--accent-secondary)' }} />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>{scheduled.name}</p>
                  <p className="text-xs" style={{ fontFamily: 'var(--font-mono)', color: 'var(--text-tertiary)' }}>
                    {scheduled.cronExpression}
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-xs" style={{ color: 'var(--text-tertiary)' }}>Next run:</p>
                  <p className="text-sm" style={{ fontFamily: 'var(--font-mono)', color: 'var(--text-secondary)' }}>
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
        <div className="vc p-6 mb-6 animate-fade-in">
          <div className="flex items-center justify-between mb-6">
            <h3 className="font-bold text-lg" style={{ color: 'var(--text-primary)' }}>Choose a Template</h3>
            <div className="flex gap-2 flex-wrap">
              <VCButton
                variant={selectedCategory === 'all' ? 'primary' : 'ghost'}
                size="sm"
                onClick={() => setSelectedCategory('all')}
              >
                All
              </VCButton>
              <VCButton
                variant={selectedCategory === 'ai' ? 'primary' : 'ghost'}
                size="sm"
                onClick={() => setSelectedCategory('ai')}
              >
                <Sparkles size={14} /> AI
              </VCButton>
              <VCButton
                variant={selectedCategory === 'integration' ? 'primary' : 'ghost'}
                size="sm"
                onClick={() => setSelectedCategory('integration')}
              >
                <RefreshCw size={14} /> Integration
              </VCButton>
              <VCButton
                variant={selectedCategory === 'crm' ? 'primary' : 'ghost'}
                size="sm"
                onClick={() => setSelectedCategory('crm')}
              >
                <Users size={14} /> CRM
              </VCButton>
            </div>
          </div>

          {/* AI Agent Templates Section */}
          {(selectedCategory === 'all' || selectedCategory === 'ai') && aiTemplates.length > 0 && (
            <div className="mb-6">
              <h4 className="text-sm font-bold mb-3 flex items-center gap-2" style={{ color: 'var(--accent-tertiary)' }}>
                <Bot size={16} />
                AI-Powered Automations
              </h4>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {aiTemplates.map((template) => (
                  <div
                    key={template.id}
                    className="vc p-4 cursor-pointer transition-all group"
                    style={{ borderColor: 'rgba(248,240,242,.08)' }}
                    onClick={() => handleCreateFromTemplate(template)}
                  >
                    <div className="flex items-start gap-3">
                      <div className="p-2 rounded-md transition-colors group-hover:scale-110" style={{ background: 'rgba(255,184,0,.1)', color: 'var(--accent-tertiary)' }}>
                        <Bot size={20} />
                      </div>
                      <div className="flex-1">
                        <h4 className="font-bold mb-1" style={{ color: 'var(--text-primary)' }}>{template.name}</h4>
                        <p className="text-sm mb-2" style={{ color: 'var(--text-secondary)' }}>{template.description}</p>
                        <div className="flex items-center gap-2">
                          <VCBadge color="amber">AI Agent</VCBadge>
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
              <h4 className="text-sm font-bold mb-3 flex items-center gap-2" style={{ color: 'var(--accent-secondary)' }}>
                <Users size={16} />
                CRM Workflows
              </h4>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {crmTemplates.map((template) => (
                  <div
                    key={template.id}
                    className="vc p-4 cursor-pointer transition-all group"
                    onClick={() => handleCreateFromTemplate(template)}
                  >
                    <div className="flex items-start gap-3">
                      <div className="p-2 rounded-md transition-colors group-hover:scale-110" style={{ background: 'rgba(0,245,212,.1)', color: 'var(--accent-secondary)' }}>
                        {renderTemplateIcon(template.icon, "w-5 h-5")}
                      </div>
                      <div className="flex-1">
                        <h4 className="font-bold mb-1" style={{ color: 'var(--text-primary)' }}>{template.name}</h4>
                        <p className="text-sm mb-2" style={{ color: 'var(--text-secondary)' }}>{template.description}</p>
                        <div className="flex items-center gap-2 flex-wrap">
                          <VCBadge color="mint">CRM</VCBadge>
                          {template.isWorkflowTemplate && (
                            <span className="text-xs" style={{ fontFamily: 'var(--font-mono)', color: 'var(--text-tertiary)' }}>
                              {template.nodeCount} nodes
                            </span>
                          )}
                          <span className="text-xs" style={{ fontFamily: 'var(--font-mono)', color: 'var(--text-tertiary)' }}>
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
              <h4 className="text-sm font-bold mb-3 flex items-center gap-2" style={{ color: 'var(--accent-primary)' }}>
                <RefreshCw size={16} />
                Integration Automations
              </h4>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {integrationTemplates.map((template) => (
                  <div
                    key={template.id}
                    className="vc p-4 cursor-pointer transition-all group"
                    onClick={() => handleCreateFromTemplate(template)}
                  >
                    <div className="flex items-start gap-3">
                      <div className="p-2 rounded-md transition-colors group-hover:scale-110" style={{ background: 'rgba(255,45,107,.1)', color: 'var(--accent-primary)' }}>
                        {getTriggerIcon(template.trigger_type || template.triggerType)}
                      </div>
                      <div className="flex-1">
                        <h4 className="font-bold mb-1" style={{ color: 'var(--text-primary)' }}>{template.name}</h4>
                        <p className="text-sm mb-2" style={{ color: 'var(--text-secondary)' }}>{template.description}</p>
                        <div className="flex items-center gap-2">
                          <VCBadge color="crimson">
                            {(template.trigger_type || template.triggerType)?.replace(/_/g, ' ')}
                          </VCBadge>
                          <span className="text-xs" style={{ fontFamily: 'var(--font-mono)', color: 'var(--text-tertiary)' }}>
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

          <VCButton variant="secondary" onClick={() => setShowCreate(false)} className="mt-4">
            Cancel
          </VCButton>
        </div>
      )}

      {/* Automations list */}
      <div className="vc">
        <div className="p-4 flex items-center justify-between" style={{ borderBottom: '1px solid rgba(248,240,242,.08)' }}>
          <h2 className="font-bold" style={{ color: 'var(--text-primary)' }}>Active Automations</h2>
          <span className="text-sm" style={{ fontFamily: 'var(--font-mono)', color: 'var(--text-tertiary)' }}>
            {automations.filter(a => a.enabled).length} active / {automations.length} total
          </span>
        </div>

        {loading ? (
          <Skeleton className="h-24" count={4} />
        ) : automations.length === 0 ? (
          <div className="p-12 text-center m-4 rounded-lg" style={{ border: '2px dashed rgba(248,240,242,.12)' }}>
            <Zap className="w-16 h-16 mx-auto mb-4 opacity-50" style={{ color: 'var(--text-tertiary)' }} />
            <h3 className="text-xl font-bold mb-2" style={{ color: 'var(--text-primary)' }}>No automations yet</h3>
            <p className="mb-6" style={{ color: 'var(--text-secondary)' }}>Create your first automation from a template or build a custom workflow</p>
            <VCButton variant="primary" onClick={() => setShowCreate(true)}>
              <Plus size={16} />
              Create Automation
            </VCButton>
          </div>
        ) : (
          <div>
            {automations.map((automation) => (
              <div key={automation.id} className="p-4 transition-colors hover:bg-black/10 group" style={{ borderBottom: '1px solid rgba(248,240,242,.06)' }}>
                <div className="flex items-start gap-4">
                  <div className="p-2 rounded-md transition-colors group-hover:scale-110" style={{ background: 'rgba(255,45,107,.1)', color: 'var(--accent-primary)' }}>
                    {getTriggerIcon(automation.trigger_type)}
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap mb-1">
                      <h3 className="font-bold" style={{ color: 'var(--text-primary)' }}>{automation.name}</h3>
                      {automation.enabled
                        ? <VCBadge color="mint">Active</VCBadge>
                        : <VCBadge color="neutral">Paused</VCBadge>
                      }
                      {automation.actions?.some(a => ['auto_assign', 'auto_prioritize', 'suggest_deadline', 'run_agent'].includes(a.type)) && (
                        <VCBadge color="amber">
                          <Bot size={12} /> AI
                        </VCBadge>
                      )}
                    </div>
                    {automation.description && (
                      <p className="text-sm mb-2" style={{ color: 'var(--text-secondary)' }}>{automation.description}</p>
                    )}
                    <div className="flex items-center gap-4 text-xs flex-wrap" style={{ fontFamily: 'var(--font-mono)', color: 'var(--text-tertiary)' }}>
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
                      className="p-2 rounded-lg transition-colors"
                      style={{ color: automation.enabled ? 'var(--accent-secondary)' : 'var(--text-tertiary)' }}
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
                      className="p-2 rounded-lg transition-colors"
                      style={{ color: 'var(--text-tertiary)' }}
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
                      className="p-2 rounded-lg transition-colors"
                      style={{ color: 'var(--text-tertiary)' }}
                      title="Run now"
                    >
                      <Zap size={16} />
                    </button>

                    <button
                      onClick={() => handleDelete(automation.id)}
                      className="p-2 rounded-lg transition-colors"
                      style={{ color: 'var(--accent-primary)' }}
                      title="Delete"
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                </div>

                {/* Test Result */}
                {testResult && testResult.id === automation.id && (
                  <div
                    className="mt-3 p-3 rounded-lg"
                    style={testResult.success
                      ? { background: 'rgba(0,245,212,.1)', border: '1px solid rgba(0,245,212,.2)' }
                      : { background: 'rgba(255,45,107,.1)', border: '1px solid rgba(255,45,107,.2)' }
                    }
                  >
                    <div className="flex items-start gap-2">
                      {testResult.success ? (
                        <CheckCircle2 size={18} className="flex-shrink-0" style={{ color: 'var(--accent-secondary)' }} />
                      ) : (
                        <AlertCircle size={18} className="flex-shrink-0" style={{ color: 'var(--accent-primary)' }} />
                      )}
                      <div className="flex-1">
                        <p className="font-medium text-sm" style={{ color: testResult.success ? 'var(--accent-secondary)' : 'var(--accent-primary)' }}>
                          {testResult.success ? 'Test passed!' : 'Test failed'}
                        </p>
                        {testResult.error && (
                          <p className="text-xs mt-1" style={{ fontFamily: 'var(--font-mono)', color: 'var(--accent-primary)' }}>{testResult.error}</p>
                        )}
                        {testResult.actionResults && (
                          <div className="mt-2 space-y-1">
                            {testResult.actionResults.map((result, idx) => (
                              <div key={idx} className="text-xs" style={{ fontFamily: 'var(--font-mono)', color: 'var(--text-secondary)' }}>
                                • {result.type}: {result.preview || 'OK'}
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                      <button
                        onClick={() => setTestResult(null)}
                        style={{ color: 'var(--text-tertiary)' }}
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
