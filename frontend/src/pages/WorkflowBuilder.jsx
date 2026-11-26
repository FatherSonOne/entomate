/**
 * WorkflowBuilder Page
 *
 * Visual workflow editor for a single workflow
 */

import React, { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { AlertCircle, Loader2 } from 'lucide-react'
import { workflowsApi } from '../services/api'
import WorkflowCanvas from '../components/workflow/WorkflowCanvas'
import { VCButton, VCBadge } from '../components/vc'
import { useConfirm } from '../components/vc/ConfirmDialog'
import { FullPageLoader } from '../components/EntoLoader'

const blankWorkflow = () => ({
  name: 'New automation',
  description: '',
  nodes: [{ id: 'trigger', type: 'trigger', subtype: 'meeting_processed', position: { x: 100, y: 100 }, config: {} }],
  connections: [],
  active: false,
})

export default function WorkflowBuilder() {
  const { id } = useParams()
  const draft = id === 'new'
  const navigate = useNavigate()
  const confirm = useConfirm()
  const [workflow, setWorkflow] = useState(() => draft ? blankWorkflow() : null)
  const [loading, setLoading] = useState(!draft)
  const [error, setError] = useState(null)
  const [saveError, setSaveError] = useState(null)

  useEffect(() => {
    if (draft) {
      setWorkflow(blankWorkflow())
      setLoading(false)
      setError(null)
      setSaveError(null)
      return
    }
    if (id) {
      loadWorkflow()
    }
  }, [id, draft])

  const loadWorkflow = async () => {
    try {
      setLoading(true)
      setError(null)
      const response = await workflowsApi.get(id)
      setWorkflow(response.data)
    } catch (err) {
      console.error('Failed to load workflow:', err)
      setError(err.message || 'Failed to load workflow')
    } finally {
      setLoading(false)
    }
  }

  const handleSave = async (data) => {
    try {
      setSaveError(null)
      const payload = {
        name: workflow.name,
        description: workflow.description,
        nodes: data.nodes,
        connections: data.connections,
        settings: workflow.settings,
      }
      const response = draft
        ? await workflowsApi.create({ ...payload, active: false }, { skipRetry: true })
        : await workflowsApi.update(id, payload)
      setWorkflow(response.data)
      if (draft) navigate(`/workflows/${response.data.id}`, { replace: true })
      return response.data
    } catch (err) {
      console.error('Failed to save workflow:', err)
      setSaveError(err.message || 'Failed to save workflow')
      throw err
    }
  }

  const handleExecute = async () => {
    try {
      const response = await workflowsApi.execute(id)
      console.log('Execution result:', response)
      return response
    } catch (err) {
      console.error('Failed to execute workflow:', err)
      throw err
    }
  }

  const handleTest = async () => {
    try {
      const response = await workflowsApi.test(id)
      console.log('Test result:', response)
      return response
    } catch (err) {
      console.error('Failed to test workflow:', err)
      throw err
    }
  }

  const handleBack = () => {
    navigate('/workflows')
  }

  const handleChange = (data) => {
    setWorkflow(prev => ({
      ...prev,
      nodes: data.nodes,
      connections: data.edges
    }))
  }

  const handleNameChange = async (newName) => {
    if (draft) {
      setWorkflow(prev => ({ ...prev, name: newName }))
      return
    }
    try {
      await workflowsApi.update(id, { name: newName })
      setWorkflow(prev => ({ ...prev, name: newName }))
    } catch (err) {
      console.error('Failed to update workflow name:', err)
    }
  }

  const handleToggleActive = async () => {
    try {
      await workflowsApi.toggle(id, !workflow.active)
      setWorkflow(prev => ({ ...prev, active: !prev.active }))
    } catch (err) {
      console.error('Failed to toggle workflow active state:', err)
    }
  }

  const handleDuplicate = async () => {
    try {
      const response = await workflowsApi.create({
        name: `${workflow.name} (copy)`,
        description: workflow.description,
        nodes: workflow.nodes,
        connections: workflow.connections,
        active: false
      })
      navigate(`/workflows/${response.data.id}`)
    } catch (err) {
      console.error('Failed to duplicate workflow:', err)
    }
  }

  const handleDelete = async () => {
    const ok = await confirm({ title: 'Delete Workflow', message: `Delete "${workflow.name}"? This cannot be undone.`, confirmLabel: 'Delete', variant: 'danger' })
    if (!ok) return
    try {
      await workflowsApi.delete(id)
      navigate('/workflows')
    } catch (err) {
      console.error('Failed to delete workflow:', err)
    }
  }

  if (loading) {
    return <FullPageLoader label="Loading workflow..." />;
  }

  if (error) {
    return (
      <div
        className="h-screen flex items-center justify-center"
        style={{ background: 'var(--bg0, #080808)' }}
      >
        <div className="vc text-center" style={{ maxWidth: 440, padding: '2rem' }}>
          <AlertCircle
            className="w-12 h-12 mx-auto mb-4"
            style={{ color: 'var(--accent-primary, #FF2D6B)' }}
          />
          <h2 style={{
            fontFamily: 'var(--font-display)',
            fontSize: '1.25rem',
            fontWeight: 600,
            color: 'var(--text-primary)',
            marginBottom: 8,
          }}>
            Failed to Load Workflow
          </h2>
          <p style={{ color: 'var(--text-secondary)', marginBottom: 16 }}>{error}</p>
          <div className="flex gap-2 justify-center">
            <VCButton variant="secondary" onClick={loadWorkflow}>
              Try Again
            </VCButton>
            <VCButton variant="primary" onClick={handleBack}>
              Back to Workflows
            </VCButton>
          </div>
        </div>
      </div>
    )
  }

  const notice = saveError && (
    <div className="flex items-center gap-2 rounded-md border border-line-default bg-surface px-4 py-2 text-accent-primary">
      <AlertCircle className="w-4 h-4 shrink-0" aria-hidden="true" />
      <span className="min-w-0 flex-1 break-words text-sm" role="alert">{saveError}</span>
      <VCButton variant="ghost" size="sm" onClick={() => setSaveError(null)}>Dismiss</VCButton>
    </div>
  )

  return (
    <div className="h-dvh flex flex-col overflow-hidden" style={{ background: 'var(--bg0, #080808)' }}>
      {/* Canvas */}
      <div className="flex-1 overflow-hidden">
        <WorkflowCanvas
          key={id}
          draft={draft}
          workflow={workflow}
          onSave={handleSave}
          onExecute={draft ? undefined : handleExecute}
          onTest={draft ? undefined : handleTest}
          onBack={handleBack}
          onChange={handleChange}
          onToggleActive={draft ? undefined : handleToggleActive}
          onDuplicate={draft ? undefined : handleDuplicate}
          onDelete={draft ? undefined : handleDelete}
          onNameChange={handleNameChange}
          notice={notice}
        />
      </div>
    </div>
  )
}
