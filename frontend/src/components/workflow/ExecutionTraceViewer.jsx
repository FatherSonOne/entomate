/**
 * ExecutionTraceViewer Component
 *
 * Shows step-by-step execution trace of a workflow run
 * with timing, inputs, outputs, and error information
 */

import React, { useState, useEffect } from 'react'
import {
  Play, CheckCircle2, XCircle, Clock, ChevronDown, ChevronRight,
  AlertCircle, Loader2, RefreshCw, Download, Filter, Search,
  ArrowRight, Zap, Timer, Database
} from 'lucide-react'
import { workflowsApi } from '../../services/api'

// Status colors and icons
const statusConfig = {
  completed: { color: 'text-semantic-success bg-semantic-success-dim', icon: CheckCircle2, label: 'Completed' },
  failed: { color: 'text-semantic-error bg-semantic-error-dim', icon: XCircle, label: 'Failed' },
  running: { color: 'text-semantic-info bg-semantic-info-dim', icon: Loader2, label: 'Running' },
  pending: { color: 'text-content-tertiary bg-surface-muted', icon: Clock, label: 'Pending' },
  skipped: { color: 'vc-text-warning vc-bg-warning-dim', icon: ArrowRight, label: 'Skipped' }
}

// Format duration
const formatDuration = (ms) => {
  if (!ms) return '-'
  if (ms < 1000) return `${ms}ms`
  if (ms < 60000) return `${(ms / 1000).toFixed(2)}s`
  return `${(ms / 60000).toFixed(2)}m`
}

// Format timestamp
const formatTime = (timestamp) => {
  if (!timestamp) return '-'
  return new Date(timestamp).toLocaleTimeString()
}

// JSON viewer component
function JsonViewer({ data, maxHeight = 200 }) {
  const [expanded, setExpanded] = useState(false)
  const jsonString = JSON.stringify(data, null, 2)
  const isLarge = jsonString.length > 500

  return (
    <div className="relative">
      <pre
        className={`text-xs font-mono vc-bg-code vc-text-primary p-3 rounded-lg overflow-auto ${
          !expanded && isLarge ? 'max-h-32' : ''
        }`}
        style={{ maxHeight: expanded ? 'none' : maxHeight }}
      >
        {jsonString}
      </pre>
      {isLarge && (
        <button
          onClick={() => setExpanded(!expanded)}
          className="absolute bottom-2 right-2 px-2 py-1 text-xs vc-bg-elevated vc-text-primary rounded"
        >
          {expanded ? 'Collapse' : 'Expand'}
        </button>
      )}
    </div>
  )
}

// Single node execution step
function ExecutionStep({ step, index, isLast, onSelect, selected }) {
  const [expanded, setExpanded] = useState(false)
  const status = statusConfig[step.status] || statusConfig.pending
  const StatusIcon = status.icon

  return (
    <div className={`relative ${!isLast ? 'pb-6' : ''}`}>
      {/* Connection line */}
      {!isLast && (
        <div className="absolute left-4 top-8 bottom-0 w-0.5 bg-surface-muted" />
      )}

      {/* Step content */}
      <div
        className={`relative flex gap-3 cursor-pointer ${
          selected ? 'bg-primary-50 -mx-2 px-2 py-1 rounded-lg' : ''
        }`}
        onClick={() => onSelect?.(step)}
      >
        {/* Status icon */}
        <div className={`flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center ${status.color}`}>
          <StatusIcon className={`w-4 h-4 ${step.status === 'running' ? 'animate-spin' : ''}`} />
        </div>

        {/* Step info */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <button
              onClick={(e) => { e.stopPropagation(); setExpanded(!expanded); }}
              className="p-0.5 hover:bg-surface-muted rounded"
            >
              {expanded ? (
                <ChevronDown className="w-4 h-4 text-content-tertiary" />
              ) : (
                <ChevronRight className="w-4 h-4 text-content-tertiary" />
              )}
            </button>
            <span className="font-medium text-content-primary">{step.nodeName || step.nodeId}</span>
            <span className="text-xs text-content-tertiary font-mono">{step.nodeType}</span>
          </div>

          {/* Timing info */}
          <div className="flex items-center gap-4 mt-1 text-xs text-content-tertiary">
            <span className="flex items-center gap-1">
              <Clock className="w-3 h-3" />
              {formatTime(step.startedAt)}
            </span>
            <span className="flex items-center gap-1">
              <Timer className="w-3 h-3" />
              {formatDuration(step.duration)}
            </span>
            {step.output && (
              <span className="flex items-center gap-1">
                <ArrowRight className="w-3 h-3" />
                Output: {step.output}
              </span>
            )}
          </div>

          {/* Error message */}
          {step.error && (
            <div className="mt-2 p-2 bg-semantic-error-dim border border-semantic-error rounded text-xs text-semantic-error">
              <div className="font-medium">Error:</div>
              <div className="font-mono">{step.error}</div>
            </div>
          )}

          {/* Expanded details */}
          {expanded && (
            <div className="mt-3 space-y-3">
              {/* Input data */}
              {step.inputData && (
                <div>
                  <div className="text-xs font-medium text-content-secondary mb-1 flex items-center gap-1">
                    <Database className="w-3 h-3" />
                    Input Data
                  </div>
                  <JsonViewer data={step.inputData} />
                </div>
              )}

              {/* Output data */}
              {step.outputData && (
                <div>
                  <div className="text-xs font-medium text-content-secondary mb-1 flex items-center gap-1">
                    <Zap className="w-3 h-3" />
                    Output Data
                  </div>
                  <JsonViewer data={step.outputData} />
                </div>
              )}

              {/* Config */}
              {step.config && Object.keys(step.config).length > 0 && (
                <div>
                  <div className="text-xs font-medium text-content-secondary mb-1">Configuration</div>
                  <JsonViewer data={step.config} maxHeight={100} />
                </div>
              )}
            </div>
          )}
        </div>

        {/* Duration badge */}
        <div className="flex-shrink-0">
          <span className={`px-2 py-0.5 text-xs rounded-full ${status.color}`}>
            {status.label}
          </span>
        </div>
      </div>
    </div>
  )
}

export default function ExecutionTraceViewer({
  workflowId,
  executionId,
  execution: propExecution,
  onNodeSelect,
  onClose
}) {
  const [execution, setExecution] = useState(propExecution || null)
  const [loading, setLoading] = useState(!propExecution)
  const [error, setError] = useState(null)
  const [selectedStep, setSelectedStep] = useState(null)
  const [filter, setFilter] = useState('all')
  const [searchTerm, setSearchTerm] = useState('')

  useEffect(() => {
    if (!propExecution && workflowId && executionId) {
      loadExecution()
    }
  }, [workflowId, executionId, propExecution])

  const loadExecution = async () => {
    try {
      setLoading(true)
      setError(null)
      const response = await workflowsApi.getExecution(workflowId, executionId)
      setExecution(response.execution)
    } catch (err) {
      setError(err.message || 'Failed to load execution')
    } finally {
      setLoading(false)
    }
  }

  const handleStepSelect = (step) => {
    setSelectedStep(step)
    onNodeSelect?.(step.nodeId)
  }

  const handleExport = () => {
    const data = JSON.stringify(execution, null, 2)
    const blob = new Blob([data], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `execution-${executionId}.json`
    a.click()
    URL.revokeObjectURL(url)
  }

  // Filter steps
  const filteredSteps = (execution?.nodeExecutions || []).filter(step => {
    const matchesFilter = filter === 'all' || step.status === filter
    const matchesSearch = !searchTerm ||
      step.nodeName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      step.nodeType?.toLowerCase().includes(searchTerm.toLowerCase())
    return matchesFilter && matchesSearch
  })

  // Calculate summary stats
  const stats = {
    total: execution?.nodeExecutions?.length || 0,
    completed: execution?.nodeExecutions?.filter(s => s.status === 'completed').length || 0,
    failed: execution?.nodeExecutions?.filter(s => s.status === 'failed').length || 0,
    skipped: execution?.nodeExecutions?.filter(s => s.status === 'skipped').length || 0
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <Loader2 className="w-6 h-6 text-accent-primary animate-spin" />
      </div>
    )
  }

  if (error) {
    return (
      <div className="p-4 text-center">
        <AlertCircle className="w-8 h-8 text-semantic-error mx-auto mb-2" />
        <p className="text-content-secondary mb-2">{error}</p>
        <button onClick={loadExecution} className="btn btn-secondary btn-sm">
          <RefreshCw className="w-4 h-4" />
          Retry
        </button>
      </div>
    )
  }

  if (!execution) {
    return (
      <div className="p-4 text-center text-content-tertiary">
        No execution data available
      </div>
    )
  }

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="p-4 border-b border-line-default">
        <div className="flex items-center justify-between mb-3">
          <h3 className="font-semibold text-content-primary">Execution Trace</h3>
          <div className="flex items-center gap-2">
            <button
              onClick={loadExecution}
              className="p-1.5 text-content-tertiary hover:text-content-secondary hover:bg-surface-muted rounded"
              title="Refresh"
            >
              <RefreshCw className="w-4 h-4" />
            </button>
            <button
              onClick={handleExport}
              className="p-1.5 text-content-tertiary hover:text-content-secondary hover:bg-surface-muted rounded"
              title="Export"
            >
              <Download className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Execution summary */}
        <div className="flex items-center gap-4 text-sm">
          <span className={`px-2 py-0.5 rounded-full ${
            execution.status === 'completed' ? 'bg-semantic-success-dim text-semantic-success' :
            execution.status === 'failed' ? 'bg-semantic-error-dim text-semantic-error' :
            execution.status === 'running' ? 'bg-semantic-info-dim text-semantic-info' :
            'bg-surface-muted text-content-secondary'
          }`}>
            {execution.status}
          </span>
          <span className="text-content-tertiary">
            {formatDuration(execution.duration_ms)}
          </span>
          <span className="text-content-tertiary text-xs">
            {new Date(execution.started_at).toLocaleString()}
          </span>
        </div>

        {/* Stats */}
        <div className="flex items-center gap-4 mt-3 text-xs">
          <span className="text-content-secondary">{stats.total} nodes</span>
          <span className="text-semantic-success">{stats.completed} completed</span>
          {stats.failed > 0 && <span className="text-semantic-error">{stats.failed} failed</span>}
          {stats.skipped > 0 && <span className="vc-text-warning">{stats.skipped} skipped</span>}
        </div>
      </div>

      {/* Filters */}
      <div className="p-3 border-b border-line-subtle flex items-center gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-content-tertiary" />
          <input
            type="text"
            placeholder="Search nodes..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-8 pr-3 py-1.5 text-sm border border-line-default rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500"
          />
        </div>
        <select
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          className="px-2 py-1.5 text-sm border border-line-default rounded-md"
        >
          <option value="all">All</option>
          <option value="completed">Completed</option>
          <option value="failed">Failed</option>
          <option value="skipped">Skipped</option>
        </select>
      </div>

      {/* Execution steps */}
      <div className="flex-1 overflow-y-auto p-4">
        {filteredSteps.length === 0 ? (
          <div className="text-center text-content-tertiary py-8">
            No matching steps found
          </div>
        ) : (
          <div className="space-y-0">
            {filteredSteps.map((step, index) => (
              <ExecutionStep
                key={step.nodeId || index}
                step={step}
                index={index}
                isLast={index === filteredSteps.length - 1}
                onSelect={handleStepSelect}
                selected={selectedStep?.nodeId === step.nodeId}
              />
            ))}
          </div>
        )}
      </div>

      {/* Error details (if execution failed) */}
      {execution.status === 'failed' && execution.error_message && (
        <div className="p-4 border-t border-semantic-error bg-semantic-error-dim">
          <div className="flex items-start gap-2">
            <AlertCircle className="w-5 h-5 text-semantic-error flex-shrink-0" />
            <div>
              <div className="font-medium text-semantic-error">Execution Failed</div>
              <div className="text-sm text-semantic-error mt-1 font-mono">
                {execution.error_message}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
