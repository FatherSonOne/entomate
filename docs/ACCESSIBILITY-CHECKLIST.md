# Accessibility Checklist - WCAG 2.1 Level AA

**Version:** 1.0
**Test Date:** TBD
**Target Standard:** WCAG 2.1 Level AA

---

## Overview

This checklist ensures Entomate meets WCAG 2.1 Level AA accessibility standards across all 10 brand themes in both light and dark modes.

**Testing Scope:** 20 theme combinations (10 brands × 2 modes)
**Pages to Test:** 7 core pages (Dashboard, Tasks, Projects, Meetings, Intelligence, Automations, Settings)

---

## 1. Perceivable

### 1.1 Text Alternatives

**Success Criterion 1.1.1: Non-text Content (Level A)**

- [ ] All images have appropriate alt text
- [ ] Decorative images use `alt=""` or `aria-hidden="true"`
- [ ] Icons have `aria-label` or accompanying text
- [ ] Charts/graphs have text descriptions

**Test Method:**
```bash
# Check with screen reader (NVDA/VoiceOver)
# Verify all images announced with meaningful text
```

**Status:** ⏳ Pending

---

### 1.3 Adaptable

**Success Criterion 1.3.1: Info and Relationships (Level A)**

- [ ] Proper heading structure (h1 → h2 → h3, no skips)
- [ ] Form labels associated with inputs (`<label for="id">`)
- [ ] Lists use proper markup (`<ul>`, `<ol>`)
- [ ] Tables use `<th>`, `<caption>`, and proper structure
- [ ] Semantic HTML elements used (header, nav, main, aside, footer)

**Test Method:**
```bash
# View page outline in browser DevTools
# Check heading hierarchy makes sense
# Verify form labels click to focus inputs
```

**Pages Tested:**
- [ ] Dashboard
- [ ] Tasks
- [ ] Projects
- [ ] Meetings
- [ ] Intelligence
- [ ] Automations
- [ ] Settings

**Status:** ⏳ Pending

---

**Success Criterion 1.3.2: Meaningful Sequence (Level A)**

- [ ] Reading order makes sense when CSS disabled
- [ ] Tab order follows visual flow
- [ ] Content order logical in DOM

**Test Method:**
```bash
# Disable CSS in browser
# Verify content still understandable
```

**Status:** ⏳ Pending

---

### 1.4 Distinguishable

**Success Criterion 1.4.1: Use of Color (Level A)**

- [ ] Color not sole means of conveying information
- [ ] Links distinguishable by more than color (underline, bold)
- [ ] Error states use icons/text, not just color

**Examples:**
```jsx
// ✅ GOOD - Icon + color
<span className="text-semantic-error flex items-center gap-1">
  <XCircle className="w-4 h-4" />
  Error occurred
</span>

// ❌ BAD - Color only
<span className="text-semantic-error">Error occurred</span>
```

**Status:** ⏳ Pending

---

**Success Criterion 1.4.3: Contrast (Minimum) (Level AA)** ⭐ **CRITICAL**

**Normal Text (< 18px): 4.5:1 minimum**
**Large Text (≥ 18px or 14px bold): 3:1 minimum**

| Theme | Mode | text-primary on bg-surface | text-secondary on bg-surface | text-tertiary on bg-surface | Status |
|-------|------|---------------------------|------------------------------|----------------------------|--------|
| Synapse | Light | TBD:1 | TBD:1 | TBD:1 | ⏳ |
| Synapse | Dark | TBD:1 | TBD:1 | TBD:1 | ⏳ |
| Blueprint | Light | TBD:1 | TBD:1 | TBD:1 | ⏳ |
| Blueprint | Dark | TBD:1 | TBD:1 | TBD:1 | ⏳ |
| Velocity | Light | TBD:1 | TBD:1 | TBD:1 | ⏳ |
| Velocity | Dark | TBD:1 | TBD:1 | TBD:1 | ⏳ |
| Neon District | Dark only | TBD:1 | TBD:1 | TBD:1 | ⏳ |
| Serif Scholar | Light | TBD:1 | TBD:1 | TBD:1 | ⏳ |
| Serif Scholar | Dark | TBD:1 | TBD:1 | TBD:1 | ⏳ |
| Aurora | Light | TBD:1 | TBD:1 | TBD:1 | ⏳ |
| Aurora | Dark | TBD:1 | TBD:1 | TBD:1 | ⏳ |
| Monolith | Light | TBD:1 | TBD:1 | TBD:1 | ⏳ |
| Monolith | Dark | TBD:1 | TBD:1 | TBD:1 | ⏳ |
| Horizon | Light | TBD:1 | TBD:1 | TBD:1 | ⏳ |
| Horizon | Dark | TBD:1 | TBD:1 | TBD:1 | ⏳ |
| Pastel Zen | Light | TBD:1 | TBD:1 | TBD:1 | ⏳ |
| Pastel Zen | Dark | TBD:1 | TBD:1 | TBD:1 | ⏳ |
| Playground | Light | TBD:1 | TBD:1 | TBD:1 | ⏳ |
| Playground | Dark | TBD:1 | TBD:1 | TBD:1 | ⏳ |

**UI Components Contrast (3:1 minimum):**

- [ ] Button text on button background
- [ ] Badge text on badge background
- [ ] Input borders against background
- [ ] Focus indicators visible
- [ ] Disabled state distinguishable

**Test Method:**
```bash
# Use WebAIM Contrast Checker
# https://webaim.org/resources/contrastchecker/

# For each theme, check:
# 1. Open page in browser
# 2. Inspect element with DevTools
# 3. Get computed colors
# 4. Test in contrast checker
```

**Status:** ⏳ Pending

---

**Success Criterion 1.4.4: Resize Text (Level AA)**

- [ ] Text resizable to 200% without loss of content or functionality
- [ ] No horizontal scrolling at 200% zoom (1280px width)
- [ ] All content still visible and usable

**Test Method:**
```bash
# Set browser zoom to 200%
# Test each page
# Verify no content clipped or hidden
```

**Pages Tested:**
- [ ] Dashboard (200% zoom)
- [ ] Tasks (200% zoom)
- [ ] Projects (200% zoom)
- [ ] Meetings (200% zoom)
- [ ] Intelligence (200% zoom)
- [ ] Automations (200% zoom)
- [ ] Settings (200% zoom)

**Status:** ⏳ Pending

---

**Success Criterion 1.4.10: Reflow (Level AA)**

- [ ] Content reflows at 320px width
- [ ] No horizontal scrolling required
- [ ] All functionality available on mobile

**Test Method:**
```bash
# Resize browser to 320px width
# Verify no horizontal scroll
# Test all interactive elements
```

**Status:** ⏳ Pending

---

**Success Criterion 1.4.11: Non-text Contrast (Level AA)**

- [ ] UI components have 3:1 contrast
- [ ] Graphical objects have 3:1 contrast
- [ ] Focus indicators have 3:1 contrast

**Status:** ⏳ Pending

---

## 2. Operable

### 2.1 Keyboard Accessible

**Success Criterion 2.1.1: Keyboard (Level A)** ⭐ **CRITICAL**

- [ ] All functionality available via keyboard
- [ ] Tab key reaches all interactive elements
- [ ] No keyboard traps (can tab in and out of all components)
- [ ] Modals/dialogs can be closed with Escape key

**Test Method:**
```bash
# Disconnect mouse
# Navigate entire app with keyboard only
# Tab through all pages
# Verify all buttons/links/inputs reachable
```

**Pages Tested:**
- [ ] Dashboard (keyboard only)
- [ ] Tasks (keyboard only)
  - [ ] Can create task via keyboard
  - [ ] Can complete task via keyboard
  - [ ] Can delete task via keyboard
- [ ] Projects (keyboard only)
- [ ] Meetings (keyboard only)
- [ ] Intelligence (keyboard only)
  - [ ] Can expand cards via keyboard
  - [ ] Can trigger actions via keyboard
- [ ] Automations (keyboard only)
- [ ] Settings (keyboard only)
  - [ ] Can switch theme via keyboard
  - [ ] Can toggle dark mode via keyboard

**Status:** ⏳ Pending

---

**Success Criterion 2.1.2: No Keyboard Trap (Level A)**

- [ ] Focus can move away from all components
- [ ] No infinite loops in tab order
- [ ] Modal dialogs release focus when closed

**Status:** ⏳ Pending

---

### 2.4 Navigable

**Success Criterion 2.4.1: Bypass Blocks (Level A)**

- [ ] Skip to main content link available
- [ ] Proper landmarks (nav, main, aside, footer)

**Status:** ⏳ Pending

---

**Success Criterion 2.4.2: Page Titled (Level A)**

- [ ] Each page has unique, descriptive title
- [ ] Title reflects page content

**Pages:**
- [ ] Dashboard - "Dashboard | Entomate"
- [ ] Tasks - "Tasks | Entomate"
- [ ] Projects - "Projects | Entomate"
- [ ] Meetings - "Meetings | Entomate"
- [ ] Intelligence - "Intelligence Dashboard | Entomate"
- [ ] Automations - "Automations | Entomate"
- [ ] Settings - "Settings | Entomate"

**Status:** ⏳ Pending

---

**Success Criterion 2.4.3: Focus Order (Level A)**

- [ ] Focus order follows visual order
- [ ] Tab order makes sense
- [ ] Skip links work correctly

**Status:** ⏳ Pending

---

**Success Criterion 2.4.4: Link Purpose (Level A)**

- [ ] Link text describes destination
- [ ] "Click here" avoided
- [ ] Icons have aria-labels

**Status:** ⏳ Pending

---

**Success Criterion 2.4.6: Headings and Labels (Level AA)**

- [ ] Headings descriptive
- [ ] Form labels clear and descriptive
- [ ] Buttons have clear labels

**Status:** ⏳ Pending

---

**Success Criterion 2.4.7: Focus Visible (Level AA)** ⭐ **CRITICAL**

- [ ] Keyboard focus indicator always visible
- [ ] Focus indicator has sufficient contrast
- [ ] Focus style consistent across themes

**Test Method:**
```bash
# Tab through page
# Verify blue focus ring on all interactive elements
# Check focus ring visible in all themes
```

**Themes Tested:**
- [ ] Synapse (light/dark)
- [ ] Blueprint (light/dark)
- [ ] Velocity (light/dark)
- [ ] All other themes (light/dark)

**Status:** ⏳ Pending

---

## 3. Understandable

### 3.1 Readable

**Success Criterion 3.1.1: Language of Page (Level A)**

- [ ] HTML lang attribute set (`<html lang="en">`)

**Status:** ⏳ Pending

---

### 3.2 Predictable

**Success Criterion 3.2.1: On Focus (Level A)**

- [ ] No automatic context changes on focus
- [ ] Forms don't auto-submit on focus

**Status:** ⏳ Pending

---

**Success Criterion 3.2.2: On Input (Level A)**

- [ ] No unexpected context changes on input
- [ ] Settings changes don't redirect user

**Status:** ⏳ Pending

---

**Success Criterion 3.2.3: Consistent Navigation (Level AA)**

- [ ] Navigation menu consistent across pages
- [ ] Settings always in same place

**Status:** ⏳ Pending

---

**Success Criterion 3.2.4: Consistent Identification (Level AA)**

- [ ] Icons used consistently (same icon for same action)
- [ ] Buttons labeled consistently

**Status:** ⏳ Pending

---

### 3.3 Input Assistance

**Success Criterion 3.3.1: Error Identification (Level A)**

- [ ] Form errors clearly identified
- [ ] Error messages descriptive

**Example:**
```jsx
// ✅ GOOD
<input className="border-semantic-error" />
<p className="text-semantic-error">Email is required</p>

// ❌ BAD
<input className="border-red-500" />
```

**Status:** ⏳ Pending

---

**Success Criterion 3.3.2: Labels or Instructions (Level A)**

- [ ] All form inputs have labels
- [ ] Instructions provided where needed
- [ ] Required fields marked

**Status:** ⏳ Pending

---

**Success Criterion 3.3.3: Error Suggestion (Level AA)**

- [ ] Error messages suggest how to fix
- [ ] Examples provided for complex inputs

**Status:** ⏳ Pending

---

**Success Criterion 3.3.4: Error Prevention (Level AA)**

- [ ] Confirmation for destructive actions
- [ ] Ability to review before submit
- [ ] Ability to undo/correct

**Examples:**
- [ ] Task deletion confirmation
- [ ] Meeting deletion confirmation
- [ ] Form validation before submit

**Status:** ⏳ Pending

---

## 4. Robust

### 4.1 Compatible

**Success Criterion 4.1.1: Parsing (Level A)**

- [ ] Valid HTML (no parsing errors)
- [ ] Elements properly nested
- [ ] Unique IDs

**Test Method:**
```bash
# Use W3C HTML Validator
# https://validator.w3.org/
```

**Status:** ⏳ Pending

---

**Success Criterion 4.1.2: Name, Role, Value (Level A)**

- [ ] Custom components have proper ARIA
- [ ] Buttons have type attribute
- [ ] Links have accessible names
- [ ] Form controls have labels

**Status:** ⏳ Pending

---

**Success Criterion 4.1.3: Status Messages (Level AA)**

- [ ] Status messages announced to screen readers
- [ ] Success/error toasts use aria-live
- [ ] Loading states announced

**Example:**
```jsx
// ✅ GOOD
<div role="status" aria-live="polite">
  Task created successfully
</div>
```

**Status:** ⏳ Pending

---

## Screen Reader Testing

**Screen Readers to Test:**

1. **NVDA (Windows - Free)**
   - [ ] Navigate all pages
   - [ ] Verify announcements correct
   - [ ] Test form interactions

2. **VoiceOver (macOS - Built-in)**
   - [ ] Navigate all pages
   - [ ] Verify announcements correct
   - [ ] Test form interactions

**Key Tests:**
- [ ] Page structure makes sense
- [ ] Headings announced correctly
- [ ] Form labels read properly
- [ ] Buttons/links have clear names
- [ ] Status messages announced
- [ ] Modal dialogs handled correctly

---

## Automated Testing

**Tools:**

1. **axe DevTools (Browser Extension)**
   ```bash
   # Install extension
   # Right-click → Inspect → axe DevTools
   # Click "Scan All of My Page"
   # Fix all Critical and Serious issues
   ```

2. **Lighthouse (Chrome DevTools)**
   ```bash
   # DevTools → Lighthouse
   # Select "Accessibility"
   # Run audit
   # Target: 100 score
   ```

3. **WAVE (Browser Extension)**
   ```bash
   # Install WAVE extension
   # Click extension icon
   # Review errors and warnings
   ```

**Results:**

| Tool | Score/Issues | Status |
|------|--------------|--------|
| axe DevTools | TBD | ⏳ Pending |
| Lighthouse | TBD/100 | ⏳ Pending |
| WAVE | TBD errors | ⏳ Pending |

---

## Summary & Sign-off

**Total Tests:** 45+
**Tests Passed:** TBD
**Tests Failed:** TBD
**Critical Issues:** TBD
**Compliance Level:** ⏳ Pending Verification

**Testing Completed By:** _________________
**Date:** _________________
**Sign-off:** _________________

---

## Issue Log

### Critical Issues (Must Fix Before Launch)

| Issue | Component | Theme | Status | Owner |
|-------|-----------|-------|--------|-------|
| | | | | |

### High Priority Issues

| Issue | Component | Theme | Status | Owner |
|-------|-----------|-------|--------|-------|
| | | | | |

### Medium Priority Issues

| Issue | Component | Theme | Status | Owner |
|-------|-----------|-------|--------|-------|
| | | | | |

### Low Priority Issues

| Issue | Component | Theme | Status | Owner |
|-------|-----------|-------|--------|-------|
| | | | | |
