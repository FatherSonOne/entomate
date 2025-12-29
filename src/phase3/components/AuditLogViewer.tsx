import React, { useState } from 'react'
import { useAuditLogs } from '../hooks'
import type { AuditLog, AuditAction, AuditCategory, AuditResourceType, AuditQueryParams } from '../types'

interface AuditLogViewerProps {
  initialFilters?: AuditQueryParams
}

export const AuditLogViewer: React.FC<AuditLogViewerProps> = ({ initialFilters = {} }) => {
  const [filters, setFilters] = useState<AuditQueryParams>({
    limit: 50,
    ...initialFilters
  })
  const [showFilters, setShowFilters] = useState(false)
  const { logs, total, isLoading, error, refetch } = useAuditLogs(filters)
  const [selectedLog, setSelectedLog] = useState<AuditLog | null>(null)

  const actions: AuditAction[] = ['create', 'read', 'update', 'delete', 'login', 'logout', 'export', 'import', 'permission_change', 'config_change']
  const categories: AuditCategory[] = ['auth', 'access', 'modification', 'admin', 'agent', 'system', 'security']
  const resourceTypes: AuditResourceType[] = ['user', 'role', 'meeting', 'task', 'customer', 'agent', 'integration', 'webhook', 'setting', 'sso_config']

  const getActionIcon = (action: AuditAction) => {
    switch (action) {
      case 'create':
        return <span className="text-green-500">+</span>
      case 'delete':
        return <span className="text-red-500">−</span>
      case 'update':
        return <span className="text-blue-500">~</span>
      case 'login':
        return <span className="text-green-500">→</span>
      case 'logout':
        return <span className="text-gray-500">←</span>
      default:
        return <span className="text-gray-400">•</span>
    }
  }

  const getCategoryColor = (category: AuditCategory) => {
    switch (category) {
      case 'auth': return 'bg-purple-100 text-purple-700'
      case 'security': return 'bg-red-100 text-red-700'
      case 'modification': return 'bg-blue-100 text-blue-700'
      case 'admin': return 'bg-orange-100 text-orange-700'
      case 'access': return 'bg-green-100 text-green-700'
      default: return 'bg-gray-100 text-gray-700'
    }
  }

  const handleFilterChange = (key: keyof AuditQueryParams, value: string | undefined) => {
    setFilters(prev => ({
      ...prev,
      [key]: value || undefined,
      offset: 0 // Reset pagination on filter change
    }))
  }

  const handleNextPage = () => {
    setFilters(prev => ({
      ...prev,
      offset: (prev.offset || 0) + (prev.limit || 50)
    }))
  }

  const handlePrevPage = () => {
    setFilters(prev => ({
      ...prev,
      offset: Math.max(0, (prev.offset || 0) - (prev.limit || 50))
    }))
  }

  const currentPage = Math.floor((filters.offset || 0) / (filters.limit || 50)) + 1
  const totalPages = Math.ceil(total / (filters.limit || 50))

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold">Audit Logs</h2>
          <p className="text-gray-500 text-sm mt-1">Track all system activity</p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => setShowFilters(!showFilters)}
            className={`px-4 py-2 rounded-full text-sm font-medium transition-colors ${
              showFilters ? 'bg-black text-white' : 'bg-gray-100 hover:bg-gray-200'
            }`}
          >
            <span className="flex items-center gap-2">
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3"></polygon>
              </svg>
              Filters
            </span>
          </button>
          <button
            onClick={() => refetch()}
            className="px-4 py-2 bg-gray-100 hover:bg-gray-200 rounded-full text-sm font-medium transition-colors"
          >
            Refresh
          </button>
        </div>
      </div>

      {/* Filters */}
      {showFilters && (
        <div className="bg-white border border-gray-100 rounded-2xl p-6">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div>
              <label className="block text-xs font-bold mb-2 text-gray-500">Action</label>
              <select
                value={filters.action || ''}
                onChange={(e) => handleFilterChange('action', e.target.value as AuditAction)}
                className="w-full p-2 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-[#2563EB] focus:border-transparent outline-none"
              >
                <option value="">All Actions</option>
                {actions.map(a => (
                  <option key={a} value={a}>{a}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-bold mb-2 text-gray-500">Category</label>
              <select
                value={filters.category || ''}
                onChange={(e) => handleFilterChange('category', e.target.value as AuditCategory)}
                className="w-full p-2 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-[#2563EB] focus:border-transparent outline-none"
              >
                <option value="">All Categories</option>
                {categories.map(c => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-bold mb-2 text-gray-500">Resource Type</label>
              <select
                value={filters.resourceType || ''}
                onChange={(e) => handleFilterChange('resourceType', e.target.value as AuditResourceType)}
                className="w-full p-2 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-[#2563EB] focus:border-transparent outline-none"
              >
                <option value="">All Types</option>
                {resourceTypes.map(r => (
                  <option key={r} value={r}>{r}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-bold mb-2 text-gray-500">User ID</label>
              <input
                value={filters.userId || ''}
                onChange={(e) => handleFilterChange('userId', e.target.value)}
                placeholder="Filter by user"
                className="w-full p-2 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-[#2563EB] focus:border-transparent outline-none"
              />
            </div>
          </div>

          <div className="flex gap-2 mt-4">
            <button
              onClick={() => setFilters({ limit: 50 })}
              className="px-3 py-1 text-sm text-gray-500 hover:text-gray-700"
            >
              Clear Filters
            </button>
          </div>
        </div>
      )}

      {/* Results Count */}
      <div className="flex justify-between items-center text-sm text-gray-500">
        <span>{total} total logs</span>
        <span>Page {currentPage} of {totalPages}</span>
      </div>

      {/* Logs Table */}
      <div className="bg-white border border-gray-100 rounded-2xl overflow-hidden">
        {isLoading ? (
          <div className="flex justify-center py-12">
            <div className="w-6 h-6 border-2 border-gray-300 border-t-gray-600 rounded-full animate-spin"></div>
          </div>
        ) : error ? (
          <div className="p-6 text-center text-red-500">{error}</div>
        ) : logs.length === 0 ? (
          <div className="p-12 text-center text-gray-400">
            <svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1" className="mx-auto mb-4 opacity-50">
              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
              <polyline points="14 2 14 8 20 8"></polyline>
              <line x1="16" y1="13" x2="8" y2="13"></line>
              <line x1="16" y1="17" x2="8" y2="17"></line>
              <polyline points="10 9 9 9 8 9"></polyline>
            </svg>
            <p>No audit logs found</p>
          </div>
        ) : (
          <div className="divide-y divide-gray-100">
            {logs.map((log) => (
              <div
                key={log.id}
                onClick={() => setSelectedLog(log)}
                className="p-4 hover:bg-gray-50 transition-colors cursor-pointer"
              >
                <div className="flex items-start gap-4">
                  <div className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center text-lg font-mono">
                    {getActionIcon(log.action)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-medium capitalize">{log.action}</span>
                      <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${getCategoryColor(log.category)}`}>
                        {log.category}
                      </span>
                      <span className="px-2 py-0.5 bg-gray-100 text-gray-600 rounded text-[10px] font-mono">
                        {log.resourceType}
                      </span>
                    </div>
                    <div className="flex items-center gap-4 mt-1 text-xs text-gray-500">
                      {log.userId && <span>User: {log.userId.slice(0, 8)}...</span>}
                      {log.resourceId && <span>Resource: {log.resourceId.slice(0, 8)}...</span>}
                      <span>{new Date(log.createdAt).toLocaleString()}</span>
                    </div>
                  </div>
                  <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-gray-300">
                    <polyline points="9 18 15 12 9 6"></polyline>
                  </svg>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Pagination */}
        {logs.length > 0 && (
          <div className="p-4 border-t border-gray-100 flex justify-between items-center">
            <button
              onClick={handlePrevPage}
              disabled={currentPage === 1}
              className="px-4 py-2 bg-gray-100 hover:bg-gray-200 rounded-xl text-sm font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Previous
            </button>
            <span className="text-sm text-gray-500">
              Showing {(filters.offset || 0) + 1} - {Math.min((filters.offset || 0) + logs.length, total)} of {total}
            </span>
            <button
              onClick={handleNextPage}
              disabled={currentPage >= totalPages}
              className="px-4 py-2 bg-gray-100 hover:bg-gray-200 rounded-xl text-sm font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Next
            </button>
          </div>
        )}
      </div>

      {/* Log Detail Modal */}
      {selectedLog && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl p-6 w-full max-w-2xl max-h-[80vh] overflow-y-auto">
            <div className="flex justify-between items-start mb-6">
              <div>
                <span className="font-mono text-xs uppercase text-gray-400">Audit Log Detail</span>
                <h3 className="text-lg font-bold mt-1 capitalize">{selectedLog.action} - {selectedLog.resourceType}</h3>
              </div>
              <button
                onClick={() => setSelectedLog(null)}
                className="text-gray-400 hover:text-gray-600"
              >
                <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <line x1="18" y1="6" x2="6" y2="18"></line>
                  <line x1="6" y1="6" x2="18" y2="18"></line>
                </svg>
              </button>
            </div>

            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <span className="text-xs text-gray-400 block">Action</span>
                  <span className="font-medium capitalize">{selectedLog.action}</span>
                </div>
                <div>
                  <span className="text-xs text-gray-400 block">Category</span>
                  <span className={`px-2 py-0.5 rounded text-xs inline-block ${getCategoryColor(selectedLog.category)}`}>
                    {selectedLog.category}
                  </span>
                </div>
                <div>
                  <span className="text-xs text-gray-400 block">Resource Type</span>
                  <span className="font-mono">{selectedLog.resourceType}</span>
                </div>
                <div>
                  <span className="text-xs text-gray-400 block">Resource ID</span>
                  <span className="font-mono text-sm">{selectedLog.resourceId || '—'}</span>
                </div>
                <div>
                  <span className="text-xs text-gray-400 block">User ID</span>
                  <span className="font-mono text-sm">{selectedLog.userId || '—'}</span>
                </div>
                <div>
                  <span className="text-xs text-gray-400 block">Timestamp</span>
                  <span>{new Date(selectedLog.createdAt).toLocaleString()}</span>
                </div>
              </div>

              {selectedLog.ipAddress && (
                <div>
                  <span className="text-xs text-gray-400 block">IP Address</span>
                  <span className="font-mono">{selectedLog.ipAddress}</span>
                </div>
              )}

              {selectedLog.userAgent && (
                <div>
                  <span className="text-xs text-gray-400 block">User Agent</span>
                  <span className="text-sm text-gray-600 break-all">{selectedLog.userAgent}</span>
                </div>
              )}

              {selectedLog.changes && (
                <div>
                  <span className="text-xs text-gray-400 block mb-2">Changes</span>
                  <div className="bg-gray-50 rounded-xl p-4 overflow-x-auto">
                    <pre className="text-xs font-mono text-gray-700">
                      {JSON.stringify(selectedLog.changes, null, 2)}
                    </pre>
                  </div>
                </div>
              )}

              {selectedLog.metadata && Object.keys(selectedLog.metadata).length > 0 && (
                <div>
                  <span className="text-xs text-gray-400 block mb-2">Metadata</span>
                  <div className="bg-gray-50 rounded-xl p-4 overflow-x-auto">
                    <pre className="text-xs font-mono text-gray-700">
                      {JSON.stringify(selectedLog.metadata, null, 2)}
                    </pre>
                  </div>
                </div>
              )}
            </div>

            <div className="mt-6 pt-6 border-t">
              <button
                onClick={() => setSelectedLog(null)}
                className="w-full py-2 bg-gray-100 hover:bg-gray-200 rounded-xl text-sm font-medium transition-colors"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default AuditLogViewer
