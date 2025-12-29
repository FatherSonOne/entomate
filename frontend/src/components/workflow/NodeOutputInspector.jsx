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
    if (value === null) return <span className="text-gray-400">null</span>
    if (value === undefined) return <span className="text-gray-400">undefined</span>
    if (typeof value === 'boolean') return <span className="text-purple-600">{value.toString()}</span>
    if (typeof value === 'number') return <span className="text-blue-600">{value}</span>
    if (typeof value === 'string') {
      if (value.length > 100) {
        return <span className="text-green-600">"{value.substring(0, 100)}..."</span>
      }
      return <span className="text-green-600">"{value}"</span>
    }
    if (isArray) return <span className="text-gray-500">[{value.length}]</span>
    if (isObject) return <span className="text-gray-500">{`{${Object.keys(value).length}}`}</span>
    return String(value)
  }

  const handleCopy = (e) => {
    e.stopPropagation()
    onCopy(isObject ? JSON.stringify(value, null, 2) : String(value))
  }

  return (
    <div className={`${matchesSearch ? 'bg-yellow-50' : ''}`}>
      <div
        className={`flex items-center gap-1 py-0.5 px-1 hover:bg-gray-100 rounded cursor-pointer group`}
        style={{ paddingLeft: depth * 16 }}
        onClick={() => isObject && setExpanded(!expanded)}
      >
        {/* Expand/collapse icon */}
        {isObject ? (
          <button className="p-0.5 hover:bg-gray-200 rounded">
            {expanded ? (
              <ChevronDown className="w-3 h-3 text-gray-500" />
            ) : (
              <ChevronRight className="w-3 h-3 text-gray-500" />
            )}
          </button>
        ) : (
          <span className="w-4" />
        )}

        {/* Key name */}
        <span className="text-gray-700 font-medium">{name}</span>
        <span className="text-gray-400">:</span>

        {/* Value */}
        <span className="flex-1 truncate text-sm font-mono">
          {getDisplayValue()}
        </span>

        {/* Copy button */}
        <button
          onClick={handleCopy}
          className="opacity-0 group-hover:opacity-100 p-1 hover:bg-gray-200 rounded"
          title="Copy value"
        >
          <Copy className="w-3 h-3 text-gray-500" />
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
      <div className="text-center text-gray-500 py-4">
        No tabular data available
      </div>
    )
  }

  // Get columns from first object
  const firstItem = data[0]
  if (typeof firstItem !== 'object' || firstItem === null) {
    return (
      <div className="text-center text-gray-500 py-4">
        Data is not in tabular format
      </div>
    )
  }

  const columns = Object.keys(firstItem)

  return (
    <div className="overflow-x-auto">
      <table className="min-w-full divide-y divide-gray-200 text-sm">
        <thead className="bg-gray-50">
          <tr>
            <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
              #
            </th>
            {columns.map(col => (
              <th
                key={col}
                className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
              >
                {col}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="bg-white divide-y divide-gray-200">
          {data.map((row, index) => (
            <tr key={index} className="hover:bg-gray-50">
              <td className="px-3 py-2 text-gray-400">{index}</td>
              {columns.map(col => (
                <td key={col} className="px-3 py-2 text-gray-900 font-mono">
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
    <div className={`flex flex-col bg-white border border-gray-200 rounded-lg shadow-sm ${className}`}>
      {/* Header */}
      <div className="flex items-center justify-between p-3 border-b border-gray-200">
        <div className="flex items-center gap-2">
          <FileJson className="w-4 h-4 text-gray-500" />
          <span className="font-medium text-gray-900">{nodeName || nodeId}</span>
          <span className="text-xs text-gray-400">Output</span>
        </div>
        <div className="flex items-center gap-1">
          {/* View mode toggle */}
          <div className="flex items-center bg-gray-100 rounded-md p-0.5">
            {Object.entries(VIEW_MODES).map(([mode, config]) => {
              const Icon = config.icon
              return (
                <button
                  key={mode}
                  onClick={() => setViewMode(mode)}
                  className={`p-1.5 rounded ${
                    viewMode === mode
                      ? 'bg-white shadow-sm text-gray-900'
                      : 'text-gray-500 hover:text-gray-700'
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
            className="p-1.5 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded"
            title={showRaw ? 'Hide raw' : 'Show raw'}
          >
            {showRaw ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
          </button>
          <button
            onClick={() => handleCopy()}
            className="p-1.5 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded"
            title="Copy all"
          >
            {copied ? <Check className="w-4 h-4 text-green-500" /> : <Copy className="w-4 h-4" />}
          </button>
          <button
            onClick={handleDownload}
            className="p-1.5 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded"
            title="Download"
          >
            <Download className="w-4 h-4" />
          </button>
          {onPin && (
            <button
              onClick={() => onPin(nodeId, output)}
              className={`p-1.5 rounded ${
                isPinned
                  ? 'text-primary-600 bg-primary-50'
                  : 'text-gray-500 hover:text-gray-700 hover:bg-gray-100'
              }`}
              title={isPinned ? 'Unpin data' : 'Pin data'}
            >
              <Code className="w-4 h-4" />
            </button>
          )}
          <button
            onClick={() => setExpanded(!expanded)}
            className="p-1.5 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded"
            title={expanded ? 'Collapse' : 'Expand'}
          >
            {expanded ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
          </button>
        </div>
      </div>

      {/* Search (for tree view) */}
      {viewMode === 'tree' && (
        <div className="p-2 border-b border-gray-100">
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              placeholder="Search..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-8 pr-3 py-1.5 text-sm border border-gray-200 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500"
            />
          </div>
        </div>
      )}

      {/* Content */}
      <div className={`flex-1 overflow-auto ${expanded ? 'max-h-[600px]' : 'max-h-[300px]'}`}>
        {isEmpty ? (
          <div className="flex items-center justify-center h-32 text-gray-500">
            No output data
          </div>
        ) : showRaw ? (
          <pre className="p-3 text-xs font-mono bg-gray-900 text-gray-100 overflow-auto">
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
          <pre className="p-3 text-xs font-mono text-gray-800 overflow-auto">
            {jsonString}
          </pre>
        ) : viewMode === 'table' ? (
          <TableView data={Array.isArray(output) ? output : [output]} onCopy={handleCopy} />
        ) : null}
      </div>

      {/* Footer with stats */}
      <div className="px-3 py-2 border-t border-gray-100 bg-gray-50 text-xs text-gray-500 flex items-center justify-between">
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
