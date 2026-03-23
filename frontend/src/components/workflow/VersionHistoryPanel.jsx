/**
 * VersionHistoryPanel Component
 *
 * Shows workflow version history with diff viewing and restore functionality
 */

import React, { useState, useEffect } from 'react'
import {
  History, Clock, User, RefreshCw, RotateCcw, Eye,
  ChevronDown, ChevronRight, GitCommit, Diff, AlertCircle,
  Plus, Minus, FileJson, Loader2, Check, X
} from 'lucide-react'
import { workflowsApi } from '../../services/api'
import { useConfirm } from '../vc/ConfirmDialog'

// Format relative time
const formatRelativeTime = (timestamp) => {
  const now = new Date()
  const date = new Date(timestamp)
  const diff = now - date
  const seconds = Math.floor(diff / 1000)
  const minutes = Math.floor(seconds / 60)
  const hours = Math.floor(minutes / 60)
  const days = Math.floor(hours / 24)

  if (days > 7) return date.toLocaleDateString()
  if (days > 0) return `${days}d ago`
  if (hours > 0) return `${hours}h ago`
  if (minutes > 0) return `${minutes}m ago`
  return 'Just now'
}

// Diff line component
function DiffLine({ type, content, lineNumber }) {
  const bgColor = type === 'add' ? 'bg-semantic-success-dim' : type === 'remove' ? 'bg-semantic-error-dim' : 'bg-surface'
  const textColor = type === 'add' ? 'text-semantic-success' : type === 'remove' ? 'text-semantic-error' : 'text-content-secondary'
  const lineColor = type === 'add' ? 'bg-semantic-success-dim text-semantic-success' : type === 'remove' ? 'bg-semantic-error-dim text-semantic-error' : 'bg-surface-muted text-content-tertiary'
  const prefix = type === 'add' ? '+' : type === 'remove' ? '-' : ' '

  return (
    <div className={`flex ${bgColor}`}>
      <span className={`w-10 flex-shrink-0 px-2 py-0.5 text-xs font-mono text-right ${lineColor}`}>
        {lineNumber}
      </span>
      <span className={`flex-1 px-2 py-0.5 text-xs font-mono whitespace-pre ${textColor}`}>
        {prefix} {content}
      </span>
    </div>
  )
}

// Simple diff generator
function generateDiff(oldObj, newObj, path = '') {
  const lines = []
  const oldKeys = Object.keys(oldObj || {})
  const newKeys = Object.keys(newObj || {})
  const allKeys = [...new Set([...oldKeys, ...newKeys])]

  for (const key of allKeys) {
    const fullPath = path ? `${path}.${key}` : key
    const oldVal = oldObj?.[key]
    const newVal = newObj?.[key]

    if (JSON.stringify(oldVal) === JSON.stringify(newVal)) {
      // Unchanged
      if (typeof oldVal !== 'object' || oldVal === null) {
        lines.push({ type: 'same', content: `${fullPath}: ${JSON.stringify(oldVal)}` })
      }
    } else if (oldVal === undefined) {
      // Added
      lines.push({ type: 'add', content: `${fullPath}: ${JSON.stringify(newVal)}` })
    } else if (newVal === undefined) {
      // Removed
      lines.push({ type: 'remove', content: `${fullPath}: ${JSON.stringify(oldVal)}` })
    } else if (typeof oldVal === 'object' && typeof newVal === 'object') {
      // Recurse into objects
      lines.push(...generateDiff(oldVal, newVal, fullPath))
    } else {
      // Changed
      lines.push({ type: 'remove', content: `${fullPath}: ${JSON.stringify(oldVal)}` })
      lines.push({ type: 'add', content: `${fullPath}: ${JSON.stringify(newVal)}` })
    }
  }

  return lines
}

// Version item component
function VersionItem({
  version,
  isCurrent,
  isSelected,
  onSelect,
  onPreview,
  onRestore
}) {
  const [expanded, setExpanded] = useState(false)

  return (
    <div
      className={`border rounded-lg overflow-hidden ${
        isSelected ? 'border-primary-500 ring-2 ring-primary-200' : 'border-line-default'
      }`}
    >
      <div
        className={`flex items-center gap-3 p-3 cursor-pointer hover:bg-surface-muted ${
          isCurrent ? 'bg-semantic-success-dim' : ''
        }`}
        onClick={() => onSelect(version)}
      >
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

        <div className="flex-shrink-0">
          <GitCommit className={`w-5 h-5 ${isCurrent ? 'text-semantic-success' : 'text-content-tertiary'}`} />
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="font-medium text-content-primary">v{version.version_number}</span>
            {isCurrent && (
              <span className="px-1.5 py-0.5 text-xs bg-semantic-success-dim text-semantic-success rounded">
                Current
              </span>
            )}
          </div>
          {version.change_summary && (
            <p className="text-sm text-content-tertiary truncate">{version.change_summary}</p>
          )}
          <div className="flex items-center gap-3 mt-1 text-xs text-content-tertiary">
            <span className="flex items-center gap-1">
              <Clock className="w-3 h-3" />
              {formatRelativeTime(version.created_at)}
            </span>
            {version.created_by && (
              <span className="flex items-center gap-1">
                <User className="w-3 h-3" />
                {version.created_by}
              </span>
            )}
          </div>
        </div>

        <div className="flex items-center gap-1">
          <button
            onClick={(e) => { e.stopPropagation(); onPreview(version); }}
            className="p-1.5 text-content-tertiary hover:text-content-secondary hover:bg-surface-muted rounded"
            title="Preview"
          >
            <Eye className="w-4 h-4" />
          </button>
          {!isCurrent && (
            <button
              onClick={(e) => { e.stopPropagation(); onRestore(version); }}
              className="p-1.5 text-accent-primary hover:text-accent-primary hover:bg-accent-primary-dim rounded"
              title="Restore this version"
            >
              <RotateCcw className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>

      {expanded && (
        <div className="p-3 border-t border-line-subtle bg-surface-muted">
          <div className="text-xs text-content-tertiary mb-2">
            <strong>Created:</strong> {new Date(version.created_at).toLocaleString()}
          </div>
          {version.change_summary && (
            <div className="text-xs text-content-secondary">
              <strong>Changes:</strong> {version.change_summary}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

// Diff viewer component
function DiffViewer({ oldVersion, newVersion, loading }) {
  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="w-6 h-6 text-content-tertiary animate-spin" />
      </div>
    )
  }

  if (!oldVersion || !newVersion) {
    return (
      <div className="text-center py-8 text-content-tertiary">
        Select two versions to compare
      </div>
    )
  }

  const diffLines = generateDiff(oldVersion.nodes, newVersion.nodes)
  const hasChanges = diffLines.some(l => l.type !== 'same')

  if (!hasChanges) {
    return (
      <div className="text-center py-8 text-content-tertiary">
        <Check className="w-8 h-8 mx-auto mb-2 text-semantic-success" />
        No changes between versions
      </div>
    )
  }

  return (
    <div className="border border-line-default rounded-lg overflow-hidden">
      <div className="bg-surface-muted px-3 py-2 border-b border-line-default flex items-center gap-2">
        <Diff className="w-4 h-4 text-content-tertiary" />
        <span className="text-sm font-medium text-content-secondary">
          v{oldVersion.version_number} → v{newVersion.version_number}
        </span>
        <span className="text-xs text-content-tertiary ml-auto">
          {diffLines.filter(l => l.type === 'add').length} additions,{' '}
          {diffLines.filter(l => l.type === 'remove').length} deletions
        </span>
      </div>
      <div className="max-h-96 overflow-auto">
        {diffLines.filter(l => l.type !== 'same').map((line, index) => (
          <DiffLine
            key={index}
            type={line.type}
            content={line.content}
            lineNumber={index + 1}
          />
        ))}
      </div>
    </div>
  )
}

export default function VersionHistoryPanel({
  workflowId,
  currentVersion,
  onRestore,
  onClose
}) {
  const confirm = useConfirm()
  const [versions, setVersions] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [selectedVersion, setSelectedVersion] = useState(null)
  const [compareVersion, setCompareVersion] = useState(null)
  const [loadingVersions, setLoadingVersions] = useState({})
  const [restoring, setRestoring] = useState(false)
  const [showDiff, setShowDiff] = useState(false)

  useEffect(() => {
    loadVersions()
  }, [workflowId])

  const loadVersions = async () => {
    try {
      setLoading(true)
      setError(null)
      const response = await workflowsApi.getVersions(workflowId)
      setVersions(response.versions || [])
    } catch (err) {
      setError(err.message || 'Failed to load versions')
    } finally {
      setLoading(false)
    }
  }

  const loadVersionDetails = async (version) => {
    if (version.nodes) return version // Already loaded

    try {
      setLoadingVersions(prev => ({ ...prev, [version.version_number]: true }))
      const response = await workflowsApi.getVersion(workflowId, version.version_number)
      const fullVersion = response.version

      setVersions(prev => prev.map(v =>
        v.version_number === version.version_number ? fullVersion : v
      ))

      return fullVersion
    } catch (err) {
      console.error('Failed to load version details:', err)
      return version
    } finally {
      setLoadingVersions(prev => ({ ...prev, [version.version_number]: false }))
    }
  }

  const handleSelectVersion = async (version) => {
    const fullVersion = await loadVersionDetails(version)
    setSelectedVersion(fullVersion)
  }

  const handlePreview = async (version) => {
    const fullVersion = await loadVersionDetails(version)
    // Could open a modal or side panel with the full workflow preview
    console.log('Preview version:', fullVersion)
  }

  const handleRestore = async (version) => {
    const ok = await confirm({ title: 'Restore Version?', message: `Restore workflow to version ${version.version_number}? This will create a new version with the restored content.`, confirmLabel: 'Restore', variant: 'danger' })
    if (!ok) {
      return
    }

    try {
      setRestoring(true)
      await workflowsApi.restoreVersion(workflowId, version.version_number)
      await loadVersions()
      onRestore?.(version)
    } catch (err) {
      console.error('Failed to restore version:', err)
    } finally {
      setRestoring(false)
    }
  }

  const handleCompare = async () => {
    if (!selectedVersion) return

    // Compare with current version or previous
    const currentIdx = versions.findIndex(v => v.version_number === selectedVersion.version_number)
    const prevVersion = versions[currentIdx + 1]

    if (prevVersion) {
      const fullPrev = await loadVersionDetails(prevVersion)
      setCompareVersion(fullPrev)
      setShowDiff(true)
    }
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
        <button onClick={loadVersions} className="btn btn-secondary btn-sm">
          <RefreshCw className="w-4 h-4" />
          Retry
        </button>
      </div>
    )
  }

  return (
    <div className="flex flex-col h-full bg-surface">
      {/* Header */}
      <div className="p-4 border-b border-line-default">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <History className="w-5 h-5 text-content-tertiary" />
            <h3 className="font-semibold text-content-primary">Version History</h3>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={loadVersions}
              className="p-1.5 text-content-tertiary hover:text-content-secondary hover:bg-surface-muted rounded"
              title="Refresh"
            >
              <RefreshCw className="w-4 h-4" />
            </button>
            {selectedVersion && (
              <button
                onClick={handleCompare}
                className="btn btn-secondary btn-sm"
              >
                <Diff className="w-4 h-4" />
                Compare
              </button>
            )}
          </div>
        </div>
        <p className="text-xs text-content-tertiary mt-1">
          {versions.length} version{versions.length !== 1 ? 's' : ''}
        </p>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-4">
        {showDiff && selectedVersion && compareVersion ? (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h4 className="font-medium text-content-primary">Version Comparison</h4>
              <button
                onClick={() => setShowDiff(false)}
                className="p-1 text-content-tertiary hover:text-content-secondary"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <DiffViewer
              oldVersion={compareVersion}
              newVersion={selectedVersion}
              loading={loadingVersions[compareVersion?.version_number]}
            />
          </div>
        ) : versions.length === 0 ? (
          <div className="text-center py-8">
            <History className="w-8 h-8 text-content-muted mx-auto mb-2" />
            <p className="text-content-tertiary">No version history</p>
            <p className="text-xs text-content-tertiary mt-1">
              Versions are created when you save changes
            </p>
          </div>
        ) : (
          <div className="space-y-2">
            {versions.map((version, index) => (
              <VersionItem
                key={version.version_number}
                version={version}
                isCurrent={index === 0}
                isSelected={selectedVersion?.version_number === version.version_number}
                onSelect={handleSelectVersion}
                onPreview={handlePreview}
                onRestore={handleRestore}
              />
            ))}
          </div>
        )}
      </div>

      {/* Footer */}
      {restoring && (
        <div className="p-3 border-t border-line-default bg-primary-50 flex items-center gap-2">
          <Loader2 className="w-4 h-4 text-accent-primary animate-spin" />
          <span className="text-sm text-primary-700">Restoring version...</span>
        </div>
      )}
    </div>
  )
}
