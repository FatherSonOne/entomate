/**
 * DataPinningPanel Component
 *
 * Allows developers to pin test data to nodes for development
 * Pinned data is used during test executions instead of live data
 */

import React, { useState, useEffect } from 'react'
import {
  Pin, PinOff, Plus, Trash2, Upload, Download, RefreshCw,
  AlertCircle, CheckCircle2, FileJson, Copy, Edit2, Save, X
} from 'lucide-react'
import { workflowsApi } from '../../services/api'

// JSON Editor component
function JsonEditor({ value, onChange, error, placeholder }) {
  return (
    <div className="relative">
      <textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder || '{\n  "key": "value"\n}'}
        className={`w-full h-48 px-3 py-2 text-sm font-mono border rounded-lg focus:outline-none focus:ring-2 ${
          error
            ? 'border-semantic-error focus:ring-red-500'
            : 'border-line-default focus:ring-primary-500'
        }`}
        spellCheck={false}
      />
      {error && (
        <p className="mt-1 text-xs text-semantic-error">{error}</p>
      )}
    </div>
  )
}

// Single pinned node item
function PinnedNodeItem({
  nodeId,
  nodeName,
  nodeType,
  pinnedData,
  onUpdate,
  onRemove,
  onEdit
}) {
  const [isEditing, setIsEditing] = useState(false)
  const [editValue, setEditValue] = useState('')
  const [error, setError] = useState(null)

  const handleStartEdit = () => {
    setEditValue(JSON.stringify(pinnedData, null, 2))
    setIsEditing(true)
    setError(null)
  }

  const handleSave = () => {
    try {
      const parsed = JSON.parse(editValue)
      onUpdate(nodeId, parsed)
      setIsEditing(false)
      setError(null)
    } catch (e) {
      setError('Invalid JSON: ' + e.message)
    }
  }

  const handleCancel = () => {
    setIsEditing(false)
    setError(null)
  }

  const dataPreview = JSON.stringify(pinnedData).substring(0, 100)

  return (
    <div className="border border-line-default rounded-lg overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between p-3 bg-surface-muted border-b border-line-default">
        <div className="flex items-center gap-2">
          <Pin className="w-4 h-4 text-primary-500" />
          <span className="font-medium text-content-primary">{nodeName || nodeId}</span>
          <span className="text-xs text-content-tertiary font-mono">{nodeType}</span>
        </div>
        <div className="flex items-center gap-1">
          {!isEditing && (
            <>
              <button
                onClick={handleStartEdit}
                className="p-1.5 text-content-tertiary hover:text-content-secondary hover:bg-surface-muted rounded"
                title="Edit"
              >
                <Edit2 className="w-4 h-4" />
              </button>
              <button
                onClick={() => onRemove(nodeId)}
                className="p-1.5 text-semantic-error hover:text-semantic-error hover:bg-semantic-error-dim rounded"
                title="Remove pin"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </>
          )}
          {isEditing && (
            <>
              <button
                onClick={handleSave}
                className="p-1.5 text-semantic-success hover:text-semantic-success hover:bg-semantic-success-dim rounded"
                title="Save"
              >
                <Save className="w-4 h-4" />
              </button>
              <button
                onClick={handleCancel}
                className="p-1.5 text-content-tertiary hover:text-content-secondary hover:bg-surface-muted rounded"
                title="Cancel"
              >
                <X className="w-4 h-4" />
              </button>
            </>
          )}
        </div>
      </div>

      {/* Content */}
      <div className="p-3">
        {isEditing ? (
          <JsonEditor
            value={editValue}
            onChange={setEditValue}
            error={error}
          />
        ) : (
          <pre className="text-xs font-mono text-content-secondary bg-surface-muted p-2 rounded overflow-x-auto max-h-24">
            {JSON.stringify(pinnedData, null, 2)}
          </pre>
        )}
      </div>
    </div>
  )
}

export default function DataPinningPanel({
  workflowId,
  nodes = [],
  pinnedData = {},
  onPinData,
  onUnpinData,
  onClose
}) {
  const [localPinnedData, setLocalPinnedData] = useState(pinnedData)
  const [showAddPin, setShowAddPin] = useState(false)
  const [selectedNode, setSelectedNode] = useState('')
  const [newPinData, setNewPinData] = useState('{\n  \n}')
  const [newPinError, setNewPinError] = useState(null)
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    setLocalPinnedData(pinnedData)
  }, [pinnedData])

  // Get unpinned nodes
  const unpinnedNodes = nodes.filter(node => !localPinnedData[node.id])

  // Handle adding new pin
  const handleAddPin = async () => {
    if (!selectedNode) {
      setNewPinError('Please select a node')
      return
    }

    try {
      const parsed = JSON.parse(newPinData)
      setSaving(true)

      if (workflowId) {
        await workflowsApi.pinNodeData(workflowId, selectedNode, parsed)
      }

      setLocalPinnedData(prev => ({
        ...prev,
        [selectedNode]: parsed
      }))
      onPinData?.(selectedNode, parsed)

      setShowAddPin(false)
      setSelectedNode('')
      setNewPinData('{\n  \n}')
      setNewPinError(null)
    } catch (e) {
      if (e.message?.includes('JSON')) {
        setNewPinError('Invalid JSON: ' + e.message)
      } else {
        setNewPinError(e.message || 'Failed to pin data')
      }
    } finally {
      setSaving(false)
    }
  }

  // Handle updating pin
  const handleUpdatePin = async (nodeId, data) => {
    try {
      setSaving(true)

      if (workflowId) {
        await workflowsApi.pinNodeData(workflowId, nodeId, data)
      }

      setLocalPinnedData(prev => ({
        ...prev,
        [nodeId]: data
      }))
      onPinData?.(nodeId, data)
    } catch (e) {
      console.error('Failed to update pin:', e)
    } finally {
      setSaving(false)
    }
  }

  // Handle removing pin
  const handleRemovePin = async (nodeId) => {
    try {
      setSaving(true)

      if (workflowId) {
        await workflowsApi.unpinNodeData(workflowId, nodeId)
      }

      setLocalPinnedData(prev => {
        const next = { ...prev }
        delete next[nodeId]
        return next
      })
      onUnpinData?.(nodeId)
    } catch (e) {
      console.error('Failed to remove pin:', e)
    } finally {
      setSaving(false)
    }
  }

  // Handle import
  const handleImport = () => {
    const input = document.createElement('input')
    input.type = 'file'
    input.accept = '.json'
    input.onchange = async (e) => {
      const file = e.target.files?.[0]
      if (!file) return

      try {
        const text = await file.text()
        const data = JSON.parse(text)

        if (typeof data === 'object' && data !== null) {
          for (const [nodeId, nodeData] of Object.entries(data)) {
            await handleUpdatePin(nodeId, nodeData)
          }
        }
      } catch (err) {
        console.error('Failed to import:', err)
      }
    }
    input.click()
  }

  // Handle export
  const handleExport = () => {
    const data = JSON.stringify(localPinnedData, null, 2)
    const blob = new Blob([data], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `pinned-data-${workflowId || 'workflow'}.json`
    a.click()
    URL.revokeObjectURL(url)
  }

  // Handle clear all
  const handleClearAll = async () => {
    if (!confirm('Remove all pinned data?')) return

    for (const nodeId of Object.keys(localPinnedData)) {
      await handleRemovePin(nodeId)
    }
  }

  const pinnedNodeIds = Object.keys(localPinnedData)

  return (
    <div className="flex flex-col h-full bg-surface">
      {/* Header */}
      <div className="p-4 border-b border-line-default">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2">
            <Pin className="w-5 h-5 text-primary-500" />
            <h3 className="font-semibold text-content-primary">Pinned Data</h3>
            {saving && (
              <RefreshCw className="w-4 h-4 text-content-tertiary animate-spin" />
            )}
          </div>
          <div className="flex items-center gap-1">
            <button
              onClick={handleImport}
              className="p-1.5 text-content-tertiary hover:text-content-secondary hover:bg-surface-muted rounded"
              title="Import"
            >
              <Upload className="w-4 h-4" />
            </button>
            <button
              onClick={handleExport}
              disabled={pinnedNodeIds.length === 0}
              className="p-1.5 text-content-tertiary hover:text-content-secondary hover:bg-surface-muted rounded disabled:opacity-50"
              title="Export"
            >
              <Download className="w-4 h-4" />
            </button>
            {pinnedNodeIds.length > 0 && (
              <button
                onClick={handleClearAll}
                className="p-1.5 text-semantic-error hover:text-semantic-error hover:bg-semantic-error-dim rounded"
                title="Clear all"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            )}
          </div>
        </div>
        <p className="text-xs text-content-tertiary">
          Pin test data to nodes for development. Pinned data will be used during test runs.
        </p>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {/* Pinned nodes */}
        {pinnedNodeIds.length > 0 ? (
          pinnedNodeIds.map(nodeId => {
            const node = nodes.find(n => n.id === nodeId)
            return (
              <PinnedNodeItem
                key={nodeId}
                nodeId={nodeId}
                nodeName={node?.data?.label}
                nodeType={node?.type}
                pinnedData={localPinnedData[nodeId]}
                onUpdate={handleUpdatePin}
                onRemove={handleRemovePin}
              />
            )
          })
        ) : (
          <div className="text-center py-8">
            <Pin className="w-8 h-8 text-content-muted mx-auto mb-2" />
            <p className="text-content-tertiary text-sm">No pinned data</p>
            <p className="text-content-tertiary text-xs mt-1">
              Pin data to nodes for testing
            </p>
          </div>
        )}

        {/* Add new pin */}
        {showAddPin ? (
          <div className="border border-primary-200 rounded-lg p-4 bg-primary-50">
            <div className="flex items-center justify-between mb-3">
              <h4 className="font-medium text-content-primary">Pin Data to Node</h4>
              <button
                onClick={() => { setShowAddPin(false); setNewPinError(null); }}
                className="p-1 text-content-tertiary hover:text-content-secondary"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-3">
              <div>
                <label className="block text-xs font-medium text-content-secondary mb-1">
                  Select Node
                </label>
                <select
                  value={selectedNode}
                  onChange={(e) => setSelectedNode(e.target.value)}
                  className="w-full px-3 py-2 text-sm border border-line-default rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500"
                >
                  <option value="">Choose a node...</option>
                  {unpinnedNodes.map(node => (
                    <option key={node.id} value={node.id}>
                      {node.data?.label || node.id} ({node.type})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-medium text-content-secondary mb-1">
                  Data (JSON)
                </label>
                <JsonEditor
                  value={newPinData}
                  onChange={setNewPinData}
                  error={newPinError}
                />
              </div>

              <div className="flex justify-end gap-2">
                <button
                  onClick={() => { setShowAddPin(false); setNewPinError(null); }}
                  className="btn btn-secondary btn-sm"
                >
                  Cancel
                </button>
                <button
                  onClick={handleAddPin}
                  disabled={saving}
                  className="btn btn-primary btn-sm"
                >
                  {saving ? (
                    <RefreshCw className="w-4 h-4 animate-spin" />
                  ) : (
                    <Pin className="w-4 h-4" />
                  )}
                  Pin Data
                </button>
              </div>
            </div>
          </div>
        ) : (
          <button
            onClick={() => setShowAddPin(true)}
            disabled={unpinnedNodes.length === 0}
            className="w-full flex items-center justify-center gap-2 p-3 border-2 border-dashed border-line-strong rounded-lg text-content-tertiary hover:border-primary-500 hover:text-accent-primary transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Plus className="w-4 h-4" />
            Add Pinned Data
          </button>
        )}
      </div>

      {/* Footer */}
      <div className="p-3 border-t border-line-default bg-surface-muted">
        <div className="flex items-start gap-2 text-xs text-content-tertiary">
          <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
          <p>
            Pinned data overrides real data during test executions.
            Remove pins before activating your workflow for production.
          </p>
        </div>
      </div>
    </div>
  )
}
