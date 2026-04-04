import { useState, useEffect } from 'react'
import { FileText } from 'lucide-react'
import { useToast } from '../components/vc/ToastProvider'
import { reportsApi, meetingsApi, projectsApi } from '../services/api'
import api from '../services/api'
import { supabase } from '../services/supabaseClient'
import ErrorState from '../components/vc/ErrorState'
import PDFReportsSection from '../components/reports/PDFReportsSection'
import CSVExportSection from '../components/reports/CSVExportSection'
import ReportsQuickStats from '../components/reports/ReportsQuickStats'
import ReportsLoadingSkeleton from '../components/reports/ReportsLoadingSkeleton'
import EffectivenessReport from '../components/learning/EffectivenessReport'

export default function Reports() {
  const toast = useToast()
  const [meetings, setMeetings] = useState([])
  const [goals, setGoals] = useState([])
  const [projects, setProjects] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [generating, setGenerating] = useState(null)
  const [selectedMeeting, setSelectedMeeting] = useState('')
  const [selectedQuarter, setSelectedQuarter] = useState('')
  const [selectedProject, setSelectedProject] = useState('')
  const [actionItemStatus, setActionItemStatus] = useState('')
  const [goalsCsvQuarter, setGoalsCsvQuarter] = useState('')
  const [sendingEmail, setSendingEmail] = useState(false)
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')
  const [previewUrl, setPreviewUrl] = useState(null)
  const [showEffectiveness, setShowEffectiveness] = useState(false)

  useEffect(() => {
    loadData()
  }, [])

  const loadData = async () => {
    try {
      setError(null)
      setLoading(true)
      const [meetingsRes, goalsRes, projectsRes] = await Promise.all([
        meetingsApi.list({ limit: 50 }).catch(() => ({ meetings: [] })),
        api.get('/goals').catch(() => ({ data: [] })),
        projectsApi.list({ limit: 100 }).catch(() => ({ projects: [] }))
      ])
      setMeetings(meetingsRes.meetings || [])
      setGoals(goalsRes.data || [])
      setProjects(projectsRes.projects || [])
    } catch (error) {
      console.error('Failed to load data:', error)
      setError(error.message || 'Failed to load report data. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  const handleDownload = async (type, params = {}) => {
    // Append date range if set
    if (dateFrom) params.from = dateFrom
    if (dateTo) params.to = dateTo

    setGenerating(type)
    try {
      switch (type) {
        case 'meeting-pdf':
          if (!params.meetingId) return toast.info('Info', 'Please select a meeting')
          await reportsApi.downloadMeetingPDF(params.meetingId)
          break
        case 'goals-pdf':
          await reportsApi.downloadGoalsPDF(params.quarter)
          break
        case 'weekly-pdf':
          await reportsApi.downloadWeeklyPDF()
          break
        case 'meetings-csv':
          await reportsApi.downloadMeetingsCSV()
          break
        case 'action-items-csv':
          await reportsApi.downloadActionItemsCSV(params)
          break
        case 'goals-csv':
          await reportsApi.downloadGoalsCSV(params)
          break
        case 'tasks-csv':
          await reportsApi.downloadTasksCSV(params)
          break
        case 'project-pdf':
          if (!params.projectId) return toast.info('Info', 'Please select a project')
          await reportsApi.downloadProjectPDF(params.projectId)
          break
        default:
          return
      }
    } catch (error) {
      console.error('Failed to generate report:', error)
      toast.error('Error', 'Failed to generate report. Please try again.')
    } finally {
      setGenerating(null)
    }
  }

  const handlePreview = async (type, params = {}) => {
    setGenerating(type)
    try {
      let path
      switch (type) {
        case 'meeting-pdf':
          if (!params.meetingId) return toast.info('Info', 'Please select a meeting')
          path = `/reports/meeting/${params.meetingId}/pdf`
          break
        case 'goals-pdf':
          path = `/reports/goals/pdf${params.quarter ? `?quarter=${params.quarter}` : ''}`
          break
        case 'weekly-pdf':
          path = '/reports/weekly/pdf'
          break
        case 'project-pdf':
          if (!params.projectId) return toast.info('Info', 'Please select a project')
          path = `/reports/project/${params.projectId}/pdf`
          break
        default:
          return
      }

      const response = await api.get(path, { responseType: 'blob' })
      const blob = new Blob([response.data], { type: 'application/pdf' })
      const url = URL.createObjectURL(blob)
      setPreviewUrl(url)
    } catch (error) {
      console.error('Failed to preview report:', error)
      toast.error('Error', 'Failed to preview report.')
    } finally {
      setGenerating(null)
    }
  }

  const handleSendRecap = async () => {
    if (!selectedMeeting) return toast.info('Info', 'Please select a meeting')
    setSendingEmail(true)
    try {
      const { data: { session } } = await supabase.auth.getSession()
      const email = session?.user?.email
      if (!email) {
        toast.error('Error', 'Could not determine your email address')
        return
      }
      await reportsApi.sendMeetingRecap(selectedMeeting, email)
      toast.success('Sent', `Meeting recap emailed to ${email}`)
    } catch (error) {
      console.error('Failed to send recap:', error)
      toast.error('Error', 'Failed to send meeting recap email.')
    } finally {
      setSendingEmail(false)
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
    return <ReportsLoadingSkeleton />
  }

  if (error) {
    return <ErrorState message={error} onRetry={loadData} />
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-4">
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

        {/* Date Range Filter */}
        <div className="flex items-center gap-2">
          <label className="text-sm" style={{ color: 'var(--text-tertiary)' }}>From</label>
          <input
            type="date"
            value={dateFrom}
            onChange={(e) => setDateFrom(e.target.value)}
            className="input text-sm"
          />
          <label className="text-sm" style={{ color: 'var(--text-tertiary)' }}>To</label>
          <input
            type="date"
            value={dateTo}
            onChange={(e) => setDateTo(e.target.value)}
            className="input text-sm"
          />
          {(dateFrom || dateTo) && (
            <button
              onClick={() => { setDateFrom(''); setDateTo('') }}
              className="text-xs px-2 py-1 rounded"
              style={{ color: 'var(--accent-primary)', background: 'rgba(255,45,107,0.1)' }}
            >
              Clear
            </button>
          )}
        </div>
      </div>

      {/* PDF Reports */}
      <PDFReportsSection
        meetings={meetings}
        projects={projects}
        generating={generating}
        selectedMeeting={selectedMeeting}
        setSelectedMeeting={setSelectedMeeting}
        selectedQuarter={selectedQuarter}
        setSelectedQuarter={setSelectedQuarter}
        selectedProject={selectedProject}
        setSelectedProject={setSelectedProject}
        sendingEmail={sendingEmail}
        onDownload={handleDownload}
        onPreview={handlePreview}
        onSendRecap={handleSendRecap}
        getQuarterOptions={getQuarterOptions}
      />

      {/* CSV Export */}
      <CSVExportSection
        meetings={meetings}
        goals={goals}
        generating={generating}
        actionItemStatus={actionItemStatus}
        setActionItemStatus={setActionItemStatus}
        goalsCsvQuarter={goalsCsvQuarter}
        setGoalsCsvQuarter={setGoalsCsvQuarter}
        onDownload={handleDownload}
        getQuarterOptions={getQuarterOptions}
      />

      {/* Quick Stats */}
      <ReportsQuickStats meetings={meetings} goals={goals} />

      {/* Learning Effectiveness */}
      <div className="vc p-6">
        <button
          onClick={() => setShowEffectiveness(!showEffectiveness)}
          className="w-full flex items-center justify-between"
        >
          <h2
            className="text-lg font-semibold flex items-center gap-2"
            style={{ color: 'var(--text-primary)' }}
          >
            <FileText className="h-5 w-5" style={{ color: 'var(--accent-primary)' }} />
            Learning Effectiveness
          </h2>
          <span
            className="text-sm"
            style={{ color: 'var(--text-tertiary)' }}
          >
            {showEffectiveness ? 'Hide' : 'Show'}
          </span>
        </button>
        {showEffectiveness && (
          <div className="mt-4">
            <EffectivenessReport days={30} />
          </div>
        )}
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
          <li>• Use the date range filter to scope exports to a specific period</li>
          <li>• All reports reflect the most current data at time of generation</li>
        </ul>
      </div>

      {/* PDF Preview Modal */}
      {previewUrl && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center"
          style={{ background: 'rgba(0,0,0,0.7)' }}
          onClick={() => { URL.revokeObjectURL(previewUrl); setPreviewUrl(null) }}
        >
          <div
            className="relative w-full max-w-4xl h-[80vh] rounded-lg overflow-hidden"
            style={{ background: 'var(--bg-primary)' }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between p-3" style={{ borderBottom: '1px solid var(--border-default)' }}>
              <h3 className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>PDF Preview</h3>
              <button
                onClick={() => { URL.revokeObjectURL(previewUrl); setPreviewUrl(null) }}
                className="text-sm px-3 py-1 rounded"
                style={{ color: 'var(--text-tertiary)' }}
              >
                Close
              </button>
            </div>
            <iframe
              src={previewUrl}
              className="w-full"
              style={{ height: 'calc(100% - 48px)' }}
              title="PDF Preview"
            />
          </div>
        </div>
      )}
    </div>
  )
}
