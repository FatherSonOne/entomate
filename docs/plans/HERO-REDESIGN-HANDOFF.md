# Entomate Hero Section — Redesign Handoff

## Current State (Stable)
- Hero image (`/brand/hero-hands.png`) renders as a **static background-image** with rounded corners
- Badge dot has a working opacity pulse animation
- Border glow has a working opacity breathe animation (20s cycle)
- Workflow nodes (meeting_ended, Priority Agent, Slack + CRM) are static
- Logo updated to use the app's `<Logo>` component (Circuit E mark + gradient wordmark)
- All scan line, energy pulse, and overlay CSS is present but the elements are removed from JSX

## The Problem
**Any CSS animation applied to or near the hero-hands.png image causes visible shaking/flickering/vibrating.** This occurs regardless of animation technique.

## What Was Tested (All Caused Shaking)

| Approach | Result |
|----------|--------|
| `transform: translateY()` on `<img>` element | Shaking |
| `transform: translate3d()` on `<img>` element | Shaking |
| Animation on `.hero-hands-img` container (with `overflow:hidden` + `border-radius`) | Shaking |
| Animation on `.hero-hands-img` container (WITHOUT `overflow:hidden` or `border-radius`) | Shaking |
| Animation on parent `.hero-visual` container | Shaking |
| Replacing `<img>` with `background-image` and animating that div | Shaking |
| Animating sibling elements (workflow nodes with `translate3d`) | Shaking |
| Animating overlay divs positioned above the image | Shaking |
| Removing `overflow: hidden` from `.hero` section | Still shaking |
| Removing aurora blobs (`filter: blur(80px)`) entirely | Still shaking |
| Removing `mix-blend-mode: lighten` | Did not fix shaking |
| Removing `border-radius` + `overflow: hidden` | Did not fix shaking |
| Adding `isolation: isolate` compositing boundaries | Did not fix shaking |
| Adding `will-change: transform` | Did not fix shaking |
| Using `translate3d` for GPU compositing | Did not fix shaking |

## What Works Without Shaking
- **Opacity-only** animations on elements **not overlapping** the image (badge dot, border glow)
- Completely static hero image with no animations anywhere near it

## What Does NOT Work
- ANY `transform` animation on any element in the hero visual area
- Even pure `translate3d` on elements with no clipping, no blend modes, no filters

## Root Causes Identified and Fixed Along the Way

These were real issues discovered and fixed, even though they weren't the final root cause:

1. **SMIL `<animate>` elements** — ~30 SVG SMIL animations were running on the CPU main thread. All removed and replaced with CSS.
2. **`mix-blend-mode: lighten`** — Forces re-compositing against backdrop on every frame. Removed.
3. **`backdrop-filter: blur()`** on workflow nodes — Prevents GPU compositing entirely. Replaced with solid backgrounds.
4. **`box-shadow` in keyframes** — Not GPU-composited, triggers paint per frame. Removed from all keyframes.
5. **`scale()` on `filter: blur(80px)` elements** — Forces blur re-rasterization per frame. Removed scale from aurora drift.
6. **Rotating pseudo-element inside `overflow:hidden` + `border-radius`** — Catastrophic re-clipping per frame. Replaced with static gradient.
7. **Missing `transform` at intermediate keyframe stops** — Browser interpolates to `none`, causing snap-jumps. Fixed.
8. **Inline `<style>` tag** — 2200+ line style block inside JSX component re-evaluated on every React render.

## The Unsolved Mystery
Despite fixing all known compositing issues, **any transform animation in the hero visual area causes the hands image to shake**. This behavior is unusual and may be related to:

- The specific image file (1024x1024 PNG, 1MB)
- The rendering environment (Windows 11, specific GPU/driver)
- The combination of the massive inline `<style>` block + React StrictMode double-mounting
- A browser compositing bug triggered by the specific DOM structure

## Recommendations for Redesign

### Option A: SVG-Based Hero
Replace the PNG with an SVG illustration of the hands. SVG elements can be individually animated (fingers, energy arcs, circuit traces) without compositing layer issues.

### Option B: CSS/Canvas Animation
Build the hero visual entirely from CSS shapes, gradients, and canvas — no raster image at all. Maximum animation control.

### Option C: Video/Lottie
Use a pre-rendered animation (MP4 video or Lottie JSON) for the hero visual. The animation is baked in, so no CSS animation is needed. Can be generated with nano-banana (`--video` flag).

### Option D: Isolate the Image in an iframe
Extreme measure: render the animated hero in an `<iframe>` to completely isolate its compositing context from the rest of the page.

### Option E: Investigate the Environment
Test the current code on a different machine/browser. If it doesn't shake elsewhere, the issue is GPU/driver-specific and may be resolved by forcing software rendering or a different compositing strategy.

## Files Modified This Session
- `f:/entomate/frontend/src/pages/LandingPage.jsx` — All hero CSS and JSX changes
- Logo import added: `import { Logo } from '../components/Logo'`
- Nav header and footer logos replaced with `<Logo variant="mark" size="sm" withText={true} />`

## Working Animations (Keep These)
```css
/* Badge dot — opacity only, 4s */
@keyframes hero-dot-pulse {
  0%, 100% { opacity: 1; }
  50%      { opacity: 0.35; }
}

/* Border glow — opacity only, 20s */
@keyframes hero-border-breathe {
  0%, 100% { opacity: 0.7; }
  50%      { opacity: 1; }
}
```

## CSS Available but Unused (Elements Removed from JSX)
The following CSS rules exist in the file but their corresponding JSX elements have been removed. They can be deleted or re-enabled if the animation issue is resolved:
- `.hero-scanline` + `@keyframes hero-scan`
- `.hero-energy-pulse` + `@keyframes hero-energy`
- Aurora blob animation classes (currently static)
- All workflow node drift keyframes (removed)
