import React, { useId, useState } from 'react'
import { meetingsApi } from '../../services/api'
import type { TaskActionRow, WorkItem } from '../../services/tasksView'
import { Drawer, Key, TextArea, TextInput } from '../bench'

type Changes = Partial<Pick<TaskActionRow, 'task_description' | 'assigned_to_name' | 'assigned_to_email' | 'due_date'>>

export default function ActionItemEdit({ item, onSaved, onClose }: {
  item: WorkItem
  onSaved: (item: TaskActionRow) => void
  onClose: () => void
}) {
  const formId = useId()
  // Compare against the version that opened the editor, even if the parent refreshes.
  const [original] = useState(item)
  const [title, setTitle] = useState(item.title)
  const [owner, setOwner] = useState(item.owner ?? '')
  const [emailDraft, setEmailDraft] = useState<string | null>(null)
  const [due, setDue] = useState(item.due ?? '')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [conflict, setConflict] = useState(false)
  const ownerChanged = (owner.trim() || null) !== original.owner
  const email = emailDraft ?? (ownerChanged ? '' : original.ownerEmail ?? '')

  const save = async (event: React.FormEvent) => {
    event.preventDefault()
    if (saving || conflict) return
    if (!title.trim()) { setError('Enter an action item.'); return }

    const changes: Changes = {}
    if (title.trim() !== original.title) changes.task_description = title.trim()
    if (ownerChanged) changes.assigned_to_name = owner.trim() || null
    // Include an explicitly entered email when the owner changes, including a re-entered address.
    if (changes.assigned_to_name !== undefined || (email.trim() || null) !== (original.ownerEmail ?? null)) {
      changes.assigned_to_email = email.trim() || null
    }
    if ((due || null) !== original.due) changes.due_date = due || null
    if (!Object.keys(changes).length) { onClose(); return }

    setSaving(true)
    setError('')
    try {
      const saved = await meetingsApi.updateActionItem(original.id, { ...changes, version: original.updatedAt ?? null }) as unknown as TaskActionRow
      onSaved(saved)
      onClose()
    } catch (cause) {
      const err = cause as Error & { status?: number; originalError?: { response?: { data?: { error?: string; details?: Array<{ message: string }> } } } }
      if (err.status === 409) {
        setConflict(true)
        setError('This action item changed. Copy any edits you want to keep and reload the page before trying again.')
      } else {
        const body = err.originalError?.response?.data
        setError(body?.details?.[0]?.message || body?.error || err.message || 'Could not save the action item.')
      }
    } finally {
      setSaving(false)
    }
  }

  return (
    <Drawer open layer="top" onClose={() => { if (!saving) onClose() }} label="Edit action item">
      <form className="bs-tasks-form" onSubmit={save}>
        <div className="bs-tasks-fl">
          <label className="bs-lbl" htmlFor={`${formId}-title`}>Action item</label>
          <TextArea id={`${formId}-title`} rows={3} required maxLength={4000} disabled={saving} value={title} onChange={(e) => setTitle(e.target.value)} />
        </div>
        <div className="bs-tasks-f2">
          <div className="bs-tasks-fl">
            <label className="bs-lbl" htmlFor={`${formId}-owner`}>Owner</label>
            <TextInput id={`${formId}-owner`} maxLength={255} disabled={saving} value={owner} onChange={(e) => setOwner(e.target.value)} />
          </div>
          <div className="bs-tasks-fl">
            <label className="bs-lbl" htmlFor={`${formId}-due`}>Due date</label>
            <TextInput id={`${formId}-due`} type="date" disabled={saving} value={due} onChange={(e) => setDue(e.target.value)} />
          </div>
        </div>
        <div className="bs-tasks-fl">
          <label className="bs-lbl" htmlFor={`${formId}-email`}>Owner email</label>
          <TextInput id={`${formId}-email`} type="email" maxLength={255} disabled={saving} value={email} onChange={(e) => setEmailDraft(e.target.value)} aria-describedby={`${formId}-email-help`} />
          <p className="bs-mut" id={`${formId}-email-help`}>Optional. Used when someone sends a reminder.</p>
        </div>
        {error && <p className="bs-tasks-err" role="alert">{error}</p>}
        <div className="bs-tasks-keys">
          <Key type="button" disabled={saving} onClick={onClose}>Cancel</Key>
          <Key type="submit" variant="primary" disabled={saving || conflict}>{saving ? 'Saving' : 'Save action item'}</Key>
        </div>
      </form>
    </Drawer>
  )
}
