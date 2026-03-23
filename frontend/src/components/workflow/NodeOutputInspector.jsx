/**
 * NodeOutputInspector Component
 *
 * Displays the output data from a node execution
 * with formatting, search, and copy functionality
 */

import React, { useState, useMemo } from 'react'
import {
  Copy, Check, Search, ChevronDown, ChevronRight,
  FileJson, List, Table2, Code, Download, Eye, EyeOff,
  Maximize2, Minimize2
} from 'lucide-react'

// View modes
const VIEW_MODES = {
  tree: { icon: ChevronRight, label: 'Tree' },
  json: { icon: FileJson, label: 'JSON' },
  table: { icon: Table2, label: 'Table' }
}

// Copy to clipboard helper
const copyToClipboard = async (text) => {
  try {
    await navigator.clipboard.writeText(text)
    return true
  } catch {
    return false
  }
}

// Tree node component for hierarchical view
function TreeNode({ name, value, path, depth = 0, searchTerm, onCopy }) {
  const [expanded, setExpanded] = useState(depth < 2)
  const isObject = value !== null && typeof value === 'object'
  const isArray = Array.isArray(value)

  // Check if matches search
  const matchesSearch = searchTerm && (
    name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (typeof value === 'string' && value.toLowerCase().includes(searchTerm.toLowerCase()))
  )

  // Get display value
  const getDisplayValue = () => {
    if (value === null) return <span className="text-content-tertiary">null</span>
    if (value === undefined) return <span className="text-content-tertiary">undefined</span>
    if (typeof value === 'boolean') return <span className="text-accent-tertiary">{value.toString()}</span>
    if (typeof value === 'number') return <span className="text-semantic-info">{value}</span>
    if (typeof value === 'string') {
      if (value.length > 100) {
        return <span className="text-semantic-success">"{value.substring(0, 100)}..."</span>
      }
      return <span className="text-semantic-success">"{value}"</span>
    }
    if (isArray) return <span className="text-content-tertiary">[{value.length}]</span>
    if (isObject) return <span className="text-content-tertiary">{`{${Object.keys(value).length}}`}</span>
    return String(value)
  }

  const handleCopy = (e) => {
    e.stopPropagation()
    onCopy(isObject ? JSON.stringify(value, null, 2) : String(value))
  }

  return (
    <div className={`${matchesSearch ? 'vc-bg-warning-dim' : ''}`}>
      <div
        className={`flex items-center gap-1 py-0.5 px-1 hover:bg-surface-muted rounded cursor-pointer group`}
        style={{ paddingLeft: depth * 16 }}
        onClick={() => isObject && setExpanded(!expanded)}
      >
        {/* Expand/collapse icon */}
        {isObject ? (
          <button className="p-0.5 hover:bg-surface-muted rounded">
            {expanded ? (
              <ChevronDown className="w-3 h-3 text-content-tertiary" />
            ) : (
              <ChevronRight className="w-3 h-3 text-content-tertiary" />
            )}
          </button>
        ) : (
          <span className="w-4" />
        )}

        {/* Key name */}
        <span className="text-content-secondary font-medium">{name}</span>
        <span className="text-content-tertiary">:</span>

        {/* Value */}
        <span className="flex-1 truncate text-sm font-mono">
          {getDisplayValue()}
        </span>

        {/* Copy button */}
        <button
          onClick={handleCopy}
          className="opacity-0 group-hover:opacity-100 p-1 hover:bg-surface-muted rounded"
          title="Copy value"
        >
          <Copy className="w-3 h-3 text-content-tertiary" />
        </button>
      </div>

      {/* Children */}
      {isObject && expanded && (
        <div>
          {(isArray ? value : Object.entries(value)).map((item, index) => {
            const childName = isArray ? index : item[0]
            const childValue = isArray ? item : item[1]
            const childPath = `${path}.${childName}`

            return (
              <TreeNode
                key={childPath}
                name={String(childName)}
                value={childValue}
                path={childPath}
                depth={depth + 1}
                searchTerm={searchTerm}
                onCopy={onCopy}
              />
            )
          })}
        </div>
      )}
    </div>
  )
}

// Table view for array data
function TableView({ data, onCopy }) {
  if (!Array.isArray(data) || data.length === 0) {
    return (
      <div className="text-center text-content-tertiary py-4">
        No tabular data available
      </div>
    )
  }

  // Get columns from first object
  const firstItem = data[0]
  if (typeof firstItem !== 'object' || firstItem === null) {
    return (
      <div className="text-center text-content-tertiary py-4">
        Data is not in tabular format
      </div>
    )
  }

  const columns = Object.keys(firstItem)

  return (
    <div className="overflow-x-auto">
      <table className="min-w-full divide-y divide-line-default text-sm">
        <thead className="bg-surface-muted">
          <tr>
            <th className="px-3 py-2 text-left text-xs font-medium text-content-tertiary uppercase tracking-wider">
              #
            </th>
            {columns.map(col => (
              <th
                key={col}
                className="px-3 py-2 text-left text-xs font-medium text-content-tertiary uppercase tracking-wider"
              >
                {col}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="bg-surface divide-y divide-line-default">
          {data.map((row, index) => (
            <tr key={index} className="hover:bg-surface-muted">
              <td className="px-3 py-2 text-content-tertiary">{index}</td>
              {columns.map(col => (
                <td key={col} className="px-3 py-2 text-content-primary font-mono">
                  {typeof row[col] === 'object'
                    ? JSON.stringify(row[col])
                    : String(row[col] ?? '')}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

export default function NodeOutputInspector({
  nodeId,
  nodeName,
  output,
  onClose,
  onPin,
  isPinned,
  className = ''
}) {
  const [viewMode, setViewMode] = useState('tree')
  const [searchTerm, setSearchTerm] = useState('')
  const [copied, setCopied] = useState(false)
  const [showRaw, setShowRaw] = useState(false)
  const [expanded, setExpanded] = useState(false)

  // Format JSON string
  const jsonString = useMemo(() => {
    try {
      return JSON.stringify(output, null, 2)
    } catch {
      return String(output)
    }
  }, [output])

  // Handle copy
  const handleCopy = async (text = jsonString) => {
    const success = await copyToClipboard(text)
    if (success) {
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    }
  }

  // Handle download
  const handleDownload = () => {
    const blob = new Blob([jsonString], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `${nodeName || nodeId}-output.json`
    a.click()
    URL.revokeObjectURL(url)
  }

  // Check if data is empty
  const isEmpty = output === null || output === undefined ||
    (typeof output === 'object' && Object.keys(output).length === 0)

  return (
    <div className={`flex flex-col bg-surface border border-line-default rounded-lg shadow-sm ${className}`}>
      {/* Header */}
      <div className="flex items-center justify-between p-3 border-b border-line-default">
        <div className="flex items-center gap-2">
          <FileJson className="w-4 h-4 text-content-tertiary" />
          <span className="font-medium text-content-primary">{nodeName || nodeId}</span>
          <span className="text-xs text-content-tertiary">Output</span>
        </div>
        <div className="flex items-center gap-1">
          {/* View mode toggle */}
          <div className="flex items-center bg-surface-muted rounded-md p-0.5">
            {Object.entries(VIEW_MODES).map(([mode, config]) => {
              const Icon = config.icon
              return (
                <button
                  key={mode}
                  onClick={() => setViewMode(mode)}
                  className={`p-1.5 rounded ${
                    viewMode === mode
                      ? 'bg-surface shadow-sm text-content-primary'
                      : 'text-content-tertiary hover:text-content-secondary'
                  }`}
                  title={config.label}
                >
                  <Icon className="w-4 h-4" />
                </button>
              )
            })}
          </div>

          {/* Actions */}
          <button
            onClick={() => setShowRaw(!showRaw)}
            className="p-1.5 text-content-tertiary hover:text-content-secondary hover:bg-surface-muted rounded"
            title={showRaw ? 'Hide raw' : 'Show raw'}
          >
            {showRaw ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
          </button>
          <button
            onClick={() => handleCopy()}
            className="p-1.5 text-content-tertiary hover:text-content-secondary hover:bg-surface-muted rounded"
            title="Copy all"
          >
            {copied ? <Check className="w-4 h-4 text-semantic-success" /> : <Copy className="w-4 h-4" />}
          </button>
          <button
            onClick={handleDownload}
            className="p-1.5 text-content-tertiary hover:text-content-secondary hover:bg-surface-muted rounded"
            title="Download"
          >
            <Download className="w-4 h-4" />
          </button>
          {onPin && (
            <button
              onClick={() => onPin(nodeId, output)}
              className={`p-1.5 rounded ${
                isPinned
                  ? 'text-accent-primary bg-primary-50'
                  : 'text-content-tertiary hover:text-content-secondary hover:bg-surface-muted'
              }`}
              title={isPinned ? 'Unpin data' : 'Pin data'}
            >
              <Code className="w-4 h-4" />
            </button>
          )}
          <button
            onClick={() => setExpanded(!expanded)}
            className="p-1.5 text-content-tertiary hover:text-content-secondary hover:bg-surface-muted rounded"
            title={expanded ? 'Collapse' : 'Expand'}
          >
            {expanded ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
          </button>
        </div>
      </div>

      {/* Search (for tree view) */}
      {viewMode === 'tree' && (
        <div className="p-2 border-b border-line-subtle">
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-content-tertiary" />
            <input
              type="text"
              placeholder="Search..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-8 pr-3 py-1.5 text-sm border border-line-default rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500"
            />
          </div>
        </div>
      )}

      {/* Content */}
      <div className={`flex-1 overflow-auto ${expanded ? 'max-h-[600px]' : 'max-h-[300px]'}`}>
        {isEmpty ? (
          <div className="flex items-center justify-center h-32 text-content-tertiary">
            No output data
          </div>
        ) : showRaw ? (
          <pre className="p-3 text-xs font-mono vc-bg-code vc-text-primary overflow-auto">
            {jsonString}
          </pre>
        ) : viewMode === 'tree' ? (
          <div className="p-2">
            <TreeNode
              name="output"
              value={output}
              path="output"
              depth={0}
              searchTerm={searchTerm}
              onCopy={handleCopy}
            />
          </div>
        ) : viewMode === 'json' ? (
          <pre className="p-3 text-xs font-mono text-content-primary overflow-auto">
            {jsonString}
          </pre>
        ) : viewMode === 'table' ? (
          <TableView data={Array.isArray(output) ? output : [output]} onCopy={handleCopy} />
        ) : null}
      </div>

      {/* Footer with stats */}
      <div className="px-3 py-2 border-t border-line-subtle bg-surface-muted text-xs text-content-tertiary flex items-center justify-between">
        <span>
          {typeof output === 'object' && output !== null
            ? `${Object.keys(output).length} ${Array.isArray(output) ? 'items' : 'keys'}`
            : typeof output}
        </span>
        <span>{jsonString.length} bytes</span>
      </div>
    </div>
  )
}
