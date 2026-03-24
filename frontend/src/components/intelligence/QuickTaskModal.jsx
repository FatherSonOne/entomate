import React, { useState } from 'react'
import { createPortal } from 'react-dom'
import { CheckSquare, X } from 'lucide-react'
import { VCButton, VCInput, VCSelect } from '../vc'
import api from '../../services/api'
import { useToast } from '../vc/ToastProvider'

export default function QuickTaskModal({ isOpen, onClose, context }) {
  const toast = useToast()
  const [submitting, setSubmitting] = useState(false)
  const [form, setForm] = useState({
    title: context?.title || '',
    description: context?.description || '',
    priority: context?.priority || 'medium',
    due_date: ''
  })

  if (!isOpen) return null

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!form.title.trim()) {
      toast.warning('Required', 'Please enter a task title')
      return
    }

    setSubmitting(true)
    try {
      await api.tasks.create({
        title: form.title,
        description: form.description,
        priority: form.priority,
        due_date: form.due_date || undefined,
        source: context?.source || 'intelligence_dashboard',
        related_id: context?.relatedId
      })

      toast.success('Created', `Task "${form.title}" created`)
      onClose()
    } catch (err) {
      console.error('Failed to create task:', err)
      toast.error('Error', err.message || 'Failed to create task')
    } finally {
      setSubmitting(false)
    }
  }

  const update = (field, value) => setForm(prev => ({ ...prev, [field]: value }))

  return createPortal(
    <div className="vc-confirm-overlay" onClick={onClose}>
      <div className="vc" style={{ maxWidth: 420, width: '90%', padding: 24 }} onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-5">
          <h3 style={{ fontFamily: 'var(--font)', fontWeight: 700, fontSize: 16, color: 'var(--t0)' }}>
            <CheckSquare className="w-4 h-4 inline-block mr-2 vc-text-success" />
            {context?.type === 'introduction' ? 'Request Introduction' : 'Create Task'}
          </h3>
          <button onClick={onClose} style={{ color: 'var(--t2)', background: 'none', border: 'none', cursor: 'pointer' }}>
            <X className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="vform-label">Title</label>
            <VCInput value={form.title} onChange={e => update('title', e.target.value)} required />
          </div>
          <div>
            <label className="vform-label">Description</label>
            <textarea
              className="vinput"
              rows={3}
              value={form.description}
              onChange={e => update('description', e.target.value)}
              placeholder="What needs to be done..."
            />
          </div>
          <div className="flex gap-3">
            <div className="flex-1">
              <label className="vform-label">Priority</label>
              <VCSelect value={form.priority} onChange={e => update('priority', e.target.value)}>
                <option value="low">Low</option>
                <option value="medium">Medium</option>
                <option value="high">High</option>
              </VCSelect>
            </div>
            <div className="flex-1">
              <label className="vform-label">Due Date</label>
              <VCInput type="date" value={form.due_date} onChange={e => update('due_date', e.target.value)} />
            </div>
          </div>
          <div className="flex gap-3 justify-end pt-2">
            <VCButton type="button" variant="ghost" onClick={onClose}>Cancel</VCButton>
            <VCButton type="submit" variant="primary" disabled={submitting}>
              {submitting ? 'Creating...' : 'Create Task'}
            </VCButton>
          </div>
        </form>
      </div>
    </div>,
    document.body
  )
}
