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

export default function WorkflowBuilder() {
  const { id } = useParams()
  const navigate = useNavigate()
  const [workflow, setWorkflow] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [saveError, setSaveError] = useState(null)

  useEffect(() => {
    if (id) {
      loadWorkflow()
    }
  }, [id])

  const loadWorkflow = async () => {
    try {
      setLoading(true)
      setError(null)
      const response = await workflowsApi.get(id)
      setWorkflow(response.workflow)
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
      const response = await workflowsApi.update(id, {
        name: workflow.name,
        description: workflow.description,
        nodes: data.nodes,
        connections: data.connections,
        settings: workflow.settings
      })
      setWorkflow(response.workflow)
      return response.workflow
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
      navigate(`/workflows/${response.workflow.id}`)
    } catch (err) {
      console.error('Failed to duplicate workflow:', err)
    }
  }

  const handleDelete = async () => {
    if (!window.confirm(`Delete "${workflow.name}"? This cannot be undone.`)) return
    try {
      await workflowsApi.delete(id)
      navigate('/workflows')
    } catch (err) {
      console.error('Failed to delete workflow:', err)
    }
  }

  if (loading) {
    return (
      <div
        className="h-screen flex items-center justify-center"
        style={{ background: 'var(--bg0, #080808)' }}
      >
        <div className="vc text-center" style={{ padding: '2rem 3rem' }}>
          <Loader2
            className="w-8 h-8 animate-spin mx-auto mb-4"
            style={{ color: 'var(--accent-primary, #FF2D6B)' }}
          />
          <p style={{ color: 'var(--text-secondary)', margin: 0 }}>Loading workflow...</p>
        </div>
      </div>
    )
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

  return (
    <div className="h-screen flex flex-col overflow-hidden" style={{ background: 'var(--bg0, #080808)' }}>
      {/* Error banner */}
      {saveError && (
        <div style={{
          background: 'rgba(255,45,107,.10)',
          borderBottom: '1px solid rgba(255,45,107,.40)',
          padding: '8px 16px',
          display: 'flex',
          alignItems: 'center',
          gap: 8,
        }}>
          <AlertCircle className="w-4 h-4" style={{ color: 'var(--accent-primary, #FF2D6B)', flexShrink: 0 }} />
          <span style={{ fontSize: 14, color: 'var(--accent-primary, #FF2D6B)', flex: 1 }}>{saveError}</span>
          <VCButton variant="ghost" size="sm" onClick={() => setSaveError(null)}>
            Dismiss
          </VCButton>
        </div>
      )}

      {/* Canvas */}
      <div className="flex-1 overflow-hidden">
        <WorkflowCanvas
          workflow={workflow}
          onSave={handleSave}
          onExecute={handleExecute}
          onTest={handleTest}
          onBack={handleBack}
          onChange={handleChange}
          onToggleActive={handleToggleActive}
          onDuplicate={handleDuplicate}
          onDelete={handleDelete}
        />
      </div>
    </div>
  )
}
