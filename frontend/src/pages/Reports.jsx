import { useState, useEffect } from 'react'
import {
  FileText, Download, Calendar, Target, CheckSquare,
  Users, FileSpreadsheet, Loader2, Clock, ChevronDown,
  Building2, BarChart3
} from 'lucide-react'
import { reportsApi, meetingsApi } from '../services/api'
import api from '../services/api'

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
        <Loader2 className="w-8 h-8 animate-spin text-accent-primary" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-content-primary flex items-center gap-2">
          <FileText className="h-7 w-7 text-accent-primary" />
          Reports & Export
        </h1>
        <p className="text-content-tertiary mt-1">
          Generate PDF reports and export data to CSV
        </p>
      </div>

      {/* PDF Reports Section */}
      <div className="card p-6">
        <h2 className="text-lg font-semibold text-content-primary mb-4 flex items-center gap-2">
          <FileText className="h-5 w-5 text-semantic-error" />
          PDF Reports
        </h2>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {/* Meeting Recap */}
          <div className="border border-line-default rounded-lg p-4 hover:border-primary-300 transition-colors">
            <div className="flex items-start gap-3 mb-3">
              <div className="p-2 bg-semantic-info-dim rounded-lg">
                <Calendar className="h-5 w-5 text-semantic-info" />
              </div>
              <div>
                <h3 className="font-medium text-content-primary">Meeting Recap</h3>
                <p className="text-sm text-content-tertiary">
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
              <button
                onClick={() => handleDownload('meeting-pdf', { meetingId: selectedMeeting })}
                disabled={!selectedMeeting || generating === 'meeting-pdf'}
                className="btn btn-primary w-full text-sm"
              >
                {generating === 'meeting-pdf' ? (
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                ) : (
                  <Download className="h-4 w-4 mr-2" />
                )}
                Download PDF
              </button>
            </div>
          </div>

          {/* Goals Report */}
          <div className="border border-line-default rounded-lg p-4 hover:border-primary-300 transition-colors">
            <div className="flex items-start gap-3 mb-3">
              <div className="p-2 bg-accent-tertiary-dim rounded-lg">
                <Target className="h-5 w-5 text-accent-tertiary" />
              </div>
              <div>
                <h3 className="font-medium text-content-primary">Goals & OKRs</h3>
                <p className="text-sm text-content-tertiary">
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
              <button
                onClick={() => handleDownload('goals-pdf', { quarter: selectedQuarter })}
                disabled={generating === 'goals-pdf'}
                className="btn btn-primary w-full text-sm"
              >
                {generating === 'goals-pdf' ? (
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                ) : (
                  <Download className="h-4 w-4 mr-2" />
                )}
                Download PDF
              </button>
            </div>
          </div>

          {/* Weekly Summary */}
          <div className="border border-line-default rounded-lg p-4 hover:border-primary-300 transition-colors">
            <div className="flex items-start gap-3 mb-3">
              <div className="p-2 bg-semantic-success-dim rounded-lg">
                <Clock className="h-5 w-5 text-semantic-success" />
              </div>
              <div>
                <h3 className="font-medium text-content-primary">Weekly Summary</h3>
                <p className="text-sm text-content-tertiary">
                  Overview of the past 7 days
                </p>
              </div>
            </div>
            <div className="space-y-2">
              <div className="text-sm text-content-tertiary py-2">
                Includes meetings, tasks, and overdue items
              </div>
              <button
                onClick={() => handleDownload('weekly-pdf')}
                disabled={generating === 'weekly-pdf'}
                className="btn btn-primary w-full text-sm"
              >
                {generating === 'weekly-pdf' ? (
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                ) : (
                  <Download className="h-4 w-4 mr-2" />
                )}
                Download PDF
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* CSV Export Section */}
      <div className="card p-6">
        <h2 className="text-lg font-semibold text-content-primary mb-4 flex items-center gap-2">
          <FileSpreadsheet className="h-5 w-5 text-semantic-success" />
          CSV Export
        </h2>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {/* Meetings Export */}
          <div className="border border-line-default rounded-lg p-4 hover:border-primary-300 transition-colors">
            <div className="flex items-start gap-3 mb-3">
              <div className="p-2 bg-semantic-info-dim rounded-lg">
                <Calendar className="h-5 w-5 text-semantic-info" />
              </div>
              <div>
                <h3 className="font-medium text-content-primary">Meetings</h3>
                <p className="text-sm text-content-tertiary">
                  Export all meetings data
                </p>
              </div>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-content-tertiary">{meetings.length} meetings</span>
              <button
                onClick={() => handleDownload('meetings-csv')}
                disabled={generating === 'meetings-csv'}
                className="btn btn-secondary text-sm"
              >
                {generating === 'meetings-csv' ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Download className="h-4 w-4" />
                )}
              </button>
            </div>
          </div>

          {/* Action Items Export */}
          <div className="border border-line-default rounded-lg p-4 hover:border-primary-300 transition-colors">
            <div className="flex items-start gap-3 mb-3">
              <div className="p-2 bg-semantic-warning-dim rounded-lg">
                <CheckSquare className="h-5 w-5 text-semantic-warning" />
              </div>
              <div>
                <h3 className="font-medium text-content-primary">Action Items</h3>
                <p className="text-sm text-content-tertiary">
                  Export all action items
                </p>
              </div>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-content-tertiary">All statuses</span>
              <button
                onClick={() => handleDownload('action-items-csv')}
                disabled={generating === 'action-items-csv'}
                className="btn btn-secondary text-sm"
              >
                {generating === 'action-items-csv' ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Download className="h-4 w-4" />
                )}
              </button>
            </div>
          </div>

          {/* Goals Export */}
          <div className="border border-line-default rounded-lg p-4 hover:border-primary-300 transition-colors">
            <div className="flex items-start gap-3 mb-3">
              <div className="p-2 bg-accent-tertiary-dim rounded-lg">
                <Target className="h-5 w-5 text-accent-tertiary" />
              </div>
              <div>
                <h3 className="font-medium text-content-primary">Goals</h3>
                <p className="text-sm text-content-tertiary">
                  Export all goals data
                </p>
              </div>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-content-tertiary">{goals.length} goals</span>
              <button
                onClick={() => handleDownload('goals-csv')}
                disabled={generating === 'goals-csv'}
                className="btn btn-secondary text-sm"
              >
                {generating === 'goals-csv' ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Download className="h-4 w-4" />
                )}
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Quick Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="card p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-semantic-info-dim rounded-lg">
              <Calendar className="h-5 w-5 text-semantic-info" />
            </div>
            <div>
              <p className="text-2xl font-bold text-content-primary">{meetings.length}</p>
              <p className="text-sm text-content-tertiary">Meetings</p>
            </div>
          </div>
        </div>

        <div className="card p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-accent-tertiary-dim rounded-lg">
              <Target className="h-5 w-5 text-accent-tertiary" />
            </div>
            <div>
              <p className="text-2xl font-bold text-content-primary">{goals.length}</p>
              <p className="text-sm text-content-tertiary">Goals</p>
            </div>
          </div>
        </div>

        <div className="card p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-semantic-success-dim rounded-lg">
              <CheckSquare className="h-5 w-5 text-semantic-success" />
            </div>
            <div>
              <p className="text-2xl font-bold text-content-primary">
                {goals.filter(g => g.status === 'completed').length}
              </p>
              <p className="text-sm text-content-tertiary">Completed</p>
            </div>
          </div>
        </div>

        <div className="card p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-semantic-warning-dim rounded-lg">
              <BarChart3 className="h-5 w-5 text-semantic-warning" />
            </div>
            <div>
              <p className="text-2xl font-bold text-content-primary">
                {goals.length > 0
                  ? Math.round(goals.reduce((sum, g) => sum + (g.progress || 0), 0) / goals.length)
                  : 0}%
              </p>
              <p className="text-sm text-content-tertiary">Avg Progress</p>
            </div>
          </div>
        </div>
      </div>

      {/* Info */}
      <div className="bg-semantic-info-dim border border-semantic-info rounded-lg p-4">
        <h3 className="font-medium text-semantic-info mb-2">About Reports</h3>
        <ul className="text-sm text-semantic-info space-y-1">
          <li>• PDF reports are generated on-demand and downloaded to your device</li>
          <li>• CSV exports can be opened in Excel, Google Sheets, or any spreadsheet app</li>
          <li>• Weekly summaries include data from the past 7 days</li>
          <li>• All reports reflect the most current data at time of generation</li>
        </ul>
      </div>
    </div>
  )
}
