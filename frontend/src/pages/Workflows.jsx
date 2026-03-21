/**
 * Workflows Page
 *
 * List and manage visual workflows
 */

import React, { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Workflow, Plus, Search, Play, Pause, Trash2, Copy,
  Clock, CheckCircle2, XCircle, MoreVertical,
  History, Zap, AlertCircle, Edit, Mic
} from 'lucide-react'
import { workflowsApi } from '../services/api'

export default function Workflows() {
  const navigate = useNavigate()
  const [workflows, setWorkflows] = useState([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')
  const [filterActive, setFilterActive] = useState('all')
  const [showMenu, setShowMenu] = useState(null)

  useEffect(() => {
    loadWorkflows()
  }, [])

  const loadWorkflows = async () => {
    try {
      setLoading(true)
      const response = await workflowsApi.list()
      setWorkflows(response.workflows || [])
    } catch (error) {
      console.error('Failed to load workflows:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleCreateWorkflow = async () => {
    try {
      const response = await workflowsApi.create({
        name: 'New Workflow',
        description: '',
        nodes: [],
        connections: [],
        active: false
      })
      navigate(`/workflows/${response.workflow.id}`)
    } catch (error) {
      console.error('Failed to create workflow:', error)
    }
  }

  const handleToggleActive = async (id, currentActive, e) => {
    e.stopPropagation()
    try {
      await workflowsApi.toggle(id, !currentActive)
      setWorkflows(workflows.map(w =>
        w.id === id ? { ...w, active: !currentActive } : w
      ))
    } catch (error) {
      console.error('Failed to toggle workflow:', error)
    }
  }

  const handleDuplicate = async (id, e) => {
    e.stopPropagation()
    setShowMenu(null)
    try {
      const original = await workflowsApi.get(id)
      const response = await workflowsApi.create({
        name: `${original.workflow.name} (copy)`,
        description: original.workflow.description,
        nodes: original.workflow.nodes,
        connections: original.workflow.connections,
        active: false
      })
      loadWorkflows()
    } catch (error) {
      console.error('Failed to duplicate workflow:', error)
    }
  }

  const handleDelete = async (id, e) => {
    e.stopPropagation()
    setShowMenu(null)
    if (!window.confirm('Delete this workflow? This cannot be undone.')) return
    try {
      await workflowsApi.delete(id)
      setWorkflows(workflows.filter(w => w.id !== id))
    } catch (error) {
      console.error('Failed to delete workflow:', error)
    }
  }

  const handleExecute = async (id, e) => {
    e.stopPropagation()
    try {
      await workflowsApi.execute(id)
      loadWorkflows()
    } catch (error) {
      console.error('Failed to execute workflow:', error)
    }
  }

  const handleCreateFromTemplate = async (templateName, nodes, connections) => {
    try {
      const response = await workflowsApi.create({
        name: templateName,
        description: '',
        nodes: nodes || [],
        connections: connections || [],
        active: false
      })
      navigate(`/workflows/${response.workflow.id}`)
    } catch (error) {
      console.error('Failed to create workflow from template:', error)
    }
  }

  // Filter workflows
  const filteredWorkflows = workflows.filter(w => {
    const matchesSearch = w.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         (w.description || '').toLowerCase().includes(searchTerm.toLowerCase())
    const matchesFilter = filterActive === 'all' ||
                         (filterActive === 'active' && w.active) ||
                         (filterActive === 'inactive' && !w.active)
    return matchesSearch && matchesFilter
  })

  const getStatusColor = (status) => {
    switch (status) {
      case 'completed': return 'text-semantic-success bg-semantic-success-dim'
      case 'failed': return 'text-semantic-error bg-semantic-error-dim'
      case 'running': return 'text-semantic-info bg-semantic-info-dim'
      default: return 'text-content-secondary bg-surface-muted'
    }
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-content-primary">Workflows</h1>
          <p className="text-content-secondary">Build visual automation workflows with a node-based editor</p>
        </div>
        <button
          onClick={handleCreateWorkflow}
          className="btn btn-primary"
        >
          <Plus className="w-4 h-4" />
          New Workflow
        </button>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-content-tertiary" />
          <input
            type="text"
            placeholder="Search workflows..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-2 border border-line-default rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
          />
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => setFilterActive('all')}
            className={`px-4 py-2 rounded-lg text-sm font-medium ${
              filterActive === 'all'
                ? 'bg-primary-100 text-primary-700'
                : 'bg-surface-muted text-content-secondary hover:bg-surface-muted'
            }`}
          >
            All
          </button>
          <button
            onClick={() => setFilterActive('active')}
            className={`px-4 py-2 rounded-lg text-sm font-medium ${
              filterActive === 'active'
                ? 'bg-semantic-success-dim text-semantic-success'
                : 'bg-surface-muted text-content-secondary hover:bg-surface-muted'
            }`}
          >
            Active
          </button>
          <button
            onClick={() => setFilterActive('inactive')}
            className={`px-4 py-2 rounded-lg text-sm font-medium ${
              filterActive === 'inactive'
                ? 'bg-surface-muted text-content-secondary'
                : 'bg-surface-muted text-content-secondary hover:bg-surface-muted'
            }`}
          >
            Inactive
          </button>
        </div>
      </div>

      {/* Workflows List */}
      <div className="card">
        {loading ? (
          <div className="p-8 text-center">
            <div className="spinner mx-auto mb-4" />
            <p className="text-content-tertiary">Loading workflows...</p>
          </div>
        ) : filteredWorkflows.length === 0 ? (
          <div className="p-8 text-center">
            <Workflow className="w-12 h-12 text-content-muted mx-auto mb-3" />
            <h3 className="text-lg font-medium text-content-primary mb-1">
              {searchTerm ? 'No workflows found' : 'No workflows yet'}
            </h3>
            <p className="text-content-tertiary mb-4">
              {searchTerm
                ? 'Try adjusting your search'
                : 'Create your first visual workflow to automate tasks'
              }
            </p>
            {!searchTerm && (
              <button onClick={handleCreateWorkflow} className="btn btn-primary">
                <Plus className="w-4 h-4" />
                Create Workflow
              </button>
            )}
          </div>
        ) : (
          <div className="divide-y divide-gray-100">
            {filteredWorkflows.map((workflow) => (
              <div
                key={workflow.id}
                onClick={() => navigate(`/workflows/${workflow.id}`)}
                className="p-4 hover:bg-surface-muted cursor-pointer transition-colors"
              >
                <div className="flex items-start gap-4">
                  {/* Icon */}
                  <div className={`w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0 ${
                    workflow.active ? 'bg-semantic-success-dim' : 'bg-surface-muted'
                  }`}>
                    <Workflow className={`w-5 h-5 ${
                      workflow.active ? 'text-semantic-success' : 'text-content-tertiary'
                    }`} />
                  </div>

                  {/* Content */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h3 className="font-medium text-content-primary">{workflow.name}</h3>
                      <span className={`px-2 py-0.5 text-xs rounded-full ${
                        workflow.active
                          ? 'bg-semantic-success-dim text-semantic-success'
                          : 'bg-surface-muted text-content-secondary'
                      }`}>
                        {workflow.active ? 'Active' : 'Inactive'}
                      </span>
                      {workflow.is_template && (
                        <span className="px-2 py-0.5 text-xs bg-semantic-info-dim text-semantic-info rounded-full">
                          Template
                        </span>
                      )}
                    </div>
                    {workflow.description && (
                      <p className="text-sm text-content-tertiary mt-1 line-clamp-1">
                        {workflow.description}
                      </p>
                    )}
                    <div className="flex items-center gap-4 mt-2 text-xs text-content-tertiary flex-wrap">
                      <span className="flex items-center gap-1">
                        <Zap className="w-3 h-3" />
                        {workflow.nodes?.length || 0} nodes
                      </span>
                      {workflow.execution_count > 0 && (
                        <span className="flex items-center gap-1">
                          <CheckCircle2 className="w-3 h-3" />
                          {workflow.execution_count} executions
                        </span>
                      )}
                      {workflow.last_executed_at && (
                        <span className="flex items-center gap-1">
                          <Clock className="w-3 h-3" />
                          Last run: {new Date(workflow.last_executed_at).toLocaleDateString()}
                        </span>
                      )}
                      <span>
                        v{workflow.version || 1}
                      </span>
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-2">
                    <button
                      onClick={(e) => handleToggleActive(workflow.id, workflow.active, e)}
                      className={`p-2 rounded-lg ${
                        workflow.active
                          ? 'text-semantic-success hover:bg-semantic-success-dim'
                          : 'text-content-tertiary hover:bg-surface-muted'
                      }`}
                      title={workflow.active ? 'Deactivate' : 'Activate'}
                    >
                      {workflow.active ? (
                        <Pause className="w-4 h-4" />
                      ) : (
                        <Play className="w-4 h-4" />
                      )}
                    </button>

                    <button
                      onClick={(e) => handleExecute(workflow.id, e)}
                      disabled={!workflow.active}
                      className="p-2 rounded-lg text-semantic-info hover:bg-semantic-info-dim disabled:opacity-50 disabled:cursor-not-allowed"
                      title="Execute now"
                    >
                      <Zap className="w-4 h-4" />
                    </button>

                    <div className="relative">
                      <button
                        onClick={(e) => { e.stopPropagation(); setShowMenu(showMenu === workflow.id ? null : workflow.id); }}
                        className="p-2 rounded-lg text-content-tertiary hover:bg-surface-muted"
                      >
                        <MoreVertical className="w-4 h-4" />
                      </button>

                      {showMenu === workflow.id && (
                        <>
                          <div
                            className="fixed inset-0 z-10"
                            onClick={(e) => { e.stopPropagation(); setShowMenu(null); }}
                          />
                          <div className="absolute right-0 top-full mt-1 w-40 bg-surface border border-line-default rounded-lg shadow-lg py-1 z-20">
                            <button
                              onClick={(e) => { e.stopPropagation(); navigate(`/workflows/${workflow.id}`); setShowMenu(null); }}
                              className="w-full flex items-center gap-2 px-3 py-2 text-sm text-content-secondary hover:bg-surface-muted"
                            >
                              <Edit className="w-4 h-4" />
                              Edit
                            </button>
                            <button
                              onClick={(e) => handleDuplicate(workflow.id, e)}
                              className="w-full flex items-center gap-2 px-3 py-2 text-sm text-content-secondary hover:bg-surface-muted"
                            >
                              <Copy className="w-4 h-4" />
                              Duplicate
                            </button>
                            <button
                              onClick={(e) => { e.stopPropagation(); navigate(`/workflows/${workflow.id}/history`); setShowMenu(null); }}
                              className="w-full flex items-center gap-2 px-3 py-2 text-sm text-content-secondary hover:bg-surface-muted"
                            >
                              <History className="w-4 h-4" />
                              History
                            </button>
                            <hr className="my-1 border-line-subtle" />
                            <button
                              onClick={(e) => handleDelete(workflow.id, e)}
                              className="w-full flex items-center gap-2 px-3 py-2 text-sm text-semantic-error hover:bg-semantic-error-dim"
                            >
                              <Trash2 className="w-4 h-4" />
                              Delete
                            </button>
                          </div>
                        </>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Quick start templates */}
      <div className="card p-5">
        <h3 className="font-semibold text-content-primary mb-4">Quick Start Templates</h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div
            onClick={() => handleCreateFromTemplate('Meeting Processing', [], [])}
            className="p-4 border border-line-default rounded-lg hover:border-accent-primary hover:bg-accent-primary-dim cursor-pointer transition-colors group"
          >
            <div className="flex items-center gap-3 mb-2">
              <div className="w-8 h-8 rounded-lg bg-accent-primary-dim border border-accent-primary/20 flex items-center justify-center flex-shrink-0 group-hover:border-accent-primary/50 transition-colors">
                <Mic className="w-4 h-4 text-accent-primary" />
              </div>
              <h4 className="font-medium text-content-primary">Meeting Processing</h4>
            </div>
            <p className="text-sm text-content-tertiary">
              Process meetings, extract action items, and notify team members
            </p>
          </div>
          <div
            onClick={() => handleCreateFromTemplate('Webhook to Slack', [], [])}
            className="p-4 border border-line-default rounded-lg hover:border-accent-primary hover:bg-accent-primary-dim cursor-pointer transition-colors group"
          >
            <div className="flex items-center gap-3 mb-2">
              <div className="w-8 h-8 rounded-lg bg-accent-secondary-dim border border-accent-secondary/20 flex items-center justify-center flex-shrink-0 group-hover:border-accent-secondary/50 transition-colors">
                <Zap className="w-4 h-4 text-accent-secondary" />
              </div>
              <h4 className="font-medium text-content-primary">Webhook to Slack</h4>
            </div>
            <p className="text-sm text-content-tertiary">
              Receive webhook events and post formatted messages to Slack
            </p>
          </div>
          <div
            onClick={() => handleCreateFromTemplate('Daily Digest', [], [])}
            className="p-4 border border-line-default rounded-lg hover:border-accent-primary hover:bg-accent-primary-dim cursor-pointer transition-colors group"
          >
            <div className="flex items-center gap-3 mb-2">
              <div className="w-8 h-8 rounded-lg bg-accent-tertiary-dim border border-accent-tertiary/20 flex items-center justify-center flex-shrink-0 group-hover:border-accent-tertiary/50 transition-colors">
                <Clock className="w-4 h-4 text-accent-tertiary" />
              </div>
              <h4 className="font-medium text-content-primary">Daily Digest</h4>
            </div>
            <p className="text-sm text-content-tertiary">
              Generate and send daily summaries of tasks and upcoming events
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
