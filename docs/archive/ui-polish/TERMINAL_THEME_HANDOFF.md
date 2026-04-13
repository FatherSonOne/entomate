# Entomate Terminal Theme - Implementation Handoff

**Status:** Week 1 Complete (Foundation) ✅
**Next Phase:** Week 2 - Layout & Navigation Enhancement
**Last Updated:** 2026-01-23
**Original Plan:** `C:\Users\Aegis{FM}\.claude\plans\radiant-tumbling-storm.md`

---

## Executive Summary

The Entomate Terminal Theme redesign is implementing a **hacker/CLI aesthetic** with Matrix-inspired visuals, monospace typography, terminal green accents (#00ff41), and balanced animations (200-400ms). This is a 7-week incremental rollout with feature flags for safe deployment.

**Theme Personality:** Raw, Technical, Developer-Forward
**Animation Level:** Balanced & Engaging (not too subtle, not too extreme)

---

## ✅ Phase 1 Complete: Design System Foundation (Week 1)

### What's Been Builtimage.png

1. **CSS Foundation** ✅
   - Terminal theme variables in `frontend/src/styles/main.css` (lines 62-87)
   - Complete animations library in `frontend/src/styles/animations.css`
   - Scan line effects, CRT glow, accessibility support

2. **Tailwind Configuration** ✅
   - Extended `frontend/tailwind.config.js` with Terminal colors
   - Terminal-specific fonts (JetBrains Mono, Share Tech Mono)
   - 15+ animation utilities, custom shadows, timing functions

3. **Core Terminal Components** ✅ (`frontend/src/components/ui/`)
   - `Button.jsx` - 5 variants (primary, secondary, ghost, danger, ai)
   - `Card.jsx` - Terminal prompt, corner brackets, hover glow
   - `Badge.jsx` - Status indicators with pulse animation
   - `Input.jsx` - Glow effects, error shake animation
   - `Skeleton.jsx` - Shimmer loading with Terminal green
   - `Toast.jsx` - Notification system with ASCII icons
   - `index.js` - Barrel export for easy imports

4. **Toast Notification System** ✅
   - `frontend/src/context/ToastContext.jsx` - Global toast provider
   - Auto-dismiss, max 3 toasts, convenience methods
   - Ready to use: `const { success, error } = useToast();`

5. **Typography** ✅
   - JetBrains Mono and Share Tech Mono fonts loaded in `frontend/index.html`

### File Structure Created

```
frontend/
├── src/
│   ├── components/
│   │   └── ui/                    # NEW - Terminal component library
│   │       ├── Button.jsx         # ✅ Complete
│   │       ├── Card.jsx           # ✅ Complete
│   │       ├── Badge.jsx          # ✅ Complete
│   │       ├── Input.jsx          # ✅ Complete
│   │       ├── Skeleton.jsx       # ✅ Complete
│   │       ├── Toast.jsx          # ✅ Complete
│   │       └── index.js           # ✅ Barrel export
│   ├── context/
│   │   └── ToastContext.jsx       # ✅ Toast provider
│   └── styles/
│       ├── main.css               # ✅ Extended with Terminal variables
│       └── animations.css         # ✅ NEW - All keyframes
├── index.html                     # ✅ Fonts added
└── tailwind.config.js             # ✅ Extended with Terminal theme
```

### How to Use Current Components

```jsx
// Import Terminal components
import { Button, Card, Badge, Input, Skeleton } from '../components/ui';
import { useToast } from '../context/ToastContext';

// Examples
<Button variant="primary" loading={isLoading}>Execute</Button>
<Card title="System Status" prompt="$" glow>
  <Badge variant="success" pulse>Active</Badge>
</Card>
<Input label="Command" error={errors.cmd} />
{loading ? <Skeleton count={5} className="h-20" /> : <DataList />}

// Toast notifications
const { success, error, warning, info } = useToast();
success('Meeting created!');
error('Failed to connect');
```

---

## 🚀 Next Phase: Week 2 - Layout & Navigation Enhancement

### Objectives

1. Integrate Toast provider into app
2. Create Modal component for dialogs
3. Enhance Layout with Terminal CLI-style navigation
4. Add PageTransition wrapper for route animations
5. Create accessibility hooks

### Tasks Breakdown

#### Task 1: Wrap App with ToastProvider

**File:** `frontend/src/main.jsx`

**Changes:**
```jsx
import { ToastProvider } from './context/ToastContext';

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <ClerkProvider publishableKey={clerkPubKey}>
      <ThemeProvider>
        <ToastProvider>  {/* ADD THIS */}
          <App />
        </ToastProvider>
      </ThemeProvider>
    </ClerkProvider>
  </React.StrictMode>
);
```

**Backend Wiring:** None required
**Testing:** App should render normally, no toasts visible yet

---

#### Task 2: Create Modal Component

**File:** `frontend/src/components/ui/Modal.jsx` (NEW)

**Requirements:**
- Terminal styling with corner brackets
- Backdrop blur with fade-in animation
- Scale entrance animation (280ms)
- Scroll lock when open
- Escape key and backdrop click to close
- Size variants: sm, md, lg, xl
- Accessibility: focus trap, aria-modal

**Code Template:**
```jsx
import React, { useEffect } from 'react';
import { X } from 'lucide-react';

const Modal = ({ isOpen, onClose, title, children, size = 'md' }) => {
  // Lock scroll when modal open
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = 'unset';
    }
    return () => { document.body.style.overflow = 'unset'; };
  }, [isOpen]);

  // Escape key handler
  useEffect(() => {
    const handleEscape = (e) => {
      if (e.key === 'Escape') onClose();
    };
    if (isOpen) {
      document.addEventListener('keydown', handleEscape);
      return () => document.removeEventListener('keydown', handleEscape);
    }
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const sizes = {
    sm: 'max-w-md',
    md: 'max-w-2xl',
    lg: 'max-w-4xl',
    xl: 'max-w-6xl',
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/80 backdrop-blur-sm animate-backdrop-fade"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Modal */}
      <div
        className={`relative w-full ${sizes[size]} bg-terminal-bg-surface border-2 border-terminal-primary p-6 animate-modal-enter shadow-terminal-glow-lg`}
        role="dialog"
        aria-modal="true"
        aria-labelledby="modal-title"
      >
        {/* Corner brackets */}
        <span className="absolute top-0 left-0 w-6 h-6 border-t-2 border-l-2 border-terminal-primary" />
        <span className="absolute bottom-0 right-0 w-6 h-6 border-b-2 border-r-2 border-terminal-primary" />

        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <h2
            id="modal-title"
            className="text-terminal-primary font-terminal-display text-xl uppercase tracking-wide"
          >
            {title}
          </h2>
          <button
            onClick={onClose}
            className="text-terminal-text-muted hover:text-terminal-primary transition-colors"
            aria-label="Close dialog"
          >
            <X size={24} />
          </button>
        </div>

        {/* Content */}
        <div className="text-terminal-text-secondary">
          {children}
        </div>
      </div>
    </div>
  );
};

export default Modal;
```

**Export:** Add to `frontend/src/components/ui/index.js`
```jsx
export { default as Modal } from './Modal';
```

**Backend Wiring:** None
**Testing:**
- Modal opens/closes
- Escape key works
- Backdrop click works
- Scroll locked when open
- Keyboard navigation works

---

#### Task 3: Create PageTransition Wrapper

**File:** `frontend/src/components/PageTransition.jsx` (NEW)

**Code:**
```jsx
import React from 'react';
import { useLocation } from 'react-router-dom';

const PageTransition = ({ children, mode = 'slide' }) => {
  const location = useLocation();

  const animations = {
    slide: 'animate-page-enter',
    fade: 'animate-page-fade',
  };

  return (
    <div
      key={location.pathname}
      className={animations[mode] || animations.slide}
    >
      {children}
    </div>
  );
};

export default PageTransition;
```

**Integration:** Update `frontend/src/App.jsx`
```jsx
import PageTransition from './components/PageTransition';

// Wrap each route's component
<Route path="dashboard" element={
  <PageTransition>
    <Dashboard />
  </PageTransition>
} />
```

**Backend Wiring:** None
**Testing:** Page transitions animate smoothly on navigation

---

#### Task 4: Create useReducedMotion Hook

**File:** `frontend/src/hooks/useReducedMotion.js` (NEW)

**Code:**
```javascript
import { useState, useEffect } from 'react';

export const useReducedMotion = () => {
  const [reducedMotion, setReducedMotion] = useState(false);

  useEffect(() => {
    const mediaQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
    setReducedMotion(mediaQuery.matches);

    const handler = (e) => setReducedMotion(e.matches);
    mediaQuery.addEventListener('change', handler);

    return () => mediaQuery.removeEventListener('change', handler);
  }, []);

  return reducedMotion;
};
```

**Usage:**
```jsx
const reducedMotion = useReducedMotion();
const animationDuration = reducedMotion ? 0 : 250;
```

**Testing:** Test with OS "Reduce motion" setting enabled

---

#### Task 5: Enhance Layout with Terminal Styling

**File:** `frontend/src/components/Layout.jsx` (MODIFY)

**Key Changes:**

1. **Add scan line overlay:**
```jsx
{/* Add after main layout wrapper */}
<div className="fixed inset-0 pointer-events-none opacity-30 z-50 bg-[repeating-linear-gradient(0deg,transparent,transparent_2px,rgba(0,255,65,0.03)_2px,rgba(0,255,65,0.03)_4px)]" />
```

2. **Update sidebar styling:**
```jsx
<aside className="bg-terminal-bg-surface border-r border-terminal-primary/30">
  <nav className="space-y-1">
    {menuItems.map(item => (
      <NavLink
        key={item.path}
        to={item.path}
        className={({ isActive }) => `
          flex items-center gap-3 px-4 py-3
          font-terminal text-sm uppercase tracking-wide
          transition-all duration-normal
          ${isActive
            ? 'text-terminal-primary bg-terminal-primary/10 border-l-2 border-terminal-primary'
            : 'text-terminal-text-secondary hover:text-terminal-primary hover:bg-terminal-primary/5'
          }
        `}
      >
        <span className="text-xs opacity-50">&gt;</span>
        <item.icon size={18} />
        <span>{item.label}</span>
      </NavLink>
    ))}
  </nav>
</aside>
```

3. **Add CLI-style breadcrumb:**
```jsx
import { Terminal } from 'lucide-react';

{/* Add above page content */}
<div className="flex items-center gap-2 mb-4 text-terminal-text-secondary font-terminal text-sm">
  <Terminal className="text-terminal-primary" size={16} />
  <span>~/entomate/{currentPath}</span>
</div>
```

**Backend Wiring:** None
**Testing:** Layout should render with Terminal theme, navigation works

---

### Week 2 Success Criteria

- [ ] Toast notifications work globally
- [ ] Modal component complete and accessible
- [ ] Page transitions animate on route changes
- [ ] Layout has Terminal styling (sidebar, breadcrumbs)
- [ ] Scan line overlay visible
- [ ] Reduced motion preference respected
- [ ] All existing functionality preserved

---

## 📋 Weeks 3-7: Page Redesigns & Polish

### Week 3: Dashboard & Meetings Pages

**Priority:** HIGH - Most visible pages

#### Dashboard Page (`frontend/src/pages/Dashboard.jsx`)

**Components to Create:**
1. ASCII Logo component (optional)
2. StatCard with glowing numbers
3. Staggered grid layout

**Changes:**
```jsx
import { Card, Badge, Skeleton } from '../components/ui';
import { useToast } from '../context/ToastContext';

// StatCard with animation
const StatCard = ({ label, value, loading }) => (
  <Card prompt="$" className="text-center">
    {loading ? (
      <Skeleton count={2} />
    ) : (
      <>
        <div className="text-4xl font-terminal-display text-terminal-primary mb-2 animate-pulse-glow">
          {value}
        </div>
        <div className="text-xs text-terminal-text-secondary uppercase tracking-wider">
          {label}
        </div>
      </>
    )}
  </Card>
);

// Staggered grid
<div className="grid grid-cols-1 md:grid-cols-4 gap-4">
  {stats.map((stat, i) => (
    <div
      key={stat.label}
      className="animate-list-enter"
      style={{ animationDelay: `${i * 80}ms` }}
    >
      <StatCard {...stat} loading={loading} />
    </div>
  ))}
</div>
```

**Backend Integration:**
```jsx
const [stats, setStats] = useState([]);
const [loading, setLoading] = useState(true);
const { showToast } = useToast();

useEffect(() => {
  const loadStats = async () => {
    try {
      setLoading(true);
      const response = await api.get('/api/dashboard/summary');
      setStats([
        { label: 'Meetings', value: response.data.meetings },
        { label: 'Action Items', value: response.data.actionItems },
        { label: 'Open Tasks', value: response.data.openItems },
        { label: 'Overdue', value: response.data.overdue },
      ]);
    } catch (error) {
      showToast('Failed to load dashboard stats', 'error');
    } finally {
      setLoading(false);
    }
  };

  loadStats();
  const interval = setInterval(() => loadStats(), 30000); // Poll every 30s
  return () => clearInterval(interval);
}, []);
```

---

#### Meetings Page (`frontend/src/pages/Meetings.jsx`)

**Components to Create:**
1. MeetingCard component
2. Search/Filter bar

**MeetingCard:**
```jsx
const MeetingCard = ({ meeting, onClick }) => (
  <Card
    prompt=">"
    className="cursor-pointer group"
    onClick={() => onClick(meeting.id)}
  >
    <div className="flex items-start justify-between mb-3">
      <h3 className="text-terminal-primary font-terminal-display text-lg uppercase group-hover:animate-glitch">
        {meeting.title}
      </h3>
      <Badge variant={meeting.sentiment_label === 'Positive' ? 'success' : 'default'}>
        {meeting.sentiment_label}
      </Badge>
    </div>

    <p className="text-terminal-text-secondary text-sm mb-3 line-clamp-2 font-terminal">
      {meeting.summary}
    </p>

    <div className="flex items-center justify-between text-xs">
      <span className="text-terminal-text-tertiary font-terminal">
        [{new Date(meeting.created_at).toLocaleString()}]
      </span>
      <span className="text-terminal-amber">
        {meeting.attendees?.length || 0} participants
      </span>
    </div>
  </Card>
);
```

**Staggered list:**
```jsx
<div className="space-y-4">
  {loading ? (
    <Skeleton count={5} className="h-32" variant="shimmer" />
  ) : (
    filteredMeetings.map((meeting, i) => (
      <div
        key={meeting.id}
        className="animate-list-enter"
        style={{ animationDelay: `${Math.min(i * 40, 200)}ms` }}
      >
        <MeetingCard meeting={meeting} onClick={handleMeetingClick} />
      </div>
    ))
  )}
</div>
```

---

### Week 4: Projects & Tasks Pages

#### Projects Page (`frontend/src/pages/Projects.jsx`)

**Key Component: ProjectCard with progress bar**
```jsx
const ProjectCard = ({ project }) => (
  <Card prompt="#">
    <div className="flex items-start justify-between mb-3">
      <h3 className="text-terminal-primary font-terminal-display uppercase text-lg">
        {project.name}
      </h3>
      <Badge variant={project.status === 'completed' ? 'success' : 'default'}>
        {project.status}
      </Badge>
    </div>

    {/* ASCII progress bar */}
    <div className="mb-3">
      <div className="flex justify-between text-xs text-terminal-text-secondary mb-1 font-terminal">
        <span>Progress</span>
        <span>[{project.progress_percent}%]</span>
      </div>
      <div className="h-2 bg-terminal-bg-base border border-terminal-primary/30 overflow-hidden">
        <div
          className="h-full bg-terminal-primary transition-all duration-slow"
          style={{ width: `${project.progress_percent}%` }}
        />
      </div>
    </div>

    {/* Stats grid */}
    <div className="grid grid-cols-3 gap-2 text-xs font-terminal">
      <div className="text-center">
        <div className="text-terminal-primary">{project.total_items}</div>
        <div className="text-terminal-text-tertiary">Total</div>
      </div>
      <div className="text-center">
        <div className="text-terminal-primary">{project.complete_items}</div>
        <div className="text-terminal-text-tertiary">Done</div>
      </div>
      <div className="text-center">
        <div className="text-[#ff0040]">{project.overdue_items}</div>
        <div className="text-terminal-text-tertiary">Overdue</div>
      </div>
    </div>
  </Card>
);
```

---

#### Tasks Page (`frontend/src/pages/Tasks.jsx`)

**Key Component: TaskItem with checkbox**
```jsx
const TaskItem = ({ task, onToggle, onDelete }) => (
  <div className="flex items-center gap-3 p-3 bg-terminal-bg-surface border border-terminal-primary/30 hover:border-terminal-primary transition-all group">
    {/* Checkbox */}
    <button
      onClick={() => onToggle(task.id)}
      className="w-5 h-5 border-2 border-terminal-primary flex items-center justify-center transition-all hover:bg-terminal-primary/20"
    >
      {task.status === 'done' && (
        <span className="text-terminal-primary text-lg">✓</span>
      )}
    </button>

    {/* Task details */}
    <div className="flex-1">
      <div className="flex items-center gap-2 mb-1">
        <span className={`font-terminal text-sm ${task.status === 'done' ? 'line-through text-terminal-text-tertiary' : 'text-terminal-primary'}`}>
          {task.title}
        </span>
        <Badge variant={
          task.priority === 'high' ? 'error' :
          task.priority === 'medium' ? 'warning' : 'default'
        }>
          {task.priority}
        </Badge>
      </div>
      <div className="text-xs text-terminal-text-secondary font-terminal">
        [{task.assigned_to}] {task.due_date && `• Due: ${new Date(task.due_date).toLocaleDateString()}`}
      </div>
    </div>

    {/* Delete button */}
    <button
      onClick={() => onDelete(task.id)}
      className="opacity-0 group-hover:opacity-100 text-[#ff0040] hover:text-[#ff0040]/80 transition-all"
    >
      ✗
    </button>
  </div>
);
```

**Optimistic Updates:**
```jsx
const handleToggleTask = async (taskId) => {
  // Optimistic update
  setTasks(prev => prev.map(t =>
    t.id === taskId ? { ...t, status: t.status === 'done' ? 'open' : 'done' } : t
  ));

  try {
    await tasksApi.update(taskId, { status: tasks.find(t => t.id === taskId).status });
    showToast('Task updated', 'success');
  } catch (error) {
    // Revert on error
    setTasks(prev => prev.map(t =>
      t.id === taskId ? { ...t, status: t.status === 'done' ? 'open' : 'done' } : t
    ));
    showToast('Failed to update task', 'error');
  }
};
```

---

### Week 5: Automations & Advanced Animations

#### Automations Page

**AutomationCard with toggle:**
```jsx
const AutomationCard = ({ automation, onToggle }) => (
  <Card prompt="λ">
    <div className="flex items-start justify-between mb-3">
      <div className="flex-1">
        <h3 className="text-terminal-primary font-terminal-display uppercase text-lg mb-2">
          {automation.name}
        </h3>
        <p className="text-terminal-text-secondary text-sm font-terminal">
          {automation.description}
        </p>
      </div>

      {/* Toggle switch */}
      <button
        onClick={() => onToggle(automation.id, !automation.enabled)}
        className={`w-12 h-6 rounded-full border-2 relative transition-all ${
          automation.enabled
            ? 'bg-terminal-primary/20 border-terminal-primary'
            : 'bg-terminal-bg-base border-terminal-primary/30'
        }`}
      >
        <div className={`absolute top-0.5 w-4 h-4 bg-terminal-primary rounded-full transition-all ${
          automation.enabled ? 'right-0.5' : 'left-0.5'
        }`} />
      </button>
    </div>

    {/* Stats */}
    <div className="grid grid-cols-2 gap-4 text-xs font-terminal mt-4 pt-4 border-t border-terminal-primary/20">
      <div>
        <div className="text-terminal-text-tertiary">Executions</div>
        <div className="text-terminal-primary text-lg">{automation.execution_count}</div>
      </div>
      <div>
        <div className="text-terminal-text-tertiary">Last Run</div>
        <div className="text-terminal-primary">
          {automation.last_executed_at
            ? new Date(automation.last_executed_at).toLocaleDateString()
            : 'Never'
          }
        </div>
      </div>
    </div>
  </Card>
);
```

#### Create useStaggerAnimation Hook

**File:** `frontend/src/hooks/useStaggerAnimation.js`
```javascript
import { useEffect, useRef } from 'react';

export const useStaggerAnimation = (items, delay = 40) => {
  const containerRef = useRef(null);

  useEffect(() => {
    if (!containerRef.current) return;

    const children = containerRef.current.children;
    Array.from(children).forEach((child, i) => {
      child.style.animationDelay = `${Math.min(i * delay, 200)}ms`;
      child.classList.add('animate-list-enter');
    });
  }, [items, delay]);

  return containerRef;
};

// Usage
const containerRef = useStaggerAnimation(meetings);
return <div ref={containerRef}>{/* list items */}</div>;
```

---

### Week 6: Integration & Testing

**Tasks:**
1. Connect all components to backend APIs
2. Add error handling everywhere
3. Implement real-time polling
4. Cross-browser testing
5. Performance profiling

**Standard API Pattern:**
```jsx
const [data, setData] = useState(null);
const [loading, setLoading] = useState(false);
const [error, setError] = useState(null);
const { showToast } = useToast();

const loadData = async () => {
  try {
    setLoading(true);
    setError(null);
    const response = await api.get('/api/endpoint');
    setData(response.data);
  } catch (err) {
    setError(err.message);
    showToast('Failed to load data', 'error');
  } finally {
    setLoading(false);
  }
};
```

---

### Week 7: Polish & Launch

**Tasks:**
1. Performance optimization (memo, useCallback, useMemo)
2. Accessibility audit (WCAG 2.1 AA)
3. Feature flag setup
4. Documentation
5. Launch preparation

**Performance Optimizations:**
```jsx
import React, { memo, useCallback, useMemo } from 'react';

// Memoize static components
export default memo(Card);

// Memoize callbacks
const handleClick = useCallback(() => {
  // handler logic
}, [dependencies]);

// Memoize expensive computations
const filteredData = useMemo(() =>
  data.filter(item => item.matches(filter)),
  [data, filter]
);
```

---

## 🔧 Development Patterns

### Component Structure

```jsx
import React, { useState, useEffect } from 'react';
import { Card, Badge, Button, Skeleton } from '../components/ui';
import { useToast } from '../context/ToastContext';
import api from '../services/api';

const PageName = () => {
  // State
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Hooks
  const { showToast } = useToast();

  // Data loading
  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      setLoading(true);
      const response = await api.get('/api/endpoint');
      setData(response.data);
    } catch (err) {
      setError(err.message);
      showToast('Failed to load data', 'error');
    } finally {
      setLoading(false);
    }
  };

  // Render
  if (loading) return <Skeleton count={5} className="h-20" />;
  if (error) return <div>Error: {error}</div>;

  return (
    <div className="space-y-4">
      {data.map((item, i) => (
        <div
          key={item.id}
          className="animate-list-enter"
          style={{ animationDelay: `${i * 40}ms` }}
        >
          <Card>{/* content */}</Card>
        </div>
      ))}
    </div>
  );
};

export default PageName;
```

---

## 📊 Testing Checklist

### Manual Testing

- [ ] All Terminal components render correctly
- [ ] Animations play smoothly (60fps)
- [ ] Toast notifications appear/dismiss correctly
- [ ] Modal opens/closes with animations
- [ ] Page transitions work on navigation
- [ ] Hover effects work on all interactive elements
- [ ] Loading skeletons show during API calls
- [ ] Error states display properly
- [ ] Dark mode works (Terminal is inherently dark)
- [ ] Mobile responsive layout works
- [ ] Keyboard navigation functional
- [ ] Screen reader announces changes
- [ ] Reduced motion preference respected

### Performance Testing

- [ ] Lighthouse score >90
- [ ] First Contentful Paint <1.5s
- [ ] Time to Interactive <3.5s
- [ ] Animation frame rate 60fps
- [ ] Bundle size <350KB (gzipped)
- [ ] No memory leaks (DevTools check)

### Accessibility Testing

- [ ] All interactive elements keyboard accessible
- [ ] Focus indicators visible
- [ ] ARIA labels present where needed
- [ ] Screen reader testing passed
- [ ] Color contrast meets WCAG AA
- [ ] prefers-reduced-motion implemented

### Cross-browser Testing

- [ ] Chrome (latest)
- [ ] Firefox (latest)
- [ ] Safari (macOS)
- [ ] Edge (latest)
- [ ] Mobile Chrome (Android)
- [ ] Mobile Safari (iOS)

---

## 🎯 Success Metrics

### User Experience
- Task completion time decreases by 15%
- User satisfaction increases
- Session duration increases
- Bounce rate decreases

### Performance
- Lighthouse score >90
- FCP <1.5s
- TTI <3.5s
- Bundle <350KB gzipped

### Quality
- Zero accessibility violations
- Zero console errors
- 95%+ test coverage for new components
- Works on all supported browsers

---

## 📁 Key Files Reference

### Configuration Files
- `frontend/index.html` - Font loading
- `frontend/tailwind.config.js` - Terminal theme config
- `frontend/src/styles/main.css` - Terminal CSS variables
- `frontend/src/styles/animations.css` - All keyframe animations

### Component Library
- `frontend/src/components/ui/Button.jsx`
- `frontend/src/components/ui/Card.jsx`
- `frontend/src/components/ui/Badge.jsx`
- `frontend/src/components/ui/Input.jsx`
- `frontend/src/components/ui/Skeleton.jsx`
- `frontend/src/components/ui/Toast.jsx`
- `frontend/src/components/ui/index.js` - Barrel export

### Context Providers
- `frontend/src/context/ToastContext.jsx`
- `frontend/src/context/ThemeContext.jsx` (existing)

### Pages to Update
- `frontend/src/pages/Dashboard.jsx`
- `frontend/src/pages/Meetings.jsx`
- `frontend/src/pages/Projects.jsx`
- `frontend/src/pages/Tasks.jsx`
- `frontend/src/pages/Automations.jsx`

### Hooks to Create
- `frontend/src/hooks/useReducedMotion.js`
- `frontend/src/hooks/useStaggerAnimation.js`

---

## 🚨 Important Notes

### Don't Break Existing Functionality
- All pages must continue to work
- API integrations remain functional
- Existing user workflows preserved

### Incremental Rollout
- Use feature flags for safe deployment
- Migrate one page at a time
- Test thoroughly before removing old components

### Accessibility First
- Respect prefers-reduced-motion
- Maintain keyboard navigation
- Screen reader compatibility
- WCAG 2.1 AA compliance

### Performance Conscious
- Use CSS transforms (GPU accelerated)
- Lazy load when possible
- Monitor bundle size
- Profile with React DevTools

---

## 💬 Questions & Support

If you need clarification on any part of this handoff:

1. Check the original plan: `C:\Users\Aegis{FM}\.claude\plans\radiant-tumbling-storm.md`
2. Review completed code in `frontend/src/components/ui/`
3. Test examples provided in this document
4. Ask specific questions about implementation details

---

## 🎨 Design Philosophy Reminders

**The Terminal Theme is:**
- Raw and technical (not polished/corporate)
- Developer-forward (CLI aesthetic)
- Engaging but professional (balanced animations)
- Accessible and performant (WCAG AA, 60fps)

**Key Visual Elements:**
- Matrix green (#00ff41) as primary color
- Monospace fonts everywhere (JetBrains Mono)
- ASCII-style indicators (>, $, λ, [], {})
- Corner brackets on cards/modals
- Scan line overlay effect
- CRT glow on focused elements
- Terminal-style error messages ([!] Error)

**Animation Guidelines:**
- Fast: 150ms (button press, icon changes)
- Normal: 250ms (hover effects, focus states)
- Medium: 350ms (page transitions, modal open)
- Slow: 500ms (progress bars, data visualization)
- Easing: cubic-bezier(0.25, 0, 0.75, 1) for sharp, digital feel

---

**Happy coding! The Terminal awaits. >_** 🚀
