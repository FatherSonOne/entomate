/**
 * SearchAnalytics — Collapsible analytics dashboard
 */
import React, { useState, useEffect } from 'react'
import {
  BarChart3, SearchIcon, Target, Zap, TrendingUp, AlertCircle,
  Clock, Loader2, RefreshCw, ChevronUp, ChevronDown, Search
} from 'lucide-react'
import { searchApi } from '../../services/api'

export default function SearchAnalytics({ onSearch, searchType }) {
  const [showAnalytics, setShowAnalytics] = useState(false)
  const [analytics, setAnalytics] = useState(null)
  const [loading, setLoading] = useState(false)
  const [period, setPeriod] = useState('7d')

  const loadAnalytics = async (p = period) => {
    try {
      setLoading(true)
      const data = await searchApi.getAnalytics(p)
      setAnalytics(data.analytics)
    } catch (error) {
      console.error('Failed to load analytics:', error)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (showAnalytics) loadAnalytics(period)
  }, [showAnalytics, period])

  return (
    <div className="vc">
      <button
        onClick={() => setShowAnalytics(!showAnalytics)}
        className="w-full p-4 flex items-center justify-between text-left transition-colors"
        onMouseEnter={e => { e.currentTarget.style.background = 'var(--b0)' }}
        onMouseLeave={e => { e.currentTarget.style.background = 'transparent' }}
      >
        <div className="flex items-center gap-2">
          <BarChart3 className="w-5 h-5" style={{ color: 'var(--accent-primary)' }} />
          <span className="font-semibold" style={{ color: 'var(--text-primary)' }}>Search Analytics</span>
        </div>
        {showAnalytics ? <ChevronUp className="w-5 h-5" style={{ color: 'var(--text-tertiary)' }} /> : <ChevronDown className="w-5 h-5" style={{ color: 'var(--text-tertiary)' }} />}
      </button>

      {showAnalytics && (
        <div className="p-4" style={{ borderTop: '1px solid var(--b1)' }}>
          {/* Period selector */}
          <div className="flex items-center justify-between mb-4">
            <div className="flex gap-2">
              {[
                { value: '24h', label: '24 Hours' },
                { value: '7d', label: '7 Days' },
                { value: '30d', label: '30 Days' },
                { value: 'all', label: 'All Time' }
              ].map(p => (
                <button
                  key={p.value}
                  onClick={() => setPeriod(p.value)}
                  className="px-3 py-1.5 text-sm rounded-lg transition-colors"
                  style={
                    period === p.value
                      ? { background: 'rgba(255,45,107,0.12)', color: 'var(--accent-primary)' }
                      : { background: 'var(--b0)', color: 'var(--text-secondary)' }
                  }
                >
                  {p.label}
                </button>
              ))}
            </div>
            <button
              onClick={() => loadAnalytics(period)}
              disabled={loading}
              className="text-sm flex items-center gap-1 transition-colors"
              style={{ color: 'var(--text-tertiary)' }}
              onMouseEnter={e => { e.currentTarget.style.color = 'var(--text-secondary)' }}
              onMouseLeave={e => { e.currentTarget.style.color = 'var(--text-tertiary)' }}
            >
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
              Refresh
            </button>
          </div>

          {loading ? (
            <div className="py-8 text-center">
              <Loader2 className="w-8 h-8 animate-spin mx-auto mb-2" style={{ color: 'var(--accent-primary)' }} />
              <p className="text-sm" style={{ color: 'var(--text-tertiary)' }}>Loading analytics...</p>
            </div>
          ) : analytics ? (
            <div className="space-y-6">
              {/* Key Metrics */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <MetricCard icon={Search} label="Total Searches" value={analytics.totalSearches || 0} color="primary" />
                <MetricCard icon={Target} label="Success Rate" value={`${analytics.successRate || 0}%`} color="secondary" valueColor="var(--accent-secondary)" />
                <MetricCard icon={Zap} label="Avg. Speed" value={`${analytics.avgExecutionTime || 0}ms`} color="secondary-light" />
                <MetricCard icon={TrendingUp} label="Avg. Results" value={analytics.avgResultsPerSearch || 0} color="tertiary" valueColor="var(--accent-tertiary)" />
              </div>

              {/* Charts Row */}
              <div className="grid md:grid-cols-2 gap-4">
                {/* Search Types */}
                <div className="rounded-lg p-4" style={{ background: 'var(--b0)' }}>
                  <h4 className="text-sm font-medium mb-3" style={{ color: 'var(--text-secondary)' }}>Searches by Type</h4>
                  {analytics.searchesByType && analytics.searchesByType.length > 0 ? (
                    <div className="space-y-2">
                      {analytics.searchesByType.map(item => {
                        const total = analytics.totalSearches || 1
                        const percentage = Math.round((item.count / total) * 100)
                        return (
                          <div key={item.type} className="flex items-center gap-3">
                            <span className="text-sm capitalize w-20" style={{ color: 'var(--text-secondary)' }}>{item.type}</span>
                            <div className="flex-1 rounded-full h-2" style={{ background: 'var(--b1)' }}>
                              <div className="h-2 rounded-full" style={{ width: `${percentage}%`, background: item.type === 'semantic' ? 'var(--accent-primary)' : 'var(--t2)' }} />
                            </div>
                            <span className="text-sm w-16 text-right" style={{ color: 'var(--text-tertiary)' }}>{item.count} ({percentage}%)</span>
                          </div>
                        )
                      })}
                    </div>
                  ) : (
                    <p className="text-sm" style={{ color: 'var(--text-tertiary)' }}>No data yet</p>
                  )}
                </div>

                {/* Daily Trend — SVG bar chart */}
                <div className="rounded-lg p-4" style={{ background: 'var(--b0)' }}>
                  <h4 className="text-sm font-medium mb-3" style={{ color: 'var(--text-secondary)' }}>Daily Trend</h4>
                  {analytics.dailyTrend && analytics.dailyTrend.length > 0 ? (
                    <DailyTrendChart data={analytics.dailyTrend} />
                  ) : (
                    <p className="text-sm" style={{ color: 'var(--text-tertiary)' }}>No data yet</p>
                  )}
                </div>
              </div>

              {/* Top Queries & Zero Results */}
              <div className="grid md:grid-cols-2 gap-4">
                <div className="rounded-lg p-4" style={{ background: 'var(--b0)' }}>
                  <h4 className="text-sm font-medium mb-3 flex items-center gap-2" style={{ color: 'var(--text-secondary)' }}>
                    <TrendingUp className="w-4 h-4" style={{ color: 'var(--accent-secondary)' }} /> Top Searches
                  </h4>
                  {analytics.topQueries && analytics.topQueries.length > 0 ? (
                    <div className="space-y-2">
                      {analytics.topQueries.slice(0, 5).map((item, idx) => (
                        <div key={idx} className="flex items-center justify-between">
                          <button
                            onClick={(e) => onSearch(e, item.query, searchType)}
                            className="text-sm truncate max-w-[200px] text-left transition-colors"
                            style={{ color: 'var(--text-secondary)' }}
                            onMouseEnter={e => { e.currentTarget.style.color = 'var(--accent-primary)' }}
                            onMouseLeave={e => { e.currentTarget.style.color = 'var(--text-secondary)' }}
                          >
                            {item.query}
                          </button>
                          <span className="text-xs px-2 py-0.5 rounded-full" style={{ background: 'var(--b0)', color: 'var(--text-secondary)' }}>{item.count}</span>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-sm" style={{ color: 'var(--text-tertiary)' }}>No searches yet</p>
                  )}
                </div>

                <div className="rounded-lg p-4" style={{ background: 'var(--b0)' }}>
                  <h4 className="text-sm font-medium mb-3 flex items-center gap-2" style={{ color: 'var(--text-secondary)' }}>
                    <AlertCircle className="w-4 h-4" style={{ color: 'var(--accent-tertiary)' }} /> Zero Results
                  </h4>
                  {analytics.zeroResultQueries && analytics.zeroResultQueries.length > 0 ? (
                    <div className="space-y-2">
                      {analytics.zeroResultQueries.map((item, idx) => (
                        <div key={idx} className="flex items-center justify-between">
                          <span className="text-sm truncate max-w-[200px]" style={{ color: 'var(--text-secondary)' }}>{item.query}</span>
                          <span className="text-xs px-2 py-0.5 rounded-full" style={{ background: 'rgba(255,184,0,0.1)', color: 'var(--accent-tertiary)' }}>{item.count}x</span>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-sm" style={{ color: 'var(--accent-secondary)' }}>All searches found results</p>
                  )}
                </div>
              </div>

              {/* Peak Hour */}
              {analytics.peakHour !== undefined && analytics.totalSearches > 0 && (
                <div className="rounded-lg p-3 flex items-center gap-3" style={{ background: 'rgba(0,245,212,0.06)', border: '1px solid rgba(0,245,212,0.15)' }}>
                  <Clock className="w-5 h-5" style={{ color: 'var(--accent-secondary)' }} />
                  <span className="text-sm" style={{ color: 'var(--accent-secondary)' }}>
                    Peak search activity: <strong>{analytics.peakHour}:00 - {analytics.peakHour + 1}:00</strong>
                  </span>
                </div>
              )}
            </div>
          ) : (
            <div className="py-8 text-center">
              <BarChart3 className="w-12 h-12 mx-auto mb-3" style={{ color: 'var(--text-tertiary)' }} />
              <p style={{ color: 'var(--text-tertiary)' }}>No analytics data available</p>
              <p className="text-sm" style={{ color: 'var(--text-tertiary)' }}>Start searching to see your analytics</p>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

function DailyTrendChart({ data }) {
  const [hoveredIdx, setHoveredIdx] = React.useState(null)
  const maxCount = Math.max(...data.map(d => d.count), 1)
  const chartHeight = 80
  const barGap = 2
  const barCount = data.length
  // Use a viewBox so it scales to container width
  const viewBoxWidth = barCount * 20

  return (
    <div className="relative">
      <svg
        viewBox={`0 0 ${viewBoxWidth} ${chartHeight + 18}`}
        className="w-full"
        style={{ height: 100 }}
        role="img"
        aria-label="Daily search trend chart"
      >
        {data.map((day, idx) => {
          const barWidth = (viewBoxWidth - (barCount - 1) * barGap) / barCount
          const x = idx * (barWidth + barGap)
          const barHeight = Math.max((day.count / maxCount) * chartHeight, 2)
          const y = chartHeight - barHeight
          const isHovered = hoveredIdx === idx

          return (
            <g key={idx}
              onMouseEnter={() => setHoveredIdx(idx)}
              onMouseLeave={() => setHoveredIdx(null)}
              style={{ cursor: 'default' }}
            >
              <rect
                x={x}
                y={y}
                width={barWidth}
                height={barHeight}
                rx={2}
                fill="var(--accent-primary)"
                opacity={isHovered ? 1 : 0.6}
                style={{ transition: 'opacity 0.15s' }}
              />
              {/* Date label (every 3rd bar or on hover) */}
              {(idx % 3 === 0 || isHovered) && (
                <text
                  x={x + barWidth / 2}
                  y={chartHeight + 12}
                  textAnchor="middle"
                  fontSize={7}
                  fill="var(--text-tertiary)"
                  fontFamily="var(--font-mono)"
                >
                  {new Date(day.date).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
                </text>
              )}
              {/* Hover tooltip */}
              {isHovered && (
                <>
                  <rect
                    x={x + barWidth / 2 - 14}
                    y={y - 16}
                    width={28}
                    height={14}
                    rx={3}
                    fill="var(--bg-elevated)"
                    stroke="var(--b1)"
                    strokeWidth={0.5}
                  />
                  <text
                    x={x + barWidth / 2}
                    y={y - 6}
                    textAnchor="middle"
                    fontSize={8}
                    fill="white"
                    fontWeight="bold"
                    fontFamily="var(--font-mono)"
                  >
                    {day.count}
                  </text>
                </>
              )}
            </g>
          )
        })}
      </svg>
    </div>
  )
}

function MetricCard({ icon: Icon, label, value, color, valueColor }) {
  const bgMap = {
    primary: { bg: 'rgba(255,45,107,0.08)', border: 'rgba(255,45,107,0.15)', iconColor: 'var(--accent-primary)' },
    secondary: { bg: 'rgba(0,245,212,0.07)', border: 'rgba(0,245,212,0.15)', iconColor: 'var(--accent-secondary)' },
    'secondary-light': { bg: 'rgba(0,245,212,0.05)', border: 'rgba(0,245,212,0.1)', iconColor: 'var(--accent-secondary)' },
    tertiary: { bg: 'rgba(255,184,0,0.07)', border: 'rgba(255,184,0,0.15)', iconColor: 'var(--accent-tertiary)' },
  }
  const c = bgMap[color] || bgMap.primary

  return (
    <div className="rounded-lg p-4" style={{ background: c.bg, border: `1px solid ${c.border}` }}>
      <div className="flex items-center gap-2 mb-1" style={{ color: c.iconColor }}>
        <Icon className="w-4 h-4" />
        <span className="text-xs font-medium uppercase" style={{ fontFamily: 'var(--font-mono)' }}>{label}</span>
      </div>
      <p style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 24, color: valueColor || 'var(--text-primary)' }}>
        {value}
      </p>
    </div>
  )
}
