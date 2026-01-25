import React, { useState, useEffect, useCallback } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '@clerk/clerk-react'
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

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000'

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
        return 'bg-red-50 border-red-200 text-red-800'
      case 'warning':
        return 'bg-amber-50 border-amber-200 text-amber-800'
      case 'success':
        return 'bg-green-50 border-green-200 text-green-800'
      default:
        return 'bg-blue-50 border-blue-200 text-blue-800'
    }
  }

  if (loading) {
    return (
      <div className="card p-6">
        <div className="animate-pulse space-y-4">
          <div className="h-8 bg-gray-200 rounded w-1/3"></div>
          <div className="h-4 bg-gray-200 rounded w-2/3"></div>
          <div className="grid grid-cols-4 gap-4 mt-4">
            <div className="h-20 bg-gray-200 rounded"></div>
            <div className="h-20 bg-gray-200 rounded"></div>
            <div className="h-20 bg-gray-200 rounded"></div>
            <div className="h-20 bg-gray-200 rounded"></div>
          </div>
          <div className="h-32 bg-gray-200 rounded mt-4"></div>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="card p-6">
        <div className="text-center py-8">
          <AlertTriangle className="w-12 h-12 text-amber-500 mx-auto mb-3" />
          <p className="text-gray-600 font-medium">Failed to load intelligence briefing</p>
          <p className="text-sm text-gray-400 mt-1">{error}</p>
          <button
            onClick={() => loadBriefing()}
            className="mt-4 px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors"
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
      <div className="bg-gradient-to-r from-indigo-600 via-purple-600 to-indigo-700 p-6 text-white">
        <div className="flex items-start justify-between">
          <div className="flex-1">
            <div className="flex items-center gap-2 mb-1">
              <GreetingIcon className="w-5 h-5" />
              <span className="text-indigo-100 text-sm">{briefing.formattedDate}</span>
            </div>
            <h2 className="text-2xl font-bold">{briefing.greeting}!</h2>
            <p className="text-indigo-100 mt-1 flex items-center gap-1">
              <Zap className="w-4 h-4" />
              Today's Intelligence Briefing
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => loadBriefing(true)}
              disabled={refreshing}
              className="p-2 hover:bg-white/10 rounded-lg transition-colors"
              title="Refresh briefing"
              aria-label="Refresh briefing"
            >
              <RefreshCw className={`w-5 h-5 ${refreshing ? 'animate-spin' : ''}`} />
            </button>
          </div>
        </div>
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-2 sm:grid-cols-4 divide-x divide-gray-100 border-b border-gray-100">
        <div className="p-4 text-center">
          <div className="flex items-center justify-center gap-1 mb-1">
            <Calendar className="w-4 h-4 text-indigo-500" />
          </div>
          <p className="text-2xl font-bold text-gray-900">{stats.todaysMeetingsCount}</p>
          <p className="text-xs text-gray-500">Today's Meetings</p>
        </div>
        <div className="p-4 text-center">
          <div className="flex items-center justify-center gap-1 mb-1">
            <AlertTriangle className="w-4 h-4 text-red-500" />
          </div>
          <p className={`text-2xl font-bold ${stats.overdueItemsCount > 0 ? 'text-red-600' : 'text-gray-900'}`}>
            {stats.overdueItemsCount}
          </p>
          <p className="text-xs text-gray-500">Overdue Items</p>
        </div>
        <div className="p-4 text-center">
          <div className="flex items-center justify-center gap-1 mb-1">
            <DollarSign className="w-4 h-4 text-amber-500" />
          </div>
          <p className={`text-2xl font-bold ${stats.urgentDealsCount > 0 ? 'text-amber-600' : 'text-gray-900'}`}>
            {stats.urgentDealsCount}
          </p>
          <p className="text-xs text-gray-500">Urgent Deals</p>
        </div>
        <div className="p-4 text-center">
          <div className="flex items-center justify-center gap-1 mb-1">
            <UserPlus className="w-4 h-4 text-green-500" />
          </div>
          <p className="text-2xl font-bold text-gray-900">{stats.newContactsCount}</p>
          <p className="text-xs text-gray-500">New Contacts</p>
        </div>
      </div>

      {/* AI Insights */}
      {insights && insights.length > 0 && (
        <div className="p-4 border-b border-gray-100 bg-gray-50">
          <h3 className="text-sm font-semibold text-gray-700 mb-3 flex items-center gap-2">
            <Zap className="w-4 h-4 text-purple-500" />
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
      <div className="divide-y divide-gray-100">
        {/* Today's Meetings */}
        <CollapsibleSection
          title="Today's Meetings"
          icon={<Calendar className="w-4 h-4 text-indigo-500" />}
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
                  className="block p-3 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors"
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-gray-900 truncate">{meeting.title}</p>
                      {meeting.attendeeContext && meeting.attendeeContext.length > 0 && (
                        <div className="flex items-center gap-1 mt-1 text-xs text-gray-500">
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
                        <div className="flex items-center gap-1 mt-1 text-xs text-amber-600">
                          <DollarSign className="w-3 h-3" />
                          Related: {meeting.relatedDeals.map(d => d.name).join(', ')}
                        </div>
                      )}
                    </div>
                    {meeting.sentiment_label && (
                      <span className={`ml-2 px-2 py-1 rounded text-xs font-medium ${
                        meeting.sentiment_label === 'Positive' ? 'bg-green-100 text-green-700' :
                        meeting.sentiment_label === 'Negative' ? 'bg-red-100 text-red-700' :
                        'bg-gray-100 text-gray-700'
                      }`}>
                        {meeting.sentiment_label}
                      </span>
                    )}
                  </div>
                  {meeting.duration_minutes && (
                    <div className="flex items-center gap-2 mt-2 text-xs text-gray-400">
                      <Clock className="w-3 h-3" />
                      {meeting.duration_minutes} min
                    </div>
                  )}
                </Link>
              ))}
            </div>
          ) : (
            <div className="text-center py-4 text-gray-500">
              <Calendar className="w-8 h-8 mx-auto mb-2 opacity-50" />
              <p className="text-sm">No meetings scheduled for today</p>
            </div>
          )}
        </CollapsibleSection>

        {/* Overdue Action Items */}
        <CollapsibleSection
          title="Overdue Action Items"
          icon={<AlertTriangle className="w-4 h-4 text-red-500" />}
          count={overdueItems.count}
          countColor={overdueItems.count > 0 ? 'text-red-600' : undefined}
          isExpanded={expandedSections.overdue}
          onToggle={() => toggleSection('overdue')}
        >
          {overdueItems.items && overdueItems.items.length > 0 ? (
            <div className="space-y-2">
              {overdueItems.items.slice(0, 5).map((item) => (
                <div
                  key={item.id}
                  className={`flex items-center gap-3 p-3 rounded-lg ${
                    item.priority === 'high' ? 'bg-red-50' : 'bg-amber-50'
                  }`}
                >
                  <div className={`w-2 h-2 rounded-full flex-shrink-0 ${
                    item.priority === 'high' ? 'bg-red-500' :
                    item.priority === 'medium' ? 'bg-amber-500' : 'bg-green-500'
                  }`} />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-gray-700 truncate">{item.task_description}</p>
                    <div className="flex items-center gap-2 mt-1 text-xs text-gray-500">
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
                  <span className="text-xs font-medium text-red-600 flex-shrink-0">
                    {item.daysOverdue}d overdue
                  </span>
                </div>
              ))}
              {overdueItems.count > 5 && (
                <Link
                  to="/tasks?filter=overdue"
                  className="inline-flex items-center gap-1 text-sm text-primary-600 hover:text-primary-700 mt-2"
                >
                  View all {overdueItems.count} overdue items <ArrowRight className="w-4 h-4" />
                </Link>
              )}
            </div>
          ) : (
            <div className="text-center py-4 text-gray-500">
              <CheckCircle2 className="w-8 h-8 mx-auto mb-2 text-green-500" />
              <p className="text-sm">No overdue items - great job!</p>
            </div>
          )}
        </CollapsibleSection>

        {/* Deals Requiring Attention */}
        <CollapsibleSection
          title="Deals Requiring Attention"
          icon={<DollarSign className="w-4 h-4 text-amber-500" />}
          count={deals.count}
          badge={deals.source === 'logos_crm' ? 'Logos CRM' : undefined}
          isExpanded={expandedSections.deals}
          onToggle={() => toggleSection('deals')}
        >
          {deals.source === 'not_configured' ? (
            <div className="text-center py-4 text-gray-500">
              <DollarSign className="w-8 h-8 mx-auto mb-2 opacity-50" />
              <p className="text-sm">Logos CRM not configured</p>
              <p className="text-xs text-gray-400 mt-1">Connect to see deal intelligence</p>
            </div>
          ) : deals.deals && deals.deals.length > 0 ? (
            <div className="space-y-2">
              {deals.deals.slice(0, 5).map((deal) => (
                <div
                  key={deal.id}
                  className={`flex items-center gap-3 p-3 rounded-lg ${
                    deal.urgencyLevel === 'critical' ? 'bg-red-50' :
                    deal.urgencyLevel === 'high' ? 'bg-amber-50' : 'bg-gray-50'
                  }`}
                >
                  <div className={`w-2 h-2 rounded-full flex-shrink-0 ${
                    deal.urgencyLevel === 'critical' ? 'bg-red-500' :
                    deal.urgencyLevel === 'high' ? 'bg-amber-500' : 'bg-blue-500'
                  }`} />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-700 truncate">{deal.name}</p>
                    <div className="flex items-center gap-2 mt-1 text-xs text-gray-500">
                      {deal.companyName && <span>{deal.companyName}</span>}
                      {deal.stage && <span className="px-1.5 py-0.5 bg-gray-200 rounded">{deal.stage}</span>}
                    </div>
                  </div>
                  <div className="text-right flex-shrink-0">
                    {deal.value > 0 && (
                      <p className="text-sm font-medium text-gray-900">
                        ${deal.value.toLocaleString()}
                      </p>
                    )}
                    <span className={`text-xs font-medium ${
                      deal.urgencyLevel === 'critical' ? 'text-red-600' :
                      deal.urgencyLevel === 'high' ? 'text-amber-600' : 'text-gray-500'
                    }`}>
                      Score: {deal.urgencyScore}/10
                    </span>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-4 text-gray-500">
              <TrendingUp className="w-8 h-8 mx-auto mb-2 text-green-500" />
              <p className="text-sm">All deals are on track</p>
            </div>
          )}
        </CollapsibleSection>

        {/* New Contacts from Logos CRM */}
        <CollapsibleSection
          title="New Contacts (Last 24h)"
          icon={<UserPlus className="w-4 h-4 text-green-500" />}
          count={recentContacts.count}
          badge={recentContacts.source === 'logos_crm' ? 'Logos CRM' : undefined}
          isExpanded={expandedSections.contacts}
          onToggle={() => toggleSection('contacts')}
        >
          {recentContacts.source === 'not_configured' ? (
            <div className="text-center py-4 text-gray-500">
              <Users className="w-8 h-8 mx-auto mb-2 opacity-50" />
              <p className="text-sm">Shared Hub not configured</p>
              <p className="text-xs text-gray-400 mt-1">Connect to see synced contacts</p>
            </div>
          ) : recentContacts.contacts && recentContacts.contacts.length > 0 ? (
            <div className="space-y-2">
              {recentContacts.contacts.slice(0, 5).map((contact) => (
                <div
                  key={contact.id}
                  className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg"
                >
                  <div className="w-8 h-8 rounded-full bg-gradient-to-br from-green-400 to-green-600 flex items-center justify-center text-white font-medium text-sm flex-shrink-0">
                    {(contact.name || contact.email || '?')[0].toUpperCase()}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-700 truncate">
                      {contact.name || contact.email}
                    </p>
                    <div className="flex items-center gap-2 mt-0.5 text-xs text-gray-500">
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
                          className="px-1.5 py-0.5 bg-green-100 text-green-700 text-xs rounded"
                        >
                          {tag}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              ))}
              {recentContacts.count > 5 && (
                <p className="text-xs text-gray-500 mt-2">
                  +{recentContacts.count - 5} more contacts synced
                </p>
              )}
            </div>
          ) : (
            <div className="text-center py-4 text-gray-500">
              <Users className="w-8 h-8 mx-auto mb-2 opacity-50" />
              <p className="text-sm">No new contacts in the last 24 hours</p>
            </div>
          )}
        </CollapsibleSection>
      </div>

      {/* Start Day Button */}
      <div className="p-4 bg-gradient-to-r from-gray-50 to-gray-100 border-t border-gray-100">
        <button
          onClick={handleStartDay}
          disabled={startingDay}
          className={`w-full flex items-center justify-center gap-2 px-6 py-3 rounded-lg font-medium transition-all ${
            startingDay
              ? 'bg-green-500 text-white'
              : 'bg-gradient-to-r from-indigo-600 to-purple-600 text-white hover:from-indigo-700 hover:to-purple-700'
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
        <p className="text-xs text-gray-500 text-center mt-2">
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
    <div className="border-b border-gray-100 last:border-b-0">
      <button
        onClick={onToggle}
        className="w-full flex items-center justify-between p-4 hover:bg-gray-50 transition-colors text-left"
        aria-expanded={isExpanded}
      >
        <div className="flex items-center gap-2">
          {icon}
          <span className="font-semibold text-gray-700">{title}</span>
          {badge && (
            <span className="px-2 py-0.5 bg-purple-100 text-purple-700 text-xs rounded-full">
              {badge}
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          <span className={`text-sm font-medium ${countColor || 'text-gray-500'}`}>
            {count}
          </span>
          {isExpanded ? (
            <ChevronUp className="w-5 h-5 text-gray-400" />
          ) : (
            <ChevronDown className="w-5 h-5 text-gray-400" />
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
