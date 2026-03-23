/**
 * WorkflowDebugPanel Component
 *
 * Unified debugging panel for workflow development
 * Combines execution trace, data pinning, and output inspection
 */

import React, { useState, useEffect } from 'react'
import {
  Bug, Play, Square, RefreshCw, ChevronLeft, ChevronRight,
  History, Pin, FileJson, AlertCircle, CheckCircle2, Clock,
  Loader2, Terminal, Eye, Settings, Maximize2, Minimize2
} from 'lucide-react'
import ExecutionTraceViewer from './ExecutionTraceViewer'
import NodeOutputInspector from './NodeOutputInspector'
import DataPinningPanel from './DataPinningPanel'
import VersionHistoryPanel from './VersionHistoryPanel'

// Tab configuration
const TABS = {
  trace: { icon: Terminal, label: 'Execution' },
  output: { icon: FileJson, label: 'Output' },
  pins: { icon: Pin, label: 'Pinned Data' },
  history: { icon: History, label: 'Versions' }
}

// Execution status indicator
function ExecutionStatus({ status, duration }) {
  const statusConfig = {
    idle: { color: 'text-content-tertiary bg-surface-muted', icon: Clock, label: 'Idle' },
    running: { color: 'text-semantic-info bg-semantic-info-dim', icon: Loader2, label: 'Running' },
    completed: { color: 'text-semantic-success bg-semantic-success-dim', icon: CheckCircle2, label: 'Completed' },
    failed: { color: 'text-semantic-error bg-semantic-error-dim', icon: AlertCircle, label: 'Failed' }
  }

  const config = statusConfig[status] || statusConfig.idle
  const Icon = config.icon

  return (
    <div className={`flex items-center gap-2 px-3 py-1.5 rounded-full ${config.color}`}>
      <Icon className={`w-4 h-4 ${status === 'running' ? 'animate-spin' : ''}`} />
      <span className="text-sm font-medium">{config.label}</span>
      {duration && <span className="text-xs opacity-75">({duration}ms)</span>}
    </div>
  )
}

export default function WorkflowDebugPanel({
  workflowId,
  nodes = [],
  selectedNodeId,
  execution,
  pinnedData = {},
  onTest,
  onExecute,
  onStop,
  onPinData,
  onUnpinData,
  onSelectNode,
  onRestore,
  isExpanded = true,
  onToggleExpand
}) {
  const [activeTab, setActiveTab] = useState('trace')
  const [executionStatus, setExecutionStatus] = useState('idle')
  const [lastExecution, setLastExecution] = useState(null)
  const [selectedOutput, setSelectedOutput] = useState(null)
  const [isMinimized, setIsMinimized] = useState(false)

  useEffect(() => {
    if (execution) {
      setLastExecution(execution)
      setExecutionStatus(execution.status)

      // If a node was executed, show its output
      if (selectedNodeId && execution.nodeExecutions) {
        const nodeExec = execution.nodeExecutions.find(n => n.nodeId === selectedNodeId)
        if (nodeExec) {
          setSelectedOutput({
            nodeId: nodeExec.nodeId,
            nodeName: nodeExec.nodeName,
            output: nodeExec.outputData
          })
        }
      }
    }
  }, [execution, selectedNodeId])

  // Handle test execution
  const handleTest = async () => {
    setExecutionStatus('running')
    try {
      const result = await onTest?.()
      setLastExecution(result)
      setExecutionStatus(result?.status || 'completed')
    } catch (error) {
      setExecutionStatus('failed')
    }
  }

  // Handle production execution
  const handleExecute = async () => {
    setExecutionStatus('running')
    try {
      const result = await onExecute?.()
      setLastExecution(result)
      setExecutionStatus(result?.status || 'completed')
    } catch (error) {
      setExecutionStatus('failed')
    }
  }

  // Handle node selection from trace
  const handleNodeSelect = (nodeId) => {
    onSelectNode?.(nodeId)

    // Find and set output for selected node
    if (lastExecution?.nodeExecutions) {
      const nodeExec = lastExecution.nodeExecutions.find(n => n.nodeId === nodeId)
      if (nodeExec) {
        setSelectedOutput({
          nodeId: nodeExec.nodeId,
          nodeName: nodeExec.nodeName,
          output: nodeExec.outputData
        })
        setActiveTab('output')
      }
    }
  }

  if (isMinimized) {
    return (
      <div className="fixed bottom-4 right-4 z-50">
        <button
          onClick={() => setIsMinimized(false)}
          className="flex items-center gap-2 px-4 py-2 vc-bg-code vc-text-primary rounded-lg shadow-lg"
        >
          <Bug className="w-4 h-4" />
          Debug Panel
          <ExecutionStatus status={executionStatus} />
        </button>
      </div>
    )
  }

  return (
    <div className={`flex flex-col bg-surface border-t border-line-default ${
      isExpanded ? 'h-80' : 'h-12'
    } transition-all duration-200`}>
      {/* Header */}
      <div className="flex items-center justify-between px-4 h-12 border-b border-line-default bg-surface-muted flex-shrink-0">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <Bug className="w-5 h-5 text-content-tertiary" />
            <span className="font-medium text-content-primary">Debug</span>
          </div>

          {/* Execution controls */}
          <div className="flex items-center gap-1">
            <button
              onClick={handleTest}
              disabled={executionStatus === 'running'}
              className="flex items-center gap-1 px-3 py-1 text-sm vc-bg-warning-dim vc-text-warning rounded disabled:opacity-50"
            >
              <Play className="w-3 h-3" />
              Test
            </button>
            <button
              onClick={handleExecute}
              disabled={executionStatus === 'running'}
              className="flex items-center gap-1 px-3 py-1 text-sm bg-semantic-success-dim text-semantic-success rounded disabled:opacity-50"
            >
              <Play className="w-3 h-3" />
              Execute
            </button>
            {executionStatus === 'running' && (
              <button
                onClick={onStop}
                className="flex items-center gap-1 px-3 py-1 text-sm bg-semantic-error-dim text-semantic-error rounded"
              >
                <Square className="w-3 h-3" />
                Stop
              </button>
            )}
          </div>

          <ExecutionStatus
            status={executionStatus}
            duration={lastExecution?.duration_ms}
          />
        </div>

        <div className="flex items-center gap-2">
          {/* Tabs */}
          <div className="flex items-center bg-surface-muted rounded-lg p-0.5">
            {Object.entries(TABS).map(([key, config]) => {
              const Icon = config.icon
              return (
                <button
                  key={key}
                  onClick={() => setActiveTab(key)}
                  className={`flex items-center gap-1.5 px-3 py-1 text-sm rounded ${
                    activeTab === key
                      ? 'bg-surface shadow-sm text-content-primary'
                      : 'text-content-tertiary hover:text-content-secondary'
                  }`}
                >
                  <Icon className="w-4 h-4" />
                  {config.label}
                </button>
              )
            })}
          </div>

          {/* Controls */}
          <button
            onClick={() => onToggleExpand?.()}
            className="p-1.5 text-content-tertiary hover:text-content-secondary hover:bg-surface-muted rounded"
          >
            {isExpanded ? <ChevronDown className="w-4 h-4" /> : <ChevronUp className="w-4 h-4" />}
          </button>
          <button
            onClick={() => setIsMinimized(true)}
            className="p-1.5 text-content-tertiary hover:text-content-secondary hover:bg-surface-muted rounded"
          >
            <Minimize2 className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Content */}
      {isExpanded && (
        <div className="flex-1 overflow-hidden">
          {activeTab === 'trace' && (
            <ExecutionTraceViewer
              workflowId={workflowId}
              execution={lastExecution}
              onNodeSelect={handleNodeSelect}
            />
          )}

          {activeTab === 'output' && (
            <div className="h-full p-4">
              {selectedOutput ? (
                <NodeOutputInspector
                  nodeId={selectedOutput.nodeId}
                  nodeName={selectedOutput.nodeName}
                  output={selectedOutput.output}
                  onPin={(nodeId, data) => onPinData?.(nodeId, data)}
                  isPinned={!!pinnedData[selectedOutput.nodeId]}
                />
              ) : (
                <div className="flex items-center justify-center h-full text-content-tertiary">
                  <div className="text-center">
                    <FileJson className="w-8 h-8 mx-auto mb-2 opacity-50" />
                    <p>Select a node to view its output</p>
                    <p className="text-xs text-content-tertiary mt-1">
                      Run a test execution first
                    </p>
                  </div>
                </div>
              )}
            </div>
          )}

          {activeTab === 'pins' && (
            <DataPinningPanel
              workflowId={workflowId}
              nodes={nodes}
              pinnedData={pinnedData}
              onPinData={onPinData}
              onUnpinData={onUnpinData}
            />
          )}

          {activeTab === 'history' && (
            <VersionHistoryPanel
              workflowId={workflowId}
              onRestore={onRestore}
            />
          )}
        </div>
      )}
    </div>
  )
}

// Import ChevronDown and ChevronUp
function ChevronDown(props) {
  return (
    <svg {...props} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M6 9l6 6 6-6" />
    </svg>
  )
}

function ChevronUp(props) {
  return (
    <svg {...props} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M18 15l-6-6-6 6" />
    </svg>
  )
}
