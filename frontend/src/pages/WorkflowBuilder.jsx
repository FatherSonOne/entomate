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
    // Update local workflow state
    setWorkflow(prev => ({
      ...prev,
      nodes: data.nodes,
      connections: data.edges
    }))
  }

  if (loading) {
    return (
      <div className="h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <Loader2 className="w-8 h-8 text-primary-600 animate-spin mx-auto mb-4" />
          <p className="text-gray-600">Loading workflow...</p>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center max-w-md">
          <AlertCircle className="w-12 h-12 text-red-500 mx-auto mb-4" />
          <h2 className="text-xl font-semibold text-gray-900 mb-2">Failed to Load Workflow</h2>
          <p className="text-gray-600 mb-4">{error}</p>
          <div className="flex gap-2 justify-center">
            <button
              onClick={loadWorkflow}
              className="btn btn-secondary"
            >
              Try Again
            </button>
            <button
              onClick={handleBack}
              className="btn btn-primary"
            >
              Back to Workflows
            </button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="h-screen flex flex-col overflow-hidden">
      {/* Error banner */}
      {saveError && (
        <div className="bg-red-50 border-b border-red-200 px-4 py-2 flex items-center gap-2">
          <AlertCircle className="w-4 h-4 text-red-500" />
          <span className="text-sm text-red-700">{saveError}</span>
          <button
            onClick={() => setSaveError(null)}
            className="ml-auto text-red-500 hover:text-red-700"
          >
            Dismiss
          </button>
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
        />
      </div>
    </div>
  )
}
