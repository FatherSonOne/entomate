import React, { useState, useEffect } from 'react'
import { createPortal } from 'react-dom'
import { X, Clock, TrendingUp, Plus, CheckCircle2, Circle, Trash2, ChevronDown, ChevronUp } from 'lucide-react'
import { tasksApi } from '../services/api'
import { VCButton, VCBadge } from './vc'
import { useToast } from './vc/ToastProvider'

const STATUS_OPTIONS = [
  { value: 'open', label: 'Open' },
  { value: 'in_progress', label: 'In Progress' },
  { value: 'review', label: 'Review' },
  { value: 'done', label: 'Done' },
  { value: 'blocked', label: 'Blocked' }
]

const PRIORITY_OPTIONS = [
  { value: 'high', label: 'High' },
  { value: 'medium', label: 'Medium' },
  { value: 'low', label: 'Low' }
]

const CONFIDENCE_COLORS = { high: 'mint', medium: 'amber', low: 'crimson' }

export default function TaskEditModal({ task, onClose, onSaved }) {
  const toast = useToast()
  const [saving, setSaving] = useState(false)
  const [eta, setEta] = useState(null)
  const [etaLoading, setEtaLoading] = useState(false)
  const [subtasks, setSubtasks] = useState([])
  const [subtasksLoading, setSubtasksLoading] = useState(false)
  const [newSubtaskTitle, setNewSubtaskTitle] = useState('')
  const [addingSubtask, setAddingSubtask] = useState(false)
  const [showSubtasks, setShowSubtasks] = useState(true)
  const [form, setForm] = useState({
    title: task.title || '',
    description: task.description || '',
    status: task.status || 'open',
    priority: task.priority || 'medium',
    assigned_to: task.assigned_to || '',
    due_date: task.due_date ? task.due_date.slice(0, 10) : '',
    start_date: task.start_date ? task.start_date.slice(0, 10) : '',
    tags: (task.tags || []).join(', ')
  })

  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  // Fetch ETA prediction
  useEffect(() => {
    if (task.status === 'done') return
    let cancelled = false

    const fetchEta = async () => {
      try {
        setEtaLoading(true)
        const data = await tasksApi.getEta(task.id)
        if (!cancelled && data.success) {
          setEta(data.prediction)
        }
      } catch (err) {
        console.debug('ETA fetch failed:', err.message)
      } finally {
        if (!cancelled) setEtaLoading(false)
      }
    }

    fetchEta()
    return () => { cancelled = true }
  }, [task.id, task.status])

  // Fetch subtasks
  useEffect(() => {
    let cancelled = false

    const fetchSubtasks = async () => {
      try {
        setSubtasksLoading(true)
        const data = await tasksApi.get(task.id)
        if (!cancelled && data.subtasks) {
          setSubtasks(data.subtasks)
        }
      } catch (err) {
        console.debug('Subtasks fetch failed:', err.message)
      } finally {
        if (!cancelled) setSubtasksLoading(false)
      }
    }

    fetchSubtasks()
    return () => { cancelled = true }
  }, [task.id])

  const handleSave = async (e) => {
    e.preventDefault()
    if (!form.title.trim()) {
      toast.error('Error', 'Title is required')
      return
    }

    try {
      setSaving(true)
      const updates = {
        title: form.title,
        description: form.description || null,
        status: form.status,
        priority: form.priority,
        assigned_to: form.assigned_to || null,
        due_date: form.due_date || null,
        start_date: form.start_date || null,
        tags: form.tags ? form.tags.split(',').map(t => t.trim()).filter(Boolean) : []
      }
      await tasksApi.update(task.id, updates)
      toast.success('Updated', 'Task updated successfully')
      onSaved()
    } catch (error) {
      console.error('Failed to update task:', error)
      toast.error('Error', error.message || 'Failed to update task')
    } finally {
      setSaving(false)
    }
  }

  const handleAddSubtask = async () => {
    if (!newSubtaskTitle.trim()) return

    try {
      setAddingSubtask(true)
      await tasksApi.create({
        title: newSubtaskTitle,
        parentTaskId: task.id,
        priority: task.priority
      })
      setNewSubtaskTitle('')
      // Refresh subtasks
      const data = await tasksApi.get(task.id)
      setSubtasks(data.subtasks || [])
      toast.success('Added', 'Subtask created')
    } catch (err) {
      console.error('Failed to create subtask:', err)
      toast.error('Error', 'Failed to create subtask')
    } finally {
      setAddingSubtask(false)
    }
  }

  const handleToggleSubtask = async (subtask) => {
    try {
      if (subtask.status === 'done') {
        await tasksApi.reopen(subtask.id)
      } else {
        await tasksApi.complete(subtask.id)
      }
      const data = await tasksApi.get(task.id)
      setSubtasks(data.subtasks || [])
    } catch (err) {
      toast.error('Error', 'Failed to update subtask')
    }
  }

  const handleDeleteSubtask = async (subtaskId) => {
    try {
      await tasksApi.delete(subtaskId)
      setSubtasks(subtasks.filter(s => s.id !== subtaskId))
    } catch (err) {
      toast.error('Error', 'Failed to delete subtask')
    }
  }

  const update = (field, value) => setForm(f => ({ ...f, [field]: value }))

  const completedSubtasks = subtasks.filter(s => s.status === 'done').length
  const subtaskProgress = subtasks.length > 0 ? Math.round((completedSubtasks / subtasks.length) * 100) : 0

  return createPortal(
    <div className="vc-confirm-overlay" onClick={onClose}>
      <div
        className="vc"
        onClick={e => e.stopPropagation()}
        style={{
          width: '100%',
          maxWidth: 600,
          maxHeight: '90vh',
          overflowY: 'auto',
          borderRadius: 12,
          padding: 0
        }}
      >
        {/* Header */}
        <div
          className="flex items-center justify-between p-5 border-b"
          style={{ borderColor: 'var(--b1)' }}
        >
          <h2
            className="text-lg font-bold"
            style={{ fontFamily: 'var(--font-display)', color: 'var(--text-primary)' }}
          >
            Edit Task
          </h2>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg transition-colors"
            style={{ color: 'var(--text-tertiary)' }}
          >
            <X size={20} />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSave} className="p-5 space-y-4">
          <div>
            <label className="label">Title</label>
            <input
              type="text"
              className="input"
              value={form.title}
              onChange={(e) => update('title', e.target.value)}
              required
            />
          </div>

          <div>
            <label className="label">Description</label>
            <textarea
              className="input"
              value={form.description}
              onChange={(e) => update('description', e.target.value)}
              rows={3}
              placeholder="Add details..."
              style={{ resize: 'vertical', minHeight: 60 }}
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="label">Status</label>
              <select
                className="input"
                value={form.status}
                onChange={(e) => update('status', e.target.value)}
              >
                {STATUS_OPTIONS.map(opt => (
                  <option key={opt.value} value={opt.value}>{opt.label}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="label">Priority</label>
              <select
                className="input"
                value={form.priority}
                onChange={(e) => update('priority', e.target.value)}
              >
                {PRIORITY_OPTIONS.map(opt => (
                  <option key={opt.value} value={opt.value}>{opt.label}</option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="label">Start Date</label>
              <input
                type="date"
                className="input"
                value={form.start_date}
                onChange={(e) => update('start_date', e.target.value)}
              />
            </div>
            <div>
              <label className="label">Due Date</label>
              <input
                type="date"
                className="input"
                value={form.due_date}
                onChange={(e) => update('due_date', e.target.value)}
              />
            </div>
          </div>

          <div>
            <label className="label">Tags</label>
            <input
              type="text"
              className="input"
              placeholder="Comma-separated tags"
              value={form.tags}
              onChange={(e) => update('tags', e.target.value)}
            />
            {form.tags && (
              <div className="flex flex-wrap gap-1 mt-2">
                {form.tags.split(',').map(t => t.trim()).filter(Boolean).map((tag, i) => (
                  <VCBadge key={i} color="neutral">{tag}</VCBadge>
                ))}
              </div>
            )}
          </div>

          {/* Subtasks Section */}
          <div
            className="rounded-lg border"
            style={{ borderColor: 'var(--b1)' }}
          >
            <button
              type="button"
              onClick={() => setShowSubtasks(!showSubtasks)}
              className="w-full flex items-center justify-between p-3 text-left"
              style={{ color: 'var(--text-primary)' }}
            >
              <div className="flex items-center gap-2">
                <span className="label" style={{ margin: 0 }}>
                  Subtasks
                </span>
                {subtasks.length > 0 && (
                  <span
                    className="text-xs px-1.5 py-0.5 rounded"
                    style={{ background: 'var(--b1)', color: 'var(--text-tertiary)', fontFamily: 'var(--font-mono)' }}
                  >
                    {completedSubtasks}/{subtasks.length}
                  </span>
                )}
              </div>
              {showSubtasks ? <ChevronUp size={16} style={{ color: 'var(--text-tertiary)' }} /> : <ChevronDown size={16} style={{ color: 'var(--text-tertiary)' }} />}
            </button>

            {showSubtasks && (
              <div className="px-3 pb-3">
                {/* Progress bar */}
                {subtasks.length > 0 && (
                  <div
                    className="h-1.5 rounded-full mb-3 overflow-hidden"
                    style={{ background: 'var(--b1)' }}
                  >
                    <div
                      className="h-full rounded-full transition-all"
                      style={{
                        width: `${subtaskProgress}%`,
                        background: subtaskProgress === 100 ? 'var(--m)' : 'var(--accent-primary)'
                      }}
                    />
                  </div>
                )}

                {/* Subtask list */}
                {subtasksLoading ? (
                  <div className="text-xs text-center py-2" style={{ color: 'var(--text-tertiary)' }}>Loading...</div>
                ) : (
                  <div className="space-y-1">
                    {subtasks.map((sub) => (
                      <div
                        key={sub.id}
                        className="flex items-center gap-2 py-1.5 group"
                      >
                        <button
                          type="button"
                          onClick={() => handleToggleSubtask(sub)}
                          className="flex-shrink-0"
                          style={{ color: sub.status === 'done' ? 'var(--m)' : 'var(--text-tertiary)' }}
                        >
                          {sub.status === 'done' ? <CheckCircle2 size={16} /> : <Circle size={16} />}
                        </button>
                        <span
                          className={`text-sm flex-1 ${sub.status === 'done' ? 'line-through' : ''}`}
                          style={{ color: sub.status === 'done' ? 'var(--text-tertiary)' : 'var(--text-primary)' }}
                        >
                          {sub.title}
                        </span>
                        <button
                          type="button"
                          onClick={() => handleDeleteSubtask(sub.id)}
                          className="opacity-0 group-hover:opacity-100 transition-opacity p-1"
                          style={{ color: 'var(--text-tertiary)' }}
                        >
                          <Trash2 size={12} />
                        </button>
                      </div>
                    ))}
                  </div>
                )}

                {/* Add subtask */}
                <div className="flex gap-2 mt-2">
                  <input
                    type="text"
                    className="input flex-1"
                    placeholder="Add subtask..."
                    value={newSubtaskTitle}
                    onChange={(e) => setNewSubtaskTitle(e.target.value)}
                    onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); handleAddSubtask() } }}
                    style={{ fontSize: 13, padding: '6px 10px' }}
                  />
                  <VCButton
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={handleAddSubtask}
                    disabled={addingSubtask || !newSubtaskTitle.trim()}
                  >
                    <Plus size={14} />
                  </VCButton>
                </div>
              </div>
            )}
          </div>

          {/* AI ETA Prediction */}
          {eta && !eta.isCompleted && (
            <div
              className="rounded-lg p-4 border"
              style={{ background: 'var(--b0)', borderColor: 'var(--b1)' }}
            >
              <div className="flex items-center gap-2 mb-2">
                <TrendingUp size={16} style={{ color: 'var(--accent-primary)' }} />
                <span
                  className="text-sm font-medium"
                  style={{ color: 'var(--text-primary)', fontFamily: 'var(--font-display)' }}
                >
                  AI Completion Estimate
                </span>
                <VCBadge color={CONFIDENCE_COLORS[eta.confidence] || 'neutral'}>
                  {eta.confidence}
                </VCBadge>
              </div>
              <div className="flex items-center gap-2 mb-1">
                <Clock size={14} style={{ color: 'var(--text-tertiary)' }} />
                <span
                  className="text-sm font-medium"
                  style={{ color: 'var(--text-primary)', fontFamily: 'var(--font-mono)' }}
                >
                  {new Date(eta.predictedCompletionDate).toLocaleDateString(undefined, {
                    weekday: 'short', month: 'short', day: 'numeric', year: 'numeric'
                  })}
                </span>
              </div>
              <p className="text-xs mt-1" style={{ color: 'var(--text-tertiary)' }}>
                {eta.explanation}
              </p>
            </div>
          )}

          {etaLoading && (
            <div className="text-xs text-center py-2" style={{ color: 'var(--text-tertiary)' }}>
              Computing ETA prediction...
            </div>
          )}

          {/* Meta info */}
          <div
            className="text-xs pt-3 border-t flex flex-wrap gap-4"
            style={{ color: 'var(--text-tertiary)', borderColor: 'var(--b1)', fontFamily: 'var(--font-mono)' }}
          >
            {task.created_at && <span>Created: {new Date(task.created_at).toLocaleDateString()}</span>}
            {task.completed_at && <span>Completed: {new Date(task.completed_at).toLocaleDateString()}</span>}
            {task.project_id && <span>Project: {task.project_id.slice(0, 8)}...</span>}
          </div>

          {/* Actions */}
          <div className="flex gap-3 pt-2">
            <VCButton type="submit" variant="primary" disabled={saving}>
              {saving ? 'Saving...' : 'Save Changes'}
            </VCButton>
            <VCButton type="button" variant="ghost" onClick={onClose}>
              Cancel
            </VCButton>
          </div>
        </form>
      </div>
    </div>,
    document.body
  )
}
