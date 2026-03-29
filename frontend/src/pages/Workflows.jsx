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
import { VCButton, VCBadge, VCInput } from '../components/vc'
import { useConfirm } from '../components/vc/ConfirmDialog'
import ErrorState from '../components/vc/ErrorState'

export default function Workflows() {
  const navigate = useNavigate()
  const confirm = useConfirm()
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
    const ok = await confirm({ title: 'Delete Workflow', message: 'Delete this workflow? This cannot be undone.', confirmLabel: 'Delete', variant: 'danger' })
    if (!ok) return
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

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold" style={{ color: 'var(--text-primary)', fontFamily: 'var(--font-display)' }}>Workflows</h1>
          <p style={{ color: 'var(--text-secondary)' }}>Build visual automation workflows with a node-based editor</p>
        </div>
        <VCButton variant="primary" onClick={handleCreateWorkflow}>
          <Plus className="w-4 h-4" />
          New Workflow
        </VCButton>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-4">
        <div className="flex-1">
          <VCInput
            type="text"
            placeholder="Search workflows..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full"
            icon={<Search className="w-4 h-4" style={{ color: 'var(--text-tertiary)' }} />}
          />
        </div>
        <div className="flex gap-2">
          <VCButton
            variant={filterActive === 'all' ? 'primary' : 'ghost'}
            size="sm"
            onClick={() => setFilterActive('all')}
          >
            All
          </VCButton>
          <VCButton
            variant={filterActive === 'active' ? 'mint' : 'ghost'}
            size="sm"
            onClick={() => setFilterActive('active')}
          >
            Active
          </VCButton>
          <VCButton
            variant={filterActive === 'inactive' ? 'secondary' : 'ghost'}
            size="sm"
            onClick={() => setFilterActive('inactive')}
          >
            Inactive
          </VCButton>
        </div>
      </div>

      {/* Workflows List */}
      <div className="vc">
        {loading ? (
          <div className="p-8 text-center">
            <div className="spinner mx-auto mb-4" />
            <p style={{ color: 'var(--text-tertiary)' }}>Loading workflows...</p>
          </div>
        ) : filteredWorkflows.length === 0 ? (
          <div className="p-8 text-center">
            <Workflow className="w-12 h-12 mx-auto mb-3" style={{ color: 'var(--text-tertiary)' }} />
            <h3 className="text-lg font-medium mb-1" style={{ color: 'var(--text-primary)' }}>
              {searchTerm ? 'No workflows found' : 'No workflows yet'}
            </h3>
            <p className="mb-4" style={{ color: 'var(--text-tertiary)' }}>
              {searchTerm
                ? 'Try adjusting your search'
                : 'Create your first visual workflow to automate tasks'
              }
            </p>
            {!searchTerm && (
              <VCButton variant="primary" onClick={handleCreateWorkflow}>
                <Plus className="w-4 h-4" />
                Create Workflow
              </VCButton>
            )}
          </div>
        ) : (
          <div>
            {filteredWorkflows.map((workflow) => (
              <div
                key={workflow.id}
                onClick={() => navigate(`/workflows/${workflow.id}`)}
                className="p-4 cursor-pointer transition-colors hover:bg-black/10"
                style={{ borderBottom: '1px solid rgba(248,240,242,.06)' }}
              >
                <div className="flex items-start gap-4">
                  {/* Icon */}
                  <div className="w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0" style={{
                    background: workflow.active ? 'rgba(0,245,212,.12)' : 'var(--bg-elevated)'
                  }}>
                    <Workflow className="w-5 h-5" style={{
                      color: workflow.active ? 'var(--accent-secondary)' : 'var(--text-tertiary)'
                    }} />
                  </div>

                  {/* Content */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h3 className="font-medium" style={{ color: 'var(--text-primary)' }}>{workflow.name}</h3>
                      {workflow.active
                        ? <VCBadge color="mint">Active</VCBadge>
                        : <VCBadge color="neutral">Inactive</VCBadge>
                      }
                      {workflow.is_template && (
                        <VCBadge color="phosphor">Template</VCBadge>
                      )}
                    </div>
                    {workflow.description && (
                      <p className="text-sm mt-1 line-clamp-1" style={{ color: 'var(--text-tertiary)' }}>
                        {workflow.description}
                      </p>
                    )}
                    <div className="flex items-center gap-4 mt-2 text-xs flex-wrap" style={{ color: 'var(--text-tertiary)' }}>
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
                    <VCButton
                      variant={workflow.active ? 'secondary' : 'ghost'}
                      size="sm"
                      onClick={(e) => handleToggleActive(workflow.id, workflow.active, e)}
                      title={workflow.active ? 'Deactivate' : 'Activate'}
                      aria-label={workflow.active ? 'Deactivate' : 'Activate'}
                    >
                      {workflow.active ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
                    </VCButton>

                    <VCButton
                      variant="ghost"
                      size="sm"
                      onClick={(e) => handleExecute(workflow.id, e)}
                      disabled={!workflow.active}
                      title="Execute now"
                      aria-label="Execute now"
                    >
                      <Zap className="w-4 h-4" />
                    </VCButton>

                    <div className="relative">
                      <VCButton
                        variant="ghost"
                        size="sm"
                        onClick={(e) => { e.stopPropagation(); setShowMenu(showMenu === workflow.id ? null : workflow.id); }}
                        aria-label="More options"
                      >
                        <MoreVertical className="w-4 h-4" />
                      </VCButton>

                      {showMenu === workflow.id && (
                        <>
                          <div
                            className="fixed inset-0 z-10"
                            onClick={(e) => { e.stopPropagation(); setShowMenu(null); }}
                          />
                          <div className="absolute right-0 top-full mt-1 w-40 rounded-lg shadow-lg py-1 z-20" style={{ background: 'var(--bg-elevated)', border: '1px solid rgba(248,240,242,.08)' }}>
                            <VCButton
                              variant="ghost"
                              size="sm"
                              className="w-full justify-start px-3 rounded-none"
                              onClick={(e) => { e.stopPropagation(); navigate(`/workflows/${workflow.id}`); setShowMenu(null); }}
                            >
                              <Edit className="w-4 h-4" />
                              Edit
                            </VCButton>
                            <VCButton
                              variant="ghost"
                              size="sm"
                              className="w-full justify-start px-3 rounded-none"
                              onClick={(e) => handleDuplicate(workflow.id, e)}
                            >
                              <Copy className="w-4 h-4" />
                              Duplicate
                            </VCButton>
                            <VCButton
                              variant="ghost"
                              size="sm"
                              className="w-full justify-start px-3 rounded-none"
                              onClick={(e) => { e.stopPropagation(); navigate(`/workflows/${workflow.id}/history`); setShowMenu(null); }}
                            >
                              <History className="w-4 h-4" />
                              History
                            </VCButton>
                            <hr style={{ margin: '4px 0', borderColor: 'rgba(248,240,242,.08)' }} />
                            <VCButton
                              variant="danger"
                              size="sm"
                              className="w-full justify-start px-3 rounded-none"
                              onClick={(e) => handleDelete(workflow.id, e)}
                            >
                              <Trash2 className="w-4 h-4" />
                              Delete
                            </VCButton>
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
      <div className="vc p-5">
        <h3 className="font-semibold mb-4" style={{ color: 'var(--text-primary)' }}>Quick Start Templates</h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div
            onClick={() => handleCreateFromTemplate('Meeting Processing', [], [])}
            className="p-4 rounded-lg cursor-pointer transition-colors group hover:bg-black/20"
            style={{ border: '1px solid rgba(248,240,242,.08)' }}
          >
            <div className="flex items-center gap-3 mb-2">
              <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 transition-colors" style={{ background: 'rgba(255,45,107,.1)', border: '1px solid rgba(255,45,107,.2)' }}>
                <Mic className="w-4 h-4" style={{ color: 'var(--accent-primary)' }} />
              </div>
              <h4 className="font-medium" style={{ color: 'var(--text-primary)' }}>Meeting Processing</h4>
            </div>
            <p className="text-sm" style={{ color: 'var(--text-tertiary)' }}>
              Process meetings, extract action items, and notify team members
            </p>
          </div>
          <div
            onClick={() => handleCreateFromTemplate('Webhook to Slack', [], [])}
            className="p-4 rounded-lg cursor-pointer transition-colors group hover:bg-black/20"
            style={{ border: '1px solid rgba(248,240,242,.08)' }}
          >
            <div className="flex items-center gap-3 mb-2">
              <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 transition-colors" style={{ background: 'rgba(0,245,212,.1)', border: '1px solid rgba(0,245,212,.2)' }}>
                <Zap className="w-4 h-4" style={{ color: 'var(--accent-secondary)' }} />
              </div>
              <h4 className="font-medium" style={{ color: 'var(--text-primary)' }}>Webhook to Slack</h4>
            </div>
            <p className="text-sm" style={{ color: 'var(--text-tertiary)' }}>
              Receive webhook events and post formatted messages to Slack
            </p>
          </div>
          <div
            onClick={() => handleCreateFromTemplate('Daily Digest', [], [])}
            className="p-4 rounded-lg cursor-pointer transition-colors group hover:bg-black/20"
            style={{ border: '1px solid rgba(248,240,242,.08)' }}
          >
            <div className="flex items-center gap-3 mb-2">
              <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 transition-colors" style={{ background: 'rgba(255,184,0,.1)', border: '1px solid rgba(255,184,0,.2)' }}>
                <Clock className="w-4 h-4" style={{ color: 'var(--accent-tertiary)' }} />
              </div>
              <h4 className="font-medium" style={{ color: 'var(--text-primary)' }}>Daily Digest</h4>
            </div>
            <p className="text-sm" style={{ color: 'var(--text-tertiary)' }}>
              Generate and send daily summaries of tasks and upcoming events
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
