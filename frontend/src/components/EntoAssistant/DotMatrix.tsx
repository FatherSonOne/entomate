/**
 * DotMatrix — the launcher's voice field: a grid of dots that idles as a slow
 * shimmer and lights up column by column with the user's voice.
 *
 * It fills whatever width its flex slot gives it (ResizeObserver, so the keycap
 * revealing on hover just shortens the field rather than clipping it) and reads
 * the microphone level from voiceSignal each frame. Ink comes from `color`, so
 * the launcher's data-state styling tints it: graphite at rest, patina listening,
 * terracotta while the assistant speaks.
 *
 * Dots brighten toward the mic end of the pill — that is where the voice enters,
 * and the fade toward the label is what makes the field read as a signal rather
 * than a texture.
 */
import React, { useEffect, useRef } from 'react';
import { useReducedMotion } from '../bench/motion';
import { getVoiceSignal, readPulse, subscribeVoiceState } from './voiceSignal';

interface DotMatrixProps {
  rows?: number;
  /** Centre-to-centre spacing in CSS px. */
  pitch?: number;
  className?: string;
}

const parseRgb = (css: string): [number, number, number] | null => {
  const m = /rgba?\(\s*([\d.]+)[,\s]+([\d.]+)[,\s]+([\d.]+)/.exec(css);
  return m ? [Number(m[1]), Number(m[2]), Number(m[3])] : null;
};

export const DotMatrix: React.FC<DotMatrixProps> = ({ rows = 4, pitch = 6, className }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const reduceMotion = useReducedMotion();

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext?.('2d');
    if (!ctx) return;

    const dpr = Math.min(2, (typeof window !== 'undefined' && window.devicePixelRatio) || 1);
    let width = 0;
    const height = rows * pitch;
    let cols = 0;
    let colEnergy = new Float32Array(0);
    let rgb: [number, number, number] = [110, 110, 110];
    let raf = 0;
    let running = false;
    let probe = 0;
    let last = 0;

    const readColor = () => {
      const c = parseRgb(getComputedStyle(canvas).color);
      if (c) rgb = c;
    };

    const resize = () => {
      const w = canvas.parentElement?.clientWidth ?? canvas.clientWidth;
      width = Math.max(0, Math.floor(w));
      cols = Math.max(0, Math.floor(width / pitch));
      colEnergy = new Float32Array(cols);
      canvas.width = Math.round(width * dpr);
      canvas.height = Math.round(height * dpr);
      canvas.style.width = `${width}px`;
      canvas.style.height = `${height}px`;
    };

    const draw = (now: number) => {
      const dt = last ? Math.min(0.05, (now - last) / 1000) : 0.016;
      last = now;
      if ((probe++ & 63) === 0) readColor();
      if (cols === 0) return;

      const sig = getVoiceSignal();
      const t = now / 1000;
      const listening = sig.state === 'listening';
      const speaking = sig.state === 'speaking';
      const thinking = sig.state === 'thinking';
      const pulse = speaking ? readPulse(now) : 0;
      const drive = listening ? sig.level : pulse;

      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, width, height);
      const [r, g, b] = rgb;
      const midRow = (rows - 1) / 2;

      for (let c = 0; c < cols; c++) {
        const u = cols > 1 ? c / (cols - 1) : 1; // 0 at the label, 1 at the mic
        const reach = 0.18 + 0.82 * u * u; // fade toward the label
        // Voice: each column wants a slightly different share of the level, so the
        // field reads as a spectrum rather than a single bar.
        const jitter = 0.65 + 0.35 * (0.5 + 0.5 * Math.sin(c * 12.9898 + Math.floor(t * 14) * 78.233));
        const target = drive * jitter * (0.55 + 0.45 * u);
        const prev = colEnergy[c]!; // c < cols === colEnergy.length
        const k = target > prev ? 0.5 : 1 - Math.exp(-dt * 9);
        const e = prev + (target - prev) * k;
        colEnergy[c] = e;

        // Idle shimmer: a slow wave crossing toward the mic; quicker while thinking.
        const wave = reduceMotion ? 0.5 : 0.5 + 0.5 * Math.sin(t * (thinking ? 4.2 : 1.6) - c * 0.55);
        const idleA = (0.10 + 0.22 * wave) * reach;

        for (let rr = 0; rr < rows; rr++) {
          const dist = Math.abs(rr - midRow) / (rows / 2); // 0 centre → 1 edge
          const lit = Math.max(0, Math.min(1, e * 2.4 - dist * 1.1));
          const a = Math.max(idleA, 0.18 + 0.82 * lit);
          const rad = 1 + 0.6 * lit;
          ctx.fillStyle = `rgba(${r},${g},${b},${a})`;
          ctx.beginPath();
          ctx.arc(c * pitch + pitch / 2, rr * pitch + pitch / 2, rad, 0, Math.PI * 2);
          ctx.fill();
        }
      }
    };

    const loop = (now: number) => {
      if (!running) return;
      draw(now);
      raf = requestAnimationFrame(loop);
    };
    const start = () => {
      if (running || document.hidden) return;
      running = true;
      last = 0;
      raf = requestAnimationFrame(loop);
    };
    const stop = () => {
      running = false;
      cancelAnimationFrame(raf);
    };

    resize();
    readColor();

    const ro = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(() => { resize(); if (!running) draw(performance.now()); }) : null;
    if (canvas.parentElement) ro?.observe(canvas.parentElement);

    if (reduceMotion) {
      // Still frame at rest; while a voice state is live the level itself is the
      // feedback, so the loop runs only then and stops with it.
      const sync = () => {
        const s = getVoiceSignal().state;
        if (s === 'listening' || s === 'speaking') start(); else { stop(); draw(performance.now()); }
      };
      sync();
      const unsub = subscribeVoiceState(sync);
      return () => { unsub(); stop(); ro?.disconnect(); };
    }

    const onVis = () => (document.hidden ? stop() : start());
    document.addEventListener('visibilitychange', onVis);
    start();
    return () => {
      stop();
      ro?.disconnect();
      document.removeEventListener('visibilitychange', onVis);
    };
  }, [rows, pitch, reduceMotion]);

  return <canvas ref={canvasRef} className={`lv-dotmatrix ${className ?? ''}`} aria-hidden="true" />;
};

export default DotMatrix;
