import React, { useState } from 'react'
import { useIntegrations, useIntegration } from '../hooks'
import * as integrationsService from '../integrationsService'
import type { Integration, IntegrationType } from '../types'

const INTEGRATION_CONFIG: Record<IntegrationType, {
  name: string
  description: string
  icon: JSX.Element
  category: 'crm' | 'video' | 'calendar' | 'communication' | 'custom'
  color: string
}> = {
  salesforce: {
    name: 'Salesforce',
    description: 'Sync contacts, deals, and activities',
    icon: <span className="text-2xl">☁️</span>,
    category: 'crm',
    color: 'bg-blue-500'
  },
  hubspot: {
    name: 'HubSpot',
    description: 'CRM and marketing automation',
    icon: <span className="text-2xl">🟠</span>,
    category: 'crm',
    color: 'bg-orange-500'
  },
  pipedrive: {
    name: 'Pipedrive',
    description: 'Sales pipeline management',
    icon: <span className="text-2xl">🟢</span>,
    category: 'crm',
    color: 'bg-green-500'
  },
  zoom: {
    name: 'Zoom',
    description: 'Video meetings and recordings',
    icon: <span className="text-2xl">📹</span>,
    category: 'video',
    color: 'bg-blue-600'
  },
  teams: {
    name: 'Microsoft Teams',
    description: 'Team collaboration and meetings',
    icon: <span className="text-2xl">💜</span>,
    category: 'video',
    color: 'bg-purple-600'
  },
  google_meet: {
    name: 'Google Meet',
    description: 'Video conferencing',
    icon: <span className="text-2xl">🟩</span>,
    category: 'video',
    color: 'bg-green-600'
  },
  google_calendar: {
    name: 'Google Calendar',
    description: 'Schedule and sync events',
    icon: <span className="text-2xl">📅</span>,
    category: 'calendar',
    color: 'bg-blue-500'
  },
  outlook_calendar: {
    name: 'Outlook Calendar',
    description: 'Microsoft calendar integration',
    icon: <span className="text-2xl">📆</span>,
    category: 'calendar',
    color: 'bg-blue-700'
  },
  slack: {
    name: 'Slack',
    description: 'Team messaging and notifications',
    icon: <span className="text-2xl">💬</span>,
    category: 'communication',
    color: 'bg-purple-500'
  },
  custom: {
    name: 'Custom',
    description: 'Custom API integration',
    icon: <span className="text-2xl">🔧</span>,
    category: 'custom',
    color: 'bg-gray-500'
  }
}

export const IntegrationsManagement: React.FC = () => {
  const { integrations, isLoading, error, connect, disconnect, refetch } = useIntegrations()
  const [selectedType, setSelectedType] = useState<IntegrationType | null>(null)
  const [connecting, setConnecting] = useState<IntegrationType | null>(null)
  const [filter, setFilter] = useState<'all' | 'connected' | 'available'>('all')

  const categories = ['crm', 'video', 'calendar', 'communication'] as const

  const handleConnect = async (type: IntegrationType) => {
    setConnecting(type)
    try {
      // In a real app, this would redirect to OAuth
      // For now, we'll simulate a connection
      const result = await connect({
        integrationType: type,
        config: {}
      })
      if (result.success) {
        setSelectedType(type)
      }
    } finally {
      setConnecting(null)
    }
  }

  const handleDisconnect = async (type: IntegrationType) => {
    if (!confirm(`Are you sure you want to disconnect ${INTEGRATION_CONFIG[type].name}?`)) return
    await disconnect(type)
    setSelectedType(null)
  }

  const getIntegrationStatus = (type: IntegrationType): 'connected' | 'error' | 'available' => {
    const integration = integrations.find(i => i.integrationType === type)
    if (!integration) return 'available'
    if (integration.lastError) return 'error'
    if (integration.isActive) return 'connected'
    return 'available'
  }

  const filteredTypes = Object.keys(INTEGRATION_CONFIG).filter(type => {
    const status = getIntegrationStatus(type as IntegrationType)
    if (filter === 'connected') return status === 'connected'
    if (filter === 'available') return status === 'available'
    return true
  }) as IntegrationType[]

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold">Integrations</h2>
          <p className="text-gray-500 text-sm mt-1">Connect external services</p>
        </div>
        <button
          onClick={() => refetch()}
          className="px-4 py-2 bg-gray-100 hover:bg-gray-200 rounded-full text-sm font-medium transition-colors"
        >
          Refresh
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4">
        <div className="bg-white border border-gray-100 rounded-2xl p-4">
          <span className="font-mono text-xs uppercase text-gray-400">Total</span>
          <div className="mt-1 text-2xl font-bold">{Object.keys(INTEGRATION_CONFIG).length}</div>
        </div>
        <div className="bg-green-50 border border-green-100 rounded-2xl p-4">
          <span className="font-mono text-xs uppercase text-green-600">Connected</span>
          <div className="mt-1 text-2xl font-bold text-green-700">
            {integrations.filter(i => i.isActive).length}
          </div>
        </div>
        <div className="bg-red-50 border border-red-100 rounded-2xl p-4">
          <span className="font-mono text-xs uppercase text-red-600">Errors</span>
          <div className="mt-1 text-2xl font-bold text-red-700">
            {integrations.filter(i => i.lastError).length}
          </div>
        </div>
      </div>

      {/* Filter */}
      <div className="flex gap-2 p-1 bg-gray-100 rounded-full w-fit">
        {(['all', 'connected', 'available'] as const).map((f) => (
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

      {/* Integrations by Category */}
      {categories.map(category => {
        const categoryIntegrations = filteredTypes.filter(
          type => INTEGRATION_CONFIG[type].category === category
        )
        if (categoryIntegrations.length === 0) return null

        return (
          <div key={category} className="space-y-4">
            <h3 className="font-mono text-xs uppercase text-gray-400 tracking-wider">
              {category === 'crm' ? 'CRM' : category.charAt(0).toUpperCase() + category.slice(1)}
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {categoryIntegrations.map(type => {
                const config = INTEGRATION_CONFIG[type]
                const status = getIntegrationStatus(type)
                const integration = integrations.find(i => i.integrationType === type)

                return (
                  <div
                    key={type}
                    className={`bg-white border rounded-2xl p-5 transition-all ${
                      status === 'connected' ? 'border-green-200' :
                      status === 'error' ? 'border-red-200' :
                      'border-gray-100 hover:border-gray-200'
                    }`}
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex items-center gap-3">
                        <div className={`w-12 h-12 ${config.color} rounded-xl flex items-center justify-center text-white`}>
                          {config.icon}
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <h4 className="font-bold">{config.name}</h4>
                            {status === 'connected' && (
                              <span className="w-2 h-2 bg-green-500 rounded-full"></span>
                            )}
                            {status === 'error' && (
                              <span className="w-2 h-2 bg-red-500 rounded-full"></span>
                            )}
                          </div>
                          <p className="text-gray-500 text-sm mt-0.5">{config.description}</p>
                        </div>
                      </div>
                    </div>

                    {integration?.lastError && (
                      <div className="mt-3 p-2 bg-red-50 rounded-lg text-red-600 text-xs">
                        {integration.lastError}
                      </div>
                    )}

                    {integration?.lastSyncAt && (
                      <p className="mt-3 text-xs text-gray-400">
                        Last sync: {new Date(integration.lastSyncAt).toLocaleString()}
                      </p>
                    )}

                    <div className="mt-4 flex gap-2">
                      {status === 'connected' ? (
                        <>
                          <button
                            onClick={() => setSelectedType(type)}
                            className="flex-1 py-2 bg-gray-100 hover:bg-gray-200 rounded-xl text-xs font-medium transition-colors"
                          >
                            Configure
                          </button>
                          <button
                            onClick={() => handleDisconnect(type)}
                            className="px-4 py-2 bg-red-100 text-red-600 hover:bg-red-200 rounded-xl text-xs font-medium transition-colors"
                          >
                            Disconnect
                          </button>
                        </>
                      ) : (
                        <button
                          onClick={() => handleConnect(type)}
                          disabled={connecting === type}
                          className="flex-1 py-2 bg-[#2563EB] text-white hover:bg-[#008f5b] rounded-xl text-xs font-bold transition-colors disabled:opacity-50"
                        >
                          {connecting === type ? 'Connecting...' : 'Connect'}
                        </button>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        )
      })}

      {/* Integration Detail Modal */}
      {selectedType && (
        <IntegrationDetail
          integrationType={selectedType}
          onClose={() => setSelectedType(null)}
          onDisconnect={() => handleDisconnect(selectedType)}
        />
      )}
    </div>
  )
}

// Integration Detail Component
interface IntegrationDetailProps {
  integrationType: IntegrationType
  onClose: () => void
  onDisconnect: () => void
}

const IntegrationDetail: React.FC<IntegrationDetailProps> = ({
  integrationType,
  onClose,
  onDisconnect
}) => {
  const { integration, isLoading } = useIntegration(integrationType)
  const [syncing, setSyncing] = useState(false)
  const config = INTEGRATION_CONFIG[integrationType]

  const handleSync = async () => {
    setSyncing(true)
    try {
      await integrationsService.syncCRMContacts(integrationType)
    } finally {
      setSyncing(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl p-6 w-full max-w-lg">
        <div className="flex justify-between items-start mb-6">
          <div className="flex items-center gap-3">
            <div className={`w-12 h-12 ${config.color} rounded-xl flex items-center justify-center text-white`}>
              {config.icon}
            </div>
            <div>
              <h3 className="text-lg font-bold">{config.name}</h3>
              <p className="text-gray-500 text-sm">{config.description}</p>
            </div>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <line x1="18" y1="6" x2="6" y2="18"></line>
              <line x1="6" y1="6" x2="18" y2="18"></line>
            </svg>
          </button>
        </div>

        {isLoading ? (
          <div className="flex justify-center py-8">
            <div className="w-6 h-6 border-2 border-gray-300 border-t-gray-600 rounded-full animate-spin"></div>
          </div>
        ) : integration ? (
          <div className="space-y-4">
            {/* Status */}
            <div className="p-4 bg-gray-50 rounded-xl">
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <span className="text-gray-400">Status</span>
                  <p className={integration.isActive ? 'text-green-600 font-medium' : 'text-gray-500'}>
                    {integration.isActive ? 'Connected' : 'Disconnected'}
                  </p>
                </div>
                <div>
                  <span className="text-gray-400">Last Sync</span>
                  <p>{integration.lastSyncAt ? new Date(integration.lastSyncAt).toLocaleString() : 'Never'}</p>
                </div>
                <div>
                  <span className="text-gray-400">Error Count</span>
                  <p className={integration.errorCount > 0 ? 'text-red-600' : ''}>{integration.errorCount}</p>
                </div>
                <div>
                  <span className="text-gray-400">Token Expires</span>
                  <p>{integration.tokenExpiresAt ? new Date(integration.tokenExpiresAt).toLocaleString() : 'N/A'}</p>
                </div>
              </div>
            </div>

            {/* Error */}
            {integration.lastError && (
              <div className="p-4 bg-red-50 border border-red-100 rounded-xl">
                <span className="text-xs font-bold text-red-600 block mb-1">Last Error</span>
                <p className="text-red-700 text-sm">{integration.lastError}</p>
              </div>
            )}

            {/* Actions */}
            <div className="flex gap-3 pt-4">
              <button
                onClick={handleSync}
                disabled={syncing}
                className="flex-1 py-2 bg-[#2563EB] text-white hover:bg-[#008f5b] rounded-xl text-sm font-medium transition-colors disabled:opacity-50"
              >
                {syncing ? 'Syncing...' : 'Sync Now'}
              </button>
              <button
                onClick={onDisconnect}
                className="flex-1 py-2 bg-red-100 text-red-600 hover:bg-red-200 rounded-xl text-sm font-medium transition-colors"
              >
                Disconnect
              </button>
            </div>
          </div>
        ) : (
          <div className="text-center py-8 text-gray-400">
            <p>Integration not found</p>
          </div>
        )}
      </div>
    </div>
  )
}

export default IntegrationsManagement
