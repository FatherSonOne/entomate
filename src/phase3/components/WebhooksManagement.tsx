import React, { useState } from 'react'
import { useWebhooks, useWebhookDeliveries } from '../hooks'
import type { Webhook, WebhookEvent, CreateWebhookInput, WebhookDelivery } from '../types'

const AVAILABLE_EVENTS: WebhookEvent[] = [
  'meeting.created',
  'meeting.completed',
  'meeting.deleted',
  'task.created',
  'task.completed',
  'task.overdue',
  'customer.created',
  'customer.updated',
  'customer.health_changed',
  'alert.created',
  'alert.resolved',
  'agent.run_completed',
  'sentiment.analyzed'
]

export const WebhooksManagement: React.FC = () => {
  const { webhooks, isLoading, error, createWebhook, deleteWebhook, testWebhook, refetch } = useWebhooks()
  const [viewMode, setViewMode] = useState<'list' | 'create'>('list')
  const [selectedWebhook, setSelectedWebhook] = useState<Webhook | null>(null)
  const [testingId, setTestingId] = useState<string | null>(null)
  const [testResult, setTestResult] = useState<{ id: string; success: boolean; message: string } | null>(null)

  const [newWebhook, setNewWebhook] = useState<CreateWebhookInput>({
    name: '',
    url: '',
    events: []
  })
  const [saving, setSaving] = useState(false)
  const [formError, setFormError] = useState<string | null>(null)

  const handleCreate = async () => {
    if (!newWebhook.name.trim()) {
      setFormError('Name is required')
      return
    }
    if (!newWebhook.url.trim()) {
      setFormError('URL is required')
      return
    }
    if (newWebhook.events.length === 0) {
      setFormError('Select at least one event')
      return
    }

    setSaving(true)
    setFormError(null)

    try {
      const result = await createWebhook(newWebhook)
      if (result.success) {
        setNewWebhook({ name: '', url: '', events: [] })
        setViewMode('list')
      } else {
        setFormError(result.error || 'Failed to create webhook')
      }
    } catch (err) {
      setFormError('Failed to create webhook')
    } finally {
      setSaving(false)
    }
  }

  const handleTest = async (webhookId: string) => {
    setTestingId(webhookId)
    setTestResult(null)

    const result = await testWebhook(webhookId)
    if (result.success && result.data) {
      setTestResult({
        id: webhookId,
        success: result.data.success,
        message: result.data.success
          ? `Success! Response time: ${result.data.responseTime}ms`
          : result.data.error || 'Test failed'
      })
    }
    setTestingId(null)
  }

  const handleDelete = async (webhookId: string) => {
    if (!confirm('Are you sure you want to delete this webhook?')) return
    await deleteWebhook(webhookId)
  }

  const toggleEvent = (event: WebhookEvent) => {
    setNewWebhook(prev => ({
      ...prev,
      events: prev.events.includes(event)
        ? prev.events.filter(e => e !== event)
        : [...prev.events, event]
    }))
  }

  const getEventCategory = (event: WebhookEvent) => {
    const [category] = event.split('.')
    return category
  }

  const groupedEvents = AVAILABLE_EVENTS.reduce((acc, event) => {
    const category = getEventCategory(event)
    if (!acc[category]) acc[category] = []
    acc[category].push(event)
    return acc
  }, {} as Record<string, WebhookEvent[]>)

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold">Webhooks</h2>
          <p className="text-gray-500 text-sm mt-1">Send events to external services</p>
        </div>
        <button
          onClick={() => setViewMode(viewMode === 'list' ? 'create' : 'list')}
          className="px-4 py-2 bg-[#2563EB] text-white hover:bg-[#008f5b] rounded-full text-sm font-bold transition-colors"
        >
          {viewMode === 'list' ? 'Add Webhook' : 'Back to List'}
        </button>
      </div>

      {viewMode === 'list' ? (
        <>
          {/* Webhooks List */}
          <div className="bg-white border border-gray-100 rounded-2xl overflow-hidden">
            {isLoading ? (
              <div className="flex justify-center py-12">
                <div className="w-6 h-6 border-2 border-gray-300 border-t-gray-600 rounded-full animate-spin"></div>
              </div>
            ) : error ? (
              <div className="p-6 text-center text-red-500">{error}</div>
            ) : webhooks.length === 0 ? (
              <div className="p-12 text-center text-gray-400">
                <svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1" className="mx-auto mb-4 opacity-50">
                  <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"></path>
                  <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"></path>
                </svg>
                <p>No webhooks configured</p>
                <button
                  onClick={() => setViewMode('create')}
                  className="mt-4 text-[#2563EB] hover:underline"
                >
                  Create your first webhook
                </button>
              </div>
            ) : (
              <div className="divide-y divide-gray-100">
                {webhooks.map((webhook) => (
                  <div key={webhook.id} className="p-4 hover:bg-gray-50 transition-colors">
                    <div className="flex items-start justify-between">
                      <div
                        className="flex-1 cursor-pointer"
                        onClick={() => setSelectedWebhook(webhook)}
                      >
                        <div className="flex items-center gap-2">
                          <div className={`w-2 h-2 rounded-full ${webhook.isActive ? 'bg-green-500' : 'bg-gray-300'}`}></div>
                          <span className="font-bold">{webhook.name}</span>
                          {webhook.consecutiveFailures > 0 && (
                            <span className="px-2 py-0.5 bg-red-100 text-red-600 rounded text-[10px] font-mono">
                              {webhook.consecutiveFailures} failures
                            </span>
                          )}
                        </div>
                        <p className="text-gray-500 text-sm mt-1 font-mono truncate">{webhook.url}</p>
                        <div className="flex flex-wrap gap-1 mt-2">
                          {webhook.events.slice(0, 3).map((event, i) => (
                            <span key={i} className="px-2 py-0.5 bg-gray-100 text-gray-600 rounded text-[10px] font-mono">
                              {event}
                            </span>
                          ))}
                          {webhook.events.length > 3 && (
                            <span className="px-2 py-0.5 bg-gray-100 text-gray-400 rounded text-[10px]">
                              +{webhook.events.length - 3} more
                            </span>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        {testResult?.id === webhook.id && (
                          <span className={`text-xs ${testResult.success ? 'text-green-500' : 'text-red-500'}`}>
                            {testResult.message}
                          </span>
                        )}
                        <button
                          onClick={() => handleTest(webhook.id)}
                          disabled={testingId === webhook.id}
                          className="px-3 py-1 bg-gray-100 hover:bg-gray-200 rounded-full text-xs font-medium transition-colors disabled:opacity-50"
                        >
                          {testingId === webhook.id ? 'Testing...' : 'Test'}
                        </button>
                        <button
                          onClick={() => handleDelete(webhook.id)}
                          className="px-3 py-1 bg-red-100 text-red-600 hover:bg-red-200 rounded-full text-xs font-medium transition-colors"
                        >
                          Delete
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Delivery History for Selected Webhook */}
          {selectedWebhook && (
            <WebhookDeliveryHistory
              webhook={selectedWebhook}
              onClose={() => setSelectedWebhook(null)}
            />
          )}
        </>
      ) : (
        /* Create Webhook Form */
        <div className="bg-white border border-gray-100 rounded-2xl p-6">
          <h3 className="font-bold text-lg mb-6">Create Webhook</h3>

          {formError && (
            <div className="mb-4 p-3 bg-red-50 border border-red-100 rounded-xl text-red-600 text-sm">
              {formError}
            </div>
          )}

          <div className="space-y-4">
            <div>
              <label className="block text-xs font-bold mb-2 text-gray-500">Name</label>
              <input
                value={newWebhook.name}
                onChange={(e) => setNewWebhook({ ...newWebhook, name: e.target.value })}
                placeholder="e.g., Slack Notifications"
                className="w-full p-3 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-[#2563EB] focus:border-transparent outline-none"
              />
            </div>

            <div>
              <label className="block text-xs font-bold mb-2 text-gray-500">Endpoint URL</label>
              <input
                value={newWebhook.url}
                onChange={(e) => setNewWebhook({ ...newWebhook, url: e.target.value })}
                placeholder="https://your-service.com/webhook"
                className="w-full p-3 border border-gray-200 rounded-xl text-sm font-mono focus:ring-2 focus:ring-[#2563EB] focus:border-transparent outline-none"
              />
            </div>

            <div>
              <label className="block text-xs font-bold mb-2 text-gray-500">Events</label>
              <div className="border border-gray-200 rounded-xl p-4 space-y-4">
                {Object.entries(groupedEvents).map(([category, events]) => (
                  <div key={category}>
                    <div className="font-mono text-xs uppercase text-gray-400 mb-2 capitalize">{category}</div>
                    <div className="flex flex-wrap gap-2">
                      {events.map((event) => (
                        <button
                          key={event}
                          onClick={() => toggleEvent(event)}
                          className={`px-3 py-1 rounded-full text-xs font-mono transition-colors ${
                            newWebhook.events.includes(event)
                              ? 'bg-[#2563EB] text-white'
                              : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                          }`}
                        >
                          {event.split('.')[1]}
                        </button>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
              <p className="text-xs text-gray-400 mt-2">
                Selected: {newWebhook.events.length} events
              </p>
            </div>

            <div className="flex gap-3 pt-4">
              <button
                onClick={() => setViewMode('list')}
                className="flex-1 py-3 bg-gray-100 hover:bg-gray-200 rounded-xl text-sm font-medium transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleCreate}
                disabled={saving}
                className="flex-1 py-3 bg-[#2563EB] text-white hover:bg-[#008f5b] rounded-xl text-sm font-bold transition-colors disabled:opacity-50"
              >
                {saving ? 'Creating...' : 'Create Webhook'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// Webhook Delivery History Component
interface WebhookDeliveryHistoryProps {
  webhook: Webhook
  onClose: () => void
}

const WebhookDeliveryHistory: React.FC<WebhookDeliveryHistoryProps> = ({ webhook, onClose }) => {
  const { deliveries, isLoading } = useWebhookDeliveries(webhook.id, 20)

  return (
    <div className="bg-white border border-gray-100 rounded-2xl p-6">
      <div className="flex justify-between items-start mb-6">
        <div>
          <span className="font-mono text-xs uppercase text-gray-400">Delivery History</span>
          <h3 className="text-lg font-bold mt-1">{webhook.name}</h3>
        </div>
        <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
          <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <line x1="18" y1="6" x2="6" y2="18"></line>
            <line x1="6" y1="6" x2="18" y2="18"></line>
          </svg>
        </button>
      </div>

      {/* Webhook Details */}
      <div className="mb-6 p-4 bg-gray-50 rounded-xl">
        <div className="grid grid-cols-2 gap-4 text-sm">
          <div>
            <span className="text-gray-400">URL</span>
            <p className="font-mono truncate">{webhook.url}</p>
          </div>
          <div>
            <span className="text-gray-400">Status</span>
            <p className={webhook.isActive ? 'text-green-600' : 'text-gray-500'}>
              {webhook.isActive ? 'Active' : 'Inactive'}
            </p>
          </div>
          <div>
            <span className="text-gray-400">Secret</span>
            <p className="font-mono">••••••••{webhook.secret.slice(-8)}</p>
          </div>
          <div>
            <span className="text-gray-400">Last Triggered</span>
            <p>{webhook.lastTriggeredAt ? new Date(webhook.lastTriggeredAt).toLocaleString() : 'Never'}</p>
          </div>
        </div>
      </div>

      {/* Deliveries */}
      {isLoading ? (
        <div className="flex justify-center py-8">
          <div className="w-6 h-6 border-2 border-gray-300 border-t-gray-600 rounded-full animate-spin"></div>
        </div>
      ) : deliveries.length === 0 ? (
        <div className="text-center py-8 text-gray-400">
          <p>No deliveries yet</p>
        </div>
      ) : (
        <div className="space-y-2 max-h-64 overflow-y-auto">
          {deliveries.map((delivery) => (
            <div
              key={delivery.id}
              className={`p-3 rounded-xl ${delivery.success ? 'bg-green-50' : 'bg-red-50'}`}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  {delivery.success ? (
                    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-green-500">
                      <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path>
                      <polyline points="22 4 12 14.01 9 11.01"></polyline>
                    </svg>
                  ) : (
                    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-red-500">
                      <circle cx="12" cy="12" r="10"></circle>
                      <line x1="15" y1="9" x2="9" y2="15"></line>
                      <line x1="9" y1="9" x2="15" y2="15"></line>
                    </svg>
                  )}
                  <span className="font-mono text-xs">{delivery.event}</span>
                </div>
                <div className="flex items-center gap-2 text-xs text-gray-500">
                  {delivery.responseStatus && (
                    <span className={delivery.success ? 'text-green-600' : 'text-red-600'}>
                      {delivery.responseStatus}
                    </span>
                  )}
                  <span>{new Date(delivery.deliveredAt).toLocaleString()}</span>
                </div>
              </div>
              {delivery.retryCount > 0 && (
                <p className="text-xs text-gray-500 mt-1">Retry #{delivery.retryCount}</p>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

export default WebhooksManagement
