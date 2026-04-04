import {
  FileText, Download, Calendar, Target, Clock, Briefcase, Mail, Loader2, Eye
} from 'lucide-react'
import { VCButton, VCIconBox } from '../vc'

export default function PDFReportsSection({
  meetings, projects, generating, selectedMeeting, setSelectedMeeting,
  selectedQuarter, setSelectedQuarter, selectedProject, setSelectedProject,
  sendingEmail, onDownload, onPreview, onSendRecap, getQuarterOptions
}) {
  return (
    <div className="vc p-6">
      <h2
        className="text-lg font-semibold mb-4 flex items-center gap-2"
        style={{ color: 'var(--text-primary)' }}
      >
        <FileText className="h-5 w-5" style={{ color: 'var(--accent-primary)' }} />
        PDF Reports
      </h2>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
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
            <div className="flex gap-2">
              <VCButton
                variant="primary"
                className="flex-1 text-sm"
                onClick={() => onDownload('meeting-pdf', { meetingId: selectedMeeting })}
                disabled={!selectedMeeting || generating === 'meeting-pdf'}
              >
                {generating === 'meeting-pdf' ? (
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                ) : (
                  <Download className="h-4 w-4 mr-2" />
                )}
                PDF
              </VCButton>
              <VCButton
                variant="ghost"
                className="text-sm"
                onClick={() => onPreview('meeting-pdf', { meetingId: selectedMeeting })}
                disabled={!selectedMeeting || generating === 'meeting-pdf'}
                aria-label="Preview meeting PDF"
              >
                <Eye className="h-4 w-4" />
              </VCButton>
            </div>
            <VCButton
              variant="ghost"
              className="w-full text-sm"
              onClick={onSendRecap}
              disabled={!selectedMeeting || sendingEmail}
            >
              {sendingEmail ? (
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
              ) : (
                <Mail className="h-4 w-4 mr-2" />
              )}
              Email Recap
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
            <div className="flex gap-2">
              <VCButton
                variant="primary"
                className="flex-1 text-sm"
                onClick={() => onDownload('goals-pdf', { quarter: selectedQuarter })}
                disabled={generating === 'goals-pdf'}
              >
                {generating === 'goals-pdf' ? (
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                ) : (
                  <Download className="h-4 w-4 mr-2" />
                )}
                PDF
              </VCButton>
              <VCButton
                variant="ghost"
                className="text-sm"
                onClick={() => onPreview('goals-pdf', { quarter: selectedQuarter })}
                disabled={generating === 'goals-pdf'}
                aria-label="Preview goals PDF"
              >
                <Eye className="h-4 w-4" />
              </VCButton>
            </div>
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
            <div className="flex gap-2">
              <VCButton
                variant="primary"
                className="flex-1 text-sm"
                onClick={() => onDownload('weekly-pdf')}
                disabled={generating === 'weekly-pdf'}
              >
                {generating === 'weekly-pdf' ? (
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                ) : (
                  <Download className="h-4 w-4 mr-2" />
                )}
                PDF
              </VCButton>
              <VCButton
                variant="ghost"
                className="text-sm"
                onClick={() => onPreview('weekly-pdf')}
                disabled={generating === 'weekly-pdf'}
                aria-label="Preview weekly PDF"
              >
                <Eye className="h-4 w-4" />
              </VCButton>
            </div>
          </div>
        </div>

        {/* Project Report */}
        <div className="vc p-4 transition-colors">
          <div className="flex items-start gap-3 mb-3">
            <VCIconBox color="amber" size="sm">
              <Briefcase className="h-5 w-5" />
            </VCIconBox>
            <div>
              <h3 className="font-medium" style={{ color: 'var(--text-primary)' }}>Project Report</h3>
              <p className="text-sm" style={{ color: 'var(--text-tertiary)' }}>
                Status, action items, and team workload
              </p>
            </div>
          </div>
          <div className="space-y-2">
            <select
              value={selectedProject}
              onChange={(e) => setSelectedProject(e.target.value)}
              className="input text-sm"
            >
              <option value="">Select a project...</option>
              {projects.map(project => (
                <option key={project.id} value={project.id}>
                  {project.name || project.title || 'Untitled'}
                </option>
              ))}
            </select>
            <div className="flex gap-2">
              <VCButton
                variant="primary"
                className="flex-1 text-sm"
                onClick={() => onDownload('project-pdf', { projectId: selectedProject })}
                disabled={!selectedProject || generating === 'project-pdf'}
              >
                {generating === 'project-pdf' ? (
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                ) : (
                  <Download className="h-4 w-4 mr-2" />
                )}
                PDF
              </VCButton>
              <VCButton
                variant="ghost"
                className="text-sm"
                onClick={() => onPreview('project-pdf', { projectId: selectedProject })}
                disabled={!selectedProject || generating === 'project-pdf'}
                aria-label="Preview project PDF"
              >
                <Eye className="h-4 w-4" />
              </VCButton>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
