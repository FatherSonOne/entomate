# ENTOMATE — Component Asset Extraction
> Extracted from live playground DOM — 2026-03-21
> Use with: /rebuild-ui skill in a new Claude session

---

## SVG ASSETS

### SVG: 200x200_0 (from: Hero — Brand Identity)
Size: 200x200

```svg
<svg width="200" height="200" viewBox="0 0 200 200" fill="none" xmlns="http://www.w3.org/2000/svg" style="overflow:visible"> <!-- Outer orbital rings --> <circle cx="100" cy="100" r="90" stroke="rgba(0,245,212,0.12)" stroke-width="1" fill="none"></circle> <circle cx="100" cy="100" r="70" stroke="rgba(255,45,107,0.15)" stroke-width="1" fill="none"></circle> <!-- Neural mesh bg lines --> <line x1="30" y1="40" x2="170" y2="160" stroke="rgba(0,245,212,0.08)" stroke-width="1"></line> <line x1="170" y1="40" x2="30" y2="160" stroke="rgba(0,245,212,0.08)" stroke-width="1"></line> <line x1="100" y1="10" x2="100" y2="190" stroke="rgba(255,45,107,0.06)" stroke-width="1"></line> <line x1="10" y1="100" x2="190" y2="100" stroke="rgba(255,45,107,0.06)" stroke-width="1"></line> <!-- Left hand (geometric wireframe) --> <g id="hero-left-hand" style="transform-origin:80px 130px;animation:heroHandFloat 3s ease-in-out infinite"> <!-- Palm --> <rect x="52" y="115" width="40" height="30" rx="5" stroke="#FF2D6B" stroke-width="1.5" fill="rgba(255,45,107,0.06)"></rect> <!-- Thumb --> <rect x="40" y="122" width="14" height="10" rx="3" stroke="#FF2D6B" stroke-width="1.2" fill="rgba(255,45,107,0.04)"></rect> <!-- Index finger --> <rect x="55" y="90" width="9" height="26" rx="3" stroke="#FF2D6B" stroke-width="1.2" fill="rgba(255,45,107,0.04)"></rect> <!-- Middle finger --> <rect x="66" y="84" width="9" height="32" rx="3" stroke="#FF2D6B" stroke-width="1.5" fill="rgba(255,45,107,0.08)"></rect> <!-- Ring finger --> <rect x="77" y="88" width="9" height="28" rx="3" stroke="#FF2D6B" stroke-width="1.2" fill="rgba(255,45,107,0.04)"></rect> <!-- Pinky --> <rect x="88" y="96" width="7" height="20" rx="2.5" stroke="#FF2D6B" stroke-width="1" fill="rgba(255,45,107,0.04)"></rect> <!-- Circuit nodes on hand --> <circle cx="60" cy="110" r="2" fill="#FF2D6B" opacity="0.8" class="node-glow"></circle> <circle cx="75" cy="112" r="1.5" fill="#00F5D4" opacity="0.7"></circle> <line x1="60" y1="110" x2="75" y2="112" stroke="#FF2D6B" stroke-width="0.8" opacity="0.5" class="circuit-flow"></line> </g> <!-- Right hand (geometric wireframe, mirrored) --> <g id="hero-right-hand" style="transform-origin:120px 130px;animation:heroHandFloat 3s ease-in-out infinite;animation-delay:-1.5s"> <!-- Palm --> <rect x="108" y="115" width="40" height="30" rx="5" stroke="#00F5D4" stroke-width="1.5" fill="rgba(0,245,212,0.06)"></rect> <!-- Thumb --> <rect x="146" y="122" width="14" height="10" rx="3" stroke="#00F5D4" stroke-width="1.2" fill="rgba(0,245,212,0.04)"></rect> <!-- Index finger --> <rect x="136" y="90" width="9" height="26" rx="3" stroke="#00F5D4" stroke-width="1.2" fill="rgba(0,245,212,0.04)"></rect> <!-- Middle finger --> <rect x="125" y="84" width="9" height="32" rx="3" stroke="#00F5D4" stroke-width="1.5" fill="rgba(0,245,212,0.08)"></rect> <!-- Ring finger --> <rect x="114" y="88" width="9" height="28" rx="3" stroke="#00F5D4" stroke-width="1.2" fill="rgba(0,245,212,0.04)"></rect> <!-- Pinky --> <rect x="105" y="96" width="7" height="20" rx="2.5" stroke="#00F5D4" stroke-width="1" fill="rgba(0,245,212,0.04)"></rect> <!-- Circuit nodes on hand --> <circle cx="140" cy="110" r="2" fill="#00F5D4" opacity="0.8" class="node-glow" style="animation-delay:.6s"></circle> <circle cx="125" cy="112" r="1.5" fill="#FF2D6B" opacity="0.7"></circle> <line x1="140" y1="110" x2="125" y2="112" stroke="#00F5D4" stroke-width="0.8" opacity="0.5" class="circuit-flow" style="animation-delay:1s"></line> </g> <!-- Connection point between hands (circuit node at top) --> <circle cx="100" cy="80" r="6" fill="rgba(255,184,0,0.2)" stroke="#FFB800" stroke-width="1.5" class="node-glow" style="animation-delay:.3s"></circle> <circle cx="100" cy="80" r="3" fill="#FFB800"></circle> <!-- Lines from finger tips to center node --> <line x1="70" y1="84" x2="97" y2="82" stroke="#FF2D6B" stroke-width="0.8" stroke-dasharray="3 3" opacity="0.6" class="circuit-flow"></line> <line x1="130" y1="84" x2="103" y2="82" stroke="#00F5D4" stroke-width="0.8" stroke-dasharray="3 3" opacity="0.6" class="circuit-flow" style="animation-delay:.5s"></line> <!-- E letterform bars below node --> <line x1="78" y1="60" x2="122" y2="60" stroke="#FF2D6B" stroke-width="2" stroke-linecap="round"></line> <line x1="78" y1="68" x2="112" y2="68" stroke="#FF2D6B" stroke-width="1.5" stroke-linecap="round" opacity="0.7"></line> <line x1="78" y1="76" x2="122" y2="76" stroke="#FF2D6B" stroke-width="2" stroke-linecap="round"></line> <!-- Outer circuit dots --> <circle cx="100" cy="20" r="3" fill="none" stroke="#00F5D4" stroke-width="1" opacity="0.5"></circle> <circle cx="40" cy="60" r="2" fill="#FF2D6B" opacity="0.4" class="node-glow" style="animation-delay:1s"></circle> <circle cx="160" cy="60" r="2" fill="#00F5D4" opacity="0.4" class="node-glow" style="animation-delay:1.5s"></circle> <circle cx="40" cy="140" r="2" fill="#FFB800" opacity="0.4"></circle> <circle cx="160" cy="140" r="2" fill="#A0FF32" opacity="0.4"></circle> <!-- Mesh lines --> <line x1="100" y1="20" x2="40" y2="60" stroke="rgba(0,245,212,0.2)" stroke-width="0.8"></line> <line x1="100" y1="20" x2="160" y2="60" stroke="rgba(0,245,212,0.2)" stroke-width="0.8"></line> <line x1="40" y1="60" x2="40" y2="140" stroke="rgba(255,45,107,0.15)" stroke-width="0.8"></line> <line x1="160" y1="60" x2="160" y2="140" stroke="rgba(255,45,107,0.15)" stroke-width="0.8"></line> </svg>
```

### SVG: 96x96_1 (from: Logo & Brand Animations)
Size: 96x96

```svg
<svg class="hand-svg" width="96" height="96" viewBox="0 0 96 96" fill="none" xmlns="http://www.w3.org/2000/svg" style="filter:drop-shadow(0 0 12px rgba(255,45,107,0.5))"> <!-- Left hand --> <rect x="14" y="54" width="28" height="20" rx="4" stroke="#FF2D6B" stroke-width="1.5" fill="rgba(255,45,107,0.06)"></rect> <rect x="7" y="60" width="9" height="7" rx="2.5" stroke="#FF2D6B" stroke-width="1.2" fill="rgba(255,45,107,0.04)"></rect> <rect x="16" y="36" width="7" height="19" rx="2.5" stroke="#FF2D6B" stroke-width="1.2" fill="rgba(255,45,107,0.04)"></rect> <rect x="25" y="30" width="7" height="25" rx="2.5" stroke="#FF2D6B" stroke-width="1.5" fill="rgba(255,45,107,0.08)"></rect> <rect x="34" y="34" width="6" height="21" rx="2.5" stroke="#FF2D6B" stroke-width="1.2" fill="rgba(255,45,107,0.04)"></rect> <rect x="40" y="40" width="5" height="15" rx="2" stroke="#FF2D6B" stroke-width="1" fill="rgba(255,45,107,0.04)"></rect> <!-- Right hand (mirror) --> <rect x="54" y="54" width="28" height="20" rx="4" stroke="#00F5D4" stroke-width="1.5" fill="rgba(0,245,212,0.06)"></rect> <rect x="80" y="60" width="9" height="7" rx="2.5" stroke="#00F5D4" stroke-width="1.2" fill="rgba(0,245,212,0.04)"></rect> <rect x="73" y="36" width="7" height="19" rx="2.5" stroke="#00F5D4" stroke-width="1.2" fill="rgba(0,245,212,0.04)"></rect> <rect x="64" y="30" width="7" height="25" rx="2.5" stroke="#00F5D4" stroke-width="1.5" fill="rgba(0,245,212,0.08)"></rect> <rect x="56" y="34" width="6" height="21" rx="2.5" stroke="#00F5D4" stroke-width="1.2" fill="rgba(0,245,212,0.04)"></rect> <rect x="51" y="40" width="5" height="15" rx="2" stroke="#00F5D4" stroke-width="1" fill="rgba(0,245,212,0.04)"></rect> <!-- Connection node at top center --> <circle cx="48" cy="26" r="5" fill="rgba(255,184,0,0.2)" stroke="#FFB800" stroke-width="1.5"></circle> <circle cx="48" cy="26" r="2.5" fill="#FFB800" class="node-glow"></circle> <!-- Circuit lines from fingers to node --> <line x1="28" y1="30" x2="45" y2="28" stroke="#FF2D6B" stroke-width="0.8" stroke-dasharray="3 2" opacity="0.7" class="circuit-flow"></line> <line x1="68" y1="30" x2="51" y2="28" stroke="#00F5D4" stroke-width="0.8" stroke-dasharray="3 2" opacity="0.7" class="circuit-flow"></line> <!-- E-bar letterform above node --> <line x1="34" y1="12" x2="62" y2="12" stroke="#FF2D6B" stroke-width="2" stroke-linecap="round"></line> <line x1="34" y1="18" x2="56" y2="18" stroke="#FF2D6B" stroke-width="1.5" stroke-linecap="round" opacity="0.75"></line> <line x1="34" y1="24" x2="62" y2="24" stroke="#FF2D6B" stroke-width="2" stroke-linecap="round"></line> <!-- Side circuit nodes --> <circle cx="14" cy="50" r="2" fill="#FF2D6B" opacity="0.6" class="node-glow"></circle> <circle cx="82" cy="50" r="2" fill="#00F5D4" opacity="0.6" class="node-glow" style="animation-delay:.8s"></circle> <line x1="14" y1="50" x2="14" y2="62" stroke="#FF2D6B" stroke-width="0.8" opacity="0.4"></line> <line x1="82" y1="50" x2="82" y2="62" stroke="#00F5D4" stroke-width="0.8" opacity="0.4"></line> </svg>
```

### SVG: 32x32_2 (from: Logo & Brand Animations)
Size: 32x32

```svg
<svg class="hand-svg" width="32" height="32" viewBox="0 0 96 96" fill="none"> <rect x="14" y="54" width="28" height="20" rx="4" stroke="#FF2D6B" stroke-width="2" fill="rgba(255,45,107,0.1)"></rect> <rect x="54" y="54" width="28" height="20" rx="4" stroke="#00F5D4" stroke-width="2" fill="rgba(0,245,212,0.1)"></rect> <circle cx="48" cy="26" r="5" fill="#FFB800"></circle> <line x1="34" y1="12" x2="62" y2="12" stroke="#FF2D6B" stroke-width="3" stroke-linecap="round"></line> <line x1="34" y1="18" x2="56" y2="18" stroke="#FF2D6B" stroke-width="2.5" stroke-linecap="round"></line> <line x1="34" y1="24" x2="62" y2="24" stroke="#FF2D6B" stroke-width="3" stroke-linecap="round"></line> </svg>
```

### SVG: 36x36_3 (from: Logo & Brand Animations)
Size: 36x36

```svg
<svg width="36" height="36" viewBox="0 0 96 96" fill="none"> <rect x="14" y="54" width="28" height="20" rx="4" stroke="white" stroke-width="2" fill="rgba(255,255,255,0.15)"></rect> <rect x="54" y="54" width="28" height="20" rx="4" stroke="white" stroke-width="2" fill="rgba(255,255,255,0.1)"></rect> <circle cx="48" cy="26" r="4" fill="white"></circle> <line x1="34" y1="12" x2="62" y2="12" stroke="white" stroke-width="3" stroke-linecap="round"></line> <line x1="34" y1="18" x2="56" y2="18" stroke="white" stroke-width="2.5" stroke-linecap="round"></line> <line x1="34" y1="24" x2="62" y2="24" stroke="white" stroke-width="3" stroke-linecap="round"></line> </svg>
```

### SVG: 52x52_4 (from: Logo & Brand Animations)
Size: 52x52

```svg
<svg class="hand-svg" width="52" height="52" viewBox="0 0 96 96" fill="none"> <rect x="14" y="54" width="28" height="20" rx="4" stroke="#FF2D6B" stroke-width="1.5" fill="rgba(255,45,107,0.07)"></rect> <rect x="54" y="54" width="28" height="20" rx="4" stroke="#00F5D4" stroke-width="1.5" fill="rgba(0,245,212,0.07)"></rect> <circle cx="48" cy="26" r="4" fill="#FFB800" class="node-glow"></circle> <line x1="34" y1="12" x2="62" y2="12" stroke="#FF2D6B" stroke-width="2.5" stroke-linecap="round"></line> <line x1="34" y1="18" x2="56" y2="18" stroke="#FF2D6B" stroke-width="2" stroke-linecap="round" opacity="0.75"></line> <line x1="34" y1="24" x2="62" y2="24" stroke="#FF2D6B" stroke-width="2.5" stroke-linecap="round"></line> <line x1="28" y1="30" x2="45" y2="28" stroke="#FF2D6B" stroke-width="0.8" stroke-dasharray="3 2" class="circuit-flow"></line> <line x1="68" y1="30" x2="51" y2="28" stroke="#00F5D4" stroke-width="0.8" stroke-dasharray="3 2" class="circuit-flow" style="animation-delay:.5s"></line> </svg>
```

### SVG: 52x52_5 (from: Logo & Brand Animations)
Size: 52x52

```svg
<svg class="hand-svg" width="52" height="52" viewBox="0 0 96 96" fill="none"> <rect x="14" y="54" width="28" height="20" rx="4" stroke="#FF2D6B" stroke-width="1.5" fill="rgba(255,45,107,0.07)"></rect> <rect x="54" y="54" width="28" height="20" rx="4" stroke="#00F5D4" stroke-width="1.5" fill="rgba(0,245,212,0.07)"></rect> <circle cx="48" cy="26" r="4" fill="#FFB800"></circle> <line x1="34" y1="12" x2="62" y2="12" stroke="#FF2D6B" stroke-width="2.5" stroke-linecap="round"></line> <line x1="34" y1="18" x2="56" y2="18" stroke="#FF2D6B" stroke-width="2" stroke-linecap="round" opacity="0.75"></line> <line x1="34" y1="24" x2="62" y2="24" stroke="#FF2D6B" stroke-width="2.5" stroke-linecap="round"></line> </svg>
```

### SVG: 52x52_6 (from: Logo & Brand Animations)
Size: 52x52

```svg
<svg class="hand-svg" width="52" height="52" viewBox="0 0 96 96" fill="none"> <circle cx="48" cy="48" r="42" stroke="rgba(255,45,107,0.2)" stroke-width="1" fill="none"></circle> <rect x="14" y="54" width="28" height="20" rx="4" stroke="#FF2D6B" stroke-width="1.5" fill="rgba(255,45,107,0.07)"></rect> <rect x="54" y="54" width="28" height="20" rx="4" stroke="#00F5D4" stroke-width="1.5" fill="rgba(0,245,212,0.07)"></rect> <circle cx="48" cy="26" r="4" fill="#FFB800"></circle> <line x1="34" y1="12" x2="62" y2="12" stroke="#FF2D6B" stroke-width="2.5" stroke-linecap="round"></line> <line x1="34" y1="18" x2="56" y2="18" stroke="#FF2D6B" stroke-width="2" stroke-linecap="round" opacity="0.75"></line> <line x1="34" y1="24" x2="62" y2="24" stroke="#FF2D6B" stroke-width="2.5" stroke-linecap="round"></line> </svg>
```

### SVG: 52x52_7 (from: Logo & Brand Animations)
Size: 52x52

```svg
<svg class="hand-svg" width="52" height="52" viewBox="0 0 96 96" fill="none"> <rect x="14" y="54" width="28" height="20" rx="4" stroke="#FF2D6B" stroke-width="1.5" fill="rgba(255,45,107,0.07)"></rect> <rect x="54" y="54" width="28" height="20" rx="4" stroke="#00F5D4" stroke-width="1.5" fill="rgba(0,245,212,0.07)"></rect> <circle cx="48" cy="26" r="4" fill="#FFB800"></circle> <line x1="34" y1="12" x2="62" y2="12" stroke="#FF2D6B" stroke-width="2.5" stroke-linecap="round"></line> <line x1="34" y1="18" x2="56" y2="18" stroke="#FF2D6B" stroke-width="2" stroke-linecap="round" opacity="0.75"></line> <line x1="34" y1="24" x2="62" y2="24" stroke="#FF2D6B" stroke-width="2.5" stroke-linecap="round"></line> </svg>
```

### SVG: 52x52_8 (from: Logo & Brand Animations)
Size: 52x52

```svg
<svg width="52" height="52" viewBox="0 0 96 96" fill="none"> <circle cx="48" cy="48" r="32" stroke="rgba(0,245,212,0.3)" stroke-width="1" fill="none" class="circuit-flow"></circle> <circle cx="48" cy="48" r="20" stroke="rgba(255,45,107,0.2)" stroke-width="1" fill="none"></circle> <line x1="48" y1="16" x2="48" y2="30" stroke="#FF2D6B" stroke-width="1.5" class="circuit-flow"></line> <line x1="48" y1="66" x2="48" y2="80" stroke="#FF2D6B" stroke-width="1.5" class="circuit-flow" style="animation-delay:.4s"></line> <line x1="16" y1="48" x2="30" y2="48" stroke="#00F5D4" stroke-width="1.5" class="circuit-flow" style="animation-delay:.8s"></line> <line x1="66" y1="48" x2="80" y2="48" stroke="#00F5D4" stroke-width="1.5" class="circuit-flow" style="animation-delay:1.2s"></line> <circle cx="48" cy="48" r="5" fill="rgba(255,184,0,0.3)" stroke="#FFB800" stroke-width="1.5" class="node-glow"></circle> <circle cx="48" cy="48" r="2" fill="#FFB800"></circle> </svg>
```

### SVG: 52x52_9 (from: Logo & Brand Animations)
Size: 52x52

```svg
<svg width="52" height="52" viewBox="0 0 96 96" fill="none"> <rect x="10" y="44" width="34" height="24" rx="5" stroke="#FF2D6B" stroke-width="1.5" fill="rgba(255,45,107,0.06)"></rect> <rect x="52" y="44" width="34" height="24" rx="5" stroke="#00F5D4" stroke-width="1.5" fill="rgba(0,245,212,0.06)"></rect> <rect x="14" y="30" width="7" height="15" rx="2.5" stroke="#FF2D6B" stroke-width="1.2" fill="rgba(255,45,107,0.04)"></rect> <rect x="23" y="24" width="7" height="21" rx="2.5" stroke="#FF2D6B" stroke-width="1.5" fill="rgba(255,45,107,0.08)"></rect> <rect x="32" y="28" width="7" height="17" rx="2.5" stroke="#FF2D6B" stroke-width="1.2" fill="rgba(255,45,107,0.04)"></rect> <rect x="57" y="28" width="7" height="17" rx="2.5" stroke="#00F5D4" stroke-width="1.2" fill="rgba(0,245,212,0.04)"></rect> <rect x="66" y="24" width="7" height="21" rx="2.5" stroke="#00F5D4" stroke-width="1.5" fill="rgba(0,245,212,0.08)"></rect> <rect x="75" y="30" width="7" height="15" rx="2.5" stroke="#00F5D4" stroke-width="1.2" fill="rgba(0,245,212,0.04)"></rect> <circle cx="48" cy="28" r="5" fill="#FFB800" class="node-glow" style="animation-delay:.3s"></circle> <line x1="26" y1="24" x2="44" y2="26" stroke="#FF2D6B" stroke-width="0.8" stroke-dasharray="3 2" class="circuit-flow"></line> <line x1="70" y1="24" x2="52" y2="26" stroke="#00F5D4" stroke-width="0.8" stroke-dasharray="3 2" class="circuit-flow" style="animation-delay:.6s"></line> <line x1="32" y1="14" x2="64" y2="14" stroke="#FF2D6B" stroke-width="2" stroke-linecap="round"></line> <line x1="32" y1="20" x2="56" y2="20" stroke="#FF2D6B" stroke-width="1.5" stroke-linecap="round" opacity="0.7"></line> </svg>
```

### SVG: 100%x130_10 (from: Workflow Nodes)
Size: 100%x130

```svg
<svg class="wf-svg" width="100%" height="130"> <line x1="120" y1="52" x2="160" y2="28" stroke="var(--c)" stroke-width="1.5" class="wf-flow"></line> <line x1="120" y1="52" x2="160" y2="96" stroke="var(--a)" stroke-width="1.5" class="wf-flow" style="animation-delay:.3s"></line> <line x1="272" y1="28" x2="300" y2="28" stroke="var(--m)" stroke-width="1.5" class="wf-flow" style="animation-delay:.6s"></line> </svg>
```

---

## COMPONENT HTML BLUEPRINTS

> These are the rendered HTML structures — use as implementation reference
> CSS classes map directly to vc-components.css

### Canvas Visualization

```html
<div class="vc" style="padding:16px"> <div class="cvs-panel"> <canvas id="canvas-preview" width="1552" height="298" style="opacity: 1;"></canvas> <div class="cvs-overlay"></div> <div class="cvs-badge" id="cvs-mode-badge">Neural</div> </div> <div class="cvs-controls" id="grp-canvas-panel"> <div class="cvs-mode-group"> <button class="cmode-btn on" data-val="neural"><span class="cmode-icon">■</span>Neural</button> <button class="cmode-btn" data-val="waves"><span class="cmode-icon">∿</span>Waves</button> <button class="cmode-btn" data-val="orbital"><span class="cmode-icon">◯</span>Orbital</button> <button class="cmode-btn" data-val="particles"><span class="cmode-icon">⋅</span>Particles</button> <button class="cmode-btn" data-val="vortex"><span class="cmode-icon">⊛</span>Vortex</button> <button class="cmode-btn" data-val="matrix"><span class="cmode-icon">▦</span>Matrix</button> <button class="cmode-btn" data-val="plasma"><span class="cmode-icon">⚯</span>Plasma</button> <button class="cmode-btn" data-val="constellation"><span class="cmode-icon">✦</span>Const</button> <button class="cmode-btn" data-val="dna"><span class="cmode-icon">⌫</span>DNA</button> <button class="cmode-btn" data-val="off"><span class="cmode-icon">□</span>Off</button> </div> </div> <div class="cvs-sliders"> <div class="cvs-sl-row"> <span class="cvs-sl-label">Speed</span> <input type="range" id="sl-speed-panel" min="1" max="100" value="50" style="flex:1"> <span class="cvs-sl-val" id="sv-speed-panel">50</span> </div> <div class="cvs-sl-row"> <span class="cvs-sl-label">Density</span> <input type="range" id="sl-density-panel" min="1" max="100" value="50" style="flex:1"> <span class="cvs-sl-val" id="sv-density-panel">96</span> </div> <div class="cvs-sl-row"> <span class="cvs-sl-label">Opacity</span> <input type="range" id="sl-canopa-panel" min="5" max="100" value="60" style="flex:1"> <span class="cvs-sl-val" id="sv-canopa-panel">100%</span> </div> </div> </div>
```

### Hero — Brand Identity

```html
<div class="vc hero-section"> <div class="hero-text"> <div class="hero-eyebrow">AI Meeting Intelligence</div> <div class="hero-headline">Turn every call into<br><span class="grad">intelligent action</span></div> <div class="hero-sub">Entomate captures, transcribes, and transforms your meetings into actionable tasks — powered by AI that works like your best analyst.</div> <div class="hero-ctas"> <button class="vbtn vbtn-p vbtn-lg">Start Free Trial</button> <button class="vbtn vbtn-s vbtn-lg">Watch Demo</button> </div> </div> <div class="hero-visual"> <!-- Animated Entomate Hands Hero Visual --> <svg width="200" height="200" viewBox="0 0 200 200" fill="none" xmlns="http://www.w3.org/2000/svg" style="overflow:visible"> <!-- Outer orbital rings --> <circle cx="100" cy="100" r="90" stroke="rgba(0,245,212,0.12)" stroke-width="1" fill="none"></circle> <circle cx="100" cy="100" r="70" stroke="rgba(255,45,107,0.15)" stroke-width="1" fill="none"></circle> <!-- Neural mesh bg lines --> <line x1="30" y1="40" x2="170" y2="160" stroke="rgba(0,245,212,0.08)" stroke-width="1"></line> <line x1="170" y1="40" x2="30" y2="160" stroke="rgba(0,245,212,0.08)" stroke-width="1"></line> <line x1="100" y1="10" x2="100" y2="190" stroke="rgba(255,45,107,0.06)" stroke-width="1"></line> <line x1="10" y1="100" x2="190" y2="100" stroke="rgba(255,45,107,0.06)" stroke-width="1"></line> <!-- Left hand (geometric wireframe) --> <g id="hero-left-hand" style="transform-origin:80px 130px;animation:heroHandFloat 3s ease-in-out infinite"> <!-- Palm --> <rect x="52" y="115" width="40" height="30" rx="5" stroke="#FF2D6B" stroke-width="1.5" fill="rgba(255,45,107,0.06)"></rect> <!-- Thumb --> <rect x="40" y="122" width="14" height="10" rx="3" stroke="#FF2D6B" stroke-width="1.2" fill="rgba(255,45,107,0.04)"></rect> <!-- Index finger --> <rect x="55" y="90" width="9" height="26" rx="3" stroke="#FF2D6B" stroke-width="1.2" fill="rgba(255,45,107,0.04)"></rect> <!-- Middle finger --> <rect x="66" y="84" width="9" hei
<!-- ... truncated -->
```

### Navigation Sidebar

```html
<div class="vc" style="width:200px;padding:0"> <div class="nl"> <div style="padding:10px 10px 6px;display:flex;align-items:center;gap:8px"> <div style="width:28px;height:28px;background:var(--c);border-radius:7px;display:flex;align-items:center;justify-content:center;font-family:var(--fd);font-size:14px;font-weight:800;color:#fff">E</div> <span style="font-family:var(--fa);font-size:13px;font-weight:700;color:var(--t0)">Entomate</span> </div> <div class="nl-section">Main</div> <div class="nl-item active"><div class="nl-icon-box">📈</div><span class="nl-name">Dashboard</span></div> <div class="nl-item"><div class="nl-icon-box">🎙</div><span class="nl-name">Meetings</span><span class="nl-badge">3</span></div> <div class="nl-item"><div class="nl-icon-box">✓</div><span class="nl-name">Tasks</span><span class="nl-badge">12</span></div> <div class="nl-item"><div class="nl-icon-box">📊</div><span class="nl-name">Analytics</span></div> <div class="nl-divider"></div> <div class="nl-section">AI Tools</div> <div class="nl-item"><div class="nl-icon-box">✨</div><span class="nl-name">Insights</span></div> <div class="nl-item"><div class="nl-icon-box">📖</div><span class="nl-name">Summaries</span></div> <div class="nl-divider"></div> <div class="nl-item"><div class="nl-icon-box">⚙</div><span class="nl-name">Settings</span></div> </div> </div>
```

### Header Topbar

```html
<div class="vc topbar" style="flex:1"> <div class="topbar-left"> <div class="topbar-logo-box">E</div> <span class="topbar-name">Entomate</span> <span style="color:var(--t2);font-size:12px">/</span> <span style="font-family:var(--fa);font-size:12px;color:var(--t1)">Dashboard</span> </div> <div class="topbar-right"> <div style="display:flex;align-items:center;gap:6px;padding:6px 10px;background:var(--b0);border:1px solid var(--b1);border-radius:7px;cursor:pointer"> <span style="font-size:12px">🔍</span> <span style="font-family:var(--fa);font-size:11px;color:var(--t2)">Search...</span> <span style="font-family:var(--fm);font-size:9px;color:var(--t2);background:var(--b1);padding:1px 4px;border-radius:3px">⌘K</span> </div> <div class="topbar-notif">🔔<div class="topbar-notif-dot"></div></div> <div class="topbar-notif">⚙</div> <div class="av av-c" style="width:32px;height:32px;font-size:13px">AJ</div> </div> </div>
```

### Metric Cards

```html
<div class="vc mc"> <div class="mc-icon mc-icon-c">🎙</div> <div class="mval">48</div> <div class="mlbl">Meetings This Month</div> <div class="mdelta mdelta-up">⇧ 12% vs last month</div> </div>
```

### Meeting Cards

```html
<div class="vc mtg"> <div class="mtg-top"> <div> <div class="mtg-title">Q4 Strategy Review</div> <div class="mtg-meta">Today 2:00 PM • 45 min</div> </div> <span class="vbadge vbadge-c vbadge-dot">Live</span> </div> <div style="display:flex;gap:4px;flex-wrap:wrap"> <span class="vbadge vbadge-n">Strategy</span> <span class="vbadge vbadge-a">✨ 3 insights</span> </div> <div class="mtg-bar"><div class="mtg-fill mtg-fill-c" style="width:62%"></div></div> <div class="mtg-footer"> <div class="av-group"><div class="av av-c">AJ</div><div class="av av-m">SK</div><div class="av av-a">MR</div></div> <span style="font-family:var(--fm);font-size:9px;color:var(--t2)">62% complete</span> </div> </div>
```

### Form Elements

```html
<div class="vc" style="padding:16px;flex:1;min-width:240px;display:flex;flex-direction:column;gap:12px"> <div class="vinput-group"> <span class="vinput-icon">🔍</span> <input class="vinput" type="text" placeholder="Search meetings..."> </div> <input class="vinput" type="email" placeholder="Email address"> <input class="vinput" type="text" placeholder="Meeting title" value="Q4 Strategy"> <textarea class="vinput" placeholder="Add meeting notes..."></textarea> <div style="display:flex;gap:6px"> <button class="vbtn vbtn-p" style="flex:1">Save</button> <button class="vbtn vbtn-g" style="flex:1">Cancel</button> </div> </div>
```

### Badges & Indicators

```html
<div class="vc" style="padding:16px;display:flex;flex-wrap:wrap;gap:8px;align-items:center"> <span class="vbadge vbadge-c vbadge-dot">Live</span> <span class="vbadge vbadge-m vbadge-dot">Active</span> <span class="vbadge vbadge-a">Scheduled</span> <span class="vbadge vbadge-p">Recording</span> <span class="vbadge vbadge-n">Archived</span> <span class="ai-badge">✦ AI</span> <span class="vbadge vbadge-c">High Priority</span> <span class="vbadge vbadge-m">Completed</span> <span class="vbadge vbadge-a">Pending</span> <span class="vbadge vbadge-n">Draft</span> <div style="display:flex;align-items:center;gap:6px;padding:4px 10px;background:var(--pd);border:1px solid rgba(160,255,50,.3);border-radius:100px"> <div style="width:6px;height:6px;border-radius:50%;background:var(--p);box-shadow:0 0 6px var(--p)"></div> <span style="font-size:9px;font-weight:700;color:var(--p);font-family:var(--fa)">Recording Now</span> </div> </div>
```

### Notifications & Toasts

```html
<div class="vc toast toast-c"> <div class="toast-icon" style="background:var(--cd);color:var(--c)">⚠</div> <div><div class="ttitle">Meeting Starting Soon</div><div class="tmsg">Q4 Strategy Review begins in 5 minutes</div></div> </div>
```

### Dropdown Menu

```html
<div class="vc dd-menu" style="min-width:200px"> <div class="ddi">🔍 Search</div> <div class="ddi active">📈 Dashboard</div> <div class="ddi">🎙 Meetings</div> <div class="ddi">✓ Tasks</div> <div class="dd-sep"></div> <div class="ddi">✦ AI Insights</div> <div class="ddi">📊 Analytics</div> <div class="dd-sep"></div> <div class="ddi" style="color:var(--c)">⚠ Danger Action</div> </div>
```

### Data Table

```html
<div class="vc" style="padding:0;overflow:hidden;flex:1"> <table class="vtbl"> <thead><tr><th>Meeting</th><th>Date</th><th>Duration</th><th>Status</th><th>Tasks</th></tr></thead> <tbody> <tr><td>Q4 Strategy Review</td><td>Today</td><td>45 min</td><td><span class="vbadge vbadge-c vbadge-dot">Live</span></td><td>3</td></tr> <tr><td>Product Roadmap Sync</td><td>Yesterday</td><td>1h 12m</td><td><span class="vbadge vbadge-m">Done</span></td><td>8</td></tr> <tr><td>Client Onboarding</td><td>Tomorrow</td><td>60 min</td><td><span class="vbadge vbadge-a">Sched</span></td><td>—</td></tr> <tr><td>Weekly Standup</td><td>Mon</td><td>15 min</td><td><span class="vbadge vbadge-m">Done</span></td><td>2</td></tr> <tr><td>Design Review</td><td>Fri</td><td>30 min</td><td><span class="vbadge vbadge-n">Draft</span></td><td>—</td></tr> </tbody> </table> </div>
```

### Kanban Board

```html
<div class="vc kcard"> <div class="kcard-title">Update meeting templates</div> <div class="kcard-meta">Design • Low priority</div> <div class="kcard-footer"><div class="av av-m">SK</div><span class="vbadge vbadge-n">Design</span></div> </div>
```

### Typography Scale

```html
<div class="vc" style="padding:20px;flex:1;display:flex;flex-direction:column;gap:14px"> <div class="ty-disp ty-grad">Meeting Intelligence</div> <div class="ty-h2">AI-Powered Insights</div> <div class="ty-h3">Real-time Analysis</div> <div class="ty-body">Entomate captures every meeting moment, extracting tasks, decisions, and insights automatically. Your team never misses a follow-up again.</div> <div class="ty-small">Last updated 2 minutes ago • Version 4.2.1</div> <div class="ty-mono">const meeting = await ai.analyze(recording);</div> </div>
```

### Icon System

```html
<div class="vc" style="padding:16px;flex:1"> <div class="icon-grid"> <div class="icon-item"><div class="icon-box">🎙</div><div class="icon-label">meeting</div></div> <div class="icon-item"><div class="icon-box" style="background:var(--cd)">✨</div><div class="icon-label">ai</div></div> <div class="icon-item"><div class="icon-box">✓</div><div class="icon-label">task</div></div> <div class="icon-item"><div class="icon-box" style="background:var(--md)">📊</div><div class="icon-label">analytics</div></div> <div class="icon-item"><div class="icon-box">🔍</div><div class="icon-label">search</div></div> <div class="icon-item"><div class="icon-box" style="background:var(--ad)">🔔</div><div class="icon-label">notify</div></div> <div class="icon-item"><div class="icon-box">⚙</div><div class="icon-label">settings</div></div> <div class="icon-item"><div class="icon-box" style="background:var(--pd)">●</div><div class="icon-label">live</div></div> <div class="icon-item"><div class="icon-box">📋</div><div class="icon-label">notes</div></div> <div class="icon-item"><div class="icon-box" style="background:var(--cd)">🔗</div><div class="icon-label">link</div></div> <div class="icon-item"><div class="icon-box">📧</div><div class="icon-label">email</div></div> <div class="icon-item"><div class="icon-box" style="background:var(--md)">👤</div><div class="icon-label">user</div></div> </div> </div>
```

### Logo & Brand Animations

```html
<div class="vc" style="padding:24px;display:flex;gap:32px;align-items:center;flex-wrap:wrap"> <!-- Primary hand logo, large --> <div style="display:flex;flex-direction:column;align-items:center;gap:12px"> <svg class="hand-svg" width="96" height="96" viewBox="0 0 96 96" fill="none" xmlns="http://www.w3.org/2000/svg" style="filter:drop-shadow(0 0 12px rgba(255,45,107,0.5))"> <!-- Left hand --> <rect x="14" y="54" width="28" height="20" rx="4" stroke="#FF2D6B" stroke-width="1.5" fill="rgba(255,45,107,0.06)"></rect> <rect x="7" y="60" width="9" height="7" rx="2.5" stroke="#FF2D6B" stroke-width="1.2" fill="rgba(255,45,107,0.04)"></rect> <rect x="16" y="36" width="7" height="19" rx="2.5" stroke="#FF2D6B" stroke-width="1.2" fill="rgba(255,45,107,0.04)"></rect> <rect x="25" y="30" width="7" height="25" rx="2.5" stroke="#FF2D6B" stroke-width="1.5" fill="rgba(255,45,107,0.08)"></rect> <rect x="34" y="34" width="6" height="21" rx="2.5" stroke="#FF2D6B" stroke-width="1.2" fill="rgba(255,45,107,0.04)"></rect> <rect x="40" y="40" width="5" height="15" rx="2" stroke="#FF2D6B" stroke-width="1" fill="rgba(255,45,107,0.04)"></rect> <!-- Right hand (mirror) --> <rect x="54" y="54" width="28" height="20" rx="4" stroke="#00F5D4" stroke-width="1.5" fill="rgba(0,245,212,0.06)"></rect> <rect x="80" y="60" width="9" height="7" rx="2.5" stroke="#00F5D4" stroke-width="1.2" fill="rgba(0,245,212,0.04)"></rect> <rect x="73" y="36" width="7" height="19" rx="2.5" stroke="#00F5D4" stroke-width="1.2" fill="rgba(0,245,212,0.04)"></rect> <rect x="64" y="30" width="7" height="25" rx="2.5" stroke="#00F5D4" stroke-width="1.5" fill="rgba(0,245,212,0.08)"></rect> <rect x="56" y="34" width="6" height="21" rx="2.5" stroke="#00F5D4" stroke-width="1.2" fill="rgba(0,245,212,0.04)"></rect> <rect x="51" y="40" width="5" height="15" rx="2" stroke="#00F5D4" stroke-width="1" fill="rgba(0,245,212,0.04)"></rect> <!-- Connection node at top center --> <circle cx="48" cy="26" r="5" fill="rgba(255,184,0,0.2)" stroke="#FF
<!-- ... truncated -->
```

### Command Palette

```html
<div class="vc cmd-overlay" style="flex:1;max-width:400px"> <input class="cmd-search" type="text" value="Start m" placeholder="Search commands..."> <div class="cmd-section">Meetings</div> <div class="cmd-list"> <div class="cmd-item active"> <div class="cmd-item-left"> <div class="cmd-item-icon">🎙</div> <span class="cmd-item-label">Start Meeting</span> </div> <div class="cmd-kbd"><span class="cmd-key">⌘</span><span class="cmd-key">N</span></div> </div> <div class="cmd-item"> <div class="cmd-item-left"> <div class="cmd-item-icon">📈</div> <span class="cmd-item-label">View Analytics</span> </div> <div class="cmd-kbd"><span class="cmd-key">⌘</span><span class="cmd-key">A</span></div> </div> <div class="cmd-item"> <div class="cmd-item-left"> <div class="cmd-item-icon">✓</div> <span class="cmd-item-label">Add Task</span> </div> <div class="cmd-kbd"><span class="cmd-key">⌘</span><span class="cmd-key">T</span></div> </div> </div> <div class="cmd-section">AI</div> <div class="cmd-list"> <div class="cmd-item"> <div class="cmd-item-left"> <div class="cmd-item-icon">✨</div> <span class="cmd-item-label">Generate Summary</span> </div> <div class="cmd-kbd"><span class="cmd-key">⌘</span><span class="cmd-key">S</span></div> </div> </div> </div>
```

### AI Chat Widget

```html
<div class="vc chat-container"> <div class="chat-head"> <div class="chat-dot"></div> <span class="chat-title">Ask Entomate AI</span> <span class="ai-badge" style="margin-left:auto">✦ AI</span> </div> <div class="chat-msgs"> <div class="chat-msg chat-msg-user">What were the key decisions from yesterday's meeting?</div> <div class="chat-msg chat-msg-ai"> <div class="chat-msg-hdr"><span class="ai-badge">✦ AI</span><span style="font-size:9px;color:var(--t2)">Entomate</span></div> From the Product Roadmap Sync, I identified 3 key decisions: <ul style="margin-top:6px;padding-left:16px;font-size:10px;color:var(--t1)"> <li>Launch v2.0 in Q1 2026</li> <li>Prioritize mobile app over API</li> <li>Hire 2 senior engineers</li> </ul> </div> <div class="chat-msg chat-msg-user">Create tasks for each decision</div> </div> <div class="chat-input-row"> <input class="chat-input" type="text" placeholder="Ask anything about your meetings..."> <button class="chat-send">↑</button> </div> </div>
```

### Meeting Timeline

```html
<div class="vc tl-container" style="flex:1"> <div class="tl-track"> <div class="tl-line"><div class="tl-fill"></div></div> <div class="tl-events"> <div class="tl-event"><div class="tl-dot tl-dot-done"></div><div class="tl-label">Strategy Call</div><div class="tl-time">9:00 AM</div></div> <div class="tl-event"><div class="tl-dot tl-dot-done"></div><div class="tl-label">Team Standup</div><div class="tl-time">10:30 AM</div></div> <div class="tl-event"><div class="tl-dot tl-dot-insight"></div><div class="tl-label">AI Insight</div><div class="tl-time">11:45 AM</div></div> <div class="tl-event"><div class="tl-dot tl-dot-now"></div><div class="tl-label">Client Review</div><div class="tl-time">2:00 PM</div></div> <div class="tl-event"><div class="tl-dot tl-dot-future"></div><div class="tl-label">Design Sync</div><div class="tl-time">4:00 PM</div></div> <div class="tl-event"><div class="tl-dot tl-dot-future"></div><div class="tl-label">Retro</div><div class="tl-time">5:30 PM</div></div> </div> </div> </div>
```

### Search Results Panel

```html
<div class="vc sr-wrap" style="flex:1"> <div class="sr-list"> <div class="sr-cat">Meetings</div> <div class="sr-item active"><span class="sr-item-icon">🎙</span><span class="sr-item-label">Q4 Strategy Review</span></div> <div class="sr-item"><span class="sr-item-icon">🎙</span><span class="sr-item-label">Product Roadmap Sync</span></div> <div class="sr-cat">Tasks</div> <div class="sr-item"><span class="sr-item-icon">✓</span><span class="sr-item-label">Update meeting templates</span></div> <div class="sr-item"><span class="sr-item-icon">✓</span><span class="sr-item-label">Integrate Slack</span></div> <div class="sr-cat">AI Insights</div> <div class="sr-item"><span class="sr-item-icon">✨</span><span class="sr-item-label">Follow-up required</span></div> </div> <div class="sr-preview"> <div class="sr-prev-title">Q4 Strategy Review</div> <div class="sr-prev-meta">Today • 45 min • 5 participants</div> <div class="sr-prev-body">Quarterly strategy session covering product direction, hiring plans, and OKR review. AI extracted 3 decisions and 8 action items.</div> <div class="sr-hints"> <span class="sr-key">↩ Open</span> <span class="sr-key">↑↓ Navigate</span> <span class="sr-key">Esc Close</span> </div> </div> </div>
```

### Workflow Nodes

```html
<div class="vc" style="padding:16px;flex:1;overflow:auto"> <div class="wf-canvas"> <svg class="wf-svg" width="100%" height="130"> <line x1="120" y1="52" x2="160" y2="28" stroke="var(--c)" stroke-width="1.5" class="wf-flow"></line> <line x1="120" y1="52" x2="160" y2="96" stroke="var(--a)" stroke-width="1.5" class="wf-flow" style="animation-delay:.3s"></line> <line x1="272" y1="28" x2="300" y2="28" stroke="var(--m)" stroke-width="1.5" class="wf-flow" style="animation-delay:.6s"></line> </svg> <div class="wf-node wf-trigger"> <div class="wf-label">Meeting Recorded</div> <div class="wf-sub">Trigger</div> </div> <div class="wf-node wf-action1"> <div class="wf-label">Extract Tasks</div> <div class="wf-sub">AI Action</div> </div> <div class="wf-node wf-action2"> <div class="wf-label">Assign to Team</div> <div class="wf-sub">Action</div> </div> <div class="wf-node wf-cond"> <div class="wf-label">Priority &gt; High?</div> <div class="wf-sub">Condition</div> </div> </div> </div>
```

### Color Token Grid

```html
<div class="vc" style="padding:16px;flex:1"> <div class="tok-grid"> <div class="vc tok-swatch"><div class="tok-color" style="background:#FF2D6B"></div><div class="tok-name">Crimson</div><div class="tok-hex">#FF2D6B</div></div> <div class="vc tok-swatch"><div class="tok-color" style="background:#00F5D4"></div><div class="tok-name">Mint</div><div class="tok-hex">#00F5D4</div></div> <div class="vc tok-swatch"><div class="tok-color" style="background:#FFB800"></div><div class="tok-name">Amber</div><div class="tok-hex">#FFB800</div></div> <div class="vc tok-swatch"><div class="tok-color" style="background:#A0FF32"></div><div class="tok-name">Phosphor</div><div class="tok-hex">#A0FF32</div></div> <div class="vc tok-swatch"><div class="tok-color" style="background:#080808;border:1px solid var(--b1)"></div><div class="tok-name">Void BG</div><div class="tok-hex">#080808</div></div> <div class="vc tok-swatch"><div class="tok-color" style="background:#101010;border:1px solid var(--b1)"></div><div class="tok-name">Surface 1</div><div class="tok-hex">#101010</div></div> <div class="vc tok-swatch"><div class="tok-color" style="background:#181818;border:1px solid var(--b1)"></div><div class="tok-name">Surface 2</div><div class="tok-hex">#181818</div></div> <div class="vc tok-swatch"><div class="tok-color" style="background:#F8F0F2;border-radius:5px"></div><div class="tok-name">Text 0</div><div class="tok-hex">#F8F0F2</div></div> <div class="vc tok-swatch"><div class="tok-color" style="background:#968890"></div><div class="tok-name">Text 1</div><div class="tok-hex">#968890</div></div> <div class="vc tok-swatch"><div class="tok-color" style="background:#585055"></div><div class="tok-name">Text 2</div><div class="tok-hex">#585055</div></div> </div> </div>
```

---

## ICON SYSTEM — Lucide → VC Container Mapping

```
Apply .vc-icon + color variant to all icon wrappers:

  .vc-icon         { width:36px; height:36px; border-radius:8px; display:grid; place-items:center; }
  .vc-icon-crimson { background:rgba(255,45,107,.12); color:#FF2D6B; }
  .vc-icon-mint    { background:rgba(0,245,212,.12);  color:#00F5D4; }
  .vc-icon-amber   { background:rgba(255,184,0,.12);  color:#FFB800; }
  .vc-icon-neutral { background:rgba(248,240,242,.06);color:#968890; }
  .vc-icon-sm      { width:28px; height:28px; border-radius:6px; }
  .vc-icon-lg      { width:48px; height:48px; border-radius:10px; }

Entomate icon → Lucide component → color variant:
  Mic (meetings)       → Mic             → crimson
  Bot (AI agents)      → Bot             → amber
  CheckSquare (tasks)  → CheckSquare     → mint
  BarChart3 (analytics)→ BarChart3       → mint
  Search               → Search          → neutral
  Settings             → Settings        → neutral
  Target (goals)       → Target          → crimson
  Zap (automations)    → Zap             → amber
  Calendar             → Calendar        → neutral
  FolderKanban (proj.) → FolderKanban    → mint
  Workflow             → Workflow        → amber
  LayoutDashboard      → LayoutDashboard → neutral
  FileText (reports)   → FileText        → neutral
  Kanban (board)       → Kanban          → mint

Usage:
  <div className="vc-icon vc-icon-crimson"><Mic size={16} /></div>
  <div className="vc-icon vc-icon-amber"><Bot size={16} /></div>
```

---

## BADGE VARIANTS — Status Indicator Mapping

```
Entomate status → VCBadge variant:
  Live / Recording now → variant="live"    (phosphor, animated pulse dot)
  Active / Running     → variant="success" (mint)
  Scheduled            → variant="neutral" (grey)
  AI Summary / AI tag  → variant="ai"      (amber)
  High Priority        → variant="error"   (crimson)
  Completed            → variant="success" (mint)
  Pending / Draft      → variant="neutral" (grey)
  Recording            → variant="live"    (phosphor)
  Archived             → variant="neutral" (grey, opacity .6)
```

---

## PLAYGROUND STATE (restore this config)

```json
{
  "style": "glass",
  "dark": true,
  "pulse": true,
  "grid": false,
  "glow": 60,
  "blur": 50,
  "extrusion": 50,
  "opacity": 70,
  "radius": 55,
  "grain": 0,
  "noise": false,
  "shadow": "auto",
  "canvas": "neural",
  "speed": 50,
  "density": 96,
  "canvasOpa": 100,
  "hover": "shimmer",
  "entry": "scalein",
  "logo": "pulse",
  "transition": "normal",
  "font": "syne",
  "scale": "compact",
  "headerSize": 36,
  "weight": "600",
  "track": "0em",
  "lineHeight": "1.4",
  "layout": "grid",
  "filter": "all",
  "cardDensity": "compact",
  "expFormat": "css"
}
```