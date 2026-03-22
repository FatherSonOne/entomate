import { useState, useEffect } from 'react'
import {
  FileText, Download, Calendar, Target, CheckSquare,
  Users, FileSpreadsheet, Loader2, Clock, ChevronDown,
  Building2, BarChart3
} from 'lucide-react'
import { reportsApi, meetingsApi } from '../services/api'
import api from '../services/api'
import { VCButton, VCBadge, VCIconBox } from '../components/vc'

export default function Reports() {
  const [meetings, setMeetings] = useState([])
  const [goals, setGoals] = useState([])
  const [loading, setLoading] = useState(true)
  const [generating, setGenerating] = useState(null)
  const [selectedMeeting, setSelectedMeeting] = useState('')
  const [selectedQuarter, setSelectedQuarter] = useState('')

  useEffect(() => {
    loadData()
  }, [])

  const loadData = async () => {
    try {
      setLoading(true)
      const [meetingsRes, goalsRes] = await Promise.all([
        meetingsApi.list({ limit: 50 }).catch(() => ({ meetings: [] })),
        api.get('/goals').catch(() => ({ data: [] }))
      ])
      setMeetings(meetingsRes.meetings || [])
      setGoals(goalsRes.data || [])
    } catch (error) {
      console.error('Failed to load data:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleDownload = async (type, params = {}) => {
    setGenerating(type)
    try {
      let url
      switch (type) {
        case 'meeting-pdf':
          if (!params.meetingId) return alert('Please select a meeting')
          url = reportsApi.downloadMeetingPDF(params.meetingId)
          break
        case 'goals-pdf':
          url = reportsApi.downloadGoalsPDF(params.quarter)
          break
        case 'weekly-pdf':
          url = reportsApi.downloadWeeklyPDF()
          break
        case 'meetings-csv':
          url = reportsApi.downloadMeetingsCSV()
          break
        case 'action-items-csv':
          url = reportsApi.downloadActionItemsCSV(params)
          break
        case 'goals-csv':
          url = reportsApi.downloadGoalsCSV(params)
          break
        default:
          return
      }

      // Open download in new tab
      window.open(url, '_blank')
    } catch (error) {
      console.error('Failed to generate report:', error)
      alert('Failed to generate report. Please try again.')
    } finally {
      setTimeout(() => setGenerating(null), 1000)
    }
  }

  const getQuarterOptions = () => {
    const now = new Date()
    const year = now.getFullYear()
    const options = [{ value: '', label: 'All Quarters' }]
    for (let y = year + 1; y >= year - 1; y--) {
      for (let q = 4; q >= 1; q--) {
        options.push({ value: `Q${q}-${y}`, label: `Q${q} ${y}` })
      }
    }
    return options
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 animate-spin" style={{ color: 'var(--accent-primary)' }} />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1
          className="text-2xl font-bold flex items-center gap-2"
          style={{ color: 'var(--text-primary)', fontFamily: 'var(--font-display)' }}
        >
          <FileText className="h-7 w-7" style={{ color: 'var(--accent-primary)' }} />
          Reports &amp; Export
        </h1>
        <p style={{ color: 'var(--text-tertiary)' }} className="mt-1">
          Generate PDF reports and export data to CSV
        </p>
      </div>

      {/* PDF Reports Section */}
      <div className="vc p-6">
        <h2
          className="text-lg font-semibold mb-4 flex items-center gap-2"
          style={{ color: 'var(--text-primary)' }}
        >
          <FileText className="h-5 w-5" style={{ color: 'var(--accent-primary)' }} />
          PDF Reports
        </h2>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {/* Meeting Recap */}
          <div className="vc p-4 transition-colors">
            <div className="flex items-start gap-3 mb-3">
              <VCIconBox color="mint" size="sm">
                <Calendar className="h-5 w-5" />
              </VCIconBox>
              <div>
                <h3 className="font-medium" style={{ color: 'var(--text-primary)' }}>Meeting Recap</h3>
                <p className="text-sm" style={{ color: 'var(--text-tertiary)' }}>
                  PDF summary with action items and decisions
                </p>
              </div>
            </div>
            <div className="space-y-2">
              <select
                value={selectedMeeting}
                onChange={(e) => setSelectedMeeting(e.target.value)}
                className="input text-sm"
              >
                <option value="">Select a meeting...</option>
                {meetings.map(meeting => (
                  <option key={meeting.id} value={meeting.id}>
                    {meeting.title || 'Untitled'} - {new Date(meeting.created_at).toLocaleDateString()}
                  </option>
                ))}
              </select>
              <VCButton
                variant="primary"
                className="w-full text-sm"
                onClick={() => handleDownload('meeting-pdf', { meetingId: selectedMeeting })}
                disabled={!selectedMeeting || generating === 'meeting-pdf'}
              >
                {generating === 'meeting-pdf' ? (
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                ) : (
                  <Download className="h-4 w-4 mr-2" />
                )}
                Download PDF
              </VCButton>
            </div>
          </div>

          {/* Goals Report */}
          <div className="vc p-4 transition-colors">
            <div className="flex items-start gap-3 mb-3">
              <VCIconBox color="amber" size="sm">
                <Target className="h-5 w-5" />
              </VCIconBox>
              <div>
                <h3 className="font-medium" style={{ color: 'var(--text-primary)' }}>Goals &amp; OKRs</h3>
                <p className="text-sm" style={{ color: 'var(--text-tertiary)' }}>
                  Progress report for all goals
                </p>
              </div>
            </div>
            <div className="space-y-2">
              <select
                value={selectedQuarter}
                onChange={(e) => setSelectedQuarter(e.target.value)}
                className="input text-sm"
              >
                {getQuarterOptions().map(opt => (
                  <option key={opt.value} value={opt.value}>{opt.label}</option>
                ))}
              </select>
              <VCButton
                variant="primary"
                className="w-full text-sm"
                onClick={() => handleDownload('goals-pdf', { quarter: selectedQuarter })}
                disabled={generating === 'goals-pdf'}
              >
                {generating === 'goals-pdf' ? (
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                ) : (
                  <Download className="h-4 w-4 mr-2" />
                )}
                Download PDF
              </VCButton>
            </div>
          </div>

          {/* Weekly Summary */}
          <div className="vc p-4 transition-colors">
            <div className="flex items-start gap-3 mb-3">
              <VCIconBox color="mint" size="sm">
                <Clock className="h-5 w-5" />
              </VCIconBox>
              <div>
                <h3 className="font-medium" style={{ color: 'var(--text-primary)' }}>Weekly Summary</h3>
                <p className="text-sm" style={{ color: 'var(--text-tertiary)' }}>
                  Overview of the past 7 days
                </p>
              </div>
            </div>
            <div className="space-y-2">
              <div className="text-sm py-2" style={{ color: 'var(--text-tertiary)' }}>
                Includes meetings, tasks, and overdue items
              </div>
              <VCButton
                variant="primary"
                className="w-full text-sm"
                onClick={() => handleDownload('weekly-pdf')}
                disabled={generating === 'weekly-pdf'}
              >
                {generating === 'weekly-pdf' ? (
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                ) : (
                  <Download className="h-4 w-4 mr-2" />
                )}
                Download PDF
              </VCButton>
            </div>
          </div>
        </div>
      </div>

      {/* CSV Export Section */}
      <div className="vc p-6">
        <h2
          className="text-lg font-semibold mb-4 flex items-center gap-2"
          style={{ color: 'var(--text-primary)' }}
        >
          <FileSpreadsheet className="h-5 w-5" style={{ color: 'var(--accent-secondary)' }} />
          CSV Export
        </h2>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {/* Meetings Export */}
          <div className="vc p-4 transition-colors">
            <div className="flex items-start gap-3 mb-3">
              <VCIconBox color="mint" size="sm">
                <Calendar className="h-5 w-5" />
              </VCIconBox>
              <div>
                <h3 className="font-medium" style={{ color: 'var(--text-primary)' }}>Meetings</h3>
                <p className="text-sm" style={{ color: 'var(--text-tertiary)' }}>
                  Export all meetings data
                </p>
              </div>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm" style={{ color: 'var(--text-tertiary)' }}>{meetings.length} meetings</span>
              <VCButton
                variant="ghost"
                size="sm"
                onClick={() => handleDownload('meetings-csv')}
                disabled={generating === 'meetings-csv'}
              >
                {generating === 'meetings-csv' ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Download className="h-4 w-4" />
                )}
              </VCButton>
            </div>
          </div>

          {/* Action Items Export */}
          <div className="vc p-4 transition-colors">
            <div className="flex items-start gap-3 mb-3">
              <VCIconBox color="amber" size="sm">
                <CheckSquare className="h-5 w-5" />
              </VCIconBox>
              <div>
                <h3 className="font-medium" style={{ color: 'var(--text-primary)' }}>Action Items</h3>
                <p className="text-sm" style={{ color: 'var(--text-tertiary)' }}>
                  Export all action items
                </p>
              </div>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm" style={{ color: 'var(--text-tertiary)' }}>All statuses</span>
              <VCButton
                variant="ghost"
                size="sm"
                onClick={() => handleDownload('action-items-csv')}
                disabled={generating === 'action-items-csv'}
              >
                {generating === 'action-items-csv' ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Download className="h-4 w-4" />
                )}
              </VCButton>
            </div>
          </div>

          {/* Goals Export */}
          <div className="vc p-4 transition-colors">
            <div className="flex items-start gap-3 mb-3">
              <VCIconBox color="amber" size="sm">
                <Target className="h-5 w-5" />
              </VCIconBox>
              <div>
                <h3 className="font-medium" style={{ color: 'var(--text-primary)' }}>Goals</h3>
                <p className="text-sm" style={{ color: 'var(--text-tertiary)' }}>
                  Export all goals data
                </p>
              </div>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm" style={{ color: 'var(--text-tertiary)' }}>{goals.length} goals</span>
              <VCButton
                variant="ghost"
                size="sm"
                onClick={() => handleDownload('goals-csv')}
                disabled={generating === 'goals-csv'}
              >
                {generating === 'goals-csv' ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Download className="h-4 w-4" />
                )}
              </VCButton>
            </div>
          </div>
        </div>
      </div>

      {/* Quick Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="vc p-4">
          <div className="flex items-center gap-3">
            <VCIconBox color="mint" size="sm">
              <Calendar className="h-5 w-5" />
            </VCIconBox>
            <div>
              <p
                style={{
                  fontFamily: 'var(--font-display)',
                  fontWeight: 700,
                  fontSize: 24,
                  color: 'var(--text-primary)',
                }}
              >
                {meetings.length}
              </p>
              <p className="text-sm" style={{ color: 'var(--text-tertiary)' }}>Meetings</p>
            </div>
          </div>
        </div>

        <div className="vc p-4">
          <div className="flex items-center gap-3">
            <VCIconBox color="amber" size="sm">
              <Target className="h-5 w-5" />
            </VCIconBox>
            <div>
              <p
                style={{
                  fontFamily: 'var(--font-display)',
                  fontWeight: 700,
                  fontSize: 24,
                  color: 'var(--text-primary)',
                }}
              >
                {goals.length}
              </p>
              <p className="text-sm" style={{ color: 'var(--text-tertiary)' }}>Goals</p>
            </div>
          </div>
        </div>

        <div className="vc p-4">
          <div className="flex items-center gap-3">
            <VCIconBox color="mint" size="sm">
              <CheckSquare className="h-5 w-5" />
            </VCIconBox>
            <div>
              <p
                style={{
                  fontFamily: 'var(--font-display)',
                  fontWeight: 700,
                  fontSize: 24,
                  color: 'var(--text-primary)',
                }}
              >
                {goals.filter(g => g.status === 'completed').length}
              </p>
              <p className="text-sm" style={{ color: 'var(--text-tertiary)' }}>Completed</p>
            </div>
          </div>
        </div>

        <div className="vc p-4">
          <div className="flex items-center gap-3">
            <VCIconBox color="amber" size="sm">
              <BarChart3 className="h-5 w-5" />
            </VCIconBox>
            <div>
              <p
                style={{
                  fontFamily: 'var(--font-display)',
                  fontWeight: 700,
                  fontSize: 24,
                  color: 'var(--text-primary)',
                }}
              >
                {goals.length > 0
                  ? Math.round(goals.reduce((sum, g) => sum + (g.progress || 0), 0) / goals.length)
                  : 0}%
              </p>
              <p className="text-sm" style={{ color: 'var(--text-tertiary)' }}>Avg Progress</p>
            </div>
          </div>
        </div>
      </div>

      {/* Info */}
      <div
        className="vc rounded-lg p-4"
        style={{
          borderColor: 'rgba(0,245,212,0.2)',
          background: 'rgba(0,245,212,0.06)',
        }}
      >
        <h3 className="font-medium mb-2 flex items-center gap-2" style={{ color: 'var(--accent-secondary)' }}>
          About Reports
        </h3>
        <ul className="text-sm space-y-1" style={{ color: 'var(--accent-secondary)', opacity: 0.85 }}>
          <li>• PDF reports are generated on-demand and downloaded to your device</li>
          <li>• CSV exports can be opened in Excel, Google Sheets, or any spreadsheet app</li>
          <li>• Weekly summaries include data from the past 7 days</li>
          <li>• All reports reflect the most current data at time of generation</li>
        </ul>
      </div>
    </div>
  )
}
