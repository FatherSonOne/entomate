import { describe, test, expect, vi } from 'vitest'

// EAI-02c slice 4 fix: on /assistant/history the panel said "Working in Dashboard".
vi.mock('../services/api', () => ({
  meetingsApi: {}, tasksApi: {}, projectsApi: {}, calendarApi: {}, workflowsApi: {}, assistantApi: {}, entoAiApi: {},
  dashboardApi: { getSummary: vi.fn(), getOverdue: vi.fn() },
}))
import { dashboardApi } from '../services/api'
import { resolveSection, getSectionLabel, loadSectionData } from '../services/entoAssistantService'

describe('the AI conversations page as a panel section', () => {
  test('resolves to its own section and label', () => {
    expect(resolveSection('/assistant/history')).toBe('assistant')
    expect(getSectionLabel('assistant')).toBe('AI conversations')
    expect(getSectionLabel(resolveSection('/nowhere'))).toBe('Dashboard')
  })

  test('loads no dashboard data for the chip', async () => {
    expect(await loadSectionData('assistant')).toEqual({})
    expect(dashboardApi.getSummary).not.toHaveBeenCalled()
  })
})
