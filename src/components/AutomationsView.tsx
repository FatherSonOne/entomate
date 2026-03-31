import React, { useState, useEffect } from 'react'
import {
  getAutomations,
  createAutomation,
  updateAutomation,
  deleteAutomation,
  toggleAutomation,
  PRESET_AUTOMATIONS,
  createPresetAutomation,
  type TriggerType,
  type ActionType
} from '../services/automationService'
import { getProjects } from '../services/projectService'
import type { EntoamateAutomation, EntoamateProject } from '../lib/supabase'

// ==================== CONSTANTS ====================

const TRIGGER_OPTIONS: { value: TriggerType; label: string; description: string }[] = [
  { value: 'meeting_completed', label: 'Meeting Completed', description: 'When a meeting is processed' },
  { value: 'action_item_created', label: 'Action Items Created', description: 'When action items are extracted' },
  { value: 'high_priority_detected', label: 'High Priority Detected', description: 'When high priority items found' },
  { value: 'keyword_detected', label: 'Keyword Detected', description: 'When specific keywords in transcript' },
  { value: 'sentiment_negative', label: 'Negative Sentiment', description: 'When sentiment score is low' }
]

const ACTION_OPTIONS: { value: ActionType; label: string; description: string }[] = [
  { value: 'sync_to_crm', label: 'Sync to CRM', description: 'Sync action items to Logos Vision' },
  { value: 'post_to_pulse', label: 'Post to Pulse', description: 'Post summary to Pulse chat' },
  { value: 'notify_team', label: 'Notify Team', description: 'Send Pulse notifications' },
  { value: 'create_project_tasks', label: 'Create Project Tasks', description: 'Add tasks to a project' },
  { value: 'webhook', label: 'Call Webhook', description: 'Send data to external URL' }
]

// ==================== COMPONENT ====================

export const AutomationsView: React.FC = () => {
  // State
  const [automations, setAutomations] = useState<EntoamateAutomation[]>([])
  const [projects, setProjects] = useState<EntoamateProject[]>([])
  const [loading, setLoading] = useState(true)
  const [showCreateForm, setShowCreateForm] = useState(false)
  const [showPresets, setShowPresets] = useState(false)
  const [editingAutomation, setEditingAutomation] = useState<EntoamateAutomation | null>(null)

  // Form state
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    trigger_type: 'meeting_completed' as TriggerType,
    trigger_config: {} as Record<string, any>,
    actions: [{ type: 'sync_to_crm' as ActionType, config: {} }]
  })

  // ==================== EFFECTS ====================

  useEffect(() => {
    loadData()
  }, [])

  // ==================== DATA LOADING ====================

  const loadData = async () => {
    setLoading(true)
    const [automationsData, projectsData] = await Promise.all([
      getAutomations(),
      getProjects()
    ])
    setAutomations(automationsData)
    setProjects(projectsData)
    setLoading(false)
  }

  // ==================== ACTIONS ====================

  const handleCreate = async () => {
    if (!formData.name.trim()) return

    const newAutomation = await createAutomation({
      name: formData.name,
      description: formData.description,
      trigger_type: formData.trigger_type,
      trigger_config: formData.trigger_config,
      actions: formData.actions
    })

    if (newAutomation) {
      setAutomations([newAutomation, ...automations])
      resetForm()
    }
  }

  const handleUpdate = async () => {
    if (!editingAutomation || !formData.name.trim()) return

    const updated = await updateAutomation(editingAutomation.id, {
      name: formData.name,
      description: formData.description,
      trigger_type: formData.trigger_type,
      trigger_config: formData.trigger_config,
      actions: formData.actions
    })

    if (updated) {
      setAutomations(automations.map(a => a.id === updated.id ? updated : a))
      resetForm()
    }
  }

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this automation?')) return

    const success = await deleteAutomation(id)
    if (success) {
      setAutomations(automations.filter(a => a.id !== id))
    }
  }

  const handleToggle = async (id: string, isActive: boolean) => {
    const success = await toggleAutomation(id, isActive)
    if (success) {
      setAutomations(automations.map(a =>
        a.id === id ? { ...a, is_active: isActive } : a
      ))
    }
  }

  const handleCreatePreset = async (index: number) => {
    const newAutomation = await createPresetAutomation(index)
    if (newAutomation) {
      setAutomations([newAutomation, ...automations])
      setShowPresets(false)
    }
  }

  const startEdit = (automation: EntoamateAutomation) => {
    setEditingAutomation(automation)
    setFormData({
      name: automation.name,
      description: automation.description || '',
      trigger_type: automation.trigger_type as TriggerType,
      trigger_config: automation.trigger_config,
      actions: automation.actions as any[]
    })
    setShowCreateForm(true)
  }

  const resetForm = () => {
    setFormData({
      name: '',
      description: '',
      trigger_type: 'meeting_completed',
      trigger_config: {},
      actions: [{ type: 'sync_to_crm', config: {} }]
    })
    setEditingAutomation(null)
    setShowCreateForm(false)
  }

  // ==================== FORM HELPERS ====================

  const addAction = () => {
    setFormData({
      ...formData,
      actions: [...formData.actions, { type: 'sync_to_crm', config: {} }]
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
      trigger_config: { ...formData.trigger_config, [key]: value }
    })
  }

  // ==================== RENDER ====================

  return (
    <div className="flex flex-col h-full gap-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold">Automations</h2>
          <p className="text-gray-500 text-sm">Automate actions based on meeting events</p>
        </div>

        <div className="flex gap-3">
          <button
            onClick={() => setShowPresets(true)}
            className="px-4 py-2 border border-gray-200 rounded-full text-sm hover:border-gray-300 flex items-center gap-2"
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polygon points="12 2 2 7 12 12 22 7 12 2"></polygon><polyline points="2 17 12 22 22 17"></polyline><polyline points="2 12 12 17 22 12"></polyline></svg>
            Presets
          </button>
          <button
            onClick={() => { resetForm(); setShowCreateForm(true) }}
            className="px-4 py-2 bg-[#2563EB] text-white rounded-full font-bold flex items-center gap-2"
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line></svg>
            New Automation
          </button>
        </div>
      </div>

      {/* Presets Modal */}
      {showPresets && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-2xl p-6 max-w-lg w-full mx-4">
            <div className="flex justify-between items-center mb-4">
              <h3 className="font-bold text-lg">Preset Automations</h3>
              <button onClick={() => setShowPresets(false)} className="text-gray-400 hover:text-gray-600">
                <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
              </button>
            </div>
            <div className="space-y-3">
              {PRESET_AUTOMATIONS.map((preset, index) => (
                <div
                  key={index}
                  className="p-4 border border-gray-100 rounded-xl hover:border-gray-300 cursor-pointer transition-colors"
                  onClick={() => handleCreatePreset(index)}
                >
                  <h4 className="font-medium">{preset.name}</h4>
                  <p className="text-sm text-gray-500">{preset.description}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Create/Edit Form */}
      {showCreateForm && (
        <div className="bg-white border border-gray-100 rounded-2xl p-6">
          <div className="flex justify-between items-center mb-4">
            <h3 className="font-bold">{editingAutomation ? 'Edit Automation' : 'Create Automation'}</h3>
            <button onClick={resetForm} className="text-gray-400 hover:text-gray-600">
              <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
            </button>
          </div>

          <div className="space-y-4">
            {/* Name */}
            <div>
              <label className="block text-xs font-bold text-gray-500 mb-2">Name *</label>
              <input
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder="My Automation"
                className="w-full border rounded-xl p-3 focus:ring-1 focus:ring-[#2563EB] outline-none"
              />
            </div>

            {/* Description */}
            <div>
              <label className="block text-xs font-bold text-gray-500 mb-2">Description</label>
              <input
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                placeholder="What does this automation do?"
                className="w-full border rounded-xl p-3 focus:ring-1 focus:ring-[#2563EB] outline-none"
              />
            </div>

            {/* Trigger */}
            <div>
              <label className="block text-xs font-bold text-gray-500 mb-2">When this happens (Trigger)</label>
              <select
                value={formData.trigger_type}
                onChange={(e) => setFormData({ ...formData, trigger_type: e.target.value as TriggerType, trigger_config: {} })}
                className="w-full border rounded-xl p-3 focus:ring-1 focus:ring-[#2563EB] outline-none"
              >
                {TRIGGER_OPTIONS.map(opt => (
                  <option key={opt.value} value={opt.value}>{opt.label} - {opt.description}</option>
                ))}
              </select>

              {/* Trigger-specific config */}
              {formData.trigger_type === 'keyword_detected' && (
                <div className="mt-3">
                  <input
                    value={formData.trigger_config.keywords?.join(', ') || ''}
                    onChange={(e) => updateTriggerConfig('keywords', e.target.value.split(',').map(s => s.trim()).filter(Boolean))}
                    placeholder="Keywords (comma-separated): budget, deadline, urgent"
                    className="w-full border rounded-xl p-3 focus:ring-1 focus:ring-[#2563EB] outline-none"
                  />
                </div>
              )}

              {formData.trigger_type === 'sentiment_negative' && (
                <div className="mt-3">
                  <label className="block text-xs text-gray-400 mb-1">Sentiment threshold (0-1, lower = more negative)</label>
                  <input
                    type="number"
                    min="0"
                    max="1"
                    step="0.1"
                    value={formData.trigger_config.sentiment_threshold ?? 0.3}
                    onChange={(e) => updateTriggerConfig('sentiment_threshold', parseFloat(e.target.value))}
                    className="w-full border rounded-xl p-3 focus:ring-1 focus:ring-[#2563EB] outline-none"
                  />
                </div>
              )}
            </div>

            {/* Actions */}
            <div>
              <div className="flex justify-between items-center mb-2">
                <label className="block text-xs font-bold text-gray-500">Do this (Actions)</label>
                <button
                  onClick={addAction}
                  className="text-xs text-[#2563EB] font-bold"
                >
                  + Add Action
                </button>
              </div>

              <div className="space-y-3">
                {formData.actions.map((action, index) => (
                  <div key={index} className="p-3 bg-gray-50 rounded-xl">
                    <div className="flex gap-3 items-start">
                      <select
                        value={action.type}
                        onChange={(e) => updateAction(index, { type: e.target.value as ActionType, config: {} })}
                        className="flex-1 border rounded-lg p-2 text-sm focus:ring-1 focus:ring-[#2563EB] outline-none"
                      >
                        {ACTION_OPTIONS.map(opt => (
                          <option key={opt.value} value={opt.value}>{opt.label}</option>
                        ))}
                      </select>

                      {formData.actions.length > 1 && (
                        <button
                          onClick={() => removeAction(index)}
                          className="text-gray-400 hover:text-red-500"
                        >
                          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>
                        </button>
                      )}
                    </div>

                    {/* Action-specific config */}
                    {action.type === 'create_project_tasks' && (
                      <div className="mt-2">
                        <select
                          value={action.config?.project_id || ''}
                          onChange={(e) => updateAction(index, { config: { ...action.config, project_id: e.target.value } })}
                          className="w-full border rounded-lg p-2 text-sm focus:ring-1 focus:ring-[#2563EB] outline-none"
                        >
                          <option value="">Select project...</option>
                          {projects.map(p => (
                            <option key={p.id} value={p.id}>{p.name}</option>
                          ))}
                        </select>
                      </div>
                    )}

                    {action.type === 'webhook' && (
                      <div className="mt-2">
                        <input
                          value={action.config?.webhook_url || ''}
                          onChange={(e) => updateAction(index, { config: { ...action.config, webhook_url: e.target.value } })}
                          placeholder="https://example.com/webhook"
                          className="w-full border rounded-lg p-2 text-sm focus:ring-1 focus:ring-[#2563EB] outline-none"
                        />
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>

            {/* Submit */}
            <div className="flex justify-end gap-3 pt-4">
              <button onClick={resetForm} className="px-6 py-2 text-gray-500 hover:text-gray-700">
                Cancel
              </button>
              <button
                onClick={editingAutomation ? handleUpdate : handleCreate}
                disabled={!formData.name.trim()}
                className="px-6 py-2 bg-[#2563EB] text-white rounded-full font-bold disabled:opacity-50"
              >
                {editingAutomation ? 'Update' : 'Create'}
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
        <div className="bg-white border border-gray-100 rounded-2xl p-12 text-center">
          <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#999" strokeWidth="2"><path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z"></path></svg>
          </div>
          <h3 className="font-bold text-lg mb-2">No automations yet</h3>
          <p className="text-gray-400 mb-6">Create automations to run actions automatically when meetings are processed</p>
          <div className="flex justify-center gap-3">
            <button
              onClick={() => setShowPresets(true)}
              className="px-4 py-2 border border-gray-200 rounded-full text-sm hover:border-gray-300"
            >
              Use a Preset
            </button>
            <button
              onClick={() => setShowCreateForm(true)}
              className="px-4 py-2 bg-[#2563EB] text-white rounded-full text-sm font-bold"
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
              className={`bg-white border rounded-2xl p-5 transition-all ${
                automation.is_active ? 'border-gray-100' : 'border-gray-100 opacity-60'
              }`}
            >
              <div className="flex justify-between items-start">
                <div className="flex-1">
                  <div className="flex items-center gap-3 mb-2">
                    <h3 className="font-bold">{automation.name}</h3>
                    <span className={`px-2 py-0.5 rounded text-xs font-bold ${
                      automation.is_active ? 'bg-green-100 text-green-600' : 'bg-gray-100 text-gray-500'
                    }`}>
                      {automation.is_active ? 'Active' : 'Paused'}
                    </span>
                  </div>
                  {automation.description && (
                    <p className="text-gray-500 text-sm mb-3">{automation.description}</p>
                  )}

                  <div className="flex flex-wrap gap-2 text-xs">
                    <span className="px-2 py-1 bg-blue-50 text-blue-600 rounded">
                      Trigger: {TRIGGER_OPTIONS.find(t => t.value === automation.trigger_type)?.label || automation.trigger_type}
                    </span>
                    {automation.actions.map((action: any, i: number) => (
                      <span key={i} className="px-2 py-1 bg-purple-50 text-purple-600 rounded">
                        {ACTION_OPTIONS.find(a => a.value === action.type)?.label || action.type}
                      </span>
                    ))}
                  </div>

                  {automation.run_count > 0 && (
                    <p className="text-xs text-gray-400 mt-3">
                      Ran {automation.run_count} time{automation.run_count !== 1 ? 's' : ''}
                      {automation.last_run_at && ` • Last: ${new Date(automation.last_run_at).toLocaleDateString()}`}
                    </p>
                  )}
                </div>

                <div className="flex items-center gap-2">
                  {/* Toggle */}
                  <button
                    onClick={() => handleToggle(automation.id, !automation.is_active)}
                    className={`w-12 h-6 rounded-full transition-colors relative ${
                      automation.is_active ? 'bg-[#2563EB]' : 'bg-gray-300'
                    }`}
                  >
                    <div className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-transform ${
                      automation.is_active ? 'left-7' : 'left-1'
                    }`}></div>
                  </button>

                  {/* Edit */}
                  <button
                    onClick={() => startEdit(automation)}
                    className="p-2 text-gray-400 hover:text-gray-600"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path></svg>
                  </button>

                  {/* Delete */}
                  <button
                    onClick={() => handleDelete(automation.id)}
                    className="p-2 text-gray-400 hover:text-red-500"
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
