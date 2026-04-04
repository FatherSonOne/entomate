import {
  FileSpreadsheet, Download, Calendar, Target, CheckSquare, ListChecks, Loader2
} from 'lucide-react'
import { VCButton, VCIconBox } from '../vc'

export default function CSVExportSection({
  meetings, goals, generating, actionItemStatus, setActionItemStatus,
  goalsCsvQuarter, setGoalsCsvQuarter, onDownload, getQuarterOptions
}) {
  return (
    <div className="vc p-6">
      <h2
        className="text-lg font-semibold mb-4 flex items-center gap-2"
        style={{ color: 'var(--text-primary)' }}
      >
        <FileSpreadsheet className="h-5 w-5" style={{ color: 'var(--accent-secondary)' }} />
        CSV Export
      </h2>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
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
              onClick={() => onDownload('meetings-csv')}
              disabled={generating === 'meetings-csv'}
              aria-label="Download meetings CSV"
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
                Export action items by status
              </p>
            </div>
          </div>
          <div className="space-y-2">
            <select
              value={actionItemStatus}
              onChange={(e) => setActionItemStatus(e.target.value)}
              className="input text-sm"
            >
              <option value="">All statuses</option>
              <option value="open">Open</option>
              <option value="in_progress">In Progress</option>
              <option value="done">Done</option>
            </select>
            <div className="flex justify-end">
              <VCButton
                variant="ghost"
                size="sm"
                onClick={() => onDownload('action-items-csv', actionItemStatus ? { status: actionItemStatus } : {})}
                disabled={generating === 'action-items-csv'}
                aria-label="Download action items CSV"
              >
                {generating === 'action-items-csv' ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Download className="h-4 w-4" />
                )}
              </VCButton>
            </div>
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
                Export goals data by quarter
              </p>
            </div>
          </div>
          <div className="space-y-2">
            <select
              value={goalsCsvQuarter}
              onChange={(e) => setGoalsCsvQuarter(e.target.value)}
              className="input text-sm"
            >
              {getQuarterOptions().map(opt => (
                <option key={opt.value} value={opt.value}>{opt.label}</option>
              ))}
            </select>
            <div className="flex items-center justify-between">
              <span className="text-sm" style={{ color: 'var(--text-tertiary)' }}>{goals.length} goals</span>
              <VCButton
                variant="ghost"
                size="sm"
                onClick={() => onDownload('goals-csv', goalsCsvQuarter ? { quarter: goalsCsvQuarter } : {})}
                disabled={generating === 'goals-csv'}
                aria-label="Download goals CSV"
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

        {/* Tasks Export */}
        <div className="vc p-4 transition-colors">
          <div className="flex items-start gap-3 mb-3">
            <VCIconBox color="mint" size="sm">
              <ListChecks className="h-5 w-5" />
            </VCIconBox>
            <div>
              <h3 className="font-medium" style={{ color: 'var(--text-primary)' }}>Tasks</h3>
              <p className="text-sm" style={{ color: 'var(--text-tertiary)' }}>
                Export all tasks data
              </p>
            </div>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-sm" style={{ color: 'var(--text-tertiary)' }}>All tasks</span>
            <VCButton
              variant="ghost"
              size="sm"
              onClick={() => onDownload('tasks-csv')}
              disabled={generating === 'tasks-csv'}
              aria-label="Download tasks CSV"
            >
              {generating === 'tasks-csv' ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Download className="h-4 w-4" />
              )}
            </VCButton>
          </div>
        </div>
      </div>
    </div>
  )
}
