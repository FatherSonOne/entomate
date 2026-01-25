import React, { useState, useEffect, useCallback } from 'react'
import { useAuth } from '@clerk/clerk-react'
import {
  Key, Plus, Trash2, Edit2, Copy, Eye, EyeOff, Shield, Clock,
  AlertCircle, CheckCircle2, Search, Filter, RefreshCw, X,
  ChevronDown, ChevronRight, Lock, Unlock, History, ExternalLink
} from 'lucide-react'

// Secrets API service factory - creates API with token getter
const createSecretsApi = (getToken) => ({
  baseUrl: import.meta.env.VITE_API_URL || 'http://localhost:3000',

  async request(endpoint, options = {}) {
    const token = await getToken()
    const response = await fetch(`${this.baseUrl}/api/secrets${endpoint}`, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...options.headers
      }
    })

    const data = await response.json()

    if (!response.ok) {
      throw new Error(data.message || data.error || 'Request failed')
    }

    return data
  },

  list: (params = {}) => {
    const queryString = new URLSearchParams(params).toString()
    return secretsApi.request(`?${queryString}`)
  },

  get: (id) => secretsApi.request(`/${id}`),

  create: (data) => secretsApi.request('', {
    method: 'POST',
    body: JSON.stringify(data)
  }),

  update: (id, data) => secretsApi.request(`/${id}`, {
    method: 'PUT',
    body: JSON.stringify(data)
  }),

  delete: (id) => secretsApi.request(`/${id}`, {
    method: 'DELETE'
  }),

  validate: (name) => secretsApi.request('/validate', {
    method: 'POST',
    body: JSON.stringify({ name })
  }),

  getAuditLog: (id, params = {}) => {
    const queryString = new URLSearchParams(params).toString()
    return secretsApi.request(`/${id}/audit?${queryString}`)
  }
})

// Create secretsApi instance - will be initialized in component
let secretsApi = null

// Environment badge colors
const ENVIRONMENT_COLORS = {
  development: 'bg-blue-100 text-blue-700 border-blue-200',
  staging: 'bg-yellow-100 text-yellow-700 border-yellow-200',
  production: 'bg-green-100 text-green-700 border-green-200'
}

// Scope icons
const SCOPE_ICONS = {
  user: Lock,
  organization: Unlock,
  workflow: ExternalLink
}

/**
 * SecretsManager Component
 *
 * A comprehensive UI for managing encrypted secrets.
 * Features:
 * - List secrets with masked values
 * - Add/Edit/Delete secrets
 * - Copy secret references
 * - Environment selector
 * - Audit log viewing
 */
export default function SecretsManager({
  workflowId = null,
  onSecretSelect = null,
  compact = false,
  className = ''
}) {
  const { getToken } = useAuth()
  
  // Initialize secretsApi with token getter
  if (!secretsApi) {
    secretsApi = createSecretsApi(getToken)
  }
  
  // State
  const [secrets, setSecrets] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedEnvironment, setSelectedEnvironment] = useState('production')
  const [selectedScope, setSelectedScope] = useState(null)

  // Modal states
  const [showAddModal, setShowAddModal] = useState(false)
  const [showEditModal, setShowEditModal] = useState(false)
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const [showAuditLog, setShowAuditLog] = useState(false)
  const [selectedSecret, setSelectedSecret] = useState(null)

  // Form state
  const [formData, setFormData] = useState({
    name: '',
    value: '',
    description: '',
    scope: 'user',
    environment: 'production',
    valueType: 'string',
    expiresAt: ''
  })
  const [formErrors, setFormErrors] = useState({})
  const [saving, setSaving] = useState(false)

  // Revealed values state
  const [revealedSecrets, setRevealedSecrets] = useState(new Set())
  const [revealedValues, setRevealedValues] = useState({})

  // Audit log state
  const [auditLogs, setAuditLogs] = useState([])
  const [auditLoading, setAuditLoading] = useState(false)

  // Load secrets
  const loadSecrets = useCallback(async () => {
    setLoading(true)
    setError(null)

    try {
      const params = {
        environment: selectedEnvironment,
        limit: 100
      }

      if (selectedScope) {
        params.scope = selectedScope
      }

      if (workflowId) {
        params.workflowId = workflowId
      }

      if (searchQuery) {
        params.search = searchQuery
      }

      const result = await secretsApi.list(params)
      setSecrets(result.secrets || [])
    } catch (err) {
      setError(err.message)
      console.error('Failed to load secrets:', err)
    } finally {
      setLoading(false)
    }
  }, [selectedEnvironment, selectedScope, workflowId, searchQuery])

  useEffect(() => {
    loadSecrets()
  }, [loadSecrets])

  // Copy reference to clipboard
  const copyReference = async (secret) => {
    try {
      await navigator.clipboard.writeText(secret.reference)
      // Could show a toast here
    } catch (err) {
      console.error('Failed to copy:', err)
    }
  }

  // Reveal secret value
  const toggleReveal = async (secret) => {
    if (revealedSecrets.has(secret.id)) {
      // Hide
      setRevealedSecrets(prev => {
        const next = new Set(prev)
        next.delete(secret.id)
        return next
      })
      setRevealedValues(prev => {
        const next = { ...prev }
        delete next[secret.id]
        return next
      })
    } else {
      // Reveal
      try {
        const result = await secretsApi.get(secret.id)
        setRevealedValues(prev => ({
          ...prev,
          [secret.id]: result.secret.value
        }))
        setRevealedSecrets(prev => new Set(prev).add(secret.id))

        // Auto-hide after 30 seconds
        setTimeout(() => {
          setRevealedSecrets(prev => {
            const next = new Set(prev)
            next.delete(secret.id)
            return next
          })
          setRevealedValues(prev => {
            const next = { ...prev }
            delete next[secret.id]
            return next
          })
        }, 30000)
      } catch (err) {
        setError(`Failed to reveal secret: ${err.message}`)
      }
    }
  }

  // Validate secret name
  const validateName = async (name) => {
    if (!name) {
      return 'Name is required'
    }

    try {
      const result = await secretsApi.validate(name)
      if (!result.valid) {
        return result.message
      }
      if (result.exists && !showEditModal) {
        return 'A secret with this name already exists'
      }
    } catch (err) {
      return 'Failed to validate name'
    }

    return null
  }

  // Handle form submit
  const handleSubmit = async (e) => {
    e.preventDefault()
    setSaving(true)
    setFormErrors({})

    try {
      // Validate
      const nameError = await validateName(formData.name)
      if (nameError) {
        setFormErrors({ name: nameError })
        setSaving(false)
        return
      }

      if (!formData.value && !showEditModal) {
        setFormErrors({ value: 'Value is required' })
        setSaving(false)
        return
      }

      if (showEditModal && selectedSecret) {
        // Update
        await secretsApi.update(selectedSecret.id, {
          value: formData.value || undefined,
          description: formData.description,
          expiresAt: formData.expiresAt || undefined
        })
      } else {
        // Create
        await secretsApi.create({
          name: formData.name,
          value: formData.value,
          description: formData.description,
          scope: formData.scope,
          environment: formData.environment,
          valueType: formData.valueType,
          workflowId: workflowId,
          expiresAt: formData.expiresAt || undefined
        })
      }

      // Reload and close
      await loadSecrets()
      setShowAddModal(false)
      setShowEditModal(false)
      resetForm()
    } catch (err) {
      setFormErrors({ submit: err.message })
    } finally {
      setSaving(false)
    }
  }

  // Handle delete
  const handleDelete = async () => {
    if (!selectedSecret) return

    try {
      await secretsApi.delete(selectedSecret.id)
      await loadSecrets()
      setShowDeleteConfirm(false)
      setSelectedSecret(null)
    } catch (err) {
      setError(`Failed to delete: ${err.message}`)
    }
  }

  // Load audit log
  const loadAuditLog = async (secret) => {
    setSelectedSecret(secret)
    setAuditLoading(true)
    setShowAuditLog(true)

    try {
      const result = await secretsApi.getAuditLog(secret.id, { limit: 50 })
      setAuditLogs(result.logs || [])
    } catch (err) {
      setError(`Failed to load audit log: ${err.message}`)
    } finally {
      setAuditLoading(false)
    }
  }

  // Reset form
  const resetForm = () => {
    setFormData({
      name: '',
      value: '',
      description: '',
      scope: 'user',
      environment: selectedEnvironment,
      valueType: 'string',
      expiresAt: ''
    })
    setFormErrors({})
  }

  // Open edit modal
  const openEditModal = (secret) => {
    setSelectedSecret(secret)
    setFormData({
      name: secret.name,
      value: '',
      description: secret.description || '',
      scope: secret.scope,
      environment: secret.environment,
      valueType: secret.valueType,
      expiresAt: secret.expiresAt ? secret.expiresAt.split('T')[0] : ''
    })
    setShowEditModal(true)
  }

  // Render secret row
  const renderSecretRow = (secret) => {
    const isRevealed = revealedSecrets.has(secret.id)
    const ScopeIcon = SCOPE_ICONS[secret.scope] || Lock

    return (
      <div
        key={secret.id}
        className={`border rounded-lg p-4 hover:border-primary-300 transition-colors ${
          secret.isExpired ? 'border-red-200 bg-red-50' : 'border-gray-200'
        }`}
      >
        <div className="flex items-start justify-between gap-4">
          {/* Secret info */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <Key className="w-4 h-4 text-gray-400 flex-shrink-0" />
              <span className="font-mono font-medium text-gray-900 truncate">
                {secret.name}
              </span>
              {secret.isExpired && (
                <span className="px-2 py-0.5 text-xs bg-red-100 text-red-700 rounded-full">
                  Expired
                </span>
              )}
            </div>

            {secret.description && (
              <p className="text-sm text-gray-500 mb-2 line-clamp-1">
                {secret.description}
              </p>
            )}

            {/* Value display */}
            <div className="flex items-center gap-2 mb-2">
              <code className="flex-1 px-2 py-1 bg-gray-100 rounded text-sm font-mono truncate">
                {isRevealed ? revealedValues[secret.id] : '***************'}
              </code>
              <button
                onClick={() => toggleReveal(secret)}
                className="p-1 hover:bg-gray-100 rounded"
                title={isRevealed ? 'Hide value' : 'Reveal value'}
              >
                {isRevealed ? (
                  <EyeOff className="w-4 h-4 text-gray-500" />
                ) : (
                  <Eye className="w-4 h-4 text-gray-500" />
                )}
              </button>
            </div>

            {/* Badges */}
            <div className="flex items-center gap-2 flex-wrap">
              <span className={`px-2 py-0.5 text-xs border rounded-full ${ENVIRONMENT_COLORS[secret.environment]}`}>
                {secret.environment}
              </span>
              <span className="px-2 py-0.5 text-xs bg-gray-100 text-gray-600 rounded-full flex items-center gap-1">
                <ScopeIcon className="w-3 h-3" />
                {secret.scope}
              </span>
              {secret.accessCount > 0 && (
                <span className="text-xs text-gray-400">
                  Accessed {secret.accessCount} times
                </span>
              )}
            </div>
          </div>

          {/* Actions */}
          <div className="flex items-center gap-1 flex-shrink-0">
            <button
              onClick={() => copyReference(secret)}
              className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
              title="Copy reference"
            >
              <Copy className="w-4 h-4 text-gray-500" />
            </button>
            <button
              onClick={() => loadAuditLog(secret)}
              className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
              title="View audit log"
            >
              <History className="w-4 h-4 text-gray-500" />
            </button>
            <button
              onClick={() => openEditModal(secret)}
              className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
              title="Edit secret"
            >
              <Edit2 className="w-4 h-4 text-gray-500" />
            </button>
            <button
              onClick={() => {
                setSelectedSecret(secret)
                setShowDeleteConfirm(true)
              }}
              className="p-2 hover:bg-red-50 rounded-lg transition-colors"
              title="Delete secret"
            >
              <Trash2 className="w-4 h-4 text-red-500" />
            </button>
          </div>
        </div>

        {/* Reference */}
        <div className="mt-3 pt-3 border-t border-gray-100">
          <div className="flex items-center gap-2">
            <span className="text-xs text-gray-500">Reference:</span>
            <code className="text-xs bg-primary-50 text-primary-700 px-2 py-0.5 rounded">
              {secret.reference}
            </code>
            {onSecretSelect && (
              <button
                onClick={() => onSecretSelect(secret.reference)}
                className="text-xs text-primary-600 hover:text-primary-700"
              >
                Insert
              </button>
            )}
          </div>
        </div>
      </div>
    )
  }

  // Render add/edit modal
  const renderFormModal = () => {
    const isEdit = showEditModal
    const title = isEdit ? 'Edit Secret' : 'Add Secret'

    return (
      <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
        <div className="bg-white rounded-xl shadow-xl max-w-lg w-full mx-4 max-h-[90vh] overflow-hidden">
          {/* Header */}
          <div className="p-4 border-b border-gray-200 flex items-center justify-between">
            <h3 className="font-semibold text-gray-900 flex items-center gap-2">
              <Shield className="w-5 h-5 text-primary-500" />
              {title}
            </h3>
            <button
              onClick={() => {
                setShowAddModal(false)
                setShowEditModal(false)
                resetForm()
              }}
              className="p-1 hover:bg-gray-100 rounded"
            >
              <X className="w-5 h-5 text-gray-500" />
            </button>
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit} className="p-4 space-y-4">
            {/* Name */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Secret Name *
              </label>
              <input
                type="text"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value.toUpperCase().replace(/[^A-Z0-9_-]/g, '') })}
                placeholder="API_KEY"
                disabled={isEdit}
                className={`input w-full font-mono ${isEdit ? 'bg-gray-100' : ''}`}
              />
              {formErrors.name && (
                <p className="text-sm text-red-600 mt-1">{formErrors.name}</p>
              )}
              <p className="text-xs text-gray-500 mt-1">
                Use uppercase letters, numbers, underscores, and hyphens
              </p>
            </div>

            {/* Value */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Secret Value {!isEdit && '*'}
              </label>
              <input
                type="password"
                value={formData.value}
                onChange={(e) => setFormData({ ...formData, value: e.target.value })}
                placeholder={isEdit ? 'Leave blank to keep current value' : 'Enter secret value'}
                className="input w-full font-mono"
              />
              {formErrors.value && (
                <p className="text-sm text-red-600 mt-1">{formErrors.value}</p>
              )}
            </div>

            {/* Description */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Description
              </label>
              <textarea
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                placeholder="What is this secret used for?"
                rows={2}
                className="input w-full"
              />
            </div>

            {/* Environment and Scope (only for new secrets) */}
            {!isEdit && (
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Environment
                  </label>
                  <select
                    value={formData.environment}
                    onChange={(e) => setFormData({ ...formData, environment: e.target.value })}
                    className="input w-full"
                  >
                    <option value="development">Development</option>
                    <option value="staging">Staging</option>
                    <option value="production">Production</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Scope
                  </label>
                  <select
                    value={formData.scope}
                    onChange={(e) => setFormData({ ...formData, scope: e.target.value })}
                    className="input w-full"
                  >
                    <option value="user">User (Private)</option>
                    <option value="organization">Organization</option>
                    {workflowId && <option value="workflow">This Workflow</option>}
                  </select>
                </div>
              </div>
            )}

            {/* Value Type (only for new secrets) */}
            {!isEdit && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Value Type
                </label>
                <select
                  value={formData.valueType}
                  onChange={(e) => setFormData({ ...formData, valueType: e.target.value })}
                  className="input w-full"
                >
                  <option value="string">String</option>
                  <option value="api_key">API Key</option>
                  <option value="json">JSON</option>
                  <option value="oauth_token">OAuth Token</option>
                  <option value="certificate">Certificate</option>
                </select>
              </div>
            )}

            {/* Expiration */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Expires At (Optional)
              </label>
              <input
                type="date"
                value={formData.expiresAt}
                onChange={(e) => setFormData({ ...formData, expiresAt: e.target.value })}
                className="input w-full"
              />
              <p className="text-xs text-gray-500 mt-1">
                Secret will be inaccessible after this date
              </p>
            </div>

            {/* Error message */}
            {formErrors.submit && (
              <div className="p-3 bg-red-50 border border-red-200 rounded-lg flex items-center gap-2">
                <AlertCircle className="w-4 h-4 text-red-500 flex-shrink-0" />
                <span className="text-sm text-red-700">{formErrors.submit}</span>
              </div>
            )}

            {/* Actions */}
            <div className="flex justify-end gap-2 pt-4 border-t">
              <button
                type="button"
                onClick={() => {
                  setShowAddModal(false)
                  setShowEditModal(false)
                  resetForm()
                }}
                className="btn btn-secondary"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={saving}
                className="btn btn-primary"
              >
                {saving ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin" />
                    Saving...
                  </>
                ) : (
                  <>
                    <CheckCircle2 className="w-4 h-4" />
                    {isEdit ? 'Save Changes' : 'Create Secret'}
                  </>
                )}
              </button>
            </div>
          </form>
        </div>
      </div>
    )
  }

  // Render delete confirmation
  const renderDeleteConfirm = () => (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white rounded-xl shadow-xl max-w-md w-full mx-4 p-6">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 bg-red-100 rounded-full flex items-center justify-center">
            <AlertCircle className="w-5 h-5 text-red-600" />
          </div>
          <div>
            <h3 className="font-semibold text-gray-900">Delete Secret</h3>
            <p className="text-sm text-gray-500">This action cannot be undone</p>
          </div>
        </div>

        <p className="text-gray-600 mb-4">
          Are you sure you want to delete the secret{' '}
          <code className="bg-gray-100 px-2 py-0.5 rounded font-mono text-sm">
            {selectedSecret?.name}
          </code>
          ? Workflows using this secret will fail.
        </p>

        <div className="flex justify-end gap-2">
          <button
            onClick={() => setShowDeleteConfirm(false)}
            className="btn btn-secondary"
          >
            Cancel
          </button>
          <button
            onClick={handleDelete}
            className="btn bg-red-600 text-white hover:bg-red-700"
          >
            <Trash2 className="w-4 h-4" />
            Delete Secret
          </button>
        </div>
      </div>
    </div>
  )

  // Render audit log modal
  const renderAuditLog = () => (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white rounded-xl shadow-xl max-w-2xl w-full mx-4 max-h-[80vh] overflow-hidden">
        <div className="p-4 border-b border-gray-200 flex items-center justify-between">
          <h3 className="font-semibold text-gray-900 flex items-center gap-2">
            <History className="w-5 h-5 text-primary-500" />
            Audit Log: {selectedSecret?.name}
          </h3>
          <button
            onClick={() => {
              setShowAuditLog(false)
              setAuditLogs([])
            }}
            className="p-1 hover:bg-gray-100 rounded"
          >
            <X className="w-5 h-5 text-gray-500" />
          </button>
        </div>

        <div className="p-4 overflow-y-auto max-h-96">
          {auditLoading ? (
            <div className="flex items-center justify-center py-8">
              <RefreshCw className="w-6 h-6 animate-spin text-gray-400" />
            </div>
          ) : auditLogs.length === 0 ? (
            <p className="text-center text-gray-500 py-8">No audit entries found</p>
          ) : (
            <div className="space-y-3">
              {auditLogs.map((log, idx) => (
                <div key={log.id || idx} className="flex items-start gap-3 p-3 bg-gray-50 rounded-lg">
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 ${
                    log.action === 'created' ? 'bg-green-100' :
                    log.action === 'deleted' ? 'bg-red-100' :
                    log.action === 'read' || log.action === 'accessed' ? 'bg-blue-100' :
                    'bg-gray-100'
                  }`}>
                    {log.action === 'created' && <Plus className="w-4 h-4 text-green-600" />}
                    {log.action === 'deleted' && <Trash2 className="w-4 h-4 text-red-600" />}
                    {(log.action === 'read' || log.action === 'accessed') && <Eye className="w-4 h-4 text-blue-600" />}
                    {log.action === 'updated' && <Edit2 className="w-4 h-4 text-gray-600" />}
                    {log.action === 'rotated' && <RefreshCw className="w-4 h-4 text-purple-600" />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="font-medium text-gray-900 capitalize">{log.action}</span>
                      <span className="text-xs text-gray-500">via {log.accessMethod}</span>
                    </div>
                    <p className="text-sm text-gray-600">
                      {log.userEmail || 'System'}
                    </p>
                    <p className="text-xs text-gray-400">
                      {new Date(log.timestamp).toLocaleString()}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )

  // Main render
  return (
    <div className={`${className}`}>
      {/* Header */}
      <div className={`flex items-center justify-between gap-4 ${compact ? 'mb-3' : 'mb-4'}`}>
        <div className="flex items-center gap-2">
          <Shield className="w-5 h-5 text-primary-500" />
          <h3 className={`font-semibold text-gray-900 ${compact ? 'text-sm' : ''}`}>
            Secrets Vault
          </h3>
        </div>
        <button
          onClick={() => {
            resetForm()
            setShowAddModal(true)
          }}
          className="btn btn-primary btn-sm"
        >
          <Plus className="w-4 h-4" />
          Add Secret
        </button>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-2 mb-4">
        {/* Search */}
        <div className="relative flex-1 min-w-48">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search secrets..."
            className="input w-full pl-9 pr-3 py-2 text-sm"
          />
        </div>

        {/* Environment filter */}
        <select
          value={selectedEnvironment}
          onChange={(e) => setSelectedEnvironment(e.target.value)}
          className="input py-2 text-sm"
        >
          <option value="production">Production</option>
          <option value="staging">Staging</option>
          <option value="development">Development</option>
        </select>

        {/* Scope filter */}
        <select
          value={selectedScope || ''}
          onChange={(e) => setSelectedScope(e.target.value || null)}
          className="input py-2 text-sm"
        >
          <option value="">All Scopes</option>
          <option value="user">User</option>
          <option value="organization">Organization</option>
          <option value="workflow">Workflow</option>
        </select>

        {/* Refresh */}
        <button
          onClick={loadSecrets}
          className="p-2 hover:bg-gray-100 rounded-lg"
          title="Refresh"
        >
          <RefreshCw className={`w-4 h-4 text-gray-500 ${loading ? 'animate-spin' : ''}`} />
        </button>
      </div>

      {/* Error message */}
      {error && (
        <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg flex items-center gap-2">
          <AlertCircle className="w-4 h-4 text-red-500 flex-shrink-0" />
          <span className="text-sm text-red-700">{error}</span>
          <button
            onClick={() => setError(null)}
            className="ml-auto p-1 hover:bg-red-100 rounded"
          >
            <X className="w-4 h-4 text-red-500" />
          </button>
        </div>
      )}

      {/* Secrets list */}
      {loading ? (
        <div className="flex items-center justify-center py-12">
          <RefreshCw className="w-6 h-6 animate-spin text-gray-400" />
        </div>
      ) : secrets.length === 0 ? (
        <div className="text-center py-12 border-2 border-dashed border-gray-200 rounded-lg">
          <Key className="w-10 h-10 text-gray-300 mx-auto mb-3" />
          <p className="text-gray-500 mb-2">No secrets found</p>
          <p className="text-sm text-gray-400">
            {searchQuery ? 'Try a different search' : 'Add your first secret to get started'}
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {secrets.map(renderSecretRow)}
        </div>
      )}

      {/* Info footer */}
      <div className="mt-4 p-3 bg-blue-50 border border-blue-100 rounded-lg">
        <p className="text-sm text-blue-700">
          <strong>Tip:</strong> Use secrets in your workflows with expressions like{' '}
          <code className="bg-blue-100 px-1 rounded">{'{{secrets.API_KEY}}'}</code>
        </p>
      </div>

      {/* Modals */}
      {(showAddModal || showEditModal) && renderFormModal()}
      {showDeleteConfirm && renderDeleteConfirm()}
      {showAuditLog && renderAuditLog()}
    </div>
  )
}
