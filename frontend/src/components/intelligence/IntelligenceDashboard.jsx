import React, { useState, useEffect, useCallback } from 'react'
import { useAuth } from '../../contexts/AuthContext'
import {
  Zap,
  RefreshCw,
  Settings,
  Calendar,
  AlertTriangle,
  CheckCircle2,
  Users,
  X
} from 'lucide-react'
import api from '../../services/api'
import MeetingPrepCard from './MeetingPrepCard'
import DealRiskAlertCard from './DealRiskAlertCard'
import ActionItemStatusCard from './ActionItemStatusCard'
import RelationshipInsightCard from './RelationshipInsightCard'

/**
 * IntelligenceDashboard - Enhanced Intelligence Dashboard
 *
 * Orchestrates all 4 intelligence card types:
 * 1. Meeting Prep Cards
 * 2. Deal Risk Alerts
 * 3. Action Item Tracking
 * 4. Relationship Insights
 *
 * Features:
 * - Auto-refresh every 5 minutes
 * - Customizable preferences
 * - Loading states with skeleton
 * - Error handling with retry
 * - Responsive grid layout
 */
export default function IntelligenceDashboard() {
  const { getToken } = useAuth()
  const [intelligence, setIntelligence] = useState(null)
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [error, setError] = useState(null)
  const [showCustomize, setShowCustomize] = useState(false)

  // User preferences
  const [preferences, setPreferences] = useState({
    showMeetingPrep: true,
    showDealRisks: true,
    showActionItems: true,
    showRelationships: true,
    dealRiskFilter: ['medium', 'high', 'critical'],
    timeHorizon: {
      meetings: 24, // hours
      risks: 7 // days
    }
  })

  // Load intelligence data
  const loadIntelligence = useCallback(async (isRefresh = false) => {
    try {
      if (isRefresh) setRefreshing(true)
      else setLoading(true)
      setError(null)

      const data = await api.intelligence.getDashboard({
        riskFilter: preferences.dealRiskFilter.join(','),
        meetingHours: preferences.timeHorizon.meetings,
        riskDays: preferences.timeHorizon.risks
      })

      setIntelligence(data)
    } catch (err) {
      console.error('Failed to load intelligence:', err)
      setError(err.message)
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }, [preferences])

  // Initial load and auto-refresh
  useEffect(() => {
    loadIntelligence()

    // Refresh every 5 minutes
    const interval = setInterval(() => {
      loadIntelligence(true)
    }, 5 * 60 * 1000)

    return () => clearInterval(interval)
  }, [loadIntelligence])

  // Handle quick actions
  const handleMeetingAction = async (action, meetingId) => {
    console.log('Meeting action:', action, meetingId)
    try {
      switch (action) {
        case 'prepareBrief':
          // Generate meeting brief
          await api.intelligence.generateMeetingBrief(meetingId)
          alert('Meeting brief generated successfully!')
          break
        case 'reschedule':
          // Open calendar integration
          alert('Calendar integration coming soon!')
          break
        default:
          console.warn('Unknown meeting action:', action)
      }
    } catch (err) {
      console.error('Meeting action failed:', err)
      alert(`Failed to ${action}: ${err.message}`)
    }
  }

  const handleRiskAction = async (action, dealId) => {
    console.log('Risk action:', action, dealId)
    try {
      switch (action) {
        case 'scheduleCall':
          // Open calendar to schedule call
          alert('Calendar integration coming soon!')
          break
        case 'createTask':
          // Create follow-up task
          alert('Task creation coming soon!')
          break
        default:
          console.warn('Unknown risk action:', action)
      }
    } catch (err) {
      console.error('Risk action failed:', err)
      alert(`Failed to ${action}: ${err.message}`)
    }
  }

  const handleActionItemAction = async (action, itemId) => {
    console.log('Action item action:', action, itemId)
    try {
      switch (action) {
        case 'nudge':
          // Send nudge to owner
          await api.intelligence.sendNudge(itemId, 'in_app')
          alert('Nudge sent successfully!')
          loadIntelligence(true)
          break
        case 'reassign':
          // Open reassignment dialog
          alert('Reassignment dialog coming soon!')
          break
        case 'complete':
          // Mark as complete
          await api.tasks.complete(itemId)
          alert('Task marked as complete!')
          loadIntelligence(true)
          break
        default:
          console.warn('Unknown action item action:', action)
      }
    } catch (err) {
      console.error('Action item action failed:', err)
      alert(`Failed to ${action}: ${err.message}`)
    }
  }

  const handleRelationshipAction = async (action, stakeholderId) => {
    console.log('Relationship action:', action, stakeholderId)
    try {
      switch (action) {
        case 'addToCRM':
          // Sync to CRM
          alert('CRM integration coming soon!')
          break
        case 'scheduleMeeting':
          // Open calendar
          alert('Calendar integration coming soon!')
          break
        case 'getIntroduction':
          // Create introduction request task
          alert('Introduction request coming soon!')
          break
        default:
          console.warn('Unknown relationship action:', action)
      }
    } catch (err) {
      console.error('Relationship action failed:', err)
      alert(`Failed to ${action}: ${err.message}`)
    }
  }

  // Loading skeleton
  if (loading && !intelligence) {
    return (
      <div className="card">
        <div className="bg-gradient-to-r from-accent-primary via-accent-tertiary to-accent-primary p-6 text-white">
          <div className="flex items-center gap-2 mb-1">
            <Zap className="w-5 h-5" />
            <span className="text-content-tertiary text-sm">Loading...</span>
          </div>
          <h2 className="text-2xl font-bold">Today's Intelligence</h2>
        </div>
        <div className="p-6 space-y-4">
          <div className="animate-pulse space-y-4">
            <div className="h-32 bg-surface-muted rounded-lg"></div>
            <div className="h-32 bg-surface-muted rounded-lg"></div>
            <div className="h-32 bg-surface-muted rounded-lg"></div>
          </div>
        </div>
      </div>
    )
  }

  // Error state
  if (error) {
    return (
      <div className="card">
        <div className="bg-gradient-to-r from-accent-primary via-accent-tertiary to-accent-primary p-6 text-white">
          <h2 className="text-2xl font-bold">Today's Intelligence</h2>
        </div>
        <div className="p-6">
          <div className="text-center py-8">
            <AlertTriangle className="w-12 h-12 text-amber-500 mx-auto mb-3" />
            <p className="text-content-secondary font-medium">Failed to load intelligence dashboard</p>
            <p className="text-sm text-content-tertiary mt-1">{error}</p>
            <button
              onClick={() => loadIntelligence()}
              className="mt-4 px-4 py-2 bg-accent-primary text-white rounded-lg hover:opacity-90 transition-colors"
            >
              Retry
            </button>
          </div>
        </div>
      </div>
    )
  }

  if (!intelligence) return null

  return (
    <div className="card overflow-hidden">
      {/* Header with gradient */}
      <div className="bg-gradient-to-r from-accent-primary via-accent-tertiary to-accent-primary p-6 text-white">
        <div className="flex items-start justify-between">
          <div className="flex-1">
            <div className="flex items-center gap-2 mb-1">
              <Zap className="w-5 h-5" />
              <span className="text-content-tertiary text-sm">
                {new Date().toLocaleDateString('en-US', {
                  weekday: 'long',
                  month: 'long',
                  day: 'numeric',
                  year: 'numeric'
                })}
              </span>
            </div>
            <h2 className="text-2xl font-bold">Today's Intelligence</h2>
            <p className="text-content-tertiary mt-1 text-sm">
              AI-powered insights for your meetings, deals, and relationships
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => loadIntelligence(true)}
              disabled={refreshing}
              className="p-2 hover:bg-surface/10 rounded-lg transition-colors"
              title="Refresh intelligence"
              aria-label="Refresh intelligence"
            >
              <RefreshCw className={`w-5 h-5 ${refreshing ? 'animate-spin' : ''}`} />
            </button>
            <button
              onClick={() => setShowCustomize(true)}
              className="p-2 hover:bg-surface/10 rounded-lg transition-colors"
              title="Customize dashboard"
              aria-label="Customize dashboard"
            >
              <Settings className="w-5 h-5" />
            </button>
          </div>
        </div>
      </div>

      {/* Intelligence Cards */}
      <div className="p-6 space-y-6">
        {/* Meeting Prep Cards */}
        {preferences.showMeetingPrep && intelligence.meetingPrep?.count > 0 && (
          <section>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-content-primary flex items-center gap-2">
                <Calendar className="w-5 h-5 text-accent-primary" />
                Upcoming Meetings
                <span className="px-2 py-0.5 bg-accent-primary-dim text-accent-primary text-sm rounded-full">
                  {intelligence.meetingPrep.count}
                </span>
              </h3>
            </div>
            <div className="space-y-3">
              {intelligence.meetingPrep.cards.map((meeting) => (
                <MeetingPrepCard
                  key={meeting.meeting.id}
                  data={meeting}
                  onAction={handleMeetingAction}
                />
              ))}
            </div>
          </section>
        )}

        {/* Deal Risk Alerts */}
        {preferences.showDealRisks && intelligence.dealRisks?.count > 0 && (
          <section>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-content-primary flex items-center gap-2">
                <AlertTriangle className="w-5 h-5 text-semantic-error" />
                Deal Risk Alerts
                <span className="px-2 py-0.5 bg-semantic-error-dim text-semantic-error text-sm rounded-full">
                  {intelligence.dealRisks.count}
                </span>
              </h3>
            </div>
            <div className="space-y-3">
              {intelligence.dealRisks.cards.map((risk) => (
                <DealRiskAlertCard
                  key={risk.deal.id}
                  data={risk}
                  onAction={handleRiskAction}
                />
              ))}
            </div>
          </section>
        )}

        {/* Action Item Status */}
        {preferences.showActionItems && intelligence.actionItems && (
          <section>
            <ActionItemStatusCard
              data={intelligence.actionItems}
              onAction={handleActionItemAction}
            />
          </section>
        )}

        {/* Relationship Insights */}
        {preferences.showRelationships && intelligence.relationships?.count > 0 && (
          <section>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-content-primary flex items-center gap-2">
                <Users className="w-5 h-5 text-semantic-success" />
                Relationship Insights
                <span className="px-2 py-0.5 bg-semantic-success-dim text-semantic-success text-sm rounded-full">
                  {intelligence.relationships.count}
                </span>
              </h3>
            </div>
            <div className="space-y-3">
              {intelligence.relationships.insights.map((insight, index) => (
                <RelationshipInsightCard
                  key={index}
                  data={insight}
                  onAction={handleRelationshipAction}
                />
              ))}
            </div>
          </section>
        )}

        {/* Empty state */}
        {(!intelligence.meetingPrep?.count &&
          !intelligence.dealRisks?.count &&
          !intelligence.actionItems &&
          !intelligence.relationships?.count) && (
          <div className="text-center py-12">
            <CheckCircle2 className="w-16 h-16 text-semantic-success mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-content-primary mb-2">All Clear!</h3>
            <p className="text-content-secondary">
              No critical items requiring your attention right now.
            </p>
          </div>
        )}
      </div>

      {/* Customization Modal */}
      {showCustomize && (
        <CustomizationModal
          preferences={preferences}
          onSave={(newPrefs) => {
            setPreferences(newPrefs)
            setShowCustomize(false)
            loadIntelligence(true)
          }}
          onClose={() => setShowCustomize(false)}
        />
      )}
    </div>
  )
}

/**
 * Customization Modal Component
 */
function CustomizationModal({ preferences, onSave, onClose }) {
  const [localPrefs, setLocalPrefs] = useState(preferences)

  const handleSave = () => {
    onSave(localPrefs)
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-surface rounded-lg max-w-md w-full shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-line-default">
          <h3 className="text-lg font-semibold text-content-primary flex items-center gap-2">
            <Settings className="w-5 h-5" />
            Customize Intelligence Dashboard
          </h3>
          <button
            onClick={onClose}
            className="p-1 hover:bg-surface-muted rounded transition-colors"
            aria-label="Close"
          >
            <X className="w-5 h-5 text-content-tertiary" />
          </button>
        </div>

        {/* Content */}
        <div className="p-4 space-y-4">
          {/* Show Cards */}
          <div>
            <h4 className="text-sm font-semibold text-content-secondary mb-2">Show Cards</h4>
            <div className="space-y-2">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={localPrefs.showMeetingPrep}
                  onChange={(e) => setLocalPrefs({ ...localPrefs, showMeetingPrep: e.target.checked })}
                  className="w-4 h-4 text-accent-primary rounded"
                />
                <span className="text-sm text-content-secondary">Meeting Preparation</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={localPrefs.showDealRisks}
                  onChange={(e) => setLocalPrefs({ ...localPrefs, showDealRisks: e.target.checked })}
                  className="w-4 h-4 text-accent-primary rounded"
                />
                <span className="text-sm text-content-secondary">Deal Risk Alerts</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={localPrefs.showActionItems}
                  onChange={(e) => setLocalPrefs({ ...localPrefs, showActionItems: e.target.checked })}
                  className="w-4 h-4 text-accent-primary rounded"
                />
                <span className="text-sm text-content-secondary">Action Item Tracking</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={localPrefs.showRelationships}
                  onChange={(e) => setLocalPrefs({ ...localPrefs, showRelationships: e.target.checked })}
                  className="w-4 h-4 text-accent-primary rounded"
                />
                <span className="text-sm text-content-secondary">Relationship Insights</span>
              </label>
            </div>
          </div>

          {/* Deal Risk Filter */}
          <div>
            <h4 className="text-sm font-semibold text-content-secondary mb-2">Deal Risk Filter</h4>
            <div className="space-y-2">
              {['low', 'medium', 'high', 'critical'].map((level) => (
                <label key={level} className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={localPrefs.dealRiskFilter.includes(level)}
                    onChange={(e) => {
                      const newFilter = e.target.checked
                        ? [...localPrefs.dealRiskFilter, level]
                        : localPrefs.dealRiskFilter.filter(l => l !== level)
                      setLocalPrefs({ ...localPrefs, dealRiskFilter: newFilter })
                    }}
                    className="w-4 h-4 text-accent-primary rounded"
                  />
                  <span className="text-sm text-content-secondary capitalize">{level}</span>
                </label>
              ))}
            </div>
          </div>

          {/* Time Horizon */}
          <div>
            <h4 className="text-sm font-semibold text-content-secondary mb-2">Time Horizon</h4>
            <div className="space-y-2">
              <div>
                <label className="text-xs text-content-secondary">Meetings (hours ahead)</label>
                <input
                  type="number"
                  value={localPrefs.timeHorizon.meetings}
                  onChange={(e) => setLocalPrefs({
                    ...localPrefs,
                    timeHorizon: { ...localPrefs.timeHorizon, meetings: parseInt(e.target.value) }
                  })}
                  className="w-full mt-1 px-3 py-2 border border-line-strong rounded-lg text-sm"
                  min="1"
                  max="168"
                />
              </div>
              <div>
                <label className="text-xs text-content-secondary">Deal Risks (days ahead)</label>
                <input
                  type="number"
                  value={localPrefs.timeHorizon.risks}
                  onChange={(e) => setLocalPrefs({
                    ...localPrefs,
                    timeHorizon: { ...localPrefs.timeHorizon, risks: parseInt(e.target.value) }
                  })}
                  className="w-full mt-1 px-3 py-2 border border-line-strong rounded-lg text-sm"
                  min="1"
                  max="90"
                />
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-2 p-4 border-t border-line-default">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm font-medium text-content-secondary bg-surface border border-line-strong rounded-lg hover:bg-surface-muted transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            className="px-4 py-2 text-sm font-medium text-white bg-accent-primary rounded-lg hover:opacity-90 transition-colors"
          >
            Save Preferences
          </button>
        </div>
      </div>
    </div>
  )
}
