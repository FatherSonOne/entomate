import React, { useState, useEffect } from 'react'
import {
  getAllAgents,
  getAgentById,
  createAgent,
  updateAgent,
  enableAgent,
  disableAgent,
  deleteAgent,
  getAgentRuns
} from '../agents/agentService'
import { testRunAgent } from '../agents/agentRunner'
import {
  getAllTemplatesWithMeta,
  getTemplate,
  AGENT_TEMPLATES
} from '../agents/templates'
import { getAvailableTriggers, getAvailableActions } from '../agents/agentRegistry'
import type { Agent, AgentRun, TriggerType, ActionStep, AgentGuardrails } from '../agents/types'

// ==================== TYPES ====================

type ViewMode = 'list' | 'detail' | 'create' | 'test' | 'history'

interface TestRunContext {
  meetingId?: string
  dealId?: string
  taskId?: string
}

// ==================== COMPONENT ====================

export const AgentsView: React.FC = () => {
  // State
  const [agents, setAgents] = useState<Agent[]>([])
  const [selectedAgent, setSelectedAgent] = useState<Agent | null>(null)
  const [agentRuns, setAgentRuns] = useState<AgentRun[]>([])
  const [loading, setLoading] = useState(true)
  const [viewMode, setViewMode] = useState<ViewMode>('list')
  const [error, setError] = useState<string | null>(null)

  // Form state
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    trigger_type: 'meeting.completed' as TriggerType,
    trigger_config: {} as Record<string, any>,
    actions: [] as ActionStep[],
    guardrails: {
      maxPulseMessagesPerRun: 3,
      maxCrmTasksPerRun: 10,
      maxTotalActionsPerRun: 25,
      dryRunDefault: true
    } as AgentGuardrails
  })

  // Test run state
  const [testContext, setTestContext] = useState<TestRunContext>({})
  const [testResult, setTestResult] = useState<any>(null)
  const [testRunning, setTestRunning] = useState(false)

  // Available options
  const triggers = getAvailableTriggers()
  const actions = getAvailableActions()
  const templates = getAllTemplatesWithMeta()

  // ==================== EFFECTS ====================

  useEffect(() => {
    loadAgents()
  }, [])

  useEffect(() => {
    if (selectedAgent) {
      loadAgentRuns(selectedAgent.id)
    }
  }, [selectedAgent])

  // ==================== DATA LOADING ====================

  const loadAgents = async () => {
    setLoading(true)
    try {
      const data = await getAllAgents()
      setAgents(data)
    } catch (err) {
      setError('Failed to load agents')
      console.error(err)
    }
    setLoading(false)
  }

  const loadAgentRuns = async (agentId: string) => {
    try {
      const runs = await getAgentRuns(agentId, { limit: 20 })
      setAgentRuns(runs)
    } catch (err) {
      console.error('Failed to load agent runs:', err)
    }
  }

  // ==================== ACTIONS ====================

  const handleSelectAgent = async (agent: Agent) => {
    setSelectedAgent(agent)
    setFormData({
      name: agent.name,
      description: agent.description || '',
      trigger_type: agent.trigger_type,
      trigger_config: agent.trigger_config,
      actions: agent.actions,
      guardrails: agent.guardrails
    })
    setViewMode('detail')
  }

  const handleToggleEnabled = async (agent: Agent) => {
    try {
      const updated = agent.enabled
        ? await disableAgent(agent.id)
        : await enableAgent(agent.id)

      setAgents(agents.map(a => a.id === agent.id ? updated : a))
      if (selectedAgent?.id === agent.id) {
        setSelectedAgent(updated)
      }
    } catch (err) {
      setError('Failed to toggle agent')
    }
  }

  const handleCreateFromTemplate = async (templateId: string) => {
    const template = getTemplate(templateId)
    if (!template) return

    setFormData({
      name: template.name,
      description: template.description || '',
      trigger_type: template.trigger_type,
      trigger_config: template.trigger_config,
      actions: template.actions,
      guardrails: template.guardrails
    })
    setViewMode('create')
  }

  const handleSaveAgent = async () => {
    if (!formData.name.trim()) {
      setError('Agent name is required')
      return
    }

    try {
      if (selectedAgent) {
        // Update existing
        const updated = await updateAgent(selectedAgent.id, {
          name: formData.name,
          description: formData.description,
          trigger_type: formData.trigger_type,
          trigger_config: formData.trigger_config,
          actions: formData.actions,
          guardrails: formData.guardrails
        })
        setAgents(agents.map(a => a.id === updated.id ? updated : a))
        setSelectedAgent(updated)
      } else {
        // Create new
        const created = await createAgent({
          name: formData.name,
          description: formData.description,
          trigger_type: formData.trigger_type,
          trigger_config: formData.trigger_config,
          actions: formData.actions,
          guardrails: formData.guardrails
        })
        setAgents([created, ...agents])
        setSelectedAgent(created)
      }
      setViewMode('detail')
      setError(null)
    } catch (err) {
      setError('Failed to save agent')
      console.error(err)
    }
  }

  const handleDeleteAgent = async (agent: Agent) => {
    if (!confirm(`Are you sure you want to delete "${agent.name}"? This cannot be undone.`)) {
      return
    }

    try {
      await deleteAgent(agent.id)
      setAgents(agents.filter(a => a.id !== agent.id))
      if (selectedAgent?.id === agent.id) {
        setSelectedAgent(null)
        setViewMode('list')
      }
    } catch (err) {
      setError('Failed to delete agent')
    }
  }

  const handleTestRun = async () => {
    if (!selectedAgent) return

    setTestRunning(true)
    setTestResult(null)

    try {
      const result = await testRunAgent(selectedAgent.id, testContext, { dryRun: true })
      setTestResult(result)
    } catch (err) {
      setTestResult({ error: err instanceof Error ? err.message : 'Test run failed' })
    }

    setTestRunning(false)
  }

  const resetForm = () => {
    setFormData({
      name: '',
      description: '',
      trigger_type: 'meeting.completed',
      trigger_config: {},
      actions: [],
      guardrails: {
        maxPulseMessagesPerRun: 3,
        maxCrmTasksPerRun: 10,
        maxTotalActionsPerRun: 25,
        dryRunDefault: true
      }
    })
    setSelectedAgent(null)
  }

  // ==================== RENDER HELPERS ====================

  const getStatusBadge = (agent: Agent) => {
    if (agent.enabled) {
      return <span style={styles.badgeLive}>LIVE</span>
    }
    return <span style={styles.badgeDisabled}>Disabled</span>
  }

  const getRunStatusBadge = (status: string) => {
    const colors: Record<string, React.CSSProperties> = {
      success: { background: '#10b981', color: 'white' },
      failed: { background: '#ef4444', color: 'white' },
      running: { background: '#3b82f6', color: 'white' },
      skipped: { background: '#6b7280', color: 'white' }
    }
    return (
      <span style={{ ...styles.badge, ...colors[status] }}>
        {status.toUpperCase()}
      </span>
    )
  }

  // ==================== RENDER ====================

  if (loading) {
    return (
      <div style={styles.container}>
        <div style={styles.loading}>Loading agents...</div>
      </div>
    )
  }

  return (
    <div style={styles.container}>
      {/* Header */}
      <div style={styles.header}>
        <h1 style={styles.title}>AI Agents</h1>
        <div style={styles.headerActions}>
          <button
            style={styles.buttonSecondary}
            onClick={() => { resetForm(); setViewMode('create') }}
          >
            + Create Agent
          </button>
        </div>
      </div>

      {/* Error banner */}
      {error && (
        <div style={styles.errorBanner}>
          {error}
          <button onClick={() => setError(null)} style={styles.errorClose}>×</button>
        </div>
      )}

      {/* Main content */}
      <div style={styles.content}>
        {/* List view */}
        {viewMode === 'list' && (
          <div style={styles.listContainer}>
            {/* Templates section */}
            <div style={styles.section}>
              <h2 style={styles.sectionTitle}>Quick Start Templates</h2>
              <div style={styles.templateGrid}>
                {templates.map(t => (
                  <div key={t.id} style={styles.templateCard}>
                    <div style={styles.templateIcon}>{t.icon}</div>
                    <div style={styles.templateName}>{t.name}</div>
                    <div style={styles.templateDesc}>{t.description}</div>
                    <button
                      style={styles.buttonSmall}
                      onClick={() => handleCreateFromTemplate(t.id)}
                    >
                      Use Template
                    </button>
                  </div>
                ))}
              </div>
            </div>

            {/* Agents list */}
            <div style={styles.section}>
              <h2 style={styles.sectionTitle}>Your Agents ({agents.length})</h2>
              {agents.length === 0 ? (
                <div style={styles.emptyState}>
                  No agents yet. Create one from a template or from scratch.
                </div>
              ) : (
                <div style={styles.agentsList}>
                  {agents.map(agent => (
                    <div key={agent.id} style={styles.agentCard}>
                      <div style={styles.agentInfo}>
                        <div style={styles.agentName}>{agent.name}</div>
                        <div style={styles.agentMeta}>
                          Trigger: {agent.trigger_type} • {agent.actions.length} actions
                        </div>
                      </div>
                      <div style={styles.agentStatus}>
                        {getStatusBadge(agent)}
                      </div>
                      <div style={styles.agentActions}>
                        <button
                          style={styles.buttonSmall}
                          onClick={() => handleSelectAgent(agent)}
                        >
                          View
                        </button>
                        <button
                          style={agent.enabled ? styles.buttonDanger : styles.buttonSuccess}
                          onClick={() => handleToggleEnabled(agent)}
                        >
                          {agent.enabled ? 'Disable' : 'Enable'}
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* Detail/Edit view */}
        {(viewMode === 'detail' || viewMode === 'create') && (
          <div style={styles.detailContainer}>
            <div style={styles.detailHeader}>
              <button style={styles.backButton} onClick={() => { setViewMode('list'); resetForm() }}>
                ← Back to List
              </button>
              <h2>{viewMode === 'create' ? 'Create Agent' : formData.name}</h2>
              {selectedAgent && getStatusBadge(selectedAgent)}
            </div>

            {/* Form */}
            <div style={styles.form}>
              {/* Basic info */}
              <div style={styles.formSection}>
                <h3>Basic Information</h3>
                <div style={styles.formGroup}>
                  <label>Name</label>
                  <input
                    type="text"
                    value={formData.name}
                    onChange={e => setFormData({ ...formData, name: e.target.value })}
                    style={styles.input}
                    placeholder="Agent name"
                  />
                </div>
                <div style={styles.formGroup}>
                  <label>Description</label>
                  <textarea
                    value={formData.description}
                    onChange={e => setFormData({ ...formData, description: e.target.value })}
                    style={styles.textarea}
                    placeholder="What does this agent do?"
                  />
                </div>
              </div>

              {/* Trigger */}
              <div style={styles.formSection}>
                <h3>Trigger</h3>
                <div style={styles.formGroup}>
                  <label>When should this agent run?</label>
                  <select
                    value={formData.trigger_type}
                    onChange={e => setFormData({ ...formData, trigger_type: e.target.value as TriggerType })}
                    style={styles.select}
                  >
                    {triggers.map(t => (
                      <option key={t.type} value={t.type}>{t.type} - {t.description}</option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Actions */}
              <div style={styles.formSection}>
                <h3>Actions ({formData.actions.length})</h3>
                {formData.actions.map((action, i) => (
                  <div key={i} style={styles.actionItem}>
                    <span>{i + 1}. {action.type}</span>
                    <button
                      style={styles.removeButton}
                      onClick={() => {
                        const newActions = [...formData.actions]
                        newActions.splice(i, 1)
                        setFormData({ ...formData, actions: newActions })
                      }}
                    >
                      ×
                    </button>
                  </div>
                ))}
                <select
                  style={styles.select}
                  onChange={e => {
                    if (e.target.value) {
                      setFormData({
                        ...formData,
                        actions: [...formData.actions, { type: e.target.value as any, config: {} }]
                      })
                      e.target.value = ''
                    }
                  }}
                  value=""
                >
                  <option value="">+ Add action...</option>
                  {actions.map(a => (
                    <option key={a.type} value={a.type}>{a.type} - {a.description}</option>
                  ))}
                </select>
              </div>

              {/* Guardrails */}
              <div style={styles.formSection}>
                <h3>Guardrails (Safety Limits)</h3>
                <div style={styles.guardrailsGrid}>
                  <div style={styles.formGroup}>
                    <label>Max Pulse messages/run</label>
                    <input
                      type="number"
                      value={formData.guardrails.maxPulseMessagesPerRun}
                      onChange={e => setFormData({
                        ...formData,
                        guardrails: { ...formData.guardrails, maxPulseMessagesPerRun: parseInt(e.target.value) || 3 }
                      })}
                      style={styles.inputSmall}
                    />
                  </div>
                  <div style={styles.formGroup}>
                    <label>Max CRM tasks/run</label>
                    <input
                      type="number"
                      value={formData.guardrails.maxCrmTasksPerRun}
                      onChange={e => setFormData({
                        ...formData,
                        guardrails: { ...formData.guardrails, maxCrmTasksPerRun: parseInt(e.target.value) || 10 }
                      })}
                      style={styles.inputSmall}
                    />
                  </div>
                  <div style={styles.formGroup}>
                    <label>Max total actions/run</label>
                    <input
                      type="number"
                      value={formData.guardrails.maxTotalActionsPerRun}
                      onChange={e => setFormData({
                        ...formData,
                        guardrails: { ...formData.guardrails, maxTotalActionsPerRun: parseInt(e.target.value) || 25 }
                      })}
                      style={styles.inputSmall}
                    />
                  </div>
                </div>
              </div>

              {/* Form actions */}
              <div style={styles.formActions}>
                <button style={styles.buttonPrimary} onClick={handleSaveAgent}>
                  {viewMode === 'create' ? 'Create Agent' : 'Save Changes'}
                </button>
                {selectedAgent && (
                  <>
                    <button
                      style={styles.buttonSecondary}
                      onClick={() => setViewMode('test')}
                    >
                      Test Run
                    </button>
                    <button
                      style={styles.buttonSecondary}
                      onClick={() => setViewMode('history')}
                    >
                      View History
                    </button>
                    <button
                      style={styles.buttonDanger}
                      onClick={() => handleDeleteAgent(selectedAgent)}
                    >
                      Delete
                    </button>
                  </>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Test run view */}
        {viewMode === 'test' && selectedAgent && (
          <div style={styles.detailContainer}>
            <div style={styles.detailHeader}>
              <button style={styles.backButton} onClick={() => setViewMode('detail')}>
                ← Back to Agent
              </button>
              <h2>Test Run: {selectedAgent.name}</h2>
            </div>

            <div style={styles.testSection}>
              <h3>Test Context</h3>
              <p style={styles.hint}>Enter IDs to test the agent with specific data</p>

              <div style={styles.formGroup}>
                <label>Meeting ID</label>
                <input
                  type="text"
                  value={testContext.meetingId || ''}
                  onChange={e => setTestContext({ ...testContext, meetingId: e.target.value })}
                  style={styles.input}
                  placeholder="Optional meeting UUID"
                />
              </div>
              <div style={styles.formGroup}>
                <label>Deal ID</label>
                <input
                  type="text"
                  value={testContext.dealId || ''}
                  onChange={e => setTestContext({ ...testContext, dealId: e.target.value })}
                  style={styles.input}
                  placeholder="Optional deal ID"
                />
              </div>
              <div style={styles.formGroup}>
                <label>Task ID</label>
                <input
                  type="text"
                  value={testContext.taskId || ''}
                  onChange={e => setTestContext({ ...testContext, taskId: e.target.value })}
                  style={styles.input}
                  placeholder="Optional task UUID"
                />
              </div>

              <div style={styles.testInfo}>
                ⚠️ Test runs execute in <strong>dry-run mode</strong> - no actual changes will be made.
              </div>

              <button
                style={styles.buttonPrimary}
                onClick={handleTestRun}
                disabled={testRunning}
              >
                {testRunning ? 'Running...' : 'Run Test'}
              </button>

              {/* Test result */}
              {testResult && (
                <div style={styles.testResult}>
                  <h4>Result</h4>
                  <pre style={styles.resultPre}>
                    {JSON.stringify(testResult, null, 2)}
                  </pre>
                </div>
              )}
            </div>
          </div>
        )}

        {/* History view */}
        {viewMode === 'history' && selectedAgent && (
          <div style={styles.detailContainer}>
            <div style={styles.detailHeader}>
              <button style={styles.backButton} onClick={() => setViewMode('detail')}>
                ← Back to Agent
              </button>
              <h2>Run History: {selectedAgent.name}</h2>
            </div>

            <div style={styles.historyList}>
              {agentRuns.length === 0 ? (
                <div style={styles.emptyState}>No runs yet</div>
              ) : (
                agentRuns.map(run => (
                  <div key={run.id} style={styles.runCard}>
                    <div style={styles.runHeader}>
                      {getRunStatusBadge(run.status)}
                      <span style={styles.runTime}>
                        {new Date(run.started_at).toLocaleString()}
                      </span>
                    </div>
                    <div style={styles.runMeta}>
                      Trigger: {run.trigger_event_id}
                    </div>
                    {run.error && (
                      <div style={styles.runError}>Error: {run.error}</div>
                    )}
                  </div>
                ))
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

// ==================== STYLES ====================

const styles: Record<string, React.CSSProperties> = {
  container: {
    padding: '24px',
    maxWidth: '1200px',
    margin: '0 auto'
  },
  header: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: '24px'
  },
  title: {
    fontSize: '28px',
    fontWeight: 600,
    margin: 0
  },
  headerActions: {
    display: 'flex',
    gap: '12px'
  },
  loading: {
    textAlign: 'center',
    padding: '48px',
    color: '#6b7280'
  },
  errorBanner: {
    background: '#fef2f2',
    border: '1px solid #ef4444',
    color: '#dc2626',
    padding: '12px 16px',
    borderRadius: '8px',
    marginBottom: '16px',
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center'
  },
  errorClose: {
    background: 'none',
    border: 'none',
    fontSize: '20px',
    cursor: 'pointer',
    color: '#dc2626'
  },
  content: {},
  listContainer: {},
  section: {
    marginBottom: '32px'
  },
  sectionTitle: {
    fontSize: '18px',
    fontWeight: 600,
    marginBottom: '16px'
  },
  templateGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fill, minmax(250px, 1fr))',
    gap: '16px'
  },
  templateCard: {
    background: '#f9fafb',
    border: '1px solid #e5e7eb',
    borderRadius: '8px',
    padding: '16px',
    display: 'flex',
    flexDirection: 'column',
    gap: '8px'
  },
  templateIcon: {
    fontSize: '24px'
  },
  templateName: {
    fontWeight: 600
  },
  templateDesc: {
    fontSize: '13px',
    color: '#6b7280',
    flex: 1
  },
  agentsList: {
    display: 'flex',
    flexDirection: 'column',
    gap: '12px'
  },
  agentCard: {
    background: 'white',
    border: '1px solid #e5e7eb',
    borderRadius: '8px',
    padding: '16px',
    display: 'flex',
    alignItems: 'center',
    gap: '16px'
  },
  agentInfo: {
    flex: 1
  },
  agentName: {
    fontWeight: 600,
    marginBottom: '4px'
  },
  agentMeta: {
    fontSize: '13px',
    color: '#6b7280'
  },
  agentStatus: {},
  agentActions: {
    display: 'flex',
    gap: '8px'
  },
  badge: {
    padding: '4px 8px',
    borderRadius: '4px',
    fontSize: '11px',
    fontWeight: 600,
    textTransform: 'uppercase'
  },
  badgeLive: {
    background: '#10b981',
    color: 'white',
    padding: '4px 8px',
    borderRadius: '4px',
    fontSize: '11px',
    fontWeight: 600
  },
  badgeDisabled: {
    background: '#6b7280',
    color: 'white',
    padding: '4px 8px',
    borderRadius: '4px',
    fontSize: '11px',
    fontWeight: 600
  },
  emptyState: {
    textAlign: 'center',
    padding: '32px',
    color: '#6b7280',
    background: '#f9fafb',
    borderRadius: '8px'
  },
  detailContainer: {},
  detailHeader: {
    display: 'flex',
    alignItems: 'center',
    gap: '16px',
    marginBottom: '24px'
  },
  backButton: {
    background: 'none',
    border: 'none',
    cursor: 'pointer',
    color: '#3b82f6',
    fontSize: '14px'
  },
  form: {},
  formSection: {
    background: '#f9fafb',
    border: '1px solid #e5e7eb',
    borderRadius: '8px',
    padding: '20px',
    marginBottom: '16px'
  },
  formGroup: {
    marginBottom: '16px'
  },
  input: {
    width: '100%',
    padding: '10px 12px',
    border: '1px solid #d1d5db',
    borderRadius: '6px',
    fontSize: '14px'
  },
  inputSmall: {
    width: '100px',
    padding: '8px 10px',
    border: '1px solid #d1d5db',
    borderRadius: '6px',
    fontSize: '14px'
  },
  textarea: {
    width: '100%',
    padding: '10px 12px',
    border: '1px solid #d1d5db',
    borderRadius: '6px',
    fontSize: '14px',
    minHeight: '80px',
    resize: 'vertical'
  },
  select: {
    width: '100%',
    padding: '10px 12px',
    border: '1px solid #d1d5db',
    borderRadius: '6px',
    fontSize: '14px',
    background: 'white'
  },
  actionItem: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '8px 12px',
    background: 'white',
    border: '1px solid #e5e7eb',
    borderRadius: '4px',
    marginBottom: '8px'
  },
  removeButton: {
    background: 'none',
    border: 'none',
    color: '#ef4444',
    fontSize: '18px',
    cursor: 'pointer'
  },
  guardrailsGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(3, 1fr)',
    gap: '16px'
  },
  formActions: {
    display: 'flex',
    gap: '12px',
    marginTop: '24px'
  },
  buttonPrimary: {
    background: '#3b82f6',
    color: 'white',
    border: 'none',
    padding: '10px 20px',
    borderRadius: '6px',
    fontSize: '14px',
    fontWeight: 500,
    cursor: 'pointer'
  },
  buttonSecondary: {
    background: '#f3f4f6',
    color: '#374151',
    border: '1px solid #d1d5db',
    padding: '10px 20px',
    borderRadius: '6px',
    fontSize: '14px',
    fontWeight: 500,
    cursor: 'pointer'
  },
  buttonSmall: {
    background: '#f3f4f6',
    color: '#374151',
    border: '1px solid #d1d5db',
    padding: '6px 12px',
    borderRadius: '4px',
    fontSize: '13px',
    cursor: 'pointer'
  },
  buttonSuccess: {
    background: '#10b981',
    color: 'white',
    border: 'none',
    padding: '6px 12px',
    borderRadius: '4px',
    fontSize: '13px',
    cursor: 'pointer'
  },
  buttonDanger: {
    background: '#ef4444',
    color: 'white',
    border: 'none',
    padding: '6px 12px',
    borderRadius: '4px',
    fontSize: '13px',
    cursor: 'pointer'
  },
  testSection: {
    background: '#f9fafb',
    border: '1px solid #e5e7eb',
    borderRadius: '8px',
    padding: '20px'
  },
  hint: {
    fontSize: '13px',
    color: '#6b7280',
    marginBottom: '16px'
  },
  testInfo: {
    background: '#fef3c7',
    border: '1px solid #f59e0b',
    color: '#92400e',
    padding: '12px',
    borderRadius: '6px',
    marginBottom: '16px',
    fontSize: '13px'
  },
  testResult: {
    marginTop: '24px',
    background: 'white',
    border: '1px solid #e5e7eb',
    borderRadius: '6px',
    padding: '16px'
  },
  resultPre: {
    background: '#1f2937',
    color: '#f9fafb',
    padding: '16px',
    borderRadius: '6px',
    overflow: 'auto',
    fontSize: '12px'
  },
  historyList: {
    display: 'flex',
    flexDirection: 'column',
    gap: '12px'
  },
  runCard: {
    background: 'white',
    border: '1px solid #e5e7eb',
    borderRadius: '8px',
    padding: '16px'
  },
  runHeader: {
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
    marginBottom: '8px'
  },
  runTime: {
    fontSize: '13px',
    color: '#6b7280'
  },
  runMeta: {
    fontSize: '12px',
    color: '#9ca3af'
  },
  runError: {
    marginTop: '8px',
    padding: '8px',
    background: '#fef2f2',
    color: '#dc2626',
    borderRadius: '4px',
    fontSize: '12px'
  }
}

export default AgentsView
