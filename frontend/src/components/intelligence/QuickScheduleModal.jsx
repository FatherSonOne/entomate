import React, { useState } from 'react'
import { createPortal } from 'react-dom'
import { Calendar, Clock, X } from 'lucide-react'
import { VCButton, VCInput } from '../vc'
import api from '../../services/api'
import { useToast } from '../vc/ToastProvider'

export default function QuickScheduleModal({ isOpen, onClose, context }) {
  const toast = useToast()
  const [submitting, setSubmitting] = useState(false)
  const [form, setForm] = useState({
    title: context?.title || '',
    date: '',
    time: '09:00',
    duration: 30,
    notes: ''
  })

  if (!isOpen) return null

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!form.date) {
      toast.warning('Required', 'Please select a date')
      return
    }

    setSubmitting(true)
    try {
      const startTime = new Date(`${form.date}T${form.time}`)
      const endTime = new Date(startTime.getTime() + form.duration * 60000)

      await api.calendar.createEvent({
        summary: form.title,
        start: startTime.toISOString(),
        end: endTime.toISOString(),
        description: form.notes,
        source: 'intelligence_dashboard',
        relatedId: context?.relatedId
      })

      toast.success('Scheduled', `"${form.title}" added to calendar`)
      onClose()
    } catch (err) {
      console.error('Failed to create event:', err)
      toast.error('Error', err.message || 'Failed to create calendar event')
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
            <Calendar className="w-4 h-4 inline-block mr-2 vc-text-warning" />
            Schedule Event
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
          <div className="flex gap-3">
            <div className="flex-1">
              <label className="vform-label">Date</label>
              <VCInput type="date" value={form.date} onChange={e => update('date', e.target.value)} required />
            </div>
            <div style={{ width: 120 }}>
              <label className="vform-label">Time</label>
              <VCInput type="time" value={form.time} onChange={e => update('time', e.target.value)} />
            </div>
          </div>
          <div>
            <label className="vform-label">Duration</label>
            <div className="flex gap-2">
              {[15, 30, 45, 60].map(d => (
                <VCButton
                  key={d}
                  type="button"
                  variant={form.duration === d ? 'primary' : 'ghost'}
                  size="sm"
                  onClick={() => update('duration', d)}
                >
                  {d}m
                </VCButton>
              ))}
            </div>
          </div>
          <div>
            <label className="vform-label">Notes</label>
            <textarea
              className="vinput"
              rows={2}
              value={form.notes}
              onChange={e => update('notes', e.target.value)}
              placeholder="Optional notes..."
            />
          </div>
          <div className="flex gap-3 justify-end pt-2">
            <VCButton type="button" variant="ghost" onClick={onClose}>Cancel</VCButton>
            <VCButton type="submit" variant="primary" disabled={submitting}>
              {submitting ? 'Scheduling...' : 'Schedule'}
            </VCButton>
          </div>
        </form>
      </div>
    </div>,
    document.body
  )
}
