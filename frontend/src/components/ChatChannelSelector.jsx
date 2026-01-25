import React, { useState, useEffect } from 'react'
import { Hash, Lock, MessageSquare, Loader2, AlertCircle, Check } from 'lucide-react'
import { integrationsApi } from '../services/api'

export default function ChatChannelSelector({
  selectedChannel,
  onChannelSelect,
  disabled = false,
  showStatus = true
}) {
  const [channels, setChannels] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [status, setStatus] = useState(null)

  useEffect(() => {
    loadChannels()
    if (showStatus) {
      loadStatus()
    }
  }, [showStatus])

  const loadChannels = async () => {
    try {
      setLoading(true)
      setError(null)
      const data = await integrationsApi.chat.getChannels()
      setChannels(data.channels || [])

      // If message indicates mock/limited mode, show it
      if (data.message) {
        setError(data.message)
      }
    } catch (err) {
      console.error('Failed to load channels:', err)
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  const loadStatus = async () => {
    try {
      // Use dedicated chat status endpoint for detailed info
      const chatStatus = await integrationsApi.chat.getStatus()
      setStatus(chatStatus)
    } catch (err) {
      // Fallback to general status endpoint
      try {
        const response = await integrationsApi.getStatus()
        setStatus(response.integrations?.chat)
      } catch (fallbackErr) {
        console.error('Failed to load chat status:', fallbackErr)
      }
    }
  }

  const getChannelIcon = (channel) => {
    if (channel.type === 'private') {
      return <Lock className="w-4 h-4 text-content-tertiary" />
    }
    return <Hash className="w-4 h-4 text-content-tertiary" />
  }

  if (loading) {
    return (
      <div className="flex items-center gap-2 text-content-tertiary py-2">
        <Loader2 className="w-4 h-4 animate-spin" />
        <span className="text-sm">Loading channels...</span>
      </div>
    )
  }

  return (
    <div className="space-y-3">
      {/* Status indicator */}
      {showStatus && status && (
        <div className={`flex items-center gap-2 text-sm ${
          status.configured ? 'text-semantic-success' : 'text-content-tertiary'
        }`}>
          {status.configured ? (
            <>
              <Check className="w-4 h-4" />
              <span>
                {status.provider === 'slack' ? 'Slack' :
                 status.provider === 'teams' ? 'Microsoft Teams' :
                 status.provider === 'discord' ? 'Discord' : status.provider}
                {status.mode === 'webhook' ? ' (Webhook)' : ' (Bot)'}
              </span>
            </>
          ) : (
            <>
              <AlertCircle className="w-4 h-4" />
              <span>Chat not configured</span>
            </>
          )}
        </div>
      )}

      {/* Channel dropdown */}
      <div className="relative">
        <select
          value={selectedChannel || ''}
          onChange={(e) => onChannelSelect(e.target.value)}
          disabled={disabled || channels.length === 0}
          className="input w-full pl-9 appearance-none cursor-pointer disabled:cursor-not-allowed disabled:opacity-50"
        >
          <option value="">Select a channel...</option>
          {channels.map((channel) => (
            <option key={channel.id} value={channel.id}>
              {channel.name}
              {channel.guild ? ` (${channel.guild})` : ''}
            </option>
          ))}
        </select>
        <MessageSquare className="w-4 h-4 text-content-tertiary absolute left-3 top-1/2 -translate-y-1/2" />
      </div>

      {/* Error/warning message */}
      {error && (
        <p className="text-xs text-semantic-warning flex items-center gap-1">
          <AlertCircle className="w-3 h-3" />
          {error}
        </p>
      )}

      {/* Channel list for visual display */}
      {channels.length > 0 && (
        <div className="max-h-48 overflow-y-auto border border-line-default rounded-lg">
          {channels.map((channel) => (
            <button
              key={channel.id}
              onClick={() => onChannelSelect(channel.id)}
              disabled={disabled}
              className={`w-full flex items-center gap-2 px-3 py-2 text-left hover:bg-surface-muted transition-colors ${
                selectedChannel === channel.id ? 'bg-primary-50 text-primary-700' : ''
              } disabled:opacity-50 disabled:cursor-not-allowed`}
            >
              {getChannelIcon(channel)}
              <span className="flex-1 text-sm font-medium">{channel.name}</span>
              {channel.memberCount && (
                <span className="text-xs text-content-tertiary">{channel.memberCount} members</span>
              )}
              {channel.guild && (
                <span className="text-xs text-content-tertiary">{channel.guild}</span>
              )}
              {selectedChannel === channel.id && (
                <Check className="w-4 h-4 text-accent-primary" />
              )}
            </button>
          ))}
        </div>
      )}

      {/* Empty state */}
      {channels.length === 0 && !loading && (
        <div className="text-center py-4 text-content-tertiary">
          <MessageSquare className="w-8 h-8 mx-auto mb-2 opacity-50" />
          <p className="text-sm">No channels available</p>
          <p className="text-xs text-content-tertiary mt-1">
            Configure a chat integration to see channels
          </p>
        </div>
      )}
    </div>
  )
}
