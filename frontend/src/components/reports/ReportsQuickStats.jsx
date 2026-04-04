import { Calendar, Target, CheckSquare, BarChart3 } from 'lucide-react'
import { VCIconBox } from '../vc'

const statStyle = {
  fontFamily: 'var(--font-display)',
  fontWeight: 700,
  fontSize: 24,
  color: 'var(--text-primary)',
}

export default function ReportsQuickStats({ meetings, goals }) {
  const completed = goals.filter(g => g.status === 'completed').length
  const avgProgress = goals.length > 0
    ? Math.round(goals.reduce((sum, g) => sum + (g.progress || 0), 0) / goals.length)
    : 0

  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
      <div className="vc p-4">
        <div className="flex items-center gap-3">
          <VCIconBox color="mint" size="sm">
            <Calendar className="h-5 w-5" />
          </VCIconBox>
          <div>
            <p style={statStyle}>{meetings.length}</p>
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
            <p style={statStyle}>{goals.length}</p>
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
            <p style={statStyle}>{completed}</p>
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
            <p style={statStyle}>{avgProgress}%</p>
            <p className="text-sm" style={{ color: 'var(--text-tertiary)' }}>Avg Progress</p>
          </div>
        </div>
      </div>
    </div>
  )
}
