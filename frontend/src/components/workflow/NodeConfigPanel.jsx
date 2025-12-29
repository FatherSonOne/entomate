/**
 * NodeConfigPanel Component
 *
 * Right sidebar for configuring selected node properties
 */

import React, { useState, useEffect } from 'react'
import {
  X, Settings, Play, Trash2, Copy, Pin, PinOff,
  Plus, Minus, ChevronDown, ChevronUp, HelpCircle
} from 'lucide-react'

// Field type renderers
const FieldRenderers = {
  text: ({ field, value, onChange }) => (
    <input
      type="text"
      value={value || ''}
      onChange={(e) => onChange(field.name, e.target.value)}
      placeholder={field.placeholder || `Enter ${field.label.toLowerCase()}`}
      className="w-full px-3 py-2 text-sm border border-gray-200 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500"
    />
  ),

  textarea: ({ field, value, onChange }) => (
    <textarea
      value={value || ''}
      onChange={(e) => onChange(field.name, e.target.value)}
      placeholder={field.placeholder}
      rows={field.rows || 3}
      className="w-full px-3 py-2 text-sm border border-gray-200 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500 font-mono"
    />
  ),

  number: ({ field, value, onChange }) => (
    <input
      type="number"
      value={value ?? field.default ?? ''}
      onChange={(e) => onChange(field.name, parseFloat(e.target.value) || 0)}
      min={field.min}
      max={field.max}
      step={field.step || 1}
      className="w-full px-3 py-2 text-sm border border-gray-200 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500"
    />
  ),

  select: ({ field, value, onChange }) => (
    <select
      value={value || field.default || ''}
      onChange={(e) => onChange(field.name, e.target.value)}
      className="w-full px-3 py-2 text-sm border border-gray-200 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500"
    >
      {field.options?.map(opt => (
        <option key={opt.value} value={opt.value}>{opt.label}</option>
      ))}
    </select>
  ),

  boolean: ({ field, value, onChange }) => (
    <label className="flex items-center gap-2 cursor-pointer">
      <input
        type="checkbox"
        checked={value ?? field.default ?? false}
        onChange={(e) => onChange(field.name, e.target.checked)}
        className="w-4 h-4 rounded border-gray-300 text-primary-600 focus:ring-primary-500"
      />
      <span className="text-sm text-gray-700">{field.checkboxLabel || 'Enable'}</span>
    </label>
  ),

  json: ({ field, value, onChange }) => {
    const [error, setError] = useState(null)
    const stringValue = typeof value === 'string' ? value : JSON.stringify(value || {}, null, 2)

    const handleChange = (e) => {
      const newValue = e.target.value
      try {
        JSON.parse(newValue)
        setError(null)
      } catch {
        setError('Invalid JSON')
      }
      onChange(field.name, newValue)
    }

    return (
      <div>
        <textarea
          value={stringValue}
          onChange={handleChange}
          rows={field.rows || 5}
          className={`w-full px-3 py-2 text-sm border rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500 font-mono ${
            error ? 'border-red-300' : 'border-gray-200'
          }`}
        />
        {error && <p className="text-xs text-red-500 mt-1">{error}</p>}
      </div>
    )
  },

  keyvalue: ({ field, value, onChange }) => {
    const pairs = value || []

    const addPair = () => {
      onChange(field.name, [...pairs, { key: '', value: '' }])
    }

    const updatePair = (index, key, val) => {
      const newPairs = [...pairs]
      newPairs[index] = { ...newPairs[index], [key]: val }
      onChange(field.name, newPairs)
    }

    const removePair = (index) => {
      onChange(field.name, pairs.filter((_, i) => i !== index))
    }

    return (
      <div className="space-y-2">
        {pairs.map((pair, index) => (
          <div key={index} className="flex gap-2">
            <input
              type="text"
              value={pair.key || ''}
              onChange={(e) => updatePair(index, 'key', e.target.value)}
              placeholder="Key"
              className="flex-1 px-2 py-1 text-sm border border-gray-200 rounded-md"
            />
            <input
              type="text"
              value={pair.value || ''}
              onChange={(e) => updatePair(index, 'value', e.target.value)}
              placeholder="Value"
              className="flex-1 px-2 py-1 text-sm border border-gray-200 rounded-md"
            />
            <button
              onClick={() => removePair(index)}
              className="p-1 text-red-500 hover:bg-red-50 rounded"
            >
              <Minus className="w-4 h-4" />
            </button>
          </div>
        ))}
        <button
          onClick={addPair}
          className="flex items-center gap-1 text-sm text-primary-600 hover:text-primary-700"
        >
          <Plus className="w-4 h-4" />
          Add {field.itemLabel || 'item'}
        </button>
      </div>
    )
  },

  conditions: ({ field, value, onChange }) => {
    const conditions = value || []
    const operators = [
      { value: 'equals', label: 'equals' },
      { value: 'not_equals', label: 'not equals' },
      { value: 'contains', label: 'contains' },
      { value: 'not_contains', label: 'not contains' },
      { value: 'greater_than', label: 'greater than' },
      { value: 'less_than', label: 'less than' },
      { value: 'exists', label: 'exists' },
      { value: 'not_exists', label: 'not exists' },
      { value: 'is_empty', label: 'is empty' },
      { value: 'is_not_empty', label: 'is not empty' }
    ]

    const addCondition = () => {
      onChange(field.name, [...conditions, { field: '', operator: 'equals', value: '', combineWith: 'AND' }])
    }

    const updateCondition = (index, key, val) => {
      const newConditions = [...conditions]
      newConditions[index] = { ...newConditions[index], [key]: val }
      onChange(field.name, newConditions)
    }

    const removeCondition = (index) => {
      onChange(field.name, conditions.filter((_, i) => i !== index))
    }

    return (
      <div className="space-y-3">
        {conditions.map((cond, index) => (
          <div key={index} className="p-3 bg-gray-50 rounded-lg border border-gray-200 space-y-2">
            {index > 0 && (
              <select
                value={cond.combineWith || 'AND'}
                onChange={(e) => updateCondition(index, 'combineWith', e.target.value)}
                className="px-2 py-1 text-xs border border-gray-200 rounded"
              >
                <option value="AND">AND</option>
                <option value="OR">OR</option>
              </select>
            )}
            <div className="flex gap-2">
              <input
                type="text"
                value={cond.field || ''}
                onChange={(e) => updateCondition(index, 'field', e.target.value)}
                placeholder="Field path"
                className="flex-1 px-2 py-1 text-sm border border-gray-200 rounded-md"
              />
              <select
                value={cond.operator || 'equals'}
                onChange={(e) => updateCondition(index, 'operator', e.target.value)}
                className="px-2 py-1 text-sm border border-gray-200 rounded-md"
              >
                {operators.map(op => (
                  <option key={op.value} value={op.value}>{op.label}</option>
                ))}
              </select>
            </div>
            {!['exists', 'not_exists', 'is_empty', 'is_not_empty'].includes(cond.operator) && (
              <input
                type="text"
                value={cond.value || ''}
                onChange={(e) => updateCondition(index, 'value', e.target.value)}
                placeholder="Value"
                className="w-full px-2 py-1 text-sm border border-gray-200 rounded-md"
              />
            )}
            <button
              onClick={() => removeCondition(index)}
              className="text-xs text-red-500 hover:text-red-700"
            >
              Remove condition
            </button>
          </div>
        ))}
        <button
          onClick={addCondition}
          className="flex items-center gap-1 text-sm text-primary-600 hover:text-primary-700"
        >
          <Plus className="w-4 h-4" />
          Add condition
        </button>
      </div>
    )
  }
}

// Node configuration schemas
const nodeSchemas = {
  // Triggers
  webhook: [
    { name: 'path', label: 'Webhook Path', type: 'text', placeholder: '/my-webhook' },
    { name: 'method', label: 'HTTP Method', type: 'select', options: [
      { value: 'POST', label: 'POST' },
      { value: 'GET', label: 'GET' },
      { value: 'PUT', label: 'PUT' },
      { value: 'DELETE', label: 'DELETE' }
    ]},
    { name: 'authentication', label: 'Authentication', type: 'select', options: [
      { value: 'none', label: 'None' },
      { value: 'header', label: 'Header Token' },
      { value: 'basic', label: 'Basic Auth' },
      { value: 'api_key', label: 'API Key' }
    ]}
  ],
  schedule: [
    { name: 'cron', label: 'Cron Expression', type: 'text', placeholder: '0 9 * * 1-5' },
    { name: 'timezone', label: 'Timezone', type: 'select', options: [
      { value: 'UTC', label: 'UTC' },
      { value: 'America/New_York', label: 'Eastern Time' },
      { value: 'America/Los_Angeles', label: 'Pacific Time' },
      { value: 'Europe/London', label: 'London' }
    ]}
  ],

  // Logic
  if: [
    { name: 'conditions', label: 'Conditions', type: 'conditions' }
  ],
  switch: [
    { name: 'field', label: 'Switch Field', type: 'text', placeholder: 'data.status' },
    { name: 'cases', label: 'Cases', type: 'keyvalue', itemLabel: 'case' }
  ],
  wait: [
    { name: 'duration', label: 'Duration', type: 'number', min: 1 },
    { name: 'unit', label: 'Unit', type: 'select', options: [
      { value: 'seconds', label: 'Seconds' },
      { value: 'minutes', label: 'Minutes' },
      { value: 'hours', label: 'Hours' }
    ]}
  ],
  loop: [
    { name: 'inputField', label: 'Input Field', type: 'text', placeholder: 'items' },
    { name: 'itemVariable', label: 'Item Variable', type: 'text', default: 'item' },
    { name: 'indexVariable', label: 'Index Variable', type: 'text', default: 'index' }
  ],
  filter: [
    { name: 'field', label: 'Field', type: 'text' },
    { name: 'operator', label: 'Operator', type: 'select', options: [
      { value: 'equals', label: 'Equals' },
      { value: 'not_equals', label: 'Not Equals' },
      { value: 'contains', label: 'Contains' },
      { value: 'greater_than', label: 'Greater Than' },
      { value: 'less_than', label: 'Less Than' }
    ]},
    { name: 'value', label: 'Value', type: 'text' }
  ],

  // Actions
  http_request: [
    { name: 'url', label: 'URL', type: 'text', placeholder: 'https://api.example.com/endpoint' },
    { name: 'method', label: 'Method', type: 'select', options: [
      { value: 'GET', label: 'GET' },
      { value: 'POST', label: 'POST' },
      { value: 'PUT', label: 'PUT' },
      { value: 'DELETE', label: 'DELETE' },
      { value: 'PATCH', label: 'PATCH' }
    ]},
    { name: 'headers', label: 'Headers', type: 'keyvalue', itemLabel: 'header' },
    { name: 'body', label: 'Request Body', type: 'json' }
  ],
  send_slack: [
    { name: 'channel', label: 'Channel', type: 'text', placeholder: '#general' },
    { name: 'message', label: 'Message', type: 'textarea', rows: 4 }
  ],
  send_email: [
    { name: 'to', label: 'To', type: 'text', placeholder: 'email@example.com' },
    { name: 'subject', label: 'Subject', type: 'text' },
    { name: 'body', label: 'Body', type: 'textarea', rows: 6 }
  ],
  create_task: [
    { name: 'title', label: 'Task Title', type: 'text' },
    { name: 'description', label: 'Description', type: 'textarea' },
    { name: 'priority', label: 'Priority', type: 'select', options: [
      { value: 'low', label: 'Low' },
      { value: 'medium', label: 'Medium' },
      { value: 'high', label: 'High' },
      { value: 'urgent', label: 'Urgent' }
    ]},
    { name: 'assignee', label: 'Assignee', type: 'text' }
  ],
  code: [
    { name: 'code', label: 'JavaScript Code', type: 'textarea', rows: 10 }
  ],

  // AI
  ai_agent: [
    { name: 'agentType', label: 'Agent Type', type: 'select', options: [
      { value: 'assignment', label: 'Assignment Agent' },
      { value: 'priority', label: 'Priority Agent' },
      { value: 'deadline', label: 'Deadline Agent' },
      { value: 'followup', label: 'Follow-up Agent' }
    ]}
  ],
  ai_prompt: [
    { name: 'prompt', label: 'Prompt', type: 'textarea', rows: 6 },
    { name: 'model', label: 'Model', type: 'select', options: [
      { value: 'gpt-4', label: 'GPT-4' },
      { value: 'gpt-3.5-turbo', label: 'GPT-3.5 Turbo' },
      { value: 'gemini-pro', label: 'Gemini Pro' }
    ]},
    { name: 'temperature', label: 'Temperature', type: 'number', min: 0, max: 2, step: 0.1, default: 0.7 }
  ],
  ai_extract: [
    { name: 'prompt', label: 'Extraction Prompt', type: 'textarea' },
    { name: 'schema', label: 'Output Schema (JSON)', type: 'json' }
  ],

  // Data
  transform: [
    { name: 'expression', label: 'Transform Expression', type: 'textarea', rows: 4 }
  ],
  set: [
    { name: 'fields', label: 'Fields to Set', type: 'keyvalue', itemLabel: 'field' }
  ],
  datetime: [
    { name: 'operation', label: 'Operation', type: 'select', options: [
      { value: 'now', label: 'Current DateTime' },
      { value: 'format', label: 'Format Date' },
      { value: 'add', label: 'Add Duration' },
      { value: 'subtract', label: 'Subtract Duration' }
    ]},
    { name: 'format', label: 'Format', type: 'text', placeholder: 'YYYY-MM-DD' }
  ]
}

export default function NodeConfigPanel({
  node,
  onClose,
  onUpdate,
  onDelete,
  onDuplicate,
  onTest,
  onTogglePin,
  isPinned
}) {
  const [config, setConfig] = useState({})
  const [showAdvanced, setShowAdvanced] = useState(false)

  useEffect(() => {
    if (node) {
      setConfig(node.data?.config || {})
    }
  }, [node])

  if (!node) {
    return (
      <div className="w-80 bg-gray-50 border-l border-gray-200 flex items-center justify-center">
        <div className="text-center text-gray-500 p-6">
          <Settings className="w-12 h-12 mx-auto mb-3 opacity-30" />
          <p className="text-sm">Select a node to configure</p>
        </div>
      </div>
    )
  }

  const schema = nodeSchemas[node.type] || []

  const handleFieldChange = (fieldName, value) => {
    const newConfig = { ...config, [fieldName]: value }
    setConfig(newConfig)
    onUpdate(node.id, { config: newConfig })
  }

  const handleLabelChange = (e) => {
    onUpdate(node.id, { label: e.target.value })
  }

  const handleDescriptionChange = (e) => {
    onUpdate(node.id, { description: e.target.value })
  }

  return (
    <div className="w-80 bg-white border-l border-gray-200 flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between p-3 border-b border-gray-200">
        <h3 className="text-sm font-semibold text-gray-900">Node Configuration</h3>
        <button
          onClick={onClose}
          className="p-1 hover:bg-gray-100 rounded text-gray-500"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {/* Basic info */}
        <div className="space-y-3">
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">Node Label</label>
            <input
              type="text"
              value={node.data?.label || ''}
              onChange={handleLabelChange}
              className="w-full px-3 py-2 text-sm border border-gray-200 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">Description</label>
            <textarea
              value={node.data?.description || ''}
              onChange={handleDescriptionChange}
              rows={2}
              className="w-full px-3 py-2 text-sm border border-gray-200 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500"
            />
          </div>
        </div>

        {/* Node type badge */}
        <div className="flex items-center gap-2">
          <span className="text-xs text-gray-500">Type:</span>
          <span className="px-2 py-0.5 text-xs bg-gray-100 text-gray-700 rounded-full">
            {node.type?.replace(/_/g, ' ')}
          </span>
        </div>

        {/* Configuration fields */}
        {schema.length > 0 && (
          <div className="space-y-4 pt-2 border-t border-gray-100">
            <h4 className="text-xs font-medium text-gray-700 uppercase tracking-wider">Configuration</h4>
            {schema.map((field) => {
              const Renderer = FieldRenderers[field.type] || FieldRenderers.text
              return (
                <div key={field.name}>
                  <label className="flex items-center gap-1 text-xs font-medium text-gray-700 mb-1">
                    {field.label}
                    {field.required && <span className="text-red-500">*</span>}
                    {field.help && (
                      <HelpCircle className="w-3 h-3 text-gray-400 cursor-help" title={field.help} />
                    )}
                  </label>
                  <Renderer
                    field={field}
                    value={config[field.name]}
                    onChange={handleFieldChange}
                  />
                </div>
              )
            })}
          </div>
        )}

        {/* Advanced section */}
        <div className="pt-2 border-t border-gray-100">
          <button
            onClick={() => setShowAdvanced(!showAdvanced)}
            className="flex items-center gap-1 text-xs text-gray-500 hover:text-gray-700"
          >
            {showAdvanced ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
            Advanced Options
          </button>
          {showAdvanced && (
            <div className="mt-3 space-y-3">
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Notes</label>
                <textarea
                  value={config.notes || ''}
                  onChange={(e) => handleFieldChange('notes', e.target.value)}
                  rows={2}
                  placeholder="Internal notes about this node..."
                  className="w-full px-3 py-2 text-sm border border-gray-200 rounded-md"
                />
              </div>
              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="continueOnFail"
                  checked={config.continueOnFail || false}
                  onChange={(e) => handleFieldChange('continueOnFail', e.target.checked)}
                  className="w-4 h-4 rounded border-gray-300"
                />
                <label htmlFor="continueOnFail" className="text-sm text-gray-700">
                  Continue on failure
                </label>
              </div>
              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="disabled"
                  checked={config.disabled || false}
                  onChange={(e) => handleFieldChange('disabled', e.target.checked)}
                  className="w-4 h-4 rounded border-gray-300"
                />
                <label htmlFor="disabled" className="text-sm text-gray-700">
                  Disable this node
                </label>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Actions footer */}
      <div className="p-3 border-t border-gray-200 space-y-2">
        <div className="flex gap-2">
          <button
            onClick={() => onTest?.(node.id)}
            className="flex-1 btn btn-secondary btn-sm"
          >
            <Play className="w-4 h-4" />
            Test
          </button>
          <button
            onClick={() => onTogglePin?.(node.id)}
            className={`btn btn-sm ${isPinned ? 'btn-primary' : 'btn-secondary'}`}
            title={isPinned ? 'Unpin data' : 'Pin data'}
          >
            {isPinned ? <PinOff className="w-4 h-4" /> : <Pin className="w-4 h-4" />}
          </button>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => onDuplicate?.(node.id)}
            className="flex-1 btn btn-ghost btn-sm"
          >
            <Copy className="w-4 h-4" />
            Duplicate
          </button>
          <button
            onClick={() => onDelete?.(node.id)}
            className="btn btn-ghost btn-sm text-red-600 hover:bg-red-50"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  )
}
