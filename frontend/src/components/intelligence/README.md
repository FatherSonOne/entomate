# Enhanced Intelligence Dashboard Components

This directory contains the AI-powered Intelligence Dashboard components based on the design specification in `docs/ENHANCED-INTELLIGENCE-DASHBOARD-DESIGN.md`.

## Components Overview

### 1. IntelligenceDashboard.jsx
**Main orchestrator component** that displays all intelligence cards.

**Features:**
- Auto-refresh every 5 minutes
- Customizable user preferences
- Loading states with skeleton UI
- Error handling with retry mechanism
- Responsive grid layout

**Usage:**
```jsx
import { IntelligenceDashboard } from './components/intelligence'

function Dashboard() {
  return <IntelligenceDashboard />
}
```

---

### 2. ExpandableCard.jsx
**Reusable adaptive expansion component** used by all card types.

**Features:**
- Compact view by default
- Smooth expand/collapse animations
- Customizable actions
- Accessible keyboard navigation
- ARIA labels for screen readers

**Props:**
```typescript
{
  title?: string              // Optional card title
  badge?: string              // Optional badge text
  compactContent: ReactNode   // Content shown when collapsed
  expandedContent?: ReactNode // Content shown when expanded
  actions?: Array<{           // Quick action buttons
    label: string
    handler: () => void
    primary?: boolean
    disabled?: boolean
  }>
  defaultExpanded?: boolean   // Start expanded
  className?: string          // Additional CSS classes
}
```

---

### 3. MeetingPrepCard.jsx
**Meeting preparation intelligence card**

**Features:**
- Meeting details (title, time, attendees)
- Sentiment trend analysis (improving/stable/declining)
- Overdue action items count
- AI-generated talking points
- Quick actions: [Prepare Brief] [Reschedule]
- Expandable: Full attendee list, sentiment history, all talking points

**Data Structure:**
```typescript
{
  meeting: {
    id: string
    title: string
    scheduledAt: string // ISO 8601
    attendees: Array<{
      name?: string
      email: string
      title?: string
    }>
    location?: string
    meetingLink?: string
  }
  dealContext?: {
    id: string
    name: string
    value: number
    stage: string
  }
  history: {
    lastContactDate: string
    meetingCount: number
    daysSinceLastContact: number
  }
  sentiment: {
    current: 'positive' | 'neutral' | 'negative'
    trend: 'improving' | 'stable' | 'declining'
    history: Array<{
      date: string
      sentiment: string
      score: number // 0-100
    }>
  }
  actionItems: {
    total: number
    overdue: number
    items: Array<{
      id: string
      task: string
      owner: string
      dueDate: string
      status: string
    }>
  }
  insights: {
    competitorMentions: string[]
    keyTopics: string[]
  }
  talkingPoints: string[]
}
```

---

### 4. DealRiskAlertCard.jsx
**Deal risk alert card with AI risk scoring**

**Features:**
- Deal name, value, stage
- Risk score badge (0-100) with color coding:
  - 🟢 Low (75-100): Green
  - 🟡 Medium (50-74): Yellow
  - 🟠 High (25-49): Orange
  - 🔴 Critical (0-24): Red
- Top 3 risk factors with impact levels
- Recommended recovery actions
- Quick actions: [Schedule Call] [Create Task]
- Expandable: All risk factors, predictions, recovery plan

**Data Structure:**
```typescript
{
  deal: {
    id: string
    name: string
    value: number
    stage: string
    expectedCloseDate: string
    owner: string
  }
  riskScore: {
    score: number // 0-100
    level: 'low' | 'medium' | 'high' | 'critical'
    trend: 'improving' | 'stable' | 'worsening'
  }
  riskFactors: Array<{
    factor: string
    weight: number // 0-1
    score: number // 0-100
    impact: 'low' | 'medium' | 'high'
    detail: string
  }>
  predictions: {
    churnRisk: number // 0-1
    closeProbability: number // 0-1
    expectedCloseDate: string
    confidence: number // 0-1
  }
  recommendedActions: Array<{
    action: string
    priority: 'low' | 'medium' | 'high'
    effort: 'low' | 'medium' | 'high'
  }>
}
```

---

### 5. ActionItemStatusCard.jsx
**Action item tracking card**

**Features:**
- Summary metrics (total, completed, overdue, completion rate)
- Completion rate progress bar
- Critical overdue items (top 5)
- Blocking chain visualization
- Quick actions: [Nudge Owner] [Reassign] [Mark Complete]
- Expandable: Week-over-week trends, team benchmarks, all overdue items

**Data Structure:**
```typescript
{
  summary: {
    total: number
    completed: number
    inProgress: number
    overdue: number
    blocked: number
    completionRate: number // 0-1
  }
  trends: {
    weekOverWeek: {
      completionRate: number // delta
      avgTimeToComplete: number // delta in days
    }
  }
  benchmarks: {
    userCompletionRate: number
    teamAverage: number
    topPerformer: {
      name: string
      rate: number
    }
  }
  criticalOverdue: Array<{
    id: string
    task: string
    owner: string
    assignedTo: string
    dueDate: string
    daysOverdue: number
    isBlocking: boolean
    blockedTasks: string[]
    relatedDeal?: {
      id: string
      name: string
      value: number
    }
  }>
  blockingChains: Array<{
    rootTask: string
    chainLength: number
    totalBlocked: number
    nodes: Array<{
      task: string
      status: string
      owner: string
    }>
  }>
}
```

---

### 6. RelationshipInsightCard.jsx
**Stakeholder relationship intelligence card**

**Features:**
- New champions detected
- Stakeholder role badges (Champion, Influencer, Economic Buyer, Blocker)
- Influence score (5-star rating)
- Coverage gaps with recommendations
- Quick actions: [Add to CRM] [Schedule Meeting] [Get Introduction]
- Expandable: All stakeholders, relationship trends, full recommendations

**Data Structure:**
```typescript
{
  stakeholders: Array<{
    id: string
    name: string
    title: string
    company: string
    role: 'champion' | 'influencer' | 'blocker' | 'economic_buyer' | 'unknown'
    influenceScore: number // 0-100
    relationshipStrength: {
      score: number // 0-100
      trend: 'growing' | 'stable' | 'declining'
    }
    engagement: {
      meetingCount: number
      lastContactDate: string
      daysSinceLastContact: number
      mentionFrequency: number
    }
    sentiment: {
      current: 'positive' | 'neutral' | 'negative'
      score: number // 0-100
      trend: 'improving' | 'stable' | 'declining'
    }
  }>
  coverage: {
    hasChampion: boolean
    hasEconomicBuyer: boolean
    multiThreaded: boolean
    coverageScore: number // 0-100
    gaps: Array<{
      missingPersona: string
      importance: 'critical' | 'high' | 'medium' | 'low'
      risk: string
      recommendation: string
    }>
  }
  insights: {
    newChampions: Array<{
      stakeholder: string
      detectedOn: string
      signals: string[]
    }>
    atRiskChampions: Array<{
      stakeholder: string
      healthScore: number
      redFlags: string[]
    }>
    recommendations: string[]
  }
}
```

---

## API Integration

The components use the `api.intelligence` service:

```javascript
// Get full dashboard
const data = await api.intelligence.getDashboard({
  riskFilter: 'medium,high,critical',
  meetingHours: 24,
  riskDays: 7
})

// Get meeting prep
const prep = await api.intelligence.getMeetingPrep(meetingId)

// Generate meeting brief
const brief = await api.intelligence.generateMeetingBrief(meetingId)

// Get deal risks
const risks = await api.intelligence.getDealRisks({ riskLevel: 'high,critical' })

// Get action items
const actionItems = await api.intelligence.getActionItems()

// Send nudge
await api.intelligence.sendNudge(itemId, 'in_app')

// Get relationships
const relationships = await api.intelligence.getRelationships(dealId)
```

---

## Styling & Animations

### Tailwind CSS Classes
All components use Tailwind CSS utility classes for styling, following Entomate's existing design system.

### Custom Animations
Fade-in animation for expanded content is defined in `frontend/src/styles/main.css`:

```css
@keyframes fadeIn {
  from {
    opacity: 0;
    transform: translateY(-8px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

.animate-fadeIn {
  animation: fadeIn 0.3s ease-out forwards;
}
```

---

## Accessibility

All components follow WCAG AA standards:

- **Keyboard Navigation**: Full functionality without mouse
- **ARIA Labels**: Descriptive labels for screen readers
- **Focus Management**: Clear focus indicators
- **Color Contrast**: 4.5:1 minimum ratio for text
- **Touch Targets**: 44px minimum for interactive elements

---

## Responsive Design

Components are mobile-first and responsive:

- **Mobile** (320px+): Single column, stacked layout
- **Tablet** (640px+): Optimized spacing
- **Desktop** (1024px+): Full feature set

---

## Integration Example

Replace the existing `TodaysIntelligence` component with the new `IntelligenceDashboard`:

```jsx
// Before (in your main app/dashboard)
import TodaysIntelligence from './components/TodaysIntelligence'

function Dashboard() {
  return (
    <div>
      <TodaysIntelligence />
    </div>
  )
}

// After
import { IntelligenceDashboard } from './components/intelligence'

function Dashboard() {
  return (
    <div>
      <IntelligenceDashboard />
    </div>
  )
}
```

---

## Development Notes

### Performance Optimizations
- Auto-refresh throttled to 5 minutes
- Loading states prevent layout shift
- Expandable sections reduce initial render load
- Animations use GPU-accelerated properties

### Error Handling
- Network errors display retry button
- API failures show user-friendly messages
- Loading states prevent interaction during refresh

### Future Enhancements
- Offline support with cached data
- Push notifications for critical alerts
- Export functionality for reports
- Team collaboration features

---

## Backend Requirements

These components require the following backend API endpoints (see `docs/ENHANCED-INTELLIGENCE-DASHBOARD-DESIGN.md`):

- `GET /api/intelligence/dashboard`
- `GET /api/intelligence/meeting-prep/:meetingId`
- `POST /api/intelligence/meeting-prep/:meetingId/brief`
- `GET /api/intelligence/deal-risks`
- `GET /api/intelligence/action-items`
- `POST /api/intelligence/action-items/:itemId/nudge`
- `GET /api/intelligence/relationships/:dealId`

---

## Testing

### Manual Testing Checklist
- [ ] Dashboard loads without errors
- [ ] Auto-refresh works (check after 5 minutes)
- [ ] Customization preferences persist
- [ ] All quick actions trigger correctly
- [ ] Expand/collapse animations smooth
- [ ] Mobile responsive layout works
- [ ] Keyboard navigation functional
- [ ] Screen reader compatibility

### Integration Testing
- [ ] API endpoints return expected data
- [ ] Error states display correctly
- [ ] Loading states prevent race conditions
- [ ] Authentication token refresh works

---

**Built by:** UI Designer Agent
**Design Spec:** `docs/ENHANCED-INTELLIGENCE-DASHBOARD-DESIGN.md`
**Version:** 1.0
**Last Updated:** 2026-01-24
