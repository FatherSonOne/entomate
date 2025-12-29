import React, { useState } from 'react'
import { useActiveAlerts, useAlertStatistics, useRealtimeAlerts } from '../hooks'
import type { CustomerAlert, AlertSeverity, AlertType } from '../types'

interface CustomerAlertsPanelProps {
  userId: string
  onAlertClick?: (alert: CustomerAlert) => void
}

export const CustomerAlertsPanel: React.FC<CustomerAlertsPanelProps> = ({
  userId,
  onAlertClick
}) => {
  const { alerts, isLoading, refetch, acknowledgeAlert, resolveAlert } = useActiveAlerts(50)
  const { stats } = useAlertStatistics()
  const [selectedAlert, setSelectedAlert] = useState<CustomerAlert | null>(null)
  const [resolveText, setResolveText] = useState('')
  const [filter, setFilter] = useState<'all' | AlertSeverity>('all')

  // Real-time alerts
  useRealtimeAlerts((newAlert) => {
    refetch()
  })

  const getSeverityIcon = (severity: AlertSeverity) => {
    switch (severity) {
      case 'critical':
        return (
          <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-red-500">
            <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"></path>
            <line x1="12" y1="9" x2="12" y2="13"></line>
            <line x1="12" y1="17" x2="12.01" y2="17"></line>
          </svg>
        )
      case 'warning':
        return (
          <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-yellow-500">
            <circle cx="12" cy="12" r="10"></circle>
            <line x1="12" y1="8" x2="12" y2="12"></line>
            <line x1="12" y1="16" x2="12.01" y2="16"></line>
          </svg>
        )
      default:
        return (
          <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-blue-500">
            <circle cx="12" cy="12" r="10"></circle>
            <line x1="12" y1="16" x2="12" y2="12"></line>
            <line x1="12" y1="8" x2="12.01" y2="8"></line>
          </svg>
        )
    }
  }

  const getSeverityStyle = (severity: AlertSeverity) => {
    switch (severity) {
      case 'critical': return 'border-red-200 bg-red-50'
      case 'warning': return 'border-yellow-200 bg-yellow-50'
      default: return 'border-blue-200 bg-blue-50'
    }
  }

  const getAlertTypeLabel = (type: AlertType) => {
    const labels: Record<AlertType, string> = {
      score_drop: 'Score Drop',
      declining_trend: 'Declining Trend',
      no_interaction: 'No Interaction',
      repeated_negative: 'Repeated Negative',
      churn_risk: 'Churn Risk',
      engagement_drop: 'Engagement Drop'
    }
    return labels[type] || type
  }

  const handleAcknowledge = async (alertId: string) => {
    await acknowledgeAlert(alertId, userId)
  }

  const handleResolve = async () => {
    if (!selectedAlert || !resolveText.trim()) return
    await resolveAlert(selectedAlert.id, userId, resolveText)
    setSelectedAlert(null)
    setResolveText('')
  }

  const filteredAlerts = filter === 'all'
    ? alerts
    : alerts.filter(a => a.severity === filter)

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold">Customer Alerts</h2>
          <p className="text-gray-500 text-sm mt-1">Monitor and respond to customer issues</p>
        </div>
        <button
          onClick={() => refetch()}
          className="px-4 py-2 bg-gray-100 hover:bg-gray-200 rounded-full text-sm font-medium transition-colors"
        >
          Refresh
        </button>
      </div>

      {/* Stats Cards */}
      {stats && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="bg-white border border-gray-100 rounded-2xl p-4">
            <span className="font-mono text-xs uppercase text-gray-400">Active</span>
            <div className="mt-1 text-2xl font-bold">{stats.totalActive}</div>
          </div>
          <div className="bg-red-50 border border-red-100 rounded-2xl p-4">
            <span className="font-mono text-xs uppercase text-red-600">Critical</span>
            <div className="mt-1 text-2xl font-bold text-red-700">{stats.bySeverity.critical}</div>
          </div>
          <div className="bg-yellow-50 border border-yellow-100 rounded-2xl p-4">
            <span className="font-mono text-xs uppercase text-yellow-600">Warning</span>
            <div className="mt-1 text-2xl font-bold text-yellow-700">{stats.bySeverity.warning}</div>
          </div>
          <div className="bg-green-50 border border-green-100 rounded-2xl p-4">
            <span className="font-mono text-xs uppercase text-green-600">Resolved</span>
            <div className="mt-1 text-2xl font-bold text-green-700">{stats.totalResolved}</div>
          </div>
        </div>
      )}

      {/* Filter Tabs */}
      <div className="flex gap-2 p-1 bg-gray-100 rounded-full w-fit">
        {(['all', 'critical', 'warning', 'info'] as const).map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`px-4 py-2 rounded-full text-xs font-bold font-mono uppercase transition-colors ${
              filter === f ? 'bg-black text-white' : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            {f}
          </button>
        ))}
      </div>

      {/* Alerts List */}
      <div className="bg-white border border-gray-100 rounded-2xl overflow-hidden">
        {isLoading ? (
          <div className="flex justify-center py-12">
            <div className="w-6 h-6 border-2 border-gray-300 border-t-gray-600 rounded-full animate-spin"></div>
          </div>
        ) : filteredAlerts.length === 0 ? (
          <div className="text-center py-12 text-gray-400">
            <svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1" className="mx-auto mb-4 opacity-50">
              <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path>
              <polyline points="22 4 12 14.01 9 11.01"></polyline>
            </svg>
            <p>No active alerts</p>
          </div>
        ) : (
          <div className="divide-y divide-gray-100">
            {filteredAlerts.map((alert) => (
              <div
                key={alert.id}
                className={`p-4 hover:bg-gray-50 transition-colors cursor-pointer ${getSeverityStyle(alert.severity)}`}
                onClick={() => {
                  setSelectedAlert(alert)
                  onAlertClick?.(alert)
                }}
              >
                <div className="flex items-start gap-4">
                  <div className="mt-1">{getSeverityIcon(alert.severity)}</div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="font-bold">{alert.title}</span>
                      <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase ${
                        alert.severity === 'critical' ? 'bg-red-100 text-red-700' :
                        alert.severity === 'warning' ? 'bg-yellow-100 text-yellow-700' :
                        'bg-blue-100 text-blue-700'
                      }`}>
                        {alert.severity}
                      </span>
                      <span className="px-2 py-0.5 bg-gray-100 text-gray-600 rounded-full text-[10px] font-mono">
                        {getAlertTypeLabel(alert.alertType)}
                      </span>
                    </div>
                    <p className="text-gray-600 text-sm">{alert.message}</p>
                    <div className="flex items-center gap-4 mt-2 text-xs text-gray-400">
                      <span>{alert.customerId}</span>
                      <span>{new Date(alert.createdAt).toLocaleString()}</span>
                      {alert.status === 'acknowledged' && (
                        <span className="text-blue-500">Acknowledged</span>
                      )}
                    </div>
                    {alert.suggestedAction && (
                      <div className="mt-2 p-2 bg-white rounded-lg text-sm text-gray-600 border border-gray-200">
                        <span className="font-mono text-[10px] uppercase text-gray-400 block mb-1">Suggested Action</span>
                        {alert.suggestedAction}
                      </div>
                    )}
                  </div>
                  <div className="flex gap-2">
                    {alert.status === 'active' && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation()
                          handleAcknowledge(alert.id)
                        }}
                        className="px-3 py-1 bg-gray-200 hover:bg-gray-300 rounded-full text-xs font-medium transition-colors"
                      >
                        Acknowledge
                      </button>
                    )}
                    <button
                      onClick={(e) => {
                        e.stopPropagation()
                        setSelectedAlert(alert)
                      }}
                      className="px-3 py-1 bg-[#2563EB] text-white hover:bg-[#008f5b] rounded-full text-xs font-medium transition-colors"
                    >
                      Resolve
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Resolve Modal */}
      {selectedAlert && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl p-6 w-full max-w-md">
            <div className="flex justify-between items-start mb-4">
              <div>
                <span className="font-mono text-xs uppercase text-gray-400">Resolve Alert</span>
                <h3 className="text-lg font-bold mt-1">{selectedAlert.title}</h3>
              </div>
              <button
                onClick={() => {
                  setSelectedAlert(null)
                  setResolveText('')
                }}
                className="text-gray-400 hover:text-gray-600"
              >
                <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <line x1="18" y1="6" x2="6" y2="18"></line>
                  <line x1="6" y1="6" x2="18" y2="18"></line>
                </svg>
              </button>
            </div>

            <div className="mb-4 p-3 bg-gray-50 rounded-xl text-sm text-gray-600">
              {selectedAlert.message}
            </div>

            <div className="mb-4">
              <label className="block text-xs font-bold mb-2 text-gray-500">Resolution Notes</label>
              <textarea
                value={resolveText}
                onChange={(e) => setResolveText(e.target.value)}
                placeholder="Describe how this was resolved..."
                className="w-full p-3 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-[#2563EB] focus:border-transparent outline-none resize-none h-24"
              />
            </div>

            <div className="flex gap-3">
              <button
                onClick={() => {
                  setSelectedAlert(null)
                  setResolveText('')
                }}
                className="flex-1 py-2 bg-gray-100 hover:bg-gray-200 rounded-xl text-sm font-medium transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleResolve}
                disabled={!resolveText.trim()}
                className="flex-1 py-2 bg-[#2563EB] text-white hover:bg-[#008f5b] rounded-xl text-sm font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Mark Resolved
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default CustomerAlertsPanel
