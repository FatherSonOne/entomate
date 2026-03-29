import React, { useState, useEffect, useCallback } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import {
  Sun,
  Moon,
  CloudSun,
  RefreshCw,
  Calendar,
  CheckCircle2,
  AlertTriangle,
  TrendingUp,
  TrendingDown,
  Clock,
  ArrowRight,
  ChevronDown,
  ChevronUp,
  Users,
  DollarSign,
  UserPlus,
  Target,
  Zap,
  AlertCircle,
  Info,
  CheckCircle,
  Play
} from 'lucide-react'

const API_BASE_URL = import.meta.env.VITE_API_URL || ''

export default function TodaysIntelligence() {
  const { getToken } = useAuth()
  const [briefing, setBriefing] = useState(null)
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [error, setError] = useState(null)
  const [startingDay, setStartingDay] = useState(false)

  // Collapsible section states
  const [expandedSections, setExpandedSections] = useState({
    meetings: true,
    overdue: true,
    deals: false,
    contacts: false
  })

  const toggleSection = (section) => {
    setExpandedSections(prev => ({
      ...prev,
      [section]: !prev[section]
    }))
  }

  const loadBriefing = useCallback(async (isRefresh = false) => {
    try {
      if (isRefresh) setRefreshing(true)
      else setLoading(true)
      setError(null)

      const token = await getToken()
      const response = await fetch(`${API_BASE_URL}/api/intelligence/today`, {
        headers: {
          'Content-Type': 'application/json',
          'Authorization': token ? `Bearer ${token}` : ''
        }
      })

      if (!response.ok) {
        throw new Error('Failed to fetch briefing')
      }

      const data = await response.json()
      setBriefing(data)
    } catch (err) {
      console.error('Failed to load briefing:', err)
      setError(err.message)
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }, [getToken])

  useEffect(() => {
    loadBriefing()
  }, [loadBriefing])

  const handleStartDay = async () => {
    try {
      setStartingDay(true)

      const token = await getToken()
      await fetch(`${API_BASE_URL}/api/intelligence/briefing/viewed`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': token ? `Bearer ${token}` : ''
        }
      })

      // Brief animation before collapsing
      setTimeout(() => {
        setExpandedSections({
          meetings: false,
          overdue: false,
          deals: false,
          contacts: false
        })
        setStartingDay(false)
      }, 500)
    } catch (err) {
      console.error('Failed to mark briefing as viewed:', err)
      setStartingDay(false)
    }
  }

  // Get greeting icon based on time
  const getGreetingIcon = () => {
    const hour = new Date().getHours()
    if (hour < 12) return Sun
    if (hour < 17) return CloudSun
    return Moon
  }

  // Get insight icon based on type
  const getInsightIcon = (type) => {
    switch (type) {
      case 'alert':
        return AlertCircle
      case 'warning':
        return AlertTriangle
      case 'success':
        return CheckCircle
      default:
        return Info
    }
  }

  // Get insight color classes
  const getInsightColors = (type) => {
    switch (type) {
      case 'alert':
        return 'bg-semantic-error-dim border-semantic-error text-semantic-error'
      case 'warning':
        return 'bg-semantic-warning-dim border-semantic-warning text-semantic-warning'
      case 'success':
        return 'bg-semantic-success-dim border-semantic-success text-semantic-success'
      default:
        return 'bg-semantic-info-dim border-semantic-info text-semantic-info'
    }
  }

  if (loading) {
    return (
      <div className="card p-6">
        <div className="animate-pulse space-y-4">
          <div className="h-8 bg-surface-muted rounded w-1/3"></div>
          <div className="h-4 bg-surface-muted rounded w-2/3"></div>
          <div className="grid grid-cols-4 gap-4 mt-4">
            <div className="h-20 bg-surface-muted rounded"></div>
            <div className="h-20 bg-surface-muted rounded"></div>
            <div className="h-20 bg-surface-muted rounded"></div>
            <div className="h-20 bg-surface-muted rounded"></div>
          </div>
          <div className="h-32 bg-surface-muted rounded mt-4"></div>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="card p-6">
        <div className="text-center py-8">
          <AlertTriangle className="w-12 h-12 vc-text-warning mx-auto mb-3" />
          <p className="text-content-secondary font-medium">Failed to load intelligence briefing</p>
          <p className="text-sm text-content-tertiary mt-1">{error}</p>
          <button
            onClick={() => loadBriefing()}
            className="mt-4 px-4 py-2 bg-accent-primary text-white rounded-lg hover:opacity-90 transition-colors"
          >
            Retry
          </button>
        </div>
      </div>
    )
  }

  if (!briefing) return null

  const GreetingIcon = getGreetingIcon()
  const { stats, meetings, overdueItems, deals, recentContacts, insights } = briefing

  return (
    <div className="card overflow-hidden">
      {/* Header with gradient */}
      <div className="bg-gradient-to-r from-accent-primary via-accent-tertiary to-accent-primary p-6 text-white">
        <div className="flex items-start justify-between">
          <div className="flex-1">
            <div className="flex items-center gap-2 mb-1">
              <GreetingIcon className="w-5 h-5" />
              <span className="text-content-tertiary text-sm">{briefing.formattedDate}</span>
            </div>
            <h2 className="text-2xl font-bold">{briefing.greeting}!</h2>
            <p className="text-content-tertiary mt-1 flex items-center gap-1">
              <Zap className="w-4 h-4" />
              Today's Intelligence Briefing
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => loadBriefing(true)}
              disabled={refreshing}
              className="p-2 hover:bg-surface/10 rounded-lg transition-colors"
              title="Refresh briefing"
              aria-label="Refresh briefing"
            >
              <RefreshCw className={`w-5 h-5 ${refreshing ? 'animate-spin' : ''}`} />
            </button>
          </div>
        </div>
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-2 sm:grid-cols-4 divide-x divide-line-subtle border-b border-line-subtle">
        <div className="p-4 text-center">
          <div className="flex items-center justify-center gap-1 mb-1">
            <Calendar className="w-4 h-4 text-accent-primary" />
          </div>
          <p className="text-2xl font-bold text-content-primary">{stats.todaysMeetingsCount}</p>
          <p className="text-xs text-content-tertiary">Today's Meetings</p>
        </div>
        <div className="p-4 text-center">
          <div className="flex items-center justify-center gap-1 mb-1">
            <AlertTriangle className="w-4 h-4 text-semantic-error" />
          </div>
          <p className={`text-2xl font-bold ${stats.overdueItemsCount > 0 ? 'text-semantic-error' : 'text-content-primary'}`}>
            {stats.overdueItemsCount}
          </p>
          <p className="text-xs text-content-tertiary">Overdue Items</p>
        </div>
        <div className="p-4 text-center">
          <div className="flex items-center justify-center gap-1 mb-1">
            <DollarSign className="w-4 h-4 vc-text-warning" />
          </div>
          <p className={`text-2xl font-bold ${stats.urgentDealsCount > 0 ? 'text-semantic-warning' : 'text-content-primary'}`}>
            {stats.urgentDealsCount}
          </p>
          <p className="text-xs text-content-tertiary">Urgent Deals</p>
        </div>
        <div className="p-4 text-center">
          <div className="flex items-center justify-center gap-1 mb-1">
            <UserPlus className="w-4 h-4 text-semantic-success" />
          </div>
          <p className="text-2xl font-bold text-content-primary">{stats.newContactsCount}</p>
          <p className="text-xs text-content-tertiary">New Contacts</p>
        </div>
      </div>

      {/* AI Insights */}
      {insights && insights.length > 0 && (
        <div className="p-4 border-b border-line-subtle bg-surface-muted">
          <h3 className="text-sm font-semibold text-content-secondary mb-3 flex items-center gap-2">
            <Zap className="w-4 h-4 text-accent-tertiary" />
            AI Insights
          </h3>
          <div className="space-y-2">
            {insights.slice(0, 3).map((insight, idx) => {
              const InsightIcon = getInsightIcon(insight.type)
              return (
                <div
                  key={idx}
                  className={`flex items-start gap-3 p-3 rounded-lg border ${getInsightColors(insight.type)}`}
                >
                  <InsightIcon className="w-5 h-5 flex-shrink-0 mt-0.5" />
                  <div>
                    <p className="font-medium text-sm">{insight.title}</p>
                    <p className="text-sm opacity-90">{insight.message}</p>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* Collapsible Sections */}
      <div className="divide-y divide-line-subtle">
        {/* Today's Meetings */}
        <CollapsibleSection
          title="Today's Meetings"
          icon={<Calendar className="w-4 h-4 text-accent-primary" />}
          count={meetings.count}
          isExpanded={expandedSections.meetings}
          onToggle={() => toggleSection('meetings')}
        >
          {meetings.meetings && meetings.meetings.length > 0 ? (
            <div className="space-y-3">
              {meetings.meetings.map((meeting) => (
                <Link
                  key={meeting.id}
                  to={`/meetings/${meeting.id}`}
                  className="block p-3 bg-surface-muted rounded-lg hover:bg-surface-muted transition-colors"
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-content-primary truncate">{meeting.title}</p>
                      {meeting.attendeeContext && meeting.attendeeContext.length > 0 && (
                        <div className="flex items-center gap-1 mt-1 text-xs text-content-tertiary">
                          <Users className="w-3 h-3" />
                          {meeting.attendeeContext.slice(0, 3).map((a, i) => (
                            <span key={i}>
                              {a.name || a.email}
                              {a.company && ` (${a.company})`}
                              {i < Math.min(meeting.attendeeContext.length, 3) - 1 && ', '}
                            </span>
                          ))}
                          {meeting.attendeeContext.length > 3 && ` +${meeting.attendeeContext.length - 3} more`}
                        </div>
                      )}
                      {meeting.relatedDeals && meeting.relatedDeals.length > 0 && (
                        <div className="flex items-center gap-1 mt-1 text-xs text-semantic-warning">
                          <DollarSign className="w-3 h-3" />
                          Related: {meeting.relatedDeals.map(d => d.name).join(', ')}
                        </div>
                      )}
                    </div>
                    {meeting.sentiment_label && (
                      <span className={`ml-2 px-2 py-1 rounded text-xs font-medium ${
                        meeting.sentiment_label === 'Positive' ? 'bg-semantic-success-dim text-semantic-success' :
                        meeting.sentiment_label === 'Negative' ? 'bg-semantic-error-dim text-semantic-error' :
                        'bg-surface-muted text-content-secondary'
                      }`}>
                        {meeting.sentiment_label}
                      </span>
                    )}
                  </div>
                  {meeting.duration_minutes && (
                    <div className="flex items-center gap-2 mt-2 text-xs text-content-tertiary">
                      <Clock className="w-3 h-3" />
                      {meeting.duration_minutes} min
                    </div>
                  )}
                </Link>
              ))}
            </div>
          ) : (
            <div className="text-center py-4 text-content-tertiary">
              <Calendar className="w-8 h-8 mx-auto mb-2 opacity-50" />
              <p className="text-sm">No meetings scheduled for today</p>
            </div>
          )}
        </CollapsibleSection>

        {/* Overdue Action Items */}
        <CollapsibleSection
          title="Overdue Action Items"
          icon={<AlertTriangle className="w-4 h-4 text-semantic-error" />}
          count={overdueItems.count}
          countColor={overdueItems.count > 0 ? 'text-semantic-error' : undefined}
          isExpanded={expandedSections.overdue}
          onToggle={() => toggleSection('overdue')}
        >
          {overdueItems.items && overdueItems.items.length > 0 ? (
            <div className="space-y-2">
              {overdueItems.items.slice(0, 5).map((item) => (
                <div
                  key={item.id}
                  className={`flex items-center gap-3 p-3 rounded-lg ${
                    item.priority === 'high' ? 'bg-semantic-error-dim' : 'bg-semantic-warning-dim'
                  }`}
                >
                  <div className={`w-2 h-2 rounded-full flex-shrink-0 ${
                    item.priority === 'high' ? 'bg-semantic-error' :
                    item.priority === 'medium' ? 'vc-bg-warning' : 'vc-bg-success'
                  }`} />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-content-secondary truncate">{item.task_description}</p>
                    <div className="flex items-center gap-2 mt-1 text-xs text-content-tertiary">
                      {item.assigned_to_name && (
                        <span className="flex items-center gap-1">
                          <Users className="w-3 h-3" />
                          {item.assigned_to_name}
                        </span>
                      )}
                      {item.meetingTitle && (
                        <span className="truncate">From: {item.meetingTitle}</span>
                      )}
                    </div>
                  </div>
                  <span className="text-xs font-medium text-semantic-error flex-shrink-0">
                    {item.daysOverdue}d overdue
                  </span>
                </div>
              ))}
              {overdueItems.count > 5 && (
                <Link
                  to="/tasks?filter=overdue"
                  className="inline-flex items-center gap-1 text-sm text-accent-primary hover:text-accent-primary mt-2"
                >
                  View all {overdueItems.count} overdue items <ArrowRight className="w-4 h-4" />
                </Link>
              )}
            </div>
          ) : (
            <div className="text-center py-4 text-content-tertiary">
              <CheckCircle2 className="w-8 h-8 mx-auto mb-2 text-semantic-success" />
              <p className="text-sm">No overdue items - great job!</p>
            </div>
          )}
        </CollapsibleSection>

        {/* Deals Requiring Attention */}
        <CollapsibleSection
          title="Deals Requiring Attention"
          icon={<DollarSign className="w-4 h-4 vc-text-warning" />}
          count={deals.count}
          badge={deals.source === 'logos_crm' ? 'Logos CRM' : undefined}
          isExpanded={expandedSections.deals}
          onToggle={() => toggleSection('deals')}
        >
          {deals.source === 'not_configured' ? (
            <div className="text-center py-4 text-content-tertiary">
              <DollarSign className="w-8 h-8 mx-auto mb-2 opacity-50" />
              <p className="text-sm">Logos CRM not configured</p>
              <p className="text-xs text-content-tertiary mt-1">Connect to see deal intelligence</p>
            </div>
          ) : deals.deals && deals.deals.length > 0 ? (
            <div className="space-y-2">
              {deals.deals.slice(0, 5).map((deal) => (
                <div
                  key={deal.id}
                  className={`flex items-center gap-3 p-3 rounded-lg ${
                    deal.urgencyLevel === 'critical' ? 'bg-semantic-error-dim' :
                    deal.urgencyLevel === 'high' ? 'bg-semantic-warning-dim' : 'bg-surface-muted'
                  }`}
                >
                  <div className={`w-2 h-2 rounded-full flex-shrink-0 ${
                    deal.urgencyLevel === 'critical' ? 'bg-semantic-error' :
                    deal.urgencyLevel === 'high' ? 'vc-bg-warning' : 'vc-bg-info'
                  }`} />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-content-secondary truncate">{deal.name}</p>
                    <div className="flex items-center gap-2 mt-1 text-xs text-content-tertiary">
                      {deal.companyName && <span>{deal.companyName}</span>}
                      {deal.stage && <span className="px-1.5 py-0.5 bg-surface-muted rounded">{deal.stage}</span>}
                    </div>
                  </div>
                  <div className="text-right flex-shrink-0">
                    {deal.value > 0 && (
                      <p className="text-sm font-medium text-content-primary">
                        ${deal.value.toLocaleString()}
                      </p>
                    )}
                    <span className={`text-xs font-medium ${
                      deal.urgencyLevel === 'critical' ? 'text-semantic-error' :
                      deal.urgencyLevel === 'high' ? 'text-semantic-warning' : 'text-content-tertiary'
                    }`}>
                      Score: {deal.urgencyScore}/10
                    </span>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-4 text-content-tertiary">
              <TrendingUp className="w-8 h-8 mx-auto mb-2 text-semantic-success" />
              <p className="text-sm">All deals are on track</p>
            </div>
          )}
        </CollapsibleSection>

        {/* New Contacts from Logos CRM */}
        <CollapsibleSection
          title="New Contacts (Last 24h)"
          icon={<UserPlus className="w-4 h-4 text-semantic-success" />}
          count={recentContacts.count}
          badge={recentContacts.source === 'logos_crm' ? 'Logos CRM' : undefined}
          isExpanded={expandedSections.contacts}
          onToggle={() => toggleSection('contacts')}
        >
          {recentContacts.source === 'not_configured' ? (
            <div className="text-center py-4 text-content-tertiary">
              <Users className="w-8 h-8 mx-auto mb-2 opacity-50" />
              <p className="text-sm">Shared Hub not configured</p>
              <p className="text-xs text-content-tertiary mt-1">Connect to see synced contacts</p>
            </div>
          ) : recentContacts.contacts && recentContacts.contacts.length > 0 ? (
            <div className="space-y-2">
              {recentContacts.contacts.slice(0, 5).map((contact) => (
                <div
                  key={contact.id}
                  className="flex items-center gap-3 p-3 bg-surface-muted rounded-lg"
                >
                  <div className="w-8 h-8 rounded-full bg-gradient-to-br from-semantic-success to-semantic-success-emphasis flex items-center justify-center text-white font-medium text-sm flex-shrink-0">
                    {(contact.name || contact.email || '?')[0].toUpperCase()}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-content-secondary truncate">
                      {contact.name || contact.email}
                    </p>
                    <div className="flex items-center gap-2 mt-0.5 text-xs text-content-tertiary">
                      {contact.job_title && <span>{contact.job_title}</span>}
                      {contact.company_name && (
                        <span className="truncate">at {contact.company_name}</span>
                      )}
                    </div>
                  </div>
                  {contact.tags && contact.tags.length > 0 && (
                    <div className="flex gap-1 flex-shrink-0">
                      {contact.tags.slice(0, 2).map((tag, i) => (
                        <span
                          key={i}
                          className="px-1.5 py-0.5 bg-semantic-success-dim text-semantic-success text-xs rounded"
                        >
                          {tag}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              ))}
              {recentContacts.count > 5 && (
                <p className="text-xs text-content-tertiary mt-2">
                  +{recentContacts.count - 5} more contacts synced
                </p>
              )}
            </div>
          ) : (
            <div className="text-center py-4 text-content-tertiary">
              <Users className="w-8 h-8 mx-auto mb-2 opacity-50" />
              <p className="text-sm">No new contacts in the last 24 hours</p>
            </div>
          )}
        </CollapsibleSection>
      </div>

      {/* Start Day Button */}
      <div className="p-4 bg-surface-muted border-t border-line-subtle">
        <button
          onClick={handleStartDay}
          disabled={startingDay}
          className={`w-full flex items-center justify-center gap-2 px-6 py-3 rounded-lg font-medium transition-all ${
            startingDay
              ? 'vc-bg-success vc-text-primary'
              : 'bg-gradient-to-r from-accent-primary to-accent-tertiary text-white hover:opacity-90'
          }`}
        >
          {startingDay ? (
            <>
              <CheckCircle2 className="w-5 h-5" />
              Day Started!
            </>
          ) : (
            <>
              <Play className="w-5 h-5" />
              Start My Day
            </>
          )}
        </button>
        <p className="text-xs text-content-tertiary text-center mt-2">
          Mark this briefing as reviewed and collapse sections
        </p>
      </div>
    </div>
  )
}

/**
 * Collapsible Section Component
 */
function CollapsibleSection({
  title,
  icon,
  count,
  countColor,
  badge,
  isExpanded,
  onToggle,
  children
}) {
  return (
    <div className="border-b border-line-subtle last:border-b-0">
      <button
        onClick={onToggle}
        className="w-full flex items-center justify-between p-4 hover:bg-surface-muted transition-colors text-left"
        aria-expanded={isExpanded}
      >
        <div className="flex items-center gap-2">
          {icon}
          <span className="font-semibold text-content-secondary">{title}</span>
          {badge && (
            <span className="px-2 py-0.5 bg-accent-tertiary-dim text-accent-tertiary text-xs rounded-full">
              {badge}
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          <span className={`text-sm font-medium ${countColor || 'text-content-tertiary'}`}>
            {count}
          </span>
          {isExpanded ? (
            <ChevronUp className="w-5 h-5 text-content-tertiary" />
          ) : (
            <ChevronDown className="w-5 h-5 text-content-tertiary" />
          )}
        </div>
      </button>
      {isExpanded && (
        <div className="px-4 pb-4">
          {children}
        </div>
      )}
    </div>
  )
}
