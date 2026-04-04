import React, { useState, useEffect, useCallback } from 'react'
import { useTheme } from '../context/ThemeContext'
import { supabase } from '../lib/supabase'
import { getProjects } from '../services/projectService'
import type { EntoamateProject } from '../lib/supabase'

// ==================== API CLIENT ====================

const API_BASE = import.meta.env.VITE_API_URL || ''

async function apiRequest(method: string, path: string, body?: any) {
  const res = await fetch(`${API_BASE}/api/automations${path}`, {
    method,
    headers: { 'Content-Type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }))
    throw new Error(err.error || `Request failed: ${res.status}`)
  }
  return res.json()
}

const automationsApi = {
  list: () => apiRequest('GET', ''),
  getTemplates: () => apiRequest('GET', '/templates'),
  create: (data: any) => apiRequest('POST', '', data),
  update: (id: string, data: any) => apiRequest('PUT', `/${id}`, data),
  delete: (id: string) => apiRequest('DELETE', `/${id}`),
  toggle: (id: string, enabled: boolean) => apiRequest('POST', `/${id}/toggle`, { enabled }),
  execute: (id: string) => apiRequest('POST', `/${id}/execute`, {}),
}

// ==================== TYPES ====================

interface Automation {
  id: string
  name: string
  description?: string | null
  trigger_type: string
  trigger_config: Record<string, any>
  actions: { type: string; config?: any }[]
  enabled: boolean
  execution_count: number
  last_executed_at?: string | null
  created_at: string
}

type TriggerType = 'meeting_ended' | 'action_item_created' | 'task_completed' | 'deal_created' | 'scheduled' | 'webhook'
type ActionType = 'sync_action_items' | 'post_to_chat' | 'notify_user' | 'create_task' | 'create_project' | 'update_crm' | 'send_email'

// ==================== CONSTANTS ====================

const TRIGGER_OPTIONS: { value: TriggerType; label: string; description: string }[] = [
  { value: 'meeting_ended', label: 'Meeting Ended', description: 'When a meeting recording ends' },
  { value: 'action_item_created', label: 'Action Items Created', description: 'When action items are extracted' },
  { value: 'task_completed', label: 'Task Completed', description: 'When a task is marked complete' },
  { value: 'deal_created', label: 'Deal Created', description: 'When a CRM deal is created' },
  { value: 'scheduled', label: 'Scheduled', description: 'Run on a time schedule' },
]

const ACTION_OPTIONS: { value: ActionType; label: string; description: string }[] = [
  { value: 'sync_action_items', label: 'Sync to CRM', description: 'Sync action items to Logos Vision' },
  { value: 'post_to_chat', label: 'Post to Chat', description: 'Post summary to team chat' },
  { value: 'notify_user', label: 'Notify Team', description: 'Send notifications' },
  { value: 'create_task', label: 'Create Task', description: 'Create a new task' },
  { value: 'create_project', label: 'Create Project', description: 'Create a project from deal' },
  { value: 'update_crm', label: 'Update CRM', description: 'Update CRM records' },
]

// ==================== PRESET TEMPLATES ====================

const PRESET_TEMPLATES = [
  {
    name: 'Auto-sync to CRM',
    description: 'Automatically sync all action items to Logos Vision CRM when a meeting is processed',
    triggerType: 'action_item_created',
    triggerConfig: {},
    actions: [{ type: 'sync_action_items', config: { syncAll: true } }]
  },
  {
    name: 'Post Meeting Recap',
    description: 'Post meeting summary to team chat after every meeting',
    triggerType: 'meeting_ended',
    triggerConfig: {},
    actions: [{ type: 'post_to_chat', config: { includeActionItems: true } }]
  },
  {
    name: 'Action Item to Task',
    description: 'Create tasks automatically when action items are extracted',
    triggerType: 'action_item_created',
    triggerConfig: { priorityFilter: ['high', 'medium'] },
    actions: [{ type: 'create_task', config: { fromActionItem: true } }]
  },
  {
    name: 'Deal Kickoff Project',
    description: 'Create a project with default tasks when a new deal is created',
    triggerType: 'deal_created',
    triggerConfig: {},
    actions: [
      { type: 'create_project', config: { fromDeal: true } },
      { type: 'notify_user', config: { message: 'New project created from deal' } }
    ]
  }
]

// ==================== COMPONENT ====================

export const AutomationsView: React.FC = () => {
  const { isDark } = useTheme()

  // State
  const [automations, setAutomations] = useState<Automation[]>([])
  const [projects, setProjects] = useState<EntoamateProject[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [showCreateForm, setShowCreateForm] = useState(false)
  const [showPresets, setShowPresets] = useState(false)
  const [editingAutomation, setEditingAutomation] = useState<Automation | null>(null)
  const [saving, setSaving] = useState(false)

  // Form state
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    triggerType: 'meeting_ended' as TriggerType,
    triggerConfig: {} as Record<string, any>,
    actions: [{ type: 'sync_action_items' as ActionType, config: {} }]
  })

  // ==================== EFFECTS ====================

  useEffect(() => {
    loadData()
  }, [])

  // Auto-dismiss error after 5s
  useEffect(() => {
    if (error) {
      const t = setTimeout(() => setError(null), 5000)
      return () => clearTimeout(t)
    }
  }, [error])

  // Real-time subscription: refresh when automations are updated externally
  // (e.g. execution_count/last_executed_at changes from background triggers)
  useEffect(() => {
    const channel = supabase
      .channel('automations-changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'automations' }, () => {
        loadData()
      })
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  }, [])

  // ==================== DATA LOADING ====================

  const loadData = async () => {
    setLoading(true)
    setError(null)
    try {
      const [automationsRes, projectsData] = await Promise.all([
        automationsApi.list(),
        getProjects()
      ])
      setAutomations(automationsRes.automations || [])
      setProjects(projectsData)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load automations')
    } finally {
      setLoading(false)
    }
  }

  // ==================== ACTIONS ====================

  const handleCreate = async () => {
    if (!formData.name.trim()) return
    setSaving(true)
    setError(null)
    try {
      const res = await automationsApi.create({
        name: formData.name,
        description: formData.description || null,
        triggerType: formData.triggerType,
        triggerConfig: formData.triggerConfig,
        actions: formData.actions,
        enabled: true
      })
      if (res.automation) {
        setAutomations([res.automation, ...automations])
      }
      resetForm()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create automation')
    } finally {
      setSaving(false)
    }
  }

  const handleUpdate = async () => {
    if (!editingAutomation || !formData.name.trim()) return
    setSaving(true)
    setError(null)
    try {
      const updated = await automationsApi.update(editingAutomation.id, {
        name: formData.name,
        description: formData.description || null,
        trigger_type: formData.triggerType,
        trigger_config: formData.triggerConfig,
        actions: formData.actions
      })
      setAutomations(automations.map(a => a.id === updated.id ? updated : a))
      resetForm()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update automation')
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this automation?')) return
    setError(null)
    try {
      await automationsApi.delete(id)
      setAutomations(automations.filter(a => a.id !== id))
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete automation')
    }
  }

  const handleToggle = async (id: string, enabled: boolean) => {
    setError(null)
    try {
      await automationsApi.toggle(id, enabled)
      setAutomations(automations.map(a =>
        a.id === id ? { ...a, enabled } : a
      ))
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to toggle automation')
    }
  }

  const handleExecute = async (id: string) => {
    setError(null)
    try {
      await automationsApi.execute(id)
      loadData() // Refresh to get updated execution_count
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to execute automation')
    }
  }

  const handleCreatePreset = async (index: number) => {
    const preset = PRESET_TEMPLATES[index]
    if (!preset) return
    setSaving(true)
    setError(null)
    try {
      const res = await automationsApi.create({
        name: preset.name,
        description: preset.description,
        triggerType: preset.triggerType,
        triggerConfig: preset.triggerConfig,
        actions: preset.actions,
        enabled: true
      })
      if (res.automation) {
        setAutomations([res.automation, ...automations])
      }
      setShowPresets(false)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create preset')
    } finally {
      setSaving(false)
    }
  }

  const startEdit = (automation: Automation) => {
    setEditingAutomation(automation)
    setFormData({
      name: automation.name,
      description: automation.description || '',
      triggerType: automation.trigger_type as TriggerType,
      triggerConfig: automation.trigger_config || {},
      actions: automation.actions as any[]
    })
    setShowCreateForm(true)
  }

  const resetForm = () => {
    setFormData({
      name: '',
      description: '',
      triggerType: 'meeting_ended',
      triggerConfig: {},
      actions: [{ type: 'sync_action_items', config: {} }]
    })
    setEditingAutomation(null)
    setShowCreateForm(false)
  }

  // ==================== FORM HELPERS ====================

  const addAction = () => {
    setFormData({
      ...formData,
      actions: [...formData.actions, { type: 'sync_action_items', config: {} }]
    })
  }

  const removeAction = (index: number) => {
    setFormData({
      ...formData,
      actions: formData.actions.filter((_, i) => i !== index)
    })
  }

  const updateAction = (index: number, updates: Partial<{ type: ActionType; config: any }>) => {
    setFormData({
      ...formData,
      actions: formData.actions.map((a, i) =>
        i === index ? { ...a, ...updates } : a
      )
    })
  }

  const updateTriggerConfig = (key: string, value: any) => {
    setFormData({
      ...formData,
      triggerConfig: { ...formData.triggerConfig, [key]: value }
    })
  }

  // ==================== STYLE HELPERS ====================

  const cls = {
    card: isDark ? 'bg-gray-900 border-gray-800' : 'bg-white border-gray-100',
    text: isDark ? 'text-white' : 'text-gray-900',
    textSub: isDark ? 'text-gray-400' : 'text-gray-500',
    textMuted: isDark ? 'text-gray-500' : 'text-gray-400',
    border: isDark ? 'border-gray-700' : 'border-gray-200',
    input: isDark
      ? 'bg-gray-800 border-gray-700 text-white placeholder-gray-500'
      : 'bg-white border-gray-200 text-gray-900 placeholder-gray-400',
    actionBg: isDark ? 'bg-gray-800' : 'bg-gray-50',
    hoverBtn: isDark ? 'hover:text-gray-200' : 'hover:text-gray-700',
    modal: isDark ? 'bg-gray-900' : 'bg-white',
    tagBlue: isDark ? 'bg-blue-900/40 text-blue-400' : 'bg-blue-50 text-blue-600',
    tagPurple: isDark ? 'bg-purple-900/40 text-purple-400' : 'bg-purple-50 text-purple-600',
    tagGreen: isDark ? 'bg-green-900/40 text-green-400' : 'bg-green-100 text-green-600',
    tagGray: isDark ? 'bg-gray-800 text-gray-400' : 'bg-gray-100 text-gray-500',
    emptyBg: isDark ? 'bg-gray-800' : 'bg-gray-100',
  }

  // ==================== RENDER ====================

  return (
    <div className="flex flex-col h-full gap-6">
      {/* Error Banner */}
      {error && (
        <div className="bg-red-500/10 border border-red-500/30 text-red-500 px-4 py-3 rounded-xl text-sm flex justify-between items-center">
          <span>{error}</span>
          <button type="button" onClick={() => setError(null)} className="ml-4 font-bold hover:text-red-400" aria-label="Dismiss error">
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
          </button>
        </div>
      )}

      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h2 className={`text-2xl font-bold ${cls.text}`}>Automations</h2>
          <p className={`text-sm ${cls.textSub}`}>Automate actions based on meeting events</p>
        </div>

        <div className="flex gap-3">
          <button
            onClick={() => setShowPresets(true)}
            className={`px-4 py-2 border ${cls.border} rounded-full text-sm ${cls.textSub} ${cls.hoverBtn} flex items-center gap-2 transition-colors`}
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polygon points="12 2 2 7 12 12 22 7 12 2"></polygon><polyline points="2 17 12 22 22 17"></polyline><polyline points="2 12 12 17 22 12"></polyline></svg>
            Presets
          </button>
          <button
            onClick={() => { resetForm(); setShowCreateForm(true) }}
            className="px-4 py-2 bg-[#2563EB] text-white rounded-full font-bold flex items-center gap-2 hover:bg-[#1d4ed8] transition-colors"
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line></svg>
            New Automation
          </button>
        </div>
      </div>

      {/* Presets Modal */}
      {showPresets && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50" onClick={() => setShowPresets(false)}>
          <div className={`${cls.modal} rounded-2xl p-6 max-w-lg w-full mx-4 shadow-xl`} onClick={e => e.stopPropagation()}>
            <div className="flex justify-between items-center mb-4">
              <h3 className={`font-bold text-lg ${cls.text}`}>Preset Automations</h3>
              <button type="button" onClick={() => setShowPresets(false)} className={`${cls.textMuted} ${cls.hoverBtn}`} aria-label="Close presets">
                <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
              </button>
            </div>
            <div className="space-y-3">
              {PRESET_TEMPLATES.map((preset, index) => (
                <button
                  key={index}
                  disabled={saving}
                  className={`w-full text-left p-4 border ${cls.border} rounded-xl hover:border-[#2563EB]/50 cursor-pointer transition-colors disabled:opacity-50`}
                  onClick={() => handleCreatePreset(index)}
                >
                  <h4 className={`font-medium ${cls.text}`}>{preset.name}</h4>
                  <p className={`text-sm ${cls.textSub}`}>{preset.description}</p>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Create/Edit Form */}
      {showCreateForm && (
        <div className={`${cls.card} border rounded-2xl p-6`}>
          <div className="flex justify-between items-center mb-4">
            <h3 className={`font-bold ${cls.text}`}>{editingAutomation ? 'Edit Automation' : 'Create Automation'}</h3>
            <button type="button" onClick={resetForm} className={`${cls.textMuted} ${cls.hoverBtn}`} aria-label="Close form">
              <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
            </button>
          </div>

          <div className="space-y-4">
            {/* Name */}
            <div>
              <label className={`block text-xs font-bold ${cls.textSub} mb-2`}>Name *</label>
              <input
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder="My Automation"
                className={`w-full border rounded-xl p-3 focus:ring-1 focus:ring-[#2563EB] outline-none ${cls.input}`}
              />
            </div>

            {/* Description */}
            <div>
              <label className={`block text-xs font-bold ${cls.textSub} mb-2`}>Description</label>
              <input
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                placeholder="What does this automation do?"
                className={`w-full border rounded-xl p-3 focus:ring-1 focus:ring-[#2563EB] outline-none ${cls.input}`}
              />
            </div>

            {/* Trigger */}
            <div>
              <label className={`block text-xs font-bold ${cls.textSub} mb-2`}>When this happens (Trigger)</label>
              <select
                value={formData.triggerType}
                onChange={(e) => setFormData({ ...formData, triggerType: e.target.value as TriggerType, triggerConfig: {} })}
                className={`w-full border rounded-xl p-3 focus:ring-1 focus:ring-[#2563EB] outline-none ${cls.input}`}
              >
                {TRIGGER_OPTIONS.map(opt => (
                  <option key={opt.value} value={opt.value}>{opt.label} - {opt.description}</option>
                ))}
              </select>

              {/* Scheduled trigger config */}
              {formData.triggerType === 'scheduled' && (
                <div className="mt-3">
                  <label className={`block text-xs ${cls.textMuted} mb-1`}>Cron expression (e.g. "0 9 * * *" for daily at 9am)</label>
                  <input
                    value={formData.triggerConfig.cron || ''}
                    onChange={(e) => updateTriggerConfig('cron', e.target.value)}
                    placeholder="0 9 * * *"
                    className={`w-full border rounded-xl p-3 focus:ring-1 focus:ring-[#2563EB] outline-none font-mono text-sm ${cls.input}`}
                  />
                </div>
              )}
            </div>

            {/* Actions */}
            <div>
              <div className="flex justify-between items-center mb-2">
                <label className={`block text-xs font-bold ${cls.textSub}`}>Do this (Actions)</label>
                <button onClick={addAction} className="text-xs text-[#2563EB] font-bold">
                  + Add Action
                </button>
              </div>

              <div className="space-y-3">
                {formData.actions.map((action, index) => (
                  <div key={index} className={`p-3 ${cls.actionBg} rounded-xl`}>
                    <div className="flex gap-3 items-start">
                      <select
                        value={action.type}
                        onChange={(e) => updateAction(index, { type: e.target.value as ActionType, config: {} })}
                        className={`flex-1 border rounded-lg p-2 text-sm focus:ring-1 focus:ring-[#2563EB] outline-none ${cls.input}`}
                      >
                        {ACTION_OPTIONS.map(opt => (
                          <option key={opt.value} value={opt.value}>{opt.label}</option>
                        ))}
                      </select>

                      {formData.actions.length > 1 && (
                        <button
                          type="button"
                          onClick={() => removeAction(index)}
                          className={`${cls.textMuted} hover:text-red-500`}
                          aria-label="Remove action"
                        >
                          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>
                        </button>
                      )}
                    </div>

                    {/* Action-specific config */}
                    {action.type === 'create_task' && (
                      <div className="mt-2">
                        <select
                          value={action.config?.project_id || ''}
                          onChange={(e) => updateAction(index, { config: { ...action.config, project_id: e.target.value } })}
                          className={`w-full border rounded-lg p-2 text-sm focus:ring-1 focus:ring-[#2563EB] outline-none ${cls.input}`}
                          aria-label="Select project"
                        >
                          <option value="">Select project (optional)...</option>
                          {projects.map(p => (
                            <option key={p.id} value={p.id}>{p.name}</option>
                          ))}
                        </select>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>

            {/* Submit */}
            <div className="flex justify-end gap-3 pt-4">
              <button type="button" onClick={resetForm} className={`px-6 py-2 ${cls.textSub} ${cls.hoverBtn}`}>
                Cancel
              </button>
              <button
                type="button"
                onClick={editingAutomation ? handleUpdate : handleCreate}
                disabled={!formData.name.trim() || saving}
                className="px-6 py-2 bg-[#2563EB] text-white rounded-full font-bold disabled:opacity-50 hover:bg-[#1d4ed8] transition-colors"
              >
                {saving ? 'Saving...' : editingAutomation ? 'Update' : 'Create'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Automations List */}
      {loading ? (
        <div className="flex justify-center py-12">
          <div className="w-8 h-8 border-2 border-[#2563EB] border-t-transparent rounded-full animate-spin"></div>
        </div>
      ) : automations.length === 0 ? (
        <div className={`${cls.card} border rounded-2xl p-12 text-center`}>
          <div className={`w-16 h-16 ${cls.emptyBg} rounded-full flex items-center justify-center mx-auto mb-4`}>
            <svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className={cls.textMuted}><path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z"></path></svg>
          </div>
          <h3 className={`font-bold text-lg mb-2 ${cls.text}`}>No automations yet</h3>
          <p className={`${cls.textMuted} mb-6`}>Create automations to run actions automatically when meetings are processed</p>
          <div className="flex justify-center gap-3">
            <button
              type="button"
              onClick={() => setShowPresets(true)}
              className={`px-4 py-2 border ${cls.border} rounded-full text-sm ${cls.textSub} ${cls.hoverBtn} transition-colors`}
            >
              Use a Preset
            </button>
            <button
              type="button"
              onClick={() => setShowCreateForm(true)}
              className="px-4 py-2 bg-[#2563EB] text-white rounded-full text-sm font-bold hover:bg-[#1d4ed8] transition-colors"
            >
              Create Custom
            </button>
          </div>
        </div>
      ) : (
        <div className="space-y-4">
          {automations.map(automation => (
            <div
              key={automation.id}
              className={`${cls.card} border rounded-2xl p-5 transition-all ${
                !automation.enabled ? 'opacity-60' : ''
              }`}
            >
              <div className="flex justify-between items-start">
                <div className="flex-1">
                  <div className="flex items-center gap-3 mb-2">
                    <h3 className={`font-bold ${cls.text}`}>{automation.name}</h3>
                    <span className={`px-2 py-0.5 rounded text-xs font-bold ${
                      automation.enabled ? cls.tagGreen : cls.tagGray
                    }`}>
                      {automation.enabled ? 'Active' : 'Paused'}
                    </span>
                  </div>
                  {automation.description && (
                    <p className={`${cls.textSub} text-sm mb-3`}>{automation.description}</p>
                  )}

                  <div className="flex flex-wrap gap-2 text-xs">
                    <span className={`px-2 py-1 ${cls.tagBlue} rounded`}>
                      Trigger: {TRIGGER_OPTIONS.find(t => t.value === automation.trigger_type)?.label || automation.trigger_type.replace(/_/g, ' ')}
                    </span>
                    {automation.actions.map((action: any, i: number) => (
                      <span key={i} className={`px-2 py-1 ${cls.tagPurple} rounded`}>
                        {ACTION_OPTIONS.find(a => a.value === action.type)?.label || action.type.replace(/_/g, ' ')}
                      </span>
                    ))}
                  </div>

                  {(automation.execution_count > 0) && (
                    <p className={`text-xs ${cls.textMuted} mt-3`}>
                      Ran {automation.execution_count} time{automation.execution_count !== 1 ? 's' : ''}
                      {automation.last_executed_at && ` \u2022 Last: ${new Date(automation.last_executed_at).toLocaleDateString()}`}
                    </p>
                  )}
                </div>

                <div className="flex items-center gap-2">
                  {/* Toggle */}
                  <button
                    type="button"
                    onClick={() => handleToggle(automation.id, !automation.enabled)}
                    className={`w-12 h-6 rounded-full transition-colors relative ${
                      automation.enabled ? 'bg-[#2563EB]' : isDark ? 'bg-gray-600' : 'bg-gray-300'
                    }`}
                    aria-label={automation.enabled ? 'Pause automation' : 'Enable automation'}
                  >
                    <div className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-transform ${
                      automation.enabled ? 'left-7' : 'left-1'
                    }`}></div>
                  </button>

                  {/* Run */}
                  <button
                    type="button"
                    onClick={() => handleExecute(automation.id)}
                    className={`p-2 ${cls.textMuted} hover:text-[#2563EB] transition-colors`}
                    title="Run now"
                    aria-label="Run automation now"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polygon points="5 3 19 12 5 21 5 3"></polygon></svg>
                  </button>

                  {/* Edit */}
                  <button
                    type="button"
                    onClick={() => startEdit(automation)}
                    className={`p-2 ${cls.textMuted} ${cls.hoverBtn} transition-colors`}
                    aria-label="Edit automation"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path></svg>
                  </button>

                  {/* Delete */}
                  <button
                    type="button"
                    onClick={() => handleDelete(automation.id)}
                    className={`p-2 ${cls.textMuted} hover:text-red-500 transition-colors`}
                    aria-label="Delete automation"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

export default AutomationsView
