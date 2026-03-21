# Entomate Section — Void × Crimson Transformation

Audit and apply the Void × Crimson design system to the section named in `$ARGUMENTS`.

**Target section:** $ARGUMENTS

---

## Your Role

You are a senior frontend designer performing a **purely visual/UX transformation** on the named Entomate section. You will:

1. Read every CSS file owned by the target section
2. Optionally read 1–2 JSX/TSX files to understand class names (read-only — no logic edits)
3. Rewrite only the CSS files to apply the Void × Crimson design system below
4. Leave all TypeScript/JavaScript, hooks, services, state, and logic completely untouched

---

## Design System — Void × Crimson

### Palette Reference

| Token | Dark value | Light value | Purpose |
|-------|-----------|-------------|---------|
| Electric Crimson | `#FF2D6B` | `#CC0044` | Primary actions, CTAs, active states |
| Neon Mint | `#00F5D4` | `#00B89E` | Success, data validation, positive states |
| Amber | `#FFB800` | `#CC9200` | AI indicators, warnings, special state |
| Pure Void | `#080808` | — | Dark canvas background |
| Abyss | `#101010` | — | Dark surface base |
| Elevated | `#181818` | — | Raised cards, panels |
| Rose Tint | — | `#FFF8FA` | Light canvas background |
| Off-white | — | `#FFFFFF` | Light surface base |

---

### CSS Token Pattern

Add this token block at the very top of the section's primary CSS file. Replace `[prefix]` with a short section-specific identifier (e.g. `meet`, `tasks`, `wflow`, `dash`).

```css
/* ============================================================
   [SECTION NAME] — DESIGN TOKENS
   Void × Crimson · Electric Crimson System
   ============================================================ */

:root {
  --[prefix]-bg:             #FFF8FA;
  --[prefix]-surface:        #FFFFFF;
  --[prefix]-surface-raised: #F5F0F2;
  --[prefix]-border:         rgba(0, 0, 0, 0.08);
  --[prefix]-primary:        #CC0044;
  --[prefix]-primary-alt:    #FF2D6B;
  --[prefix]-primary-soft:   rgba(204, 0, 68, 0.10);
  --[prefix]-primary-softer: rgba(204, 0, 68, 0.05);
  --[prefix]-primary-glow:   rgba(204, 0, 68, 0.25);
  --[prefix]-secondary:      #00B89E;
  --[prefix]-tertiary:       #CC9200;
  --[prefix]-text-main:      #0F0608;
  --[prefix]-text-secondary: #4A3040;
  --[prefix]-text-muted:     #7A6070;
  --[prefix]-shadow-sm:      0 1px 3px rgba(0, 0, 0, 0.06);
  --[prefix]-shadow-md:      0 4px 12px rgba(0, 0, 0, 0.08);
  --[prefix]-shadow-crimson: 0 0 0 1px var(--[prefix]-primary),
                             0 4px 24px var(--[prefix]-primary-glow);
}

.dark {
  --[prefix]-bg:             #080808;
  --[prefix]-surface:        #101010;
  --[prefix]-surface-raised: #181818;
  --[prefix]-border:         rgba(255, 255, 255, 0.06);
  --[prefix]-border-raised:  rgba(255, 255, 255, 0.09);
  --[prefix]-primary:        #FF2D6B;
  --[prefix]-primary-alt:    #FF5585;
  --[prefix]-primary-soft:   rgba(255, 45, 107, 0.10);
  --[prefix]-primary-softer: rgba(255, 45, 107, 0.05);
  --[prefix]-primary-glow:   rgba(255, 45, 107, 0.30);
  --[prefix]-secondary:      #00F5D4;
  --[prefix]-tertiary:       #FFB800;
  --[prefix]-text-main:      #F8F0F3;
  --[prefix]-text-secondary: #C8AAB8;
  --[prefix]-text-muted:     #7A6070;
  --[prefix]-shadow-sm:      0 1px 4px rgba(0, 0, 0, 0.50);
  --[prefix]-shadow-md:      0 4px 16px rgba(0, 0, 0, 0.60);
  --[prefix]-shadow-crimson: 0 0 0 1px var(--[prefix]-primary),
                             0 4px 24px var(--[prefix]-primary-glow);
}
```

---

### Canvas & Surfaces

| Context | Dark | Light |
|---------|------|-------|
| Page background | `#080808` | `#FFF8FA` |
| Header/toolbar | `#101010` | `#FFFFFF` |
| Card / list item (rest) | `#101010` | `#FFFFFF` |
| Card / list item (hover) | `#181818` | `rgba(255, 45, 107, 0.02)` |
| Card / list item (active) | `rgba(255, 45, 107, 0.06)` | `rgba(204, 0, 68, 0.04)` |
| Default border | `rgba(255, 255, 255, 0.06)` | `rgba(0, 0, 0, 0.08)` |
| Raised border | `rgba(255, 255, 255, 0.09)` | `rgba(0, 0, 0, 0.12)` |

**Dark mode surfaces MUST be opaque hex** — use `#101010`, `#181818`, `#222022` (not translucent rgba). The Void × Crimson dark palette is solid ink-black, not frosted glass.

---

### Crimson Accent Budget — Rule of 4

**Maximum 4 crimson-colored elements visible on screen at one time.** Prioritize:
1. Active / selected left border (`border-left: 2px solid var(--[prefix]-primary)`)
2. Focus glow ring on the primary interactive input
3. Primary CTA button
4. Live/active status indicator or AI badge

Everything else — inactive icons, timestamps, secondary badges — uses `--[prefix]-text-muted` or `--[prefix]-text-secondary`.

**Left border continuity rule:** List items that can be active MUST have `2px solid transparent` at rest. Hover shows `rgba(255, 45, 107, 0.25)`. Active/selected shows `#FF2D6B` (dark) / `#CC0044` (light).

```css
.list-item {
  border-left: 2px solid transparent;
  transition: border-color 150ms cubic-bezier(0.16, 1, 0.3, 1),
              background   150ms cubic-bezier(0.16, 1, 0.3, 1);
}
.list-item:hover {
  border-left-color: rgba(255, 45, 107, 0.25);
  background: var(--[prefix]-surface-raised);
}
.list-item.active {
  border-left-color: var(--[prefix]-primary);
  background: var(--[prefix]-primary-softer);
}
```

---

### Typography Hierarchy

| Role | Size | Weight | Color | Letter-spacing |
|------|------|--------|-------|----------------|
| Section title / hero h1 | 28px | 700 | `--[prefix]-text-main` | −0.02em |
| Panel / column header | 16px | 600 | `--[prefix]-text-main` | −0.02em |
| Item / card title | 15px | 600 | `--[prefix]-text-main` | −0.01em |
| Emphasis / own name | 14px | 600 | `var(--[prefix]-primary)` | −0.01em |
| Body text | 15px | 400 | `--[prefix]-text-main` | 0 |
| Preview / snippet | 13px | 400 | `--[prefix]-text-muted` | 0 |
| Metadata / timestamps | 11px | 400 | `--[prefix]-text-muted` | 0 |
| Section labels / dividers | 9px | 700 | `--[prefix]-text-muted` | 0.12em, uppercase |
| AI indicator label | 11px | 600 | `var(--[prefix]-tertiary)` | 0.06em, uppercase |
| Badges / counts | 10px | 700 | white on `var(--[prefix]-primary)` | 0 |
| Input placeholder | 15px | 400 | `--[prefix]-text-muted` | −0.01em |

**Display headings:** `'Syne', var(--font-display, sans-serif)` — section titles, panel headers, modal titles
**Body text:** `'Space Grotesk', var(--font-body, system-ui, sans-serif)` — all other text
**Code / shortcuts:** `'JetBrains Mono', 'Courier New', monospace`

---

### Easing & Timing

| Use | Value |
|-----|-------|
| Enter / appear | `cubic-bezier(0.16, 1, 0.3, 1)` — spring decelerate |
| State transitions (hover, toggle) | `cubic-bezier(0.4, 0, 0.2, 1)` — standard |
| Hover response | `150ms` |
| Card / item entry duration | `220ms` |
| Focus heartbeat | `500ms`, single-fire, `cubic-bezier(0.16, 1, 0.3, 1)` |
| Exit / close | `150ms`, `cubic-bezier(0.4, 0, 1, 1)` |

---

### Focus Heartbeat — Compositor-Safe Pattern

```css
/* Static box-shadow on ::after — never animate box-shadow itself */
.my-input-container {
  position: relative;
}
.my-input-container::after {
  content: '';
  position: absolute;
  inset: -4px;
  border-radius: calc(var(--radius-md, 8px) + 4px);
  box-shadow:
    0 0 0 3px rgba(255, 45, 107, 0.12),
    0 0 24px rgba(255, 45, 107, 0.20);
  opacity: 0;
  pointer-events: none;
  will-change: opacity;    /* Only opacity changes — GPU composited */
  transition: opacity 0.2s ease;
}

/* Steady glow while focused */
.my-input-container:focus-within::after {
  opacity: 0.5;
}

/* Single-fire heartbeat — JS adds/removes this class on first focus */
.my-input-container.heartbeat-active::after {
  animation: [prefix]Heartbeat 0.5s cubic-bezier(0.16, 1, 0.3, 1) forwards;
}

@keyframes [prefix]Heartbeat {
  0%   { opacity: 0;   }
  35%  { opacity: 1;   }
  100% { opacity: 0.5; }
}
```

**JS trigger (add to existing onFocus handler — do NOT create new handlers):**
```js
containerRef.current?.classList.add('heartbeat-active');
containerRef.current?.addEventListener('animationend', () => {
  containerRef.current?.classList.remove('heartbeat-active');
}, { once: true });
```

---

### List Item Stagger Animation

```css
@keyframes [prefix]Enter {
  from { opacity: 0; transform: translateX(-8px); }
  to   { opacity: 1; transform: translateX(0); }
}

.list-container .list-item {
  animation: [prefix]Enter 0.22s cubic-bezier(0.16, 1, 0.3, 1) both;
  will-change: transform, opacity;
}

/* 35ms stagger — first 5 items only */
.list-container .list-item:nth-child(1) { animation-delay:   0ms; }
.list-container .list-item:nth-child(2) { animation-delay:  35ms; }
.list-container .list-item:nth-child(3) { animation-delay:  70ms; }
.list-container .list-item:nth-child(4) { animation-delay: 105ms; }
.list-container .list-item:nth-child(5) { animation-delay: 140ms; }

/* Items beyond 5: no animation overhead */
.list-container .list-item:nth-child(n+6) {
  animation: none;
  will-change: auto;
}
```

---

### Glass Dropdown / Popover

```css
.my-dropdown {
  background: rgba(255, 248, 250, 0.97);
  -webkit-backdrop-filter: blur(24px) saturate(160%);
          backdrop-filter: blur(24px) saturate(160%);
  border: 1px solid rgba(255, 45, 107, 0.15);
  border-radius: 12px;
  box-shadow:
    0 12px 32px rgba(0, 0, 0, 0.10),
    0 0 0 1px rgba(255, 45, 107, 0.04) inset;
}

.dark .my-dropdown {
  background: rgba(16, 16, 16, 0.96);
  -webkit-backdrop-filter: blur(24px) saturate(160%);
          backdrop-filter: blur(24px) saturate(160%);
  border: 1px solid rgba(255, 255, 255, 0.07);
  box-shadow:
    0 12px 40px rgba(0, 0, 0, 0.75),
    0 0 0 1px rgba(255, 45, 107, 0.06) inset;
}

/* Dropdown header */
.my-dropdown-header {
  background: linear-gradient(135deg,
    rgba(255, 45, 107, 0.06) 0%,
    rgba(0, 245, 212, 0.04) 100%);
  border-bottom: 1px solid rgba(255, 45, 107, 0.12);
}
.dark .my-dropdown-header {
  background: rgba(255, 45, 107, 0.04);
  border-bottom-color: rgba(255, 255, 255, 0.06);
}

/* Selected item in dropdown */
.my-dropdown-item.selected {
  background: linear-gradient(90deg,
    rgba(255, 45, 107, 0.10) 0%,
    rgba(255, 45, 107, 0.05) 100%);
  border-left: 2px solid var(--[prefix]-primary);
}
```

---

### Scrollbar — Crimson Thumb

```css
.scrollable-area {
  scrollbar-width: thin;
  scrollbar-color: rgba(255, 45, 107, 0.20) transparent;
}
.scrollable-area::-webkit-scrollbar       { width: 4px; }
.scrollable-area::-webkit-scrollbar-track { background: transparent; margin: 8px 0; }
.scrollable-area::-webkit-scrollbar-thumb {
  background: rgba(255, 45, 107, 0.20);
  border-radius: 2px;
}
.scrollable-area::-webkit-scrollbar-thumb:hover {
  background: rgba(255, 45, 107, 0.45);
}
```

---

### Primary CTA Button

```css
.cta-button {
  background: var(--[prefix]-primary);
  border: none;
  color: white;
  border-radius: var(--radius-md, 8px);
  box-shadow: 0 4px 12px var(--[prefix]-primary-glow);
  transition: all 150ms cubic-bezier(0.16, 1, 0.3, 1);
  font-family: 'Space Grotesk', system-ui, sans-serif;
  font-weight: 600;
}
.cta-button:hover {
  transform: translateY(-1px);
  box-shadow: 0 6px 20px var(--[prefix]-primary-glow);
  filter: brightness(1.08);
}
.cta-button:active  { transform: scale(0.96); }
.cta-button:disabled {
  opacity: 0.4;
  cursor: not-allowed;
  transform: none;
  box-shadow: none;
  filter: none;
}
```

### Secondary / Ghost Button

```css
.ghost-button {
  background: transparent;
  border: 1px solid var(--[prefix]-border);
  color: var(--[prefix]-text-secondary);
  border-radius: var(--radius-md, 8px);
  transition: all 150ms cubic-bezier(0.16, 1, 0.3, 1);
}
.ghost-button:hover {
  background: var(--[prefix]-primary-softer);
  border-color: rgba(255, 45, 107, 0.30);
  color: var(--[prefix]-primary);
}
```

---

### Badges & Counts

```css
.unread-badge {
  background: var(--[prefix]-primary);
  color: white;
  font-size: 10px;
  font-weight: 700;
  border-radius: 10px;
  padding: 2px 6px;
  min-width: 18px;
  text-align: center;
  box-shadow: 0 0 8px var(--[prefix]-primary-glow);
}

/* Mint badge — success / data */
.success-badge {
  background: rgba(0, 245, 212, 0.12);
  color: var(--[prefix]-secondary);
  border: 1px solid rgba(0, 245, 212, 0.25);
  font-size: 10px;
  font-weight: 600;
  border-radius: 6px;
  padding: 2px 6px;
}

/* Amber badge — AI generated / in-progress */
.ai-badge {
  background: rgba(255, 184, 0, 0.12);
  color: var(--[prefix]-tertiary);
  border: 1px solid rgba(255, 184, 0, 0.25);
  font-size: 10px;
  font-weight: 600;
  border-radius: 6px;
  padding: 2px 6px;
}
```

---

### Date / Section Dividers

```css
.date-divider {
  display: flex;
  align-items: center;
  gap: 12px;
  margin: 16px 0;
  font-family: 'Syne', var(--font-display, sans-serif);
  font-size: 9px;
  font-weight: 700;
  letter-spacing: 0.12em;
  text-transform: uppercase;
  color: var(--[prefix]-text-muted);
  -webkit-user-select: none;
  user-select: none;
}
.date-divider::before,
.date-divider::after {
  content: '';
  flex: 1;
  height: 1px;
}
.date-divider::before { background: var(--[prefix]-border); }
.date-divider::after  { background: var(--[prefix]-border); }
```

---

### AI / Special State

AI-specific accents use **Amber** `#FFB800` (dark) / `#CC9200` (light) — not crimson. This is reserved for AI-generated content labels, AI toggle buttons, and processing indicators. Do not replace amber with crimson in AI contexts.

```css
/* AI state indicator */
.ai-active-indicator {
  color: var(--[prefix]-tertiary);
  border-color: rgba(255, 184, 0, 0.35);
  background: rgba(255, 184, 0, 0.08);
}

/* AI processing pulse — opacity-only, GPU safe */
.ai-processing-dot {
  background: var(--[prefix]-tertiary);
  box-shadow: 0 0 8px rgba(255, 184, 0, 0.50);
  will-change: opacity;
  animation: aiPulse 1.4s ease-in-out infinite alternate;
}

@keyframes aiPulse {
  from { opacity: 1;   }
  to   { opacity: 0.4; }
}
```

---

### Accessibility

```css
/* Crimson focus ring — replaces browser default */
*:focus-visible {
  outline: 2px solid var(--accent-primary, #FF2D6B);
  outline-offset: 2px;
  border-radius: 4px;
}
*:focus:not(:focus-visible) { outline: none; }

/* Reduced motion */
@media (prefers-reduced-motion: reduce) {
  *,
  *::before,
  *::after {
    animation-duration: 0.01ms !important;
    animation-iteration-count: 1 !important;
    transition-duration: 0.01ms !important;
  }
}
```

---

## Implementation Steps

Follow these steps for every section:

1. **Read** the section's CSS file(s) and 1–2 JSX/TSX files (read-only) to map existing class names
2. **Add** the `--[prefix]-*` token block at the top of the primary CSS file
3. **Add** the `[prefix]Heartbeat` and `[prefix]Enter` keyframes
4. **Update** all dark surfaces: remove translucent rgba → solid opaque hex (`#101010`, `#181818`)
5. **Replace** any blue (`#3b82f6`, `#60a5fa`) or rose (`#f43f5e`, `#ec4899`) accents with `var(--[prefix]-primary)`
6. **Apply** the `::after` heartbeat glow to the section's primary interactive input
7. **Apply** `translateX(-8px)` stagger to list items (first 5, 35ms apart)
8. **Verify** crimson budget: count visible crimson elements — must be ≤ 4
9. **Update** all scrollbar styles to 4px crimson thumb pattern
10. **Update** all dark-mode selectors from hardcoded hex to token variables
11. **Update** typography: display headings → Syne, body → Space Grotesk
12. **Replace** purple `#8B5CF6` AI indicators with amber `var(--[prefix]-tertiary)`
13. **Test** both dark and light mode mentally — no hard-coded color values should remain

---

## What NOT to Change

- **No JSX/TSX edits** — zero changes to component logic, hooks, props, or state
- **No amber `#FFB800` replacement** in AI contexts — AI keeps amber
- **No structural changes** — don't add or remove DOM structure via CSS
- **No new CSS classes** — only update existing selectors. If a new class is needed for a keyframe target, prefix it with `[prefix]-`
- **No translucent surfaces in dark mode** — Void × Crimson uses solid ink surfaces, not glass

---

## Verification Checklist

After implementing, mentally verify:

- [ ] Dark mode: `#080808` Pure Void canvas (not dark gray or semi-transparent black)
- [ ] Surfaces: solid opaque hex in dark mode (`#101010`, `#181818`)
- [ ] Light mode: `#FFF8FA` rose-tinted canvas
- [ ] Crimson budget: ≤ 4 crimson elements visible simultaneously
- [ ] Active/selected items: crimson left border `2px solid var(--[prefix]-primary)`
- [ ] Focus: heartbeat animation fires once, settles to steady crimson glow
- [ ] List entry: stagger animation uses `translateX(-8px)` slide on first 5 items
- [ ] Typography: section labels use Syne 9px uppercase, body uses Space Grotesk
- [ ] Timestamps and metadata: 11px, `--[prefix]-text-muted`
- [ ] Scrollbars: 4px crimson thumb with hover brightening
- [ ] Dropdowns/popovers: dark glass treatment with crimson border tint
- [ ] AI elements (if present): amber `#FFB800` — not crimson
- [ ] Success/data elements: mint `#00F5D4` — not crimson
- [ ] No inline styles added to JSX/TSX
- [ ] `-webkit-backdrop-filter` prefix present alongside `backdrop-filter`
- [ ] `-webkit-user-select` prefix present alongside `user-select`
- [ ] `@media (prefers-reduced-motion)` block present
