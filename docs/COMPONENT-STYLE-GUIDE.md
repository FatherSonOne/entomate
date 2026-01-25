# Component Style Guide

**Version:** 2.0
**Last Updated:** 2026-01-25
**Theme System:** Multi-Brand CSS Variables

---

## Overview

This guide documents the new multi-brand theme system architecture and provides examples for building theme-aware components in Entomate.

### Key Principles

1. **Zero Hard-Coded Colors** - All colors reference CSS variables
2. **Semantic Tokens** - Use meaning-based names (e.g., `text-content-primary` not `text-gray-900`)
3. **Theme Independence** - Components work across all 10 brand themes
4. **Accessible by Default** - WCAG AA contrast ratios maintained

---

## CSS Variable System

### Color Token Categories

#### 1. Content Colors (Text)

```css
/* Usage: Text content with hierarchical importance */
--text-primary     /* Main headings, important text */
--text-secondary   /* Body text, descriptions */
--text-tertiary    /* Subtle text, hints, metadata */
```

**Tailwind Classes:**
- `text-content-primary`
- `text-content-secondary`
- `text-content-tertiary`

**Example:**
```jsx
<h1 className="text-content-primary">Main Heading</h1>
<p className="text-content-secondary">Body text goes here</p>
<span className="text-content-tertiary text-xs">Metadata</span>
```

#### 2. Background Colors

```css
/* Usage: Surfaces and containers */
--bg-base           /* Page background */
--bg-surface        /* Card backgrounds */
--bg-surface-muted  /* Subtle backgrounds */
--bg-surface-subtle /* Very subtle backgrounds */
--bg-surface-elevated /* Raised elements */
```

**Tailwind Classes:**
- `bg-surface`
- `bg-surface-muted`
- `bg-surface-subtle`
- `bg-surface-elevated`

**Example:**
```jsx
<div className="bg-surface rounded-lg p-4">
  <div className="bg-surface-muted p-3 rounded">
    Nested content
  </div>
</div>
```

#### 3. Accent Colors (Brand-Specific)

```css
/* Usage: CTAs, highlights, interactive elements */
--accent-primary       /* Primary brand color */
--accent-primary-dim   /* Dimmed primary */
--accent-secondary     /* Secondary brand color */
--accent-tertiary      /* Tertiary brand color */
```

**Tailwind Classes:**
- `bg-accent-primary`, `text-accent-primary`, `border-accent-primary`
- `bg-accent-primary-dim`, `text-accent-primary-dim`
- `bg-accent-secondary`, `text-accent-secondary`
- `bg-accent-tertiary`, `text-accent-tertiary`

**Example:**
```jsx
<button className="bg-accent-primary text-white px-4 py-2 rounded-lg hover:opacity-90">
  Primary Action
</button>

<div className="bg-accent-primary-dim border border-accent-primary p-3 rounded">
  <p className="text-accent-primary">Highlighted content</p>
</div>
```

#### 4. Semantic Colors (Status)

```css
/* Usage: Success, error, warning, info states */
--semantic-success      /* Success states (green) */
--semantic-success-dim  /* Dimmed success background */
--semantic-error        /* Error states (red) */
--semantic-error-dim    /* Dimmed error background */
--semantic-warning      /* Warning states (yellow/orange) */
--semantic-warning-dim  /* Dimmed warning background */
--semantic-info         /* Info states (blue) */
--semantic-info-dim     /* Dimmed info background */
```

**Tailwind Classes:**
- `text-semantic-success`, `bg-semantic-success`, `border-semantic-success`
- `bg-semantic-success-dim`
- (Same pattern for error, warning, info)

**Example:**
```jsx
/* Success message */
<div className="bg-semantic-success-dim border border-semantic-success rounded-lg p-3">
  <p className="text-semantic-success">✓ Task completed successfully</p>
</div>

/* Error message */
<div className="bg-semantic-error-dim border border-semantic-error rounded-lg p-3">
  <p className="text-semantic-error">✗ Failed to save changes</p>
</div>

/* Warning alert */
<div className="bg-semantic-warning-dim border border-semantic-warning rounded-lg p-3">
  <p className="text-semantic-warning">⚠ Action required</p>
</div>
```

#### 5. Line/Border Colors

```css
/* Usage: Borders, dividers, separators */
--line-default  /* Default borders */
--line-subtle   /* Subtle dividers */
--line-strong   /* Emphasized borders */
```

**Tailwind Classes:**
- `border-line-default`
- `border-line-subtle`
- `border-line-strong`
- `divide-line-subtle` (for divide-y/divide-x)

**Example:**
```jsx
<div className="border border-line-default rounded-lg">
  <div className="p-4 border-b border-line-subtle">Header</div>
  <div className="p-4">Content</div>
</div>

<div className="divide-y divide-line-subtle">
  <div className="p-3">Item 1</div>
  <div className="p-3">Item 2</div>
</div>
```

---

## Component Patterns

### Pattern 1: Card Component

```jsx
// ✅ GOOD - Theme-aware card
export function Card({ children, className = '' }) {
  return (
    <div className={`
      bg-surface
      border border-line-default
      rounded-lg
      p-4
      hover:border-accent-primary
      transition-colors
      ${className}
    `}>
      {children}
    </div>
  );
}

// ❌ BAD - Hard-coded colors
export function Card({ children }) {
  return (
    <div className="bg-white border-gray-200 rounded-lg p-4">
      {children}
    </div>
  );
}
```

### Pattern 2: Button Component

```jsx
// ✅ GOOD - Semantic button variants
export function Button({ variant = 'primary', children }) {
  const variants = {
    primary: 'bg-accent-primary text-white hover:opacity-90',
    secondary: 'bg-surface-muted text-content-primary hover:bg-surface-elevated border border-line-default',
    success: 'bg-semantic-success text-white hover:opacity-90',
    error: 'bg-semantic-error text-white hover:opacity-90'
  };

  return (
    <button className={`px-4 py-2 rounded-lg transition-all ${variants[variant]}`}>
      {children}
    </button>
  );
}

// ❌ BAD - Hard-coded colors
export function Button({ children }) {
  return (
    <button className="bg-blue-500 text-white px-4 py-2 rounded-lg">
      {children}
    </button>
  );
}
```

### Pattern 3: Badge Component

```jsx
// ✅ GOOD - Status-based badges
export function Badge({ status, children }) {
  const statusStyles = {
    success: 'bg-semantic-success-dim text-semantic-success border-semantic-success',
    error: 'bg-semantic-error-dim text-semantic-error border-semantic-error',
    warning: 'bg-semantic-warning-dim text-semantic-warning border-semantic-warning',
    info: 'bg-semantic-info-dim text-semantic-info border-semantic-info',
    neutral: 'bg-surface-muted text-content-secondary border-line-default'
  };

  return (
    <span className={`px-2 py-1 text-xs font-medium rounded border ${statusStyles[status]}`}>
      {children}
    </span>
  );
}

// Usage
<Badge status="success">Completed</Badge>
<Badge status="error">Failed</Badge>
<Badge status="warning">Pending</Badge>
```

### Pattern 4: Alert/Banner Component

```jsx
// ✅ GOOD - Semantic alert types
export function Alert({ type = 'info', children }) {
  const types = {
    success: {
      bg: 'bg-semantic-success-dim',
      border: 'border-semantic-success',
      text: 'text-semantic-success',
      icon: '✓'
    },
    error: {
      bg: 'bg-semantic-error-dim',
      border: 'border-semantic-error',
      text: 'text-semantic-error',
      icon: '✗'
    },
    warning: {
      bg: 'bg-semantic-warning-dim',
      border: 'border-semantic-warning',
      text: 'text-semantic-warning',
      icon: '⚠'
    },
    info: {
      bg: 'bg-semantic-info-dim',
      border: 'border-semantic-info',
      text: 'text-semantic-info',
      icon: 'ℹ'
    }
  };

  const style = types[type];

  return (
    <div className={`${style.bg} border ${style.border} rounded-lg p-4`}>
      <p className={`${style.text} flex items-center gap-2`}>
        <span>{style.icon}</span>
        {children}
      </p>
    </div>
  );
}
```

### Pattern 5: Input Component

```jsx
// ✅ GOOD - Accessible form input
export function Input({ label, error, ...props }) {
  return (
    <div>
      {label && (
        <label className="block text-sm font-medium text-content-primary mb-1">
          {label}
        </label>
      )}
      <input
        className={`
          w-full px-3 py-2
          bg-surface border rounded-lg
          text-content-primary
          placeholder:text-content-tertiary
          focus:outline-none focus:ring-2 focus:ring-accent-primary
          ${error ? 'border-semantic-error' : 'border-line-default'}
        `}
        {...props}
      />
      {error && (
        <p className="text-semantic-error text-xs mt-1">{error}</p>
      )}
    </div>
  );
}

// ❌ BAD - Hard-coded colors and no focus state
export function Input(props) {
  return (
    <input className="border-gray-300 rounded px-3 py-2" {...props} />
  );
}
```

---

## Intelligence Component Examples

### AgentRecommendationPanel

```jsx
export default function AgentRecommendationPanel({ recommendations }) {
  return (
    <div className="bg-accent-primary-dim border border-accent-primary rounded-lg p-4">
      <div className="flex items-center gap-2 mb-4">
        <Sparkles className="w-5 h-5 text-accent-primary" />
        <h3 className="font-semibold text-accent-primary">AI Recommendations</h3>
      </div>

      {/* Confidence badge */}
      <span className={`
        px-2 py-1 text-xs font-medium rounded
        ${confidence >= 0.8 ? 'bg-semantic-success-dim text-semantic-success' :
          confidence >= 0.6 ? 'bg-semantic-warning-dim text-semantic-warning' :
          'bg-semantic-error-dim text-semantic-error'}
      `}>
        {(confidence * 100).toFixed(0)}% Confidence
      </span>
    </div>
  );
}
```

### RiskFactorBreakdown

```jsx
export default function RiskFactorBreakdown({ factors }) {
  const getImpactColor = (impact) => {
    switch (impact) {
      case 'high': return 'bg-semantic-error text-semantic-error border-semantic-error';
      case 'medium': return 'bg-semantic-warning text-semantic-warning border-semantic-warning';
      case 'low': return 'bg-semantic-success text-semantic-success border-semantic-success';
    }
  };

  return factors.map((factor, index) => (
    <div key={index} className={`${getImpactColor(factor.impact).split(' ')[0]}-dim border rounded-lg p-3`}>
      <div className="flex items-center justify-between mb-2">
        <span className="text-sm font-medium text-content-primary">{factor.factor}</span>
        <span className={`text-xs font-semibold ${getImpactColor(factor.impact).split(' ')[1]}`}>
          {factor.impact.toUpperCase()}
        </span>
      </div>

      {/* Progress bar */}
      <div className="w-full h-2 bg-surface rounded-full overflow-hidden">
        <div
          className={`h-full rounded-full ${getImpactColor(factor.impact).split(' ')[1].replace('text', 'bg')}`}
          style={{ width: `${factor.score}%` }}
        />
      </div>
    </div>
  ));
}
```

---

## Migration Guide

### Migrating Existing Components

**Before:**
```jsx
<div className="bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700">
  <h2 className="text-gray-900 dark:text-gray-100">Title</h2>
  <p className="text-gray-600 dark:text-gray-400">Description</p>
</div>
```

**After:**
```jsx
<div className="bg-surface border-line-default">
  <h2 className="text-content-primary">Title</h2>
  <p className="text-content-secondary">Description</p>
</div>
```

### Common Replacements

| Old (Hard-coded) | New (Semantic) |
|------------------|----------------|
| `bg-white dark:bg-gray-800` | `bg-surface` |
| `text-gray-900 dark:text-gray-100` | `text-content-primary` |
| `text-gray-600 dark:text-gray-400` | `text-content-secondary` |
| `text-gray-500 dark:text-gray-500` | `text-content-tertiary` |
| `border-gray-200 dark:border-gray-700` | `border-line-default` |
| `bg-blue-500` | `bg-accent-primary` |
| `text-green-600` | `text-semantic-success` |
| `bg-red-50` | `bg-semantic-error-dim` |
| `text-yellow-600` | `text-semantic-warning` |

---

## Intentional Color Preservation

Some colors should **NOT** be replaced with CSS variables:

### 1. Star Ratings
```jsx
// ✅ KEEP - Amber is universally understood for ratings
<Star className="text-amber-400 fill-amber-400" />
```

### 2. Progress Bars (Data Visualization)
```jsx
// ✅ KEEP - Red/yellow/green traffic light pattern
<div className={`h-full ${
  score >= 75 ? 'bg-green-500' :
  score >= 50 ? 'bg-amber-500' :
  'bg-red-500'
}`} />
```

### 3. Specific Brand Colors (When Intentional)
```jsx
// ✅ KEEP - Displaying specific app branding
<div className="bg-[#00D632]">Slack integration active</div>
```

---

## Accessibility Requirements

### Contrast Ratios

All text must meet WCAG AA standards:

- **Normal text (< 18px):** 4.5:1 minimum
- **Large text (≥ 18px or 14px bold):** 3:1 minimum
- **UI components:** 3:1 minimum

### Testing Contrast

```javascript
// Use browser DevTools or:
// https://webaim.org/resources/contrastchecker/

// Example checks:
// text-content-primary on bg-surface: Must be ≥ 4.5:1
// text-content-secondary on bg-surface: Must be ≥ 4.5:1
// bg-accent-primary text on white: Must be ≥ 4.5:1
```

### Focus Indicators

All interactive elements must have visible focus states:

```jsx
// ✅ GOOD - Visible focus ring
<button className="focus:outline-none focus:ring-2 focus:ring-accent-primary">
  Click me
</button>

// ❌ BAD - No focus indicator
<button className="outline-none">
  Click me
</button>
```

---

## Theme-Specific Considerations

### Radius Values

Different themes have different border radius preferences:

- **Monolith / Neon District:** 0px (sharp edges)
- **Blueprint:** 4px (subtle rounding)
- **Synapse / Aurora:** 12px (moderate rounding)
- **Pastel Zen / Playground:** 20-24px (soft rounding)

**Solution:** Use Tailwind's responsive radius classes:
```jsx
// Good - Uses theme-defined radius
<div className="rounded-lg">Card</div>

// Bad - Hard-coded radius
<div className="rounded-[12px]">Card</div>
```

### Shadow Styles

Themes define different shadow personalities:

- **Monolith:** Hard shadows (4px 4px 0 #000)
- **Blueprint:** Hard shadows for technical feel
- **Synapse:** Glow effects (0 0 24px rgba(139,92,246,0.3))
- **Pastel Zen:** Subtle soft shadows

**Solution:** Use semantic shadow classes from Tailwind config

---

## Best Practices Summary

### ✅ DO

1. Always use CSS variable-based color classes
2. Use semantic token names (content, surface, accent, semantic)
3. Test components in multiple themes (light/dark)
4. Ensure 4.5:1 contrast ratio for text
5. Include visible focus indicators
6. Use intentional colors for data visualization
7. Follow component patterns from this guide

### ❌ DON'T

1. Hard-code color values (bg-blue-500, text-gray-900)
2. Use dark mode variants (dark:bg-gray-800)
3. Skip accessibility testing
4. Remove focus indicators
5. Use color alone to convey information
6. Create theme-specific components

---

## Questions & Support

For questions about the theme system or component development:
- Review this guide
- Check existing component examples in `frontend/src/components/intelligence/`
- Test in multiple themes before submitting PR
- Ask in #frontend-dev Slack channel
