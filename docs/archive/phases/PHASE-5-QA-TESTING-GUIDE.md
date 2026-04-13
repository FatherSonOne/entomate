# Phase 5: QA Testing & Launch Guide

**Status:** In Progress
**Version:** 1.0
**Last Updated:** 2026-01-25

---

## Overview

Phase 5 focuses on comprehensive quality assurance, performance optimization, accessibility compliance, and launch preparation for the Entomate UI/UX Brand Overhaul.

**Timeline:** 2 weeks (Week 5: Testing, Week 6: Launch Prep)

---

## Week 5: Comprehensive Testing

### Day 1-2: Multi-Theme Testing

#### Testing Matrix

**10 Brand Themes × 2 Modes = 20 Combinations**

| Theme | Category | Light Mode | Dark Mode | Status |
|-------|----------|------------|-----------|--------|
| Synapse | Technical/Futuristic | ⬜ | ⬜ | Pending |
| Velocity | Technical/Futuristic | ⬜ | ⬜ | Pending |
| Neon District | Technical/Futuristic | ⬜ | ⬜ | Pending |
| Blueprint | Professional/Enterprise | ⬜ | ⬜ | Pending |
| Serif Scholar | Professional/Enterprise | ⬜ | ⬜ | Pending |
| Aurora | Professional/Enterprise | ⬜ | ⬜ | Pending |
| Monolith | Professional/Enterprise | ⬜ | ⬜ | Pending |
| Horizon | Creative/Playful | ⬜ | ⬜ | Pending |
| Pastel Zen | Creative/Playful | ⬜ | ⬜ | Pending |
| Playground | Creative/Playful | ⬜ | ⬜ | Pending |

#### Pages to Test (7 core pages)

1. **Dashboard** - `/`
   - [ ] Stat cards render correctly
   - [ ] IntelligenceDashboard displays
   - [ ] LearningInsightsWidget appears (when data available)
   - [ ] Recent meetings/tasks lists
   - [ ] System status indicators

2. **Tasks** - `/tasks`
   - [ ] Task list renders
   - [ ] Create task modal
   - [ ] AgentRecommendationPanel (when typing)
   - [ ] Priority badges
   - [ ] Status filters

3. **Projects** - `/projects`
   - [ ] Project cards
   - [ ] Create/edit modals
   - [ ] Progress indicators

4. **Meetings** - `/meetings`
   - [ ] Meeting list
   - [ ] Meeting detail view
   - [ ] Sentiment badges
   - [ ] Action items

5. **Intelligence** - `/intelligence`
   - [ ] MeetingPrepCard
   - [ ] DealRiskAlertCard with RiskFactorBreakdown & PredictionGauge
   - [ ] ActionItemStatusCard with BlockingChainDiagram
   - [ ] RelationshipInsightCard with StakeholderCard
   - [ ] ExpandableCard interactions

6. **Automations** - `/automations`
   - [ ] Automation builder
   - [ ] Workflow canvas
   - [ ] SecretsManager

7. **Settings** - `/settings`
   - [ ] Theme switcher
   - [ ] AI Learning section
   - [ ] System status
   - [ ] Configuration guides

#### Component-Specific Tests

**Intelligence Components (7 enhancement components)**

- [ ] **AgentRecommendationPanel**
  - Confidence badges display correctly
  - "Why?" buttons trigger ExplanationModal
  - Accept/Override buttons functional
  - Colors adapt to theme

- [ ] **RiskFactorBreakdown**
  - Weighted bars render properly
  - Impact colors (high/medium/low) visible
  - Factor details readable

- [ ] **PredictionGauge**
  - Circular SVG gauge renders
  - Risk score colors correct
  - Churn/close percentages visible
  - Confidence meter readable

- [ ] **BlockingChainDiagram**
  - Vertical flow diagram clear
  - Arrows connect nodes
  - Status icons visible
  - Chain statistics readable

- [ ] **StakeholderCard**
  - Avatar colors distinct
  - Role badges readable
  - Star ratings visible
  - Relationship meters clear
  - Action buttons accessible

- [ ] **SentimentTrendMini**
  - Sparkline bars render
  - Color coding (green/red/gray) works
  - Trend indicators visible
  - Date range readable

- [ ] **LearningInsightsWidget**
  - Metrics display clearly
  - Review button visible
  - Navigation functional

#### Testing Process

1. **Manual Theme Switching**
   ```bash
   # Open browser DevTools Console
   # Switch theme via Settings or programmatically:
   localStorage.setItem('entomate-brand-theme', 'synapse')
   location.reload()
   ```

2. **Visual Checks**
   - Text contrast (all text should be readable)
   - Color consistency (semantic colors work across themes)
   - Spacing/layout (no broken layouts)
   - Icons/badges (all visible and correct colors)
   - Borders/shadows (appropriate for theme personality)

3. **Interactive Elements**
   - Buttons have clear hover/focus states
   - Links are distinguishable
   - Modals/popovers render correctly
   - Form inputs have visible focus rings
   - Dropdowns/select menus readable

4. **Document Issues**
   ```markdown
   ### Issue Template
   **Theme:** [theme-name]
   **Mode:** [light/dark]
   **Page:** [page-name]
   **Component:** [component-name]
   **Issue:** [description]
   **Severity:** [Critical/High/Medium/Low]
   **Screenshot:** [attach if applicable]
   ```

---

### Day 3: Accessibility Audit

#### WCAG 2.1 Level AA Compliance Checklist

**1. Perceivable**

- [ ] **1.1 Text Alternatives**
  - [ ] All images have alt text
  - [ ] Icons have aria-labels
  - [ ] Decorative images marked with aria-hidden

- [ ] **1.3 Adaptable**
  - [ ] Proper HTML semantic structure (header, nav, main, footer)
  - [ ] Form labels associated with inputs
  - [ ] Reading order makes sense without CSS

- [ ] **1.4 Distinguishable**
  - [ ] **Contrast Ratio: 4.5:1 for normal text** (all themes)
  - [ ] **Contrast Ratio: 3:1 for large text** (all themes)
  - [ ] **Contrast Ratio: 3:1 for UI components** (buttons, inputs)
  - [ ] Color not the sole means of conveying information
  - [ ] Text resizable to 200% without loss of content
  - [ ] No horizontal scrolling at 320px width

**2. Operable**

- [ ] **2.1 Keyboard Accessible**
  - [ ] All interactive elements reachable via Tab key
  - [ ] Tab order is logical
  - [ ] No keyboard traps
  - [ ] Visible focus indicators on all focusable elements

- [ ] **2.4 Navigable**
  - [ ] Page titles unique and descriptive
  - [ ] Skip to main content link
  - [ ] Headings in logical order (h1 → h2 → h3)
  - [ ] Link purposes clear from link text

**3. Understandable**

- [ ] **3.1 Readable**
  - [ ] Language of page set in HTML (lang="en")
  - [ ] Text content readable (avoid jargon)

- [ ] **3.2 Predictable**
  - [ ] Navigation consistent across pages
  - [ ] Form labels consistent
  - [ ] No unexpected context changes on focus

- [ ] **3.3 Input Assistance**
  - [ ] Form errors identified and described
  - [ ] Labels/instructions for user input
  - [ ] Error suggestions provided

**4. Robust**

- [ ] **4.1 Compatible**
  - [ ] Valid HTML (no parsing errors)
  - [ ] Proper ARIA attributes
  - [ ] Status messages announced to screen readers

#### Testing Tools

1. **Automated Tools**
   ```bash
   # Install axe DevTools extension
   # Run in browser: Right-click → Inspect → axe DevTools → Scan
   ```

2. **Manual Testing**
   - **Keyboard Navigation:** Tab through entire page
   - **Screen Reader:** Test with NVDA (Windows) or VoiceOver (Mac)
   - **Contrast Checker:** Use WebAIM Contrast Checker
   - **Text Scaling:** Browser zoom to 200%

3. **Color Contrast Testing**
   ```bash
   # For each theme, check:
   - text-content-primary on bg-surface
   - text-content-secondary on bg-surface
   - text-content-tertiary on bg-surface
   - All button text on button backgrounds
   - All badge text on badge backgrounds
   ```

---

### Day 4: Performance Testing

#### Metrics & Targets

| Metric | Target | Critical | How to Measure |
|--------|--------|----------|----------------|
| Theme Switch Time | < 100ms | < 200ms | DevTools Performance tab |
| CSS Bundle Size | < 15KB gzipped | < 25KB | Build output size |
| Font Load Time | < 1s | < 2s | Network tab (font resources) |
| First Contentful Paint (FCP) | < 1.8s | < 3s | Lighthouse |
| Largest Contentful Paint (LCP) | < 2.5s | < 4s | Lighthouse |
| Cumulative Layout Shift (CLS) | 0 on theme switch | < 0.1 | DevTools Performance |
| Time to Interactive (TTI) | < 3.8s | < 7.3s | Lighthouse |

#### Performance Testing Steps

1. **Theme Switch Performance**
   ```javascript
   // Run in Console:
   console.time('theme-switch');
   document.documentElement.setAttribute('data-brand', 'velocity');
   requestAnimationFrame(() => {
     console.timeEnd('theme-switch');
   });
   ```

2. **CSS Bundle Analysis**
   ```bash
   cd frontend
   npm run build
   # Check dist/assets/*.css file sizes
   ls -lh dist/assets/*.css
   ```

3. **Font Loading Performance**
   - Open DevTools → Network tab → Filter by "Font"
   - Reload page
   - Check font file sizes and load times
   - Verify `font-display: swap` prevents FOIT

4. **Lighthouse Audit**
   ```bash
   # In DevTools → Lighthouse
   # Run audit for:
   - Performance
   - Accessibility
   - Best Practices
   # Target: 90+ scores on all metrics
   ```

5. **Layout Shift Testing**
   - Open DevTools → Performance
   - Record while switching themes
   - Check "Experience" section for CLS
   - Target: CLS = 0 (no layout shift on theme change)

#### Performance Optimization Checklist

- [ ] All theme CSS uses CSS variables (no hard-coded colors)
- [ ] Font files are subset to reduce size
- [ ] `font-display: swap` set for all @font-face rules
- [ ] Unused CSS removed from bundle
- [ ] Critical CSS inlined for FCP
- [ ] Images lazy loaded
- [ ] Code-splitting implemented (React.lazy)
- [ ] Service worker for caching (if applicable)

---

### Day 5: User Testing

#### User Testing Protocol

**Participants:** 5-8 internal team members

**Test Scenarios:**

1. **First-Time User Experience**
   - Task: Sign up and select a brand theme
   - Goal: Can user understand theme differences?
   - Metrics: Time to select theme, satisfaction rating

2. **Theme Switching**
   - Task: Switch between 3 different themes
   - Goal: Is switching intuitive and fast?
   - Metrics: Ease of use (1-5), preference feedback

3. **Dark Mode Toggle**
   - Task: Toggle between light and dark modes
   - Goal: Does dark mode improve readability?
   - Metrics: Preference, readability rating

4. **Task Creation with AI**
   - Task: Create a new task and see AI recommendations
   - Goal: Are recommendations helpful and clear?
   - Metrics: Did user notice panel? Did they click "Why?"

5. **Intelligence Dashboard**
   - Task: Review intelligence cards (if data available)
   - Goal: Is information valuable and understandable?
   - Metrics: Comprehension, usefulness rating

**Feedback Collection**

```markdown
## User Testing Feedback Template

**Participant:** [ID/Name]
**Theme Preference:** [theme-name]
**Mode Preference:** [light/dark]

### Overall Experience (1-5)
- Visual Appeal: [1-5]
- Readability: [1-5]
- Intuitiveness: [1-5]
- Performance: [1-5]

### What You Liked
- [feedback]

### What Could Be Improved
- [feedback]

### Theme-Specific Comments
- [feedback]
```

---

## Week 6: Launch Preparation

### Day 1-2: Documentation

**Documents to Create:**

1. **[THEME-MIGRATION-GUIDE.md](./THEME-MIGRATION-GUIDE.md)** - For existing users
2. **[COMPONENT-STYLE-GUIDE.md](./COMPONENT-STYLE-GUIDE.md)** - For developers
3. **[BRAND-THEME-CATALOG.md](./BRAND-THEME-CATALOG.md)** - All 10 themes showcase
4. **[ACCESSIBILITY-REPORT.md](./ACCESSIBILITY-REPORT.md)** - WCAG compliance summary
5. **[PERFORMANCE-BENCHMARKS.md](./PERFORMANCE-BENCHMARKS.md)** - Performance results

### Day 3: Migration Strategy

**Automatic Theme Migration:**

```javascript
// backend/migrations/migrate-user-themes.sql
-- Auto-map old themes to new brands:
UPDATE user_preferences
SET theme = CASE
  WHEN theme = 'cursor' THEN 'blueprint'
  WHEN theme = 'supabase' THEN 'horizon'
  WHEN theme = 'vscode' THEN 'monolith'
  WHEN theme = 'github' THEN 'serif-scholar'
  WHEN theme = 'dark-pro' THEN 'velocity'
  ELSE 'synapse' -- default for unmapped themes
END
WHERE theme IN ('cursor', 'supabase', 'vscode', 'github', 'dark-pro');
```

**Migration Banner:**

```jsx
// frontend/src/components/ThemeMigrationBanner.jsx
{hasOldTheme && (
  <div className="bg-accent-primary-dim border border-accent-primary p-4 rounded-lg mb-4">
    <p className="text-sm text-accent-primary">
      ✨ We've upgraded your theme! You're now using <strong>{newThemeName}</strong>.
      <button onClick={exploreThemes} className="underline ml-2">
        Explore other themes
      </button>
    </p>
  </div>
)}
```

### Day 4: New User Onboarding

**Brand Selection Quiz:**

```jsx
// frontend/src/components/BrandQuiz.jsx
const questions = [
  {
    q: "What describes your team best?",
    options: [
      { label: "Technical & Innovative", themes: ['synapse', 'velocity'] },
      { label: "Professional & Structured", themes: ['blueprint', 'serif-scholar'] },
      { label: "Creative & Forward-Thinking", themes: ['horizon', 'playground'] }
    ]
  },
  {
    q: "What's your work style?",
    options: [
      { label: "Fast-paced & Dynamic", themes: ['velocity', 'neon-district'] },
      { label: "Calm & Focused", themes: ['pastel-zen', 'monolith'] },
      { label: "Premium & Polished", themes: ['aurora', 'serif-scholar'] }
    ]
  }
];
```

### Day 5: Launch Checklist

**Pre-Launch:**

- [ ] All Phase 5 tests passed
- [ ] Documentation complete
- [ ] Migration script tested
- [ ] Feature flag configured
- [ ] Rollback plan documented
- [ ] Support team briefed

**Launch Day:**

- [ ] Deploy to production
- [ ] Monitor error logs
- [ ] Watch performance metrics
- [ ] Collect user feedback
- [ ] Track theme adoption analytics

**Post-Launch (Week 1):**

- [ ] Review user feedback daily
- [ ] Fix critical issues within 24h
- [ ] Monitor theme switching patterns
- [ ] Measure performance benchmarks
- [ ] Document lessons learned

---

## Success Criteria

### Quantitative Metrics

- ✅ 0 hard-coded color references
- ✅ 100% WCAG AA compliance
- ✅ Theme switch < 100ms
- ✅ CSS bundle < 15KB gzipped
- ✅ LCP < 2.5s
- ✅ CLS = 0 on theme switch

### Qualitative Metrics

- ✅ User satisfaction > 4/5
- ✅ No critical bugs in first week
- ✅ Positive developer experience
- ✅ Theme adoption spread across all 10 brands

---

## Issue Tracking

### Critical Issues (P0)
- [ ] [Issue description] - [Status] - [Owner]

### High Priority (P1)
- [ ] [Issue description] - [Status] - [Owner]

### Medium Priority (P2)
- [ ] [Issue description] - [Status] - [Owner]

### Low Priority (P3)
- [ ] [Issue description] - [Status] - [Owner]

---

## Contact & Resources

**Project Lead:** [Name]
**QA Lead:** [Name]
**Accessibility Lead:** [Name]

**Resources:**
- [WebAIM Contrast Checker](https://webaim.org/resources/contrastchecker/)
- [WCAG 2.1 Guidelines](https://www.w3.org/WAI/WCAG21/quickref/)
- [Lighthouse CI](https://github.com/GoogleChrome/lighthouse-ci)
- [axe DevTools](https://www.deque.com/axe/devtools/)
