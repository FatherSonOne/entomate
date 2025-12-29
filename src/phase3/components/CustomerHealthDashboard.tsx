import React, { useState } from 'react'
import {
  useHealthDistribution,
  useCustomersNeedingAttention,
  useCustomerHealth,
  useRealtimeHealth
} from '../hooks'
import type { CustomerHealth, HealthLabel } from '../types'

interface CustomerHealthDashboardProps {
  onCustomerSelect?: (customerId: string) => void
}

export const CustomerHealthDashboard: React.FC<CustomerHealthDashboardProps> = ({
  onCustomerSelect
}) => {
  const { distribution, isLoading: distLoading } = useHealthDistribution()
  const { customers, isLoading: custLoading, refetch } = useCustomersNeedingAttention(20)
  const [selectedCustomerId, setSelectedCustomerId] = useState<string | null>(null)

  const getHealthColor = (label: HealthLabel) => {
    switch (label) {
      case 'healthy': return 'bg-green-500'
      case 'at_risk': return 'bg-yellow-500'
      case 'critical': return 'bg-red-500'
      default: return 'bg-gray-500'
    }
  }

  const getHealthBgColor = (label: HealthLabel) => {
    switch (label) {
      case 'healthy': return 'bg-green-100 text-green-700'
      case 'at_risk': return 'bg-yellow-100 text-yellow-700'
      case 'critical': return 'bg-red-100 text-red-700'
      default: return 'bg-gray-100 text-gray-700'
    }
  }

  const getTrendIcon = (trend: string) => {
    switch (trend) {
      case 'improving':
        return (
          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-green-500">
            <polyline points="23 6 13.5 15.5 8.5 10.5 1 18"></polyline>
            <polyline points="17 6 23 6 23 12"></polyline>
          </svg>
        )
      case 'declining':
        return (
          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-red-500">
            <polyline points="23 18 13.5 8.5 8.5 13.5 1 6"></polyline>
            <polyline points="17 18 23 18 23 12"></polyline>
          </svg>
        )
      default:
        return (
          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-gray-400">
            <line x1="5" y1="12" x2="19" y2="12"></line>
          </svg>
        )
    }
  }

  const handleCustomerClick = (customerId: string) => {
    setSelectedCustomerId(customerId)
    onCustomerSelect?.(customerId)
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold">Customer Health</h2>
          <p className="text-gray-500 text-sm mt-1">Monitor customer sentiment and engagement</p>
        </div>
        <button
          onClick={() => refetch()}
          className="px-4 py-2 bg-gray-100 hover:bg-gray-200 rounded-full text-sm font-medium transition-colors"
        >
          Refresh
        </button>
      </div>

      {/* Distribution Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        {/* Total */}
        <div className="bg-white border border-gray-100 rounded-2xl p-6">
          <span className="font-mono text-xs uppercase text-gray-400">Total Customers</span>
          <div className="mt-2 text-4xl font-bold">
            {distLoading ? '—' : distribution?.total || 0}
          </div>
        </div>

        {/* Healthy */}
        <div className="bg-green-50 border border-green-100 rounded-2xl p-6">
          <span className="font-mono text-xs uppercase text-green-600">Healthy</span>
          <div className="mt-2 flex items-end gap-2">
            <span className="text-4xl font-bold text-green-700">
              {distLoading ? '—' : distribution?.healthy || 0}
            </span>
            {distribution && distribution.total > 0 && (
              <span className="text-green-600 text-sm mb-1">
                ({Math.round((distribution.healthy / distribution.total) * 100)}%)
              </span>
            )}
          </div>
        </div>

        {/* At Risk */}
        <div className="bg-yellow-50 border border-yellow-100 rounded-2xl p-6">
          <span className="font-mono text-xs uppercase text-yellow-600">At Risk</span>
          <div className="mt-2 flex items-end gap-2">
            <span className="text-4xl font-bold text-yellow-700">
              {distLoading ? '—' : distribution?.atRisk || 0}
            </span>
            {distribution && distribution.total > 0 && (
              <span className="text-yellow-600 text-sm mb-1">
                ({Math.round((distribution.atRisk / distribution.total) * 100)}%)
              </span>
            )}
          </div>
        </div>

        {/* Critical */}
        <div className="bg-red-50 border border-red-100 rounded-2xl p-6">
          <span className="font-mono text-xs uppercase text-red-600">Critical</span>
          <div className="mt-2 flex items-end gap-2">
            <span className="text-4xl font-bold text-red-700">
              {distLoading ? '—' : distribution?.critical || 0}
            </span>
            {distribution && distribution.total > 0 && (
              <span className="text-red-600 text-sm mb-1">
                ({Math.round((distribution.critical / distribution.total) * 100)}%)
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Health Bar */}
      {distribution && distribution.total > 0 && (
        <div className="bg-white border border-gray-100 rounded-2xl p-6">
          <span className="font-mono text-xs uppercase text-gray-400 mb-4 block">Distribution</span>
          <div className="h-4 rounded-full overflow-hidden flex">
            <div
              className="bg-green-500 transition-all duration-500"
              style={{ width: `${(distribution.healthy / distribution.total) * 100}%` }}
            />
            <div
              className="bg-yellow-500 transition-all duration-500"
              style={{ width: `${(distribution.atRisk / distribution.total) * 100}%` }}
            />
            <div
              className="bg-red-500 transition-all duration-500"
              style={{ width: `${(distribution.critical / distribution.total) * 100}%` }}
            />
          </div>
          <div className="flex justify-between mt-2 text-xs text-gray-500">
            <span>Healthy</span>
            <span>At Risk</span>
            <span>Critical</span>
          </div>
        </div>
      )}

      {/* Customers Needing Attention */}
      <div className="bg-white border border-gray-100 rounded-2xl p-6">
        <div className="flex justify-between items-center mb-4">
          <span className="font-mono text-xs uppercase text-gray-400">Needs Attention</span>
          <span className="text-xs text-gray-500">{customers.length} customers</span>
        </div>

        {custLoading ? (
          <div className="flex justify-center py-8">
            <div className="w-6 h-6 border-2 border-gray-300 border-t-gray-600 rounded-full animate-spin"></div>
          </div>
        ) : customers.length === 0 ? (
          <div className="text-center py-8 text-gray-400">
            <p>All customers are healthy!</p>
          </div>
        ) : (
          <div className="space-y-3">
            {customers.map((customer) => (
              <div
                key={customer.customerId}
                onClick={() => handleCustomerClick(customer.customerId)}
                className={`p-4 rounded-xl border transition-all cursor-pointer hover:shadow-md ${
                  selectedCustomerId === customer.customerId
                    ? 'border-blue-500 bg-blue-50'
                    : 'border-gray-100 hover:border-gray-200'
                }`}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    {/* Health Score Circle */}
                    <div className={`w-12 h-12 rounded-full flex items-center justify-center text-white font-bold ${getHealthColor(customer.healthLabel)}`}>
                      {customer.healthScore}
                    </div>
                    <div>
                      <div className="font-medium">{customer.customerId}</div>
                      <div className="flex items-center gap-2 text-xs text-gray-500 mt-1">
                        <span className={`px-2 py-0.5 rounded-full ${getHealthBgColor(customer.healthLabel)}`}>
                          {customer.healthLabel.replace('_', ' ')}
                        </span>
                        {customer.daysSinceInteraction !== null && (
                          <span>
                            {customer.daysSinceInteraction === 0
                              ? 'Today'
                              : `${customer.daysSinceInteraction}d ago`}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {getTrendIcon(customer.sentimentTrend)}
                    <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-gray-300">
                      <polyline points="9 18 15 12 9 6"></polyline>
                    </svg>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Selected Customer Detail */}
      {selectedCustomerId && (
        <CustomerHealthDetail
          customerId={selectedCustomerId}
          onClose={() => setSelectedCustomerId(null)}
        />
      )}
    </div>
  )
}

// Customer Health Detail Component
interface CustomerHealthDetailProps {
  customerId: string
  onClose: () => void
}

const CustomerHealthDetail: React.FC<CustomerHealthDetailProps> = ({ customerId, onClose }) => {
  const { health, isLoading, refresh } = useCustomerHealth(customerId)

  // Real-time updates
  useRealtimeHealth(customerId, (updated) => {
    refresh()
  })

  if (isLoading) {
    return (
      <div className="bg-white border border-gray-100 rounded-2xl p-6">
        <div className="flex justify-center py-8">
          <div className="w-6 h-6 border-2 border-gray-300 border-t-gray-600 rounded-full animate-spin"></div>
        </div>
      </div>
    )
  }

  if (!health) {
    return (
      <div className="bg-white border border-gray-100 rounded-2xl p-6">
        <div className="flex justify-between items-center mb-4">
          <span className="font-bold">Customer Details</span>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <line x1="18" y1="6" x2="6" y2="18"></line>
              <line x1="6" y1="6" x2="18" y2="18"></line>
            </svg>
          </button>
        </div>
        <p className="text-gray-500">No health data available for this customer.</p>
      </div>
    )
  }

  const factors = health.factors

  return (
    <div className="bg-white border border-gray-100 rounded-2xl p-6">
      <div className="flex justify-between items-start mb-6">
        <div>
          <span className="font-mono text-xs uppercase text-gray-400">Customer Health</span>
          <h3 className="text-xl font-bold mt-1">{customerId}</h3>
        </div>
        <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
          <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <line x1="18" y1="6" x2="6" y2="18"></line>
            <line x1="6" y1="6" x2="18" y2="18"></line>
          </svg>
        </button>
      </div>

      {/* Score */}
      <div className="flex items-center gap-6 mb-6">
        <div className={`w-24 h-24 rounded-full flex items-center justify-center text-white text-3xl font-bold ${
          health.healthLabel === 'healthy' ? 'bg-green-500' :
          health.healthLabel === 'at_risk' ? 'bg-yellow-500' :
          'bg-red-500'
        }`}>
          {health.healthScore}
        </div>
        <div>
          <div className={`text-lg font-bold ${
            health.healthLabel === 'healthy' ? 'text-green-600' :
            health.healthLabel === 'at_risk' ? 'text-yellow-600' :
            'text-red-600'
          }`}>
            {health.healthLabel.replace('_', ' ').toUpperCase()}
          </div>
          <div className="text-sm text-gray-500 mt-1">
            Trend: {health.sentimentTrend}
          </div>
          {health.lastInteraction && (
            <div className="text-xs text-gray-400 mt-1">
              Last interaction: {new Date(health.lastInteraction).toLocaleDateString()}
            </div>
          )}
        </div>
      </div>

      {/* Factor Breakdown */}
      <div className="space-y-4">
        <span className="font-mono text-xs uppercase text-gray-400">Score Factors</span>

        {/* Sentiment */}
        <div>
          <div className="flex justify-between text-sm mb-1">
            <span>Sentiment (30%)</span>
            <span className="font-mono">{Math.round(factors.sentimentScore)}</span>
          </div>
          <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
            <div className="h-full bg-blue-500 transition-all" style={{ width: `${factors.sentimentScore}%` }} />
          </div>
        </div>

        {/* Engagement */}
        <div>
          <div className="flex justify-between text-sm mb-1">
            <span>Engagement (25%)</span>
            <span className="font-mono">{Math.round(factors.engagementScore)}</span>
          </div>
          <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
            <div className="h-full bg-purple-500 transition-all" style={{ width: `${factors.engagementScore}%` }} />
          </div>
        </div>

        {/* Responsiveness */}
        <div>
          <div className="flex justify-between text-sm mb-1">
            <span>Responsiveness (15%)</span>
            <span className="font-mono">{Math.round(factors.responsivenessScore)}</span>
          </div>
          <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
            <div className="h-full bg-cyan-500 transition-all" style={{ width: `${factors.responsivenessScore}%` }} />
          </div>
        </div>

        {/* Deal Progress */}
        <div>
          <div className="flex justify-between text-sm mb-1">
            <span>Deal Progress (15%)</span>
            <span className="font-mono">{Math.round(factors.dealProgressScore)}</span>
          </div>
          <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
            <div className="h-full bg-orange-500 transition-all" style={{ width: `${factors.dealProgressScore}%` }} />
          </div>
        </div>

        {/* Task Completion */}
        <div>
          <div className="flex justify-between text-sm mb-1">
            <span>Task Completion (15%)</span>
            <span className="font-mono">{Math.round(factors.taskCompletionScore)}</span>
          </div>
          <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
            <div className="h-full bg-green-500 transition-all" style={{ width: `${factors.taskCompletionScore}%` }} />
          </div>
        </div>
      </div>

      {/* Actions */}
      <div className="mt-6 pt-6 border-t flex gap-3">
        <button
          onClick={() => refresh()}
          className="flex-1 py-2 bg-gray-100 hover:bg-gray-200 rounded-xl text-sm font-medium transition-colors"
        >
          Recalculate
        </button>
        <button className="flex-1 py-2 bg-[#2563EB] text-white hover:bg-[#008f5b] rounded-xl text-sm font-medium transition-colors">
          View History
        </button>
      </div>
    </div>
  )
}

export default CustomerHealthDashboard
