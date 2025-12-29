import React, { useState } from 'react'
import {
  Zap, Plus, Trash2, Clock, Calendar, ChevronRight, ChevronDown,
  Play, AlertCircle, CheckCircle2, Bot, Bell, Mail, MessageSquare,
  Database, ArrowRight, Settings, X, Eye, Sparkles
} from 'lucide-react'

// Available trigger types
const TRIGGER_TYPES = [
  { id: 'meeting_processed', name: 'Meeting Processed', icon: '📝', description: 'When a meeting is transcribed and analyzed' },
  { id: 'meeting_ended', name: 'Meeting Ended', icon: '🎙️', description: 'When a meeting recording ends' },
  { id: 'action_item_created', name: 'Action Item Created', icon: '📋', description: 'When a new action item is extracted' },
  { id: 'task_completed', name: 'Task Completed', icon: '✅', description: 'When a task is marked complete' },
  { id: 'deal_created', name: 'Deal Created', icon: '💰', description: 'When a CRM deal is created' },
  { id: 'scheduled', name: 'Scheduled', icon: '🕐', description: 'Run on a schedule (cron)' },
]

// Available action types
const ACTION_TYPES = [
  { id: 'run_agent', name: 'Run AI Agent', icon: <Bot className="w-4 h-4" />, category: 'ai', description: 'Execute an AI agent (assignment, priority, deadline)' },
  { id: 'auto_assign', name: 'Auto-Assign', icon: <Bot className="w-4 h-4" />, category: 'ai', description: 'AI determines best assignee' },
  { id: 'auto_prioritize', name: 'Auto-Prioritize', icon: <Sparkles className="w-4 h-4" />, category: 'ai', description: 'AI sets priority level' },
  { id: 'suggest_deadline', name: 'Suggest Deadline', icon: <Calendar className="w-4 h-4" />, category: 'ai', description: 'AI suggests due date' },
  { id: 'detect_followups', name: 'Detect Follow-ups', icon: <ArrowRight className="w-4 h-4" />, category: 'ai', description: 'AI identifies follow-up tasks from meeting content' },
  { id: 'send_notification', name: 'Send Notification', icon: <Bell className="w-4 h-4" />, category: 'notification', description: 'Send an in-app notification' },
  { id: 'send_email', name: 'Send Email', icon: <Mail className="w-4 h-4" />, category: 'notification', description: 'Send an email notification' },
  { id: 'send_slack', name: 'Send to Slack', icon: <MessageSquare className="w-4 h-4" />, category: 'integration', description: 'Post message to Slack channel' },
  { id: 'sync_to_crm', name: 'Sync to CRM', icon: <Database className="w-4 h-4" />, category: 'integration', description: 'Create/update CRM record' },
  { id: 'create_task', name: 'Create Task', icon: <CheckCircle2 className="w-4 h-4" />, category: 'action', description: 'Create a new task' },
  { id: 'update_status', name: 'Update Status', icon: <Settings className="w-4 h-4" />, category: 'action', description: 'Update item status' },
]

// Common cron presets
const CRON_PRESETS = [
  { label: 'Every hour', value: '0 * * * *' },
  { label: 'Every day at 9 AM', value: '0 9 * * *' },
  { label: 'Every Monday at 9 AM', value: '0 9 * * 1' },
  { label: 'Every weekday at 9 AM', value: '0 9 * * 1-5' },
  { label: 'First of month at 9 AM', value: '0 9 1 * *' },
]

export default function AutomationBuilder({ onSave, onCancel, onTest, initialData = null }) {
  const [step, setStep] = useState(1) // 1: trigger, 2: actions, 3: review
  const [name, setName] = useState(initialData?.name || '')
  const [description, setDescription] = useState(initialData?.description || '')
  const [triggerType, setTriggerType] = useState(initialData?.trigger_type || '')
  const [triggerConfig, setTriggerConfig] = useState(initialData?.trigger_config || {})
  const [actions, setActions] = useState(initialData?.actions || [])
  const [showActionPicker, setShowActionPicker] = useState(false)
  const [testResult, setTestResult] = useState(null)
  const [testing, setTesting] = useState(false)

  const handleSelectTrigger = (type) => {
    setTriggerType(type)
    if (type !== 'scheduled') {
      setTriggerConfig({})
    }
  }

  const handleAddAction = (actionType) => {
    const newAction = {
      id: Date.now(),
      type: actionType.id,
      config: getDefaultConfig(actionType.id)
    }
    setActions([...actions, newAction])
    setShowActionPicker(false)
  }

  const handleRemoveAction = (actionId) => {
    setActions(actions.filter(a => a.id !== actionId))
  }

  const handleUpdateActionConfig = (actionId, config) => {
    setActions(actions.map(a =>
      a.id === actionId ? { ...a, config: { ...a.config, ...config } } : a
    ))
  }

  const getDefaultConfig = (actionType) => {
    switch (actionType) {
      case 'run_agent':
        return { agent: 'assignment' }
      case 'send_notification':
        return { message: '', recipients: 'all' }
      case 'send_email':
        return { to: '', subject: '', body: '' }
      case 'send_slack':
        return { channel: '', message: '' }
      case 'sync_to_crm':
        return { objectType: 'deal', fields: {} }
      case 'create_task':
        return { title: '', priority: 'medium' }
      case 'update_status':
        return { status: 'in_progress' }
      case 'detect_followups':
        return { autoCreate: true }
      default:
        return {}
    }
  }

  const handleTest = async () => {
    if (!triggerType || actions.length === 0) return

    setTesting(true)
    setTestResult(null)

    try {
      // Create a temporary automation object for testing
      const testAutomation = {
        name: name || 'Test Automation',
        triggerType: triggerType,
        triggerConfig: triggerConfig,
        actions: actions.map(({ type, config }) => ({ type, config }))
      }

      const result = await onTest(testAutomation)
      setTestResult(result)
    } catch (error) {
      setTestResult({ success: false, error: error.message })
    } finally {
      setTesting(false)
    }
  }

  const handleSave = () => {
    if (!name || !triggerType || actions.length === 0) return

    onSave({
      name,
      description,
      triggerType: triggerType,
      triggerConfig: triggerConfig,
      actions: actions.map(({ type, config }) => ({ type, config })),
      enabled: true
    })
  }

  const isValid = name && triggerType && actions.length > 0

  const getActionType = (typeId) => ACTION_TYPES.find(a => a.id === typeId)
  const getTriggerType = (typeId) => TRIGGER_TYPES.find(t => t.id === typeId)

  return (
    <div className="card">
      {/* Header */}
      <div className="p-4 border-b border-gray-200 flex items-center justify-between">
        <h3 className="font-semibold text-gray-900 flex items-center gap-2">
          <Zap className="w-5 h-5 text-primary-500" />
          {initialData ? 'Edit Automation' : 'Create Automation'}
        </h3>
        <button onClick={onCancel} className="btn btn-icon btn-ghost">
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Progress Steps */}
      <div className="p-4 border-b border-gray-100 bg-gray-50">
        <div className="flex items-center justify-center gap-4">
          {[
            { num: 1, label: 'Trigger' },
            { num: 2, label: 'Actions' },
            { num: 3, label: 'Review' }
          ].map(({ num, label }) => (
            <button
              key={num}
              onClick={() => setStep(num)}
              className={`flex items-center gap-2 px-3 py-1 rounded-full transition-colors ${
                step === num
                  ? 'bg-primary-500 text-white'
                  : step > num
                    ? 'bg-green-100 text-green-700'
                    : 'bg-gray-200 text-gray-500'
              }`}
            >
              <span className="w-5 h-5 rounded-full bg-white/20 flex items-center justify-center text-xs font-medium">
                {step > num ? '✓' : num}
              </span>
              <span className="text-sm font-medium">{label}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Step 1: Choose Trigger */}
      {step === 1 && (
        <div className="p-5">
          <h4 className="font-medium text-gray-900 mb-4">What should trigger this automation?</h4>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {TRIGGER_TYPES.map((trigger) => (
              <button
                key={trigger.id}
                onClick={() => handleSelectTrigger(trigger.id)}
                className={`p-4 border-2 rounded-lg text-left transition-all ${
                  triggerType === trigger.id
                    ? 'border-primary-500 bg-primary-50'
                    : 'border-gray-200 hover:border-primary-300'
                }`}
              >
                <div className="flex items-start gap-3">
                  <span className="text-2xl">{trigger.icon}</span>
                  <div>
                    <h5 className="font-medium text-gray-900">{trigger.name}</h5>
                    <p className="text-sm text-gray-500 mt-1">{trigger.description}</p>
                  </div>
                </div>
              </button>
            ))}
          </div>

          {/* Scheduled trigger config */}
          {triggerType === 'scheduled' && (
            <div className="mt-4 p-4 border border-yellow-200 bg-yellow-50 rounded-lg">
              <h5 className="font-medium text-gray-900 mb-3 flex items-center gap-2">
                <Clock className="w-4 h-4" />
                Schedule Configuration
              </h5>
              <div className="space-y-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Preset</label>
                  <select
                    value=""
                    onChange={(e) => setTriggerConfig({ ...triggerConfig, cron: e.target.value })}
                    className="input w-full"
                  >
                    <option value="">Select a preset...</option>
                    {CRON_PRESETS.map(preset => (
                      <option key={preset.value} value={preset.value}>{preset.label}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Cron Expression
                  </label>
                  <input
                    type="text"
                    value={triggerConfig.cron || ''}
                    onChange={(e) => setTriggerConfig({ ...triggerConfig, cron: e.target.value })}
                    placeholder="0 9 * * *"
                    className="input w-full font-mono"
                  />
                  <p className="text-xs text-gray-500 mt-1">
                    Format: minute hour day month weekday (e.g., "0 9 * * 1-5" = weekdays at 9 AM)
                  </p>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Timezone</label>
                  <select
                    value={triggerConfig.timezone || 'UTC'}
                    onChange={(e) => setTriggerConfig({ ...triggerConfig, timezone: e.target.value })}
                    className="input w-full"
                  >
                    <option value="UTC">UTC</option>
                    <option value="America/New_York">Eastern Time</option>
                    <option value="America/Chicago">Central Time</option>
                    <option value="America/Denver">Mountain Time</option>
                    <option value="America/Los_Angeles">Pacific Time</option>
                    <option value="Europe/London">London</option>
                    <option value="Europe/Paris">Paris</option>
                    <option value="Asia/Tokyo">Tokyo</option>
                  </select>
                </div>
              </div>
            </div>
          )}

          <div className="flex justify-end mt-6">
            <button
              onClick={() => setStep(2)}
              disabled={!triggerType}
              className="btn btn-primary"
            >
              Next: Add Actions
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* Step 2: Add Actions */}
      {step === 2 && (
        <div className="p-5">
          <div className="flex items-center justify-between mb-4">
            <h4 className="font-medium text-gray-900">What actions should run?</h4>
            <button
              onClick={() => setShowActionPicker(true)}
              className="btn btn-secondary btn-sm"
            >
              <Plus className="w-4 h-4" />
              Add Action
            </button>
          </div>

          {/* Action list */}
          {actions.length === 0 ? (
            <div className="text-center py-8 border-2 border-dashed border-gray-200 rounded-lg">
              <Zap className="w-8 h-8 text-gray-300 mx-auto mb-2" />
              <p className="text-gray-500">No actions added yet</p>
              <button
                onClick={() => setShowActionPicker(true)}
                className="btn btn-primary btn-sm mt-3"
              >
                <Plus className="w-4 h-4" />
                Add First Action
              </button>
            </div>
          ) : (
            <div className="space-y-3">
              {actions.map((action, idx) => {
                const actionType = getActionType(action.type)
                return (
                  <div key={action.id} className="border border-gray-200 rounded-lg p-4">
                    <div className="flex items-start justify-between mb-3">
                      <div className="flex items-center gap-3">
                        <span className="w-6 h-6 bg-gray-100 rounded-full flex items-center justify-center text-xs font-medium">
                          {idx + 1}
                        </span>
                        <div className="flex items-center gap-2">
                          {actionType?.icon}
                          <span className="font-medium text-gray-900">{actionType?.name}</span>
                        </div>
                      </div>
                      <button
                        onClick={() => handleRemoveAction(action.id)}
                        className="btn btn-icon btn-ghost text-red-500 hover:bg-red-50"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>

                    {/* Action configuration */}
                    <ActionConfigForm
                      actionType={action.type}
                      config={action.config}
                      onChange={(config) => handleUpdateActionConfig(action.id, config)}
                    />
                  </div>
                )
              })}
            </div>
          )}

          {/* Action picker modal */}
          {showActionPicker && (
            <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
              <div className="bg-white rounded-xl shadow-xl max-w-lg w-full mx-4 max-h-[80vh] overflow-hidden">
                <div className="p-4 border-b border-gray-200 flex items-center justify-between">
                  <h4 className="font-semibold text-gray-900">Choose an Action</h4>
                  <button onClick={() => setShowActionPicker(false)} className="btn btn-icon btn-ghost">
                    <X className="w-4 h-4" />
                  </button>
                </div>
                <div className="p-4 overflow-y-auto max-h-96">
                  {['ai', 'notification', 'integration', 'action'].map(category => (
                    <div key={category} className="mb-4">
                      <h5 className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-2">
                        {category === 'ai' ? 'AI-Powered' : category.charAt(0).toUpperCase() + category.slice(1)}
                      </h5>
                      <div className="space-y-2">
                        {ACTION_TYPES.filter(a => a.category === category).map(actionType => (
                          <button
                            key={actionType.id}
                            onClick={() => handleAddAction(actionType)}
                            className="w-full p-3 border border-gray-200 rounded-lg text-left hover:border-primary-300 hover:bg-primary-50 transition-colors"
                          >
                            <div className="flex items-center gap-3">
                              <span className="w-8 h-8 bg-gray-100 rounded-lg flex items-center justify-center">
                                {actionType.icon}
                              </span>
                              <div>
                                <h6 className="font-medium text-gray-900">{actionType.name}</h6>
                                <p className="text-xs text-gray-500">{actionType.description}</p>
                              </div>
                            </div>
                          </button>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          <div className="flex justify-between mt-6">
            <button onClick={() => setStep(1)} className="btn btn-secondary">
              Back
            </button>
            <button
              onClick={() => setStep(3)}
              disabled={actions.length === 0}
              className="btn btn-primary"
            >
              Next: Review
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* Step 3: Review & Save */}
      {step === 3 && (
        <div className="p-5">
          <h4 className="font-medium text-gray-900 mb-4">Review & Save</h4>

          {/* Name & Description */}
          <div className="space-y-4 mb-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Automation Name *
              </label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g., Auto-assign meeting action items"
                className="input w-full"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Description (optional)
              </label>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="What does this automation do?"
                rows={2}
                className="input w-full"
              />
            </div>
          </div>

          {/* Summary */}
          <div className="bg-gray-50 rounded-lg p-4 mb-6">
            <h5 className="font-medium text-gray-900 mb-3">Automation Summary</h5>

            <div className="flex items-center gap-3 mb-3">
              <span className="text-xl">{getTriggerType(triggerType)?.icon}</span>
              <div>
                <p className="text-sm font-medium text-gray-900">
                  Trigger: {getTriggerType(triggerType)?.name}
                </p>
                {triggerType === 'scheduled' && triggerConfig.cron && (
                  <p className="text-xs text-gray-500 font-mono">{triggerConfig.cron}</p>
                )}
              </div>
            </div>

            <div className="border-l-2 border-gray-300 pl-4 ml-3 space-y-2">
              {actions.map((action, idx) => {
                const actionType = getActionType(action.type)
                return (
                  <div key={action.id} className="flex items-center gap-2 text-sm">
                    <ArrowRight className="w-3 h-3 text-gray-400" />
                    {actionType?.icon}
                    <span className="text-gray-700">{actionType?.name}</span>
                  </div>
                )
              })}
            </div>
          </div>

          {/* Test Button */}
          <div className="mb-6">
            <button
              onClick={handleTest}
              disabled={testing || !triggerType || actions.length === 0}
              className="btn btn-secondary w-full"
            >
              {testing ? (
                <>
                  <div className="spinner w-4 h-4" />
                  Testing...
                </>
              ) : (
                <>
                  <Eye className="w-4 h-4" />
                  Test Automation (Dry Run)
                </>
              )}
            </button>

            {testResult && (
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
                    <p className={`font-medium ${testResult.success ? 'text-green-700' : 'text-red-700'}`}>
                      {testResult.success ? 'Test passed!' : 'Test failed'}
                    </p>
                    {testResult.error && (
                      <p className="text-sm text-red-600 mt-1">{testResult.error}</p>
                    )}
                    {testResult.actionResults && (
                      <div className="mt-2 space-y-1">
                        {testResult.actionResults.map((result, idx) => (
                          <div key={idx} className="text-sm text-gray-600">
                            • {result.type}: {result.preview || 'OK'}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}
          </div>

          <div className="flex justify-between">
            <button onClick={() => setStep(2)} className="btn btn-secondary">
              Back
            </button>
            <div className="flex gap-2">
              <button onClick={onCancel} className="btn btn-ghost">
                Cancel
              </button>
              <button
                onClick={handleSave}
                disabled={!isValid}
                className="btn btn-primary"
              >
                <CheckCircle2 className="w-4 h-4" />
                Save Automation
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// Action configuration form component
function ActionConfigForm({ actionType, config, onChange }) {
  switch (actionType) {
    case 'run_agent':
      return (
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Agent</label>
          <select
            value={config.agent || 'assignment'}
            onChange={(e) => onChange({ agent: e.target.value })}
            className="input w-full"
          >
            <option value="assignment">Assignment Agent</option>
            <option value="priority">Priority Agent</option>
            <option value="deadline">Deadline Agent</option>
            <option value="followup">Follow-up Detector</option>
          </select>
        </div>
      )

    case 'send_notification':
      return (
        <div className="space-y-3">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Message</label>
            <input
              type="text"
              value={config.message || ''}
              onChange={(e) => onChange({ message: e.target.value })}
              placeholder="Notification message..."
              className="input w-full"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Recipients</label>
            <select
              value={config.recipients || 'all'}
              onChange={(e) => onChange({ recipients: e.target.value })}
              className="input w-full"
            >
              <option value="all">All Users</option>
              <option value="assignee">Assignee Only</option>
              <option value="creator">Creator Only</option>
            </select>
          </div>
        </div>
      )

    case 'send_email':
      return (
        <div className="space-y-3">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">To</label>
            <input
              type="email"
              value={config.to || ''}
              onChange={(e) => onChange({ to: e.target.value })}
              placeholder="recipient@example.com"
              className="input w-full"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Subject</label>
            <input
              type="text"
              value={config.subject || ''}
              onChange={(e) => onChange({ subject: e.target.value })}
              placeholder="Email subject..."
              className="input w-full"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Body</label>
            <textarea
              value={config.body || ''}
              onChange={(e) => onChange({ body: e.target.value })}
              placeholder="Email body..."
              rows={3}
              className="input w-full"
            />
          </div>
        </div>
      )

    case 'send_slack':
      return (
        <div className="space-y-3">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Channel</label>
            <input
              type="text"
              value={config.channel || ''}
              onChange={(e) => onChange({ channel: e.target.value })}
              placeholder="#channel-name or channel ID"
              className="input w-full"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Message</label>
            <textarea
              value={config.message || ''}
              onChange={(e) => onChange({ message: e.target.value })}
              placeholder="Message to post..."
              rows={2}
              className="input w-full"
            />
          </div>
        </div>
      )

    case 'sync_to_crm':
      return (
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Object Type</label>
          <select
            value={config.objectType || 'deal'}
            onChange={(e) => onChange({ objectType: e.target.value })}
            className="input w-full"
          >
            <option value="deal">Deal</option>
            <option value="contact">Contact</option>
            <option value="task">Task</option>
          </select>
        </div>
      )

    case 'create_task':
      return (
        <div className="space-y-3">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Task Title</label>
            <input
              type="text"
              value={config.title || ''}
              onChange={(e) => onChange({ title: e.target.value })}
              placeholder="Task title (use {{variables}})"
              className="input w-full"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Priority</label>
            <select
              value={config.priority || 'medium'}
              onChange={(e) => onChange({ priority: e.target.value })}
              className="input w-full"
            >
              <option value="low">Low</option>
              <option value="medium">Medium</option>
              <option value="high">High</option>
              <option value="urgent">Urgent</option>
            </select>
          </div>
        </div>
      )

    case 'update_status':
      return (
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">New Status</label>
          <select
            value={config.status || 'in_progress'}
            onChange={(e) => onChange({ status: e.target.value })}
            className="input w-full"
          >
            <option value="pending">Pending</option>
            <option value="in_progress">In Progress</option>
            <option value="completed">Completed</option>
            <option value="cancelled">Cancelled</option>
          </select>
        </div>
      )

    case 'auto_assign':
    case 'auto_prioritize':
    case 'suggest_deadline':
      return (
        <p className="text-sm text-gray-500 italic">
          This AI action will automatically analyze the context and make suggestions.
        </p>
      )

    case 'detect_followups':
      return (
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              id="autoCreate"
              checked={config.autoCreate !== false}
              onChange={(e) => onChange({ autoCreate: e.target.checked })}
              className="rounded border-gray-300"
            />
            <label htmlFor="autoCreate" className="text-sm text-gray-700">
              Automatically create follow-up tasks (for high-confidence detections)
            </label>
          </div>
          <p className="text-xs text-gray-500 italic">
            AI will analyze meeting content to identify follow-up opportunities and can automatically create tasks for items with 70%+ confidence.
          </p>
        </div>
      )

    default:
      return null
  }
}
