# Entomate Under The Hood
## Complete UI Design Brief for Google Gemini

**Project:** Entomate - AI-Powered Meeting Intelligence Platform
**Version:** 1.0
**Last Updated:** December 28, 2025

---

## 1. Executive Summary

Entomate is a **meeting intelligence platform** that transforms meetings into actionable insights. It combines:
- **Audio/transcript processing** with AI analysis
- **Project & task management** with Kanban boards
- **Visual workflow automation** (node-based editor)
- **AI agents** that auto-assign tasks, set priorities, and detect follow-ups
- **Cross-app search** and daily intelligence briefings

### Design Vision
Create a **data-rich analytics dashboard** aesthetic inspired by team analytics tools:
- **Dark base with subtle surfaces** - Cards have slightly lighter backgrounds for hierarchy
- **Vibrant data visualization colors** - Cyan, pink, orange, purple for charts and highlights
- **Monospace typography for data** - Type labels, stats, timestamps in JetBrains Mono
- **Gradient progress bars** - Pink-to-cyan gradients with glow effects
- **High-density layouts** - Compact spacing, maximum information per card
- **Colorful pill badges** - Dark backgrounds with vibrant colored text

The result should feel **data-centric, technical, and vibrant** - like a premium team analytics dashboard.

---

## 2. Design System Foundation

### 2.1 Color Palette

#### Dark Mode (Default)
```css
/* Background Layers - Slightly purple-tinted blacks */
--bg-base: #0d0d10;        /* Deepest black */
--bg-surface: #13131a;     /* Card/panel backgrounds */
--bg-elevated: #1a1a24;    /* Elevated elements, hover states */
--bg-muted: #22222e;       /* Muted/disabled backgrounds */
--bg-subtle: #2a2a38;      /* Subtle accents */

/* Text Hierarchy */
--text-primary: #f4f4f6;   /* Primary text - near white */
--text-secondary: #9d9dab; /* Secondary text */
--text-tertiary: #6b6b7a;  /* Tertiary/labels */
--text-muted: #4a4a58;     /* Muted/disabled */

/* Borders - Very subtle */
--border-subtle: #1f1f2a;
--border-default: #2d2d3a;
--border-strong: #3d3d4a;
```

#### Data Visualization Colors (Vibrant Palette)
```css
/* These are used for charts, progress bars, badges, and visual highlights */
--data-cyan: #22D3EE;      /* Bright cyan */
--data-pink: #EC4899;      /* Hot pink */
--data-orange: #F97316;    /* Vibrant orange */
--data-purple: #A855F7;    /* Electric purple */
--data-green: #3ECF8E;     /* Supabase green */
--data-yellow: #FACC15;    /* Bright yellow */
--data-blue: #3B82F6;      /* Electric blue */
```

#### Accent Colors
```css
/* Primary - Electric Green (main CTA, active states) */
--accent-primary: #3ECF8E;
--accent-primary-dim: rgba(62, 207, 142, 0.12);
--accent-primary-glow: rgba(62, 207, 142, 0.35);

/* Secondary - Cyan (links, interactive) */
--accent-secondary: #22D3EE;
--accent-secondary-dim: rgba(34, 211, 238, 0.12);

/* Tertiary - Purple (AI/intelligence features) */
--accent-tertiary: #A855F7;
--accent-tertiary-dim: rgba(168, 85, 247, 0.12);
```

#### Gradient Definitions
```css
/* For progress bars and visual highlights */
--gradient-primary: linear-gradient(90deg, #EC4899, #22D3EE);  /* Pink to Cyan */
--gradient-ai: linear-gradient(90deg, #A855F7, #EC4899);       /* Purple to Pink */
--gradient-success: linear-gradient(90deg, #3ECF8E, #22D3EE);  /* Green to Cyan */
```

#### Semantic Colors
```css
--semantic-success: #3ECF8E;   /* Green - matches primary */
--semantic-warning: #FACC15;   /* Yellow */
--semantic-error: #EF4444;     /* Red */
--semantic-info: #3B82F6;      /* Blue */
```

### 2.2 Typography

```css
/* Font Families */
--font-sans: 'Inter', -apple-system, BlinkMacSystemFont, sans-serif;
--font-mono: 'JetBrains Mono', 'Fira Code', monospace;
--font-display: 'Space Grotesk', 'Inter', sans-serif;
```

| Usage | Font | Weight | Size |
|-------|------|--------|------|
| Page titles (H1) | Space Grotesk | 700 | 28-32px |
| Section headers (H2) | Inter | 600 | 20-24px |
| Card titles (H3) | Inter | 600 | 16-18px |
| Body text | Inter | 400 | 14-16px |
| Labels/captions | Inter | 500 | 12-14px |
| Code/data/stats | JetBrains Mono | 400-500 | 12-14px |
| Timestamps | JetBrains Mono | 400 | 11-12px |

### 2.3 Spacing & Layout

```
Base unit: 4px
Spacing scale: 4, 8, 12, 16, 20, 24, 32, 48, 64px
Border radius: 4px (small), 8px (medium), 12px (large), 16px (cards)
```

### 2.4 Visual Effects (Nothing x Supabase Style)

#### Glow Effects
```css
/* For active/focused elements */
box-shadow: 0 0 15px rgba(62, 207, 142, 0.3);

/* Strong glow for emphasis */
box-shadow: 0 0 25px rgba(62, 207, 142, 0.5);

/* AI feature glow (purple) */
box-shadow: 0 0 30px rgba(168, 85, 247, 0.2);
```

#### Surface Treatments
- **Subtle gradients** on cards: Top-left lighter, bottom-right darker
- **Dot matrix patterns** for backgrounds (Nothing style)
- **Grid lines** visible in certain sections
- **Glass/blur effects** for modals and overlays

---

## 3. Application Structure

### 3.1 Navigation Pages (13 Total)

| Page | Icon | Purpose |
|------|------|---------|
| Dashboard | `LayoutDashboard` | Home overview with daily briefing, stats, recent activity |
| Meetings | `Mic` | List/record/process meetings with AI analysis |
| Projects | `FolderKanban` | Project list and management |
| Project Board | `Kanban` | Kanban board view for project tasks |
| Tasks | `CheckSquare` | Task list with filters and quick actions |
| Automations | `Zap` | Rule-based automation builder |
| Workflows | `Workflow` | Visual node-based workflow editor |
| AI Agents | `Bot` | Configure AI agents (assignment, priority, deadline, follow-up) |
| Goals | `Target` | Goal tracking and OKRs |
| Analytics | `BarChart3` | Charts and metrics |
| Reports | `FileText` | Generated reports |
| Calendar | `Calendar` | Calendar view of meetings and deadlines |
| Search | `Search` | Cross-app unified search |
| Settings | `Settings` | App configuration, integrations, theme |

### 3.2 Key Components (27 Total)

#### Core Layout
- `Layout.jsx` - Main shell with sidebar, header, and content area
- `ThemeToggle.jsx` - Dark/light mode + accent color selector
- `CommandPalette.jsx` - Cmd+K quick command interface

#### Meeting Features
- `MeetingRecorder.jsx` - Audio recording interface with waveform
- `ActionItemsList.jsx` - Extracted action items from meetings
- `DailyBriefing.jsx` - AI-generated morning briefing card

#### Task/Project Features
- `KanbanBoard.jsx` - Drag-and-drop kanban for tasks
- `AutomationBuilder.jsx` - 3-step wizard for automation rules

#### Workflow Builder (Visual Editor)
- `WorkflowCanvas.jsx` - Main node-based editor canvas
- `NodePalette.jsx` - Draggable node types sidebar
- `NodeConfigPanel.jsx` - Configuration panel for selected node
- `WorkflowToolbar.jsx` - Toolbar with save, run, undo/redo
- `ExecutionTraceViewer.jsx` - Debug trace visualization
- `ExpressionEditor.jsx` - Expression builder with autocomplete

#### Intelligence Features
- `TodaysIntelligence.jsx` - AI-curated daily insights
- `CrossAppSearch.jsx` - Search across meetings, tasks, projects
- `MeetingSummaryWidget.jsx` - Compact meeting summary card

#### Settings
- `SlackSettings.jsx` - Slack integration configuration

---

## 4. Page-by-Page Design Requirements

### 4.1 Dashboard (`/dashboard`)

**Purpose:** Home base with at-a-glance overview

**Layout:**
```
+----------------------------------+
|  Daily Briefing (full width)     |
+----------------------------------+
|  System Status Bar               |
+--------+--------+--------+-------+
| Stat   | Stat   | Stat   | Stat  |
| Card   | Card   | Card   | Card  |
+--------+--------+--------+-------+
+----------------+  +---------------+
| Meeting        |  | Recent        |
| Recorder       |  | Meetings      |
|                |  +---------------+
|                |  | Open Tasks    |
+----------------+  +---------------+
```

**Components:**
1. **Daily Briefing Card** - AI-generated summary of the day
   - Shows upcoming meetings, overdue tasks, important alerts
   - Should feel "intelligent" - use purple AI accent

2. **Stats Grid** (4 cards)
   - Total Meetings (green icon)
   - Active Projects (blue icon)
   - Open Tasks (yellow icon)
   - Automations (purple icon)
   - Each card links to its page

3. **Meeting Recorder** - Large card with:
   - Record button with recording animation
   - Or file upload dropzone
   - Or text transcript input
   - Waveform visualization when recording

4. **Recent Meetings List**
   - Show sentiment emoji, title, date, duration
   - Badge for sentiment (Positive/Negative/Neutral)

5. **Open Tasks List**
   - Checkbox, title, due date, priority badge
   - Priority colors: High (red), Medium (yellow), Low (green)

### 4.2 Meetings Page (`/meetings`)

**Purpose:** View all meetings, start new recordings

**Layout:**
```
+----------------------------------+
|  Header: "Meetings" + New Button |
+----------------------------------+
|  [Meeting Recorder - expandable] |
+----------------------------------+
|  Search input | Filter button    |
+----------------------------------+
|  Meeting List                    |
|  +----------------------------+  |
|  | [emoji] Title    [badge]  |  |
|  | Summary preview           |  |
|  | Date | Duration | Pts     |  |
|  +----------------------------+  |
|  ...                             |
+----------------------------------+
```

**Meeting List Item:**
- Sentiment emoji (happy/neutral/sad)
- Title (semibold)
- Summary (1-2 lines, truncated)
- Metadata row: date, duration, key points count
- Sentiment badge
- Delete action (on hover)

### 4.3 Meeting Detail (`/meetings/:id`)

**Purpose:** Full meeting analysis view

**Sections:**
1. **Header** - Title, date, duration, participants
2. **Summary** - AI-generated meeting summary
3. **Key Points** - Bullet list of important points
4. **Action Items** - Extracted tasks with assign/complete actions
5. **Transcript** - Full transcript with speaker labels
6. **Ask AI** - Chat interface to ask questions about the meeting

### 4.4 Tasks Page (`/tasks`)

**Purpose:** Unified task management

**Layout:**
```
+----------------------------------+
|  Header: "Tasks" + New Button    |
+----------------------------------+
|  Search | Status Filters         |
|  [All] [Open] [In Progress] [Done]|
+----------------------------------+
|  Task List                       |
|  +----------------------------+  |
|  | [ ] Task title             |  |
|  |     Due: Jan 15 | [HIGH]   |  |
|  +----------------------------+  |
+----------------------------------+
```

**Task Item:**
- Checkbox (green highlight when checked)
- Title
- Due date (red if overdue)
- Priority badge
- Source indicator (which meeting/project)
- Delete action

### 4.5 Workflows Page (`/workflows`)

**Purpose:** Visual automation builder

**List View Layout:**
```
+----------------------------------+
|  Header + "New Workflow" button  |
+----------------------------------+
|  Search | Filters [All/Active]   |
+----------------------------------+
|  Workflow Cards                  |
|  +----------------------------+  |
|  | [icon] Workflow Name       |  |
|  |        Description         |  |
|  | [Active] 5 nodes | 12 runs |  |
|  | Actions: Play, Pause, Menu |  |
|  +----------------------------+  |
+----------------------------------+
|  Quick Start Templates (3 grid) |
+----------------------------------+
```

**Workflow Builder (`/workflows/:id`):**
- Left sidebar: Node palette (draggable nodes)
- Center: Canvas with nodes and connections
- Right panel: Node configuration
- Top: Toolbar with save, run, version, debug

**Node Types:**
| Category | Nodes |
|----------|-------|
| Triggers | Webhook, Schedule, Meeting Created, Task Created |
| Actions | Send Slack, Create Task, Send Email, HTTP Request |
| Logic | Condition, Switch, Loop, Delay |
| AI | AI Process, AI Summarize, AI Classify |
| Data | Transform, Filter, Map |

### 4.6 AI Agents Page (`/agents`)

**Purpose:** Configure AI automation agents

**Agents:**
1. **Assignment Agent** - Auto-assigns tasks to team members
2. **Priority Agent** - Sets task priorities based on content
3. **Deadline Agent** - Suggests due dates
4. **Follow-up Agent** - Detects follow-up needs from meetings

**Card Layout:**
```
+----------------------------+
| [Bot Icon] Agent Name      |
| Description text           |
| Status: [Active Toggle]    |
| Last run: 2 hours ago      |
| [Configure] [View Logs]    |
+----------------------------+
```

### 4.7 Command Palette (Cmd+K)

**Purpose:** Quick navigation and actions

**Design:**
- Modal overlay with blur backdrop
- Search input at top
- Grouped results: Navigation, Actions, Help
- Keyboard navigation hints at bottom
- Selected item has accent color highlight

### 4.8 Settings Page (`/settings`)

**Sections:**
1. **Appearance** - Theme mode (dark/light/system), accent color picker
2. **Integrations** - Slack, CRM, Calendar connections
3. **Notifications** - Email, Slack notification preferences
4. **API Keys** - Manage API access tokens
5. **Team** - User management (if applicable)

---

## 5. Data Models

### 5.1 Meeting
```typescript
interface Meeting {
  id: string;
  title: string;
  summary?: string;
  key_points?: string[];
  action_items?: ActionItem[];
  transcript?: string;
  audio_url?: string;
  sentiment_score?: number;  // -1 to 1
  sentiment_label?: 'Positive' | 'Neutral' | 'Negative';
  duration_minutes?: number;
  attendees?: string[];
  created_at: string;
  updated_at: string;
}
```

### 5.2 Task
```typescript
interface Task {
  id: string;
  title: string;
  description?: string;
  status: 'open' | 'in_progress' | 'done' | 'blocked';
  priority: 'low' | 'medium' | 'high';
  due_date?: string;
  assigned_to?: string;
  project_id?: string;
  meeting_id?: string;  // Source meeting
  created_at: string;
  completed_at?: string;
}
```

### 5.3 Project
```typescript
interface Project {
  id: string;
  name: string;
  description?: string;
  status: 'active' | 'completed' | 'archived';
  progress?: number;  // 0-100
  task_count?: number;
  completed_task_count?: number;
  created_at: string;
}
```

### 5.4 Workflow
```typescript
interface Workflow {
  id: string;
  name: string;
  description?: string;
  nodes: WorkflowNode[];
  connections: WorkflowConnection[];
  active: boolean;
  is_template: boolean;
  version: number;
  execution_count: number;
  last_executed_at?: string;
}

interface WorkflowNode {
  id: string;
  type: string;
  position: { x: number; y: number };
  data: Record<string, any>;
}
```

### 5.5 Automation (Rule-Based)
```typescript
interface Automation {
  id: string;
  name: string;
  description?: string;
  trigger_type: string;
  trigger_config: Record<string, any>;
  action_type: string;
  action_config: Record<string, any>;
  active: boolean;
  last_triggered_at?: string;
  trigger_count: number;
}
```

---

## 6. Component Patterns

### 6.1 Cards
```css
.card {
  background: var(--bg-surface);
  border: 1px solid var(--border-subtle);
  border-radius: 8px;
  transition: all 0.2s ease;
}

.card:hover {
  border-color: var(--border-default);
  background: var(--bg-elevated);
}

/* Card with glow on hover */
.card-glow:hover {
  border-color: var(--accent-primary);
  box-shadow: 0 0 25px rgba(62, 207, 142, 0.2);
}
```

### 6.2 Pill Badges (Data Labels)
```jsx
// Dark background with colored text - used for type labels
<span className="pill">
  <span className="pill-dot bg-data-pink"></span>
  Dreama • Type 2 2w3
</span>

// CSS
.pill {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 4px 10px;
  border-radius: 9999px;
  background: var(--bg-muted);
  color: var(--text-primary);
  font-family: 'JetBrains Mono', monospace;
  font-size: 12px;
}

.pill-dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
}
```

### 6.3 Progress Bars with Gradients
```jsx
// Gradient progress bar with glow
<div className="progress-bar">
  <div
    className="progress-bar-fill progress-gradient-primary"
    style={{ width: '75%' }}
  />
</div>

// CSS
.progress-bar {
  height: 8px;
  border-radius: 4px;
  background: var(--bg-muted);
  overflow: hidden;
}

.progress-bar-fill {
  height: 100%;
  border-radius: 4px;
  transition: width 0.5s ease;
}

.progress-gradient-primary {
  background: linear-gradient(90deg, #EC4899, #22D3EE);
  box-shadow: 0 0 12px rgba(236, 72, 153, 0.4);
}
```

### 6.4 Stat Display (Big Numbers)
```jsx
// Large monospace numbers with labels
<div className="stat-card">
  <span className="stat-label">Triad coverage</span>
  <span className="stat-value">3 of 3</span>
</div>

// CSS
.stat-value {
  font-family: 'JetBrains Mono', monospace;
  font-size: 24px;
  font-weight: 700;
  color: var(--text-primary);
}

.stat-label {
  font-size: 12px;
  font-weight: 500;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  color: var(--text-tertiary);
}
```

### 6.5 Data List Items
```jsx
// Dense list with hover state
<div className="data-list-item">
  <div>
    <span className="font-medium text-content-primary">Dreama</span>
    <span className="pill ml-2">Type 2 • 2w3</span>
  </div>
  <span className="text-sm text-content-secondary">Heart • Positive</span>
</div>

// CSS
.data-list-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 12px;
  border-bottom: 1px solid var(--border-subtle);
  transition: background 0.15s;
}

.data-list-item:hover {
  background: var(--bg-elevated);
}
```

### 6.2 Buttons

| Variant | Background | Text | Use Case |
|---------|------------|------|----------|
| Primary | Accent green | White | Main CTAs |
| Secondary | Transparent | Text color | Secondary actions |
| Ghost | Transparent | Muted | Tertiary actions |
| Danger | Red | White | Destructive actions |

### 6.3 Badges

| Type | Background | Text | Use Case |
|------|------------|------|----------|
| Success | Green dim | Green | Positive sentiment, done status |
| Warning | Yellow dim | Yellow | Medium priority, in progress |
| Error | Red dim | Red | High priority, overdue |
| Info | Blue dim | Blue | Open status, info |
| Gray | Gray dim | Gray | Neutral, inactive |

### 6.4 Form Inputs
```css
.input {
  background: var(--bg-elevated);
  border: 1px solid var(--border-default);
  border-radius: 8px;
  padding: 10px 16px;
  color: var(--text-primary);
}

.input:focus {
  border-color: var(--accent-primary);
  box-shadow: 0 0 0 2px var(--accent-primary-dim);
}
```

### 6.5 Navigation Items
```css
.nav-item {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 10px 12px;
  border-radius: 8px;
  color: var(--text-secondary);
  transition: all 0.15s ease;
}

.nav-item:hover {
  background: var(--bg-subtle);
  color: var(--text-primary);
}

.nav-item-active {
  background: var(--accent-primary-dim);
  color: var(--accent-primary);
}
```

---

## 7. Animation & Motion

### 7.1 Micro-interactions
- Button hover: Scale 1.02, subtle glow
- Card hover: Border highlight, lift shadow
- Nav item: Smooth color transition 150ms
- Toggle: Smooth slide 200ms

### 7.2 Loading States
- Spinner: Accent-colored border-top rotating
- Skeleton: Pulse animation on gray shapes
- Content fade: 300ms ease opacity

### 7.3 Page Transitions
- Route change: Fade 200ms
- Modal open: Scale from 0.95 + fade
- Sidebar mobile: Slide from left 200ms

### 7.4 Special Effects
```css
/* Recording pulse animation */
@keyframes recording-pulse {
  0%, 100% { opacity: 1; transform: scale(1); }
  50% { opacity: 0.5; transform: scale(1.1); }
}

/* Glow animation for AI features */
@keyframes glow {
  0% { box-shadow: 0 0 5px var(--accent-tertiary); }
  100% { box-shadow: 0 0 20px var(--accent-tertiary); }
}
```

---

## 8. Responsive Breakpoints

```css
/* Mobile first */
sm: 640px   /* Small tablets */
md: 768px   /* Tablets */
lg: 1024px  /* Desktop */
xl: 1280px  /* Large desktop */
2xl: 1536px /* Extra large */
```

### Mobile Considerations
- Sidebar collapses to hamburger menu
- Cards stack vertically
- Bottom navigation optional
- Touch-friendly tap targets (44px minimum)

---

## 9. Accessibility Requirements

- **Color contrast**: WCAG AA minimum (4.5:1 for text)
- **Focus indicators**: Visible focus rings on all interactive elements
- **Keyboard navigation**: Full app usable without mouse
- **Screen reader**: Proper ARIA labels and roles
- **Reduced motion**: Respect `prefers-reduced-motion`

---

## 10. Design Deliverables Needed

### Priority 1: Core Layout
1. Application shell (sidebar + header + content)
2. Dashboard page
3. Card component variants

### Priority 2: Feature Pages
4. Meetings page + meeting detail
5. Tasks page with kanban view
6. Workflow builder canvas

### Priority 3: Components
7. Command palette
8. Form components (inputs, selects, toggles)
9. Data tables
10. Empty states

### Priority 4: Polish
11. Loading states & skeletons
12. Error states
13. Onboarding flows
14. Illustrations/icons

---

## 11. Reference Links

### Design Inspiration
- **Nothing Phone OS**: [nothing.tech](https://nothing.tech) - Dot matrix, exposed structure, monospace
- **Supabase Dashboard**: [app.supabase.com](https://app.supabase.com) - Developer UI, dark mode, neon accents
- **Linear**: [linear.app](https://linear.app) - Clean task management UI
- **Raycast**: [raycast.com](https://raycast.com) - Command palette excellence

### Tech Stack
- **Framework**: React 18 + Vite 6
- **Styling**: Tailwind CSS 3.4 + CSS Custom Properties
- **Icons**: Lucide React
- **Fonts**: Inter, JetBrains Mono, Space Grotesk (Google Fonts)

---

## 12. Summary

Design an **AI-powered meeting intelligence platform** that feels like a premium developer tool. The visual language should merge:

1. **Nothing's minimalism** - Clean lines, dot patterns, exposed structure, monospace elements
2. **Supabase's energy** - Neon accents, dark-first, developer-friendly density

Key emotions to evoke:
- **Intelligence** - The AI feels smart and helpful (purple accents)
- **Clarity** - Information is easy to scan and understand
- **Power** - Professional users feel in control
- **Delight** - Subtle animations and polish create joy

The end result should make users think: *"This is how modern software should look."*
