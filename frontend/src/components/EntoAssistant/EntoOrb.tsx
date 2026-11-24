/**
 * EntoOrb — the assistant's face: a luminous particle sphere that listens and talks.
 *
 * WHY A CANVAS AND NOT AN SVG
 * ~500 points on a sphere whose surface displaces with the user's voice is a
 * per-frame geometry problem. SVG would mean 500 DOM nodes updating sixty times a
 * second; a 2D canvas draws them in one pass for a fraction of the cost and stays
 * crisp at any devicePixelRatio.
 *
 * WHY MONOCHROME
 * The orb is deliberately NOT in the brand palette. It reads as "the intelligence",
 * not "the logo": graphite in light mode, silver in dark, taken from the surface's
 * own `color` so it inherits every palette (Folio, Slate, Ink) for free. Brand
 * colour appears only as STATE — patina while it listens, terracotta while it
 * speaks — so colour on the orb always means something is happening.
 *
 * STATES (read every frame from voiceSignal; nothing here is React state)
 *   idle       a still frame that breathes: a slow glide every ten seconds
 *   listening  the surface displaces with the microphone level, tinted patina
 *   thinking   the sphere tightens and spins faster, still monochrome
 *   speaking   a pulse per streaming chunk ripples the surface, tinted terracotta
 *
 * The loop only runs while the canvas is on screen and the tab is visible, and
 * under prefers-reduced-motion it draws one still frame per state change so the
 * colour feedback survives without the movement.
 *
 * WHY IDLE IS A BREATH, NOT A LOOP (PR-1393)
 * The launcher orb sits on every page. Drawn at 60 fps at rest it cost ~315 ms of
 * whole-browser CPU per second on a real GPU, for an orb nobody was talking to.
 * At rest it now holds its frame and glides for BREATH_MS every BREATH_EVERY_MS
 * (Frank picked this over a lower idle frame rate and a fully still orb, from
 * recordings of all three). Every voice state still runs at the full rate.
 */
import React, { useEffect, useMemo, useRef } from 'react';
import { useReducedMotion } from '../bench/motion';
import { getVoiceSignal, readPulse, subscribeVoiceState, type VoiceState } from './voiceSignal';
import './EntoOrb.css';

interface EntoOrbProps {
  /** Rendered diameter in CSS px. */
  size?: number;
  className?: string;
}

// Brand tints, light and dark variants. Chosen from the base luminance at runtime.
// light is patina-deep: #3B9E8F is 2.76:1 on Linen, under the 3:1 a graphic needs.
const PATINA = { light: [45, 127, 115], dark: [82, 181, 166] } as const;
const TERRACOTTA = { light: [184, 92, 56], dark: [212, 118, 90] } as const;

type RGB = [number, number, number];

const parseRgb = (css: string): RGB | null => {
  const m = /rgba?\(\s*([\d.]+)[,\s]+([\d.]+)[,\s]+([\d.]+)/.exec(css);
  return m ? [Number(m[1]), Number(m[2]), Number(m[3])] : null;
};

const mix = (a: RGB, b: RGB, t: number): RGB => [
  a[0] + (b[0] - a[0]) * t,
  a[1] + (b[1] - a[1]) * t,
  a[2] + (b[2] - a[2]) * t,
];

/**
 * The Horizon cut (identity system, Logos AI "Orb on the horizon"): the mark's gap
 * band crosses the orb 0.34 R below centre, 0.10 R half-height. Points inside the
 * band are not drawn; points below it are drawn at 55 %. Dots blur a thin band, so
 * the gap is widened ×1.8 at ≤ 30 px and ×1.2 at ≥ 48 px (eased between).
 * Returns the alpha multiplier for a point at projected y.
 */
const gapScale = (size: number) => (size <= 30 ? 1.8 : size >= 48 ? 1.2 : 1.8 - ((size - 30) / 18) * 0.6);
const horizonAlpha = (y: number, cy: number, R: number, scale: number) => {
  const dy = y - (cy + 0.34 * R);
  if (Math.abs(dy) < 0.1 * R * scale) return 0;
  return dy > 0 ? 0.55 : 1;
};

/** Evenly spread unit vectors — a Fibonacci sphere, so no clumping at the poles. */
function fibonacciSphere(n: number): Float32Array {
  const pts = new Float32Array(n * 3);
  const golden = Math.PI * (3 - Math.sqrt(5));
  for (let i = 0; i < n; i++) {
    const y = 1 - (i / (n - 1)) * 2;
    const r = Math.sqrt(1 - y * y);
    const theta = golden * i;
    pts[i * 3] = Math.cos(theta) * r;
    pts[i * 3 + 1] = y;
    pts[i * 3 + 2] = Math.sin(theta) * r;
  }
  return pts;
}

/** Per-state motion targets. Eased toward each frame so transitions never snap. */
const TARGETS: Record<VoiceState, { amp: number; omega: number; tint: number; scale: number }> = {
  idle:      { amp: 0.035, omega: 0.28, tint: 0,    scale: 1 },
  listening: { amp: 0.05,  omega: 0.42, tint: 0.9,  scale: 1.03 },
  thinking:  { amp: 0.07,  omega: 1.1,  tint: 0,    scale: 0.94 },
  speaking:  { amp: 0.06,  omega: 0.55, tint: 0.9,  scale: 1.04 },
};

/** The idle breath: the first glide comes FIRST_BREATH_MS after mount, then one every BREATH_EVERY_MS. */
const BREATH_EVERY_MS = 10_000;
const BREATH_MS = 2_400;
const FIRST_BREATH_MS = 4_000;

export const EntoOrb: React.FC<EntoOrbProps> = ({ size = 44, className }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  // Point budget scales with size so a 22px header orb costs a quarter of a 56px one.
  // Below ~28px a dense lattice anti-aliases into a haze, so the small orb uses far
  // fewer points and lets each one resolve as a point.
  const count = useMemo(
    () => (size <= 28 ? 140 : Math.max(200, Math.min(560, Math.round(size * 9)))),
    [size],
  );
  const points = useMemo(() => fibonacciSphere(count), [count]);

  const reduceMotion = useReducedMotion();
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext?.('2d');
    // jsdom and the test suite's stub context can't paint; a context without the
    // gradient API is one of those, and there is nothing for the orb to do there.
    if (!ctx || typeof ctx.createRadialGradient !== 'function') return;

    const dpr = Math.min(2, (typeof window !== 'undefined' && window.devicePixelRatio) || 1);
    canvas.width = Math.round(size * dpr);
    canvas.height = Math.round(size * dpr);

    // Three fixed directions give a cheap, organic "noise" without a noise library.
    const d1 = [0.36, 0.8, 0.48] as const, d2 = [-0.7, 0.2, 0.68] as const, d3 = [0.5, -0.6, 0.62] as const;

    const R = size * 0.4;
    const cx = size / 2, cy = size / 2;
    const dotScale = size / 44;
    const gap = gapScale(size);
    const order = Array.from({ length: count }, (_, i) => i);
    const px = new Float32Array(count), py = new Float32Array(count), pz = new Float32Array(count);
    // Per-point lighting: a fixed key light from the upper-left, in front of the
    // sphere. Points facing it draw at full ink; the far side falls off, so the
    // orb has a lit hemisphere and reads as luminous instead of pencil-shaded.
    const lit = new Float32Array(count);
    const LX = -0.42, LY = -0.5, LZ = 0.76; // normalised; canvas y points down

    let angle = 0;
    let last = 0;
    let raf = 0;
    let breathTimer: ReturnType<typeof setTimeout> | undefined;
    let running = false;
    let visible = true;
    let base: RGB = [40, 42, 48];
    let colorProbe = 0;
    // The surface's own time. It advances only while the orb moves, so a still orb
    // resumes where it stopped instead of jumping to wherever the wall clock went.
    let clock = 0;
    // 0 = holding still, 1 = full motion; eased so the orb glides in and out of rest.
    let motion = 0;
    const nowMs = () => (typeof performance !== 'undefined' ? performance.now() : Date.now());
    let breathStart = nowMs() + FIRST_BREATH_MS;
    // Eased parameters
    const cur = { amp: TARGETS.idle.amp, omega: TARGETS.idle.omega, tint: 0, scale: 1 };

    const readBase = () => {
      const c = parseRgb(getComputedStyle(canvas).color);
      if (c) base = c;
      else if (typeof document !== 'undefined' && document.documentElement.classList.contains('dark')) base = [226, 228, 232];
    };

    // The breath's envelope at `now`: 0 outside a glide, a smooth 0 → 1 → 0 inside one.
    const breath = (now: number) => {
      // Skip the glides missed while the orb was stopped, hidden or off screen.
      while (now - breathStart >= BREATH_MS) breathStart += BREATH_EVERY_MS;
      if (now < breathStart) return 0;
      const v = Math.sin((Math.PI * (now - breathStart)) / BREATH_MS);
      return v * v;
    };
    // Full motion in every voice state; at rest, only the breath moves the orb.
    const wantMotion = (now: number) => (getVoiceSignal().state !== 'idle' ? 1 : breath(now));

    const draw = (now: number) => {
      const dt = last ? Math.min(0.05, (now - last) / 1000) : 0.016;
      last = now;
      if ((colorProbe++ & 63) === 0) readBase();

      const want = wantMotion(now);
      // Glide in quickly, out slowly, so leaving a voice state or a breath never snaps.
      motion += (want - motion) * (1 - Math.exp(-dt * (want > motion ? 10 : 4)));
      const mdt = dt * motion;

      const sig = getVoiceSignal();
      const state = sig.state;
      const tgt = TARGETS[state];
      const k = 1 - Math.exp(-dt * 6); // ~160ms time constant
      cur.amp += (tgt.amp - cur.amp) * k;
      cur.omega += (tgt.omega - cur.omega) * k;
      cur.tint += (tgt.tint - cur.tint) * k;
      cur.scale += (tgt.scale - cur.scale) * k;

      // Energy: the mic while listening, the chunk pulse while speaking.
      const pulse = state === 'speaking' ? readPulse(now) : 0;
      const energy = state === 'listening' ? sig.level : pulse;
      const amp = cur.amp + energy * 0.22;
      clock += mdt;
      const t = clock;
      angle += cur.omega * mdt;

      const isDarkBase = (base[0] + base[1] + base[2]) / 3 > 128; // silver base = dark surface
      const tintRGB: RGB =
        state === 'speaking'
          ? (isDarkBase ? [...TERRACOTTA.dark] : [...TERRACOTTA.light]) as RGB
          : (isDarkBase ? [...PATINA.dark] : [...PATINA.light]) as RGB;
      const color = mix(base, tintRGB, cur.tint);
      const breath = 1 + 0.02 * Math.sin(t * 0.9);
      const radius = R * cur.scale * breath;

      const ca = Math.cos(angle), sa = Math.sin(angle);
      const tilt = 0.38, ct = Math.cos(tilt), st = Math.sin(tilt);

      for (let i = 0; i < count; i++) {
        const x0 = points[i * 3]!, y0 = points[i * 3 + 1]!, z0 = points[i * 3 + 2]!;
        // Displace along the normal with a slow, layered field.
        const n =
          0.5 * Math.sin(3.1 * (x0 * d1[0] + y0 * d1[1] + z0 * d1[2]) + t * 1.3) +
          0.3 * Math.sin(5.3 * (x0 * d2[0] + y0 * d2[1] + z0 * d2[2]) - t * 0.9) +
          0.2 * Math.sin(7.9 * (x0 * d3[0] + y0 * d3[1] + z0 * d3[2]) + t * 1.7);
        const rr = radius * (1 + amp * n);
        // Rotate about Y, then tilt about X.
        const x1 = x0 * ca + z0 * sa;
        const z1 = -x0 * sa + z0 * ca;
        const y2 = y0 * ct - z1 * st;
        const z2 = y0 * st + z1 * ct;
        px[i] = cx + x1 * rr;
        py[i] = cy + y2 * rr;
        pz[i] = z2;
        lit[i] = 0.5 + 0.5 * (x1 * LX + y2 * LY + z2 * LZ);
      }
      order.sort((a, b) => pz[a]! - pz[b]!);

      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, size, size);

      // The orb's own light, centred toward the key light — brighter the more it
      // is doing, and a touch stronger on a dark surface where silver ink alone
      // would sink into the ground.
      const glowA = (isDarkBase ? 0.2 : 0.14) + 0.22 * Math.min(1, cur.tint * 0.6 + energy);
      const gx = cx + LX * radius * 0.3, gy = cy + LY * radius * 0.3;
      const glow = ctx.createRadialGradient(gx, gy, radius * 0.15, cx, cy, radius * 1.45);
      glow.addColorStop(0, `rgba(${color[0]},${color[1]},${color[2]},${glowA})`);
      glow.addColorStop(1, `rgba(${color[0]},${color[1]},${color[2]},0)`);
      ctx.fillStyle = glow;
      ctx.fillRect(0, 0, size, size);

      const [r, g, b] = color.map(Math.round);
      for (let j = 0; j < count; j++) {
        const i = order[j]!; // order holds 0..count-1, the typed arrays' own range
        const dx = px[i]!, dy = py[i]!;
        const cut = horizonAlpha(dy, cy, radius, gap);
        if (cut === 0) continue;
        const depth = (pz[i]! + 1) / 2; // 0 back → 1 front
        // Front dots are small and dark, back dots are faint and smaller still: the
        // lattice stays open so the sphere reads as a field of points, not a ball.
        // The key light then lifts the facing side and lets the far side recede.
        const a = (0.06 + 0.84 * depth * depth * depth) * (0.45 + 0.55 * lit[i]!) * cut;
        // Never below ~0.7px: smaller than that a point anti-aliases into smear.
        const rad = Math.max(0.7, (0.4 + 0.72 * depth) * dotScale);
        ctx.fillStyle = `rgba(${r},${g},${b},${a})`;
        ctx.beginPath();
        ctx.arc(dx, dy, rad, 0, Math.PI * 2);
        ctx.fill();
      }
    };

    // Nothing left to move: no motion wanted or left over, and the eased state has caught up.
    const settled = (now: number) => {
      const tgt = TARGETS[getVoiceSignal().state];
      return (
        wantMotion(now) === 0 &&
        motion < 0.002 &&
        Math.abs(cur.tint - tgt.tint) < 0.002 &&
        Math.abs(cur.scale - tgt.scale) < 0.0005 &&
        Math.abs(cur.amp - tgt.amp) < 0.0005
      );
    };

    const loop = (now: number) => {
      if (!running) return;
      draw(now);
      if (settled(now)) {
        // Hold this frame, and wake for the next breath.
        running = false;
        breathTimer = setTimeout(start, Math.max(0, breathStart - nowMs()));
        return;
      }
      raf = requestAnimationFrame(loop);
    };

    const start = () => {
      if (running || !visible || document.hidden) return;
      running = true;
      last = 0;
      clearTimeout(breathTimer);
      readBase(); // a held orb may have missed a palette change the class observer can't see
      raf = requestAnimationFrame(loop);
    };
    const stop = () => {
      running = false;
      cancelAnimationFrame(raf);
      clearTimeout(breathTimer);
    };

    // Settle the eased params instantly for a still frame (reduced motion).
    const still = () => {
      const tgt = TARGETS[getVoiceSignal().state];
      cur.amp = tgt.amp; cur.omega = tgt.omega; cur.tint = tgt.tint; cur.scale = tgt.scale;
      readBase();
      draw(nowMs());
    };

    readBase();
    // The ink follows the theme the moment it flips, not 64 frames later. A held
    // frame is repainted, since no next frame is coming to pick the new ink up.
    const onTheme = () => {
      readBase();
      if (reduceMotion) still();
      else if (!running) draw(nowMs());
    };
    const themeObs =
      typeof MutationObserver !== 'undefined' && typeof document !== 'undefined'
        ? new MutationObserver(onTheme)
        : null;
    themeObs?.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] });
    // Paint one frame synchronously: the canvas is never blank while the loop
    // waits on the observer's first report.
    draw(nowMs());

    if (reduceMotion) {
      // One still frame now, and one per state change so the tint still answers.
      still();
      const unsub = subscribeVoiceState(still);
      return () => {
        unsub();
        themeObs?.disconnect();
      };
    }

    const io =
      typeof IntersectionObserver !== 'undefined'
        ? new IntersectionObserver(([entry]) => {
            visible = !!entry && (entry.isIntersecting || entry.intersectionRatio > 0);
            if (visible) start(); else stop();
          })
        : null;
    io?.observe(canvas);
    const onVis = () => {
      if (document.hidden) stop();
      else { last = 0; start(); }
    };
    document.addEventListener('visibilitychange', onVis);
    // A state change restarts a stopped loop, so the orb can never be caught
    // still mid-conversation by an observer that missed a beat.
    const unsubState = subscribeVoiceState(() => start());
    if (!io) start();

    return () => {
      stop();
      unsubState();
      io?.disconnect();
      themeObs?.disconnect();
      document.removeEventListener('visibilitychange', onVis);
    };
  }, [size, count, points, reduceMotion]);

  return (
    <canvas
      ref={canvasRef}
      className={`lv-orb ${className ?? ''}`}
      style={{ width: size, height: size }}
      aria-hidden="true"
    />
  );
};

/**
 * EntoOrbGlyph — the still, SVG version for places that repeat (message avatars).
 * Forty projected points, no loop, no canvas: identity without a render budget.
 */
export const EntoOrbGlyph: React.FC<{ size?: number; className?: string }> = ({ size = 20, className }) => {
  const dots = useMemo(() => {
    const n = 48;
    const pts = fibonacciSphere(n);
    const out: { x: number; y: number; d: number; cut: number }[] = [];
    const tilt = 0.38, ct = Math.cos(tilt), st = Math.sin(tilt);
    for (let i = 0; i < n; i++) {
      const x = pts[i * 3]!, y = pts[i * 3 + 1]!, z = pts[i * 3 + 2]!;
      const y2 = y * ct - z * st;
      const z2 = y * st + z * ct;
      // 48 points is the small cut at every size it ships at (14-30 px).
      const cut = horizonAlpha(12 + y2 * 8.4, 12, 8.4, gapScale(0));
      if (cut > 0) out.push({ x: 12 + x * 8.4, y: 12 + y2 * 8.4, d: (z2 + 1) / 2, cut });
    }
    return out.sort((a, b) => a.d - b.d);
  }, []);
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} className={`lv-orb-glyph ${className ?? ''}`} aria-hidden="true">
      {dots.map((p, i) => (
        <circle key={i} cx={p.x} cy={p.y} r={0.55 + 0.75 * p.d} fill="currentColor" opacity={(0.12 + 0.8 * p.d * p.d) * p.cut} />
      ))}
    </svg>
  );
};

export default EntoOrb;
