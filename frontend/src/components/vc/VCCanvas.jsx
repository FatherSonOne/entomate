import { useEffect, useRef } from 'react'

const CRIMSON = '#FF2D6B'
const MINT    = '#00F5D4'
const AMBER   = '#FFB800'
const PHOSPHOR = '#A0FF32'

/**
 * VCCanvas — Void × Crimson animated background canvas.
 * Renders a fixed full-viewport canvas with the selected animation mode.
 * Extracted from the Design Playground (2026-03-21).
 *
 * @param {string}  mode    - 'neural'|'waves'|'orbital'|'particles'|'vortex'|'matrix'|'constellation'
 * @param {number}  speed   - 0–100, default 50
 * @param {number}  density - 0–100, default 95
 * @param {number}  opacity - 0–1,   default 0.9
 */
export default function VCCanvas({ mode = 'neural', speed = 50, density = 95, opacity = 0.9 }) {
  const canvasRef = useRef(null)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')

    let W = 0, H = 0
    let nodes = [], particles = [], stars = [], matrixCols = []
    let t = 0, raf = 0
    const spd  = speed
    const dens = density

    const nodeCount     = () => Math.round(20 + dens * 1.2)
    const particleCount = () => Math.round(30 + dens * 2)

    function buildNodes() {
      nodes = []
      for (let i = 0; i < nodeCount(); i++) {
        nodes.push({
          x: Math.random() * W, y: Math.random() * H,
          vx: (Math.random() - 0.5) * 0.4,
          vy: (Math.random() - 0.5) * 0.4,
          r: Math.random() * 2.5 + 1,
          col: [CRIMSON, MINT, AMBER][Math.floor(Math.random() * 3)],
        })
      }
    }

    function buildParticles() {
      particles = []
      for (let i = 0; i < particleCount(); i++) {
        particles.push({
          x: Math.random() * W, y: Math.random() * H,
          vx: (Math.random() - 0.5) * 0.6,
          vy: (Math.random() - 0.5) * 0.6,
          r:  Math.random() * 2 + 0.5,
          col: [CRIMSON, MINT, AMBER][Math.floor(Math.random() * 3)],
        })
      }
    }

    function buildStars() {
      stars = []
      for (let i = 0; i < Math.round(40 + dens * 1.5); i++) {
        stars.push({
          x: Math.random() * W, y: Math.random() * H,
          vx: (Math.random() - 0.5) * 0.08,
          vy: (Math.random() - 0.5) * 0.08,
          r: Math.random() * 1.5 + 0.3,
        })
      }
    }

    function buildMatrix() {
      matrixCols = []
      const cols = Math.round(W / 18)
      for (let i = 0; i < cols; i++) {
        matrixCols.push({
          x: i * 18 + 9,
          y: Math.random() * H,
          speed: 0.5 + Math.random() * 1.5,
          chars: Math.round(3 + Math.random() * 8),
        })
      }
    }

    function resize() {
      W = canvas.width  = window.innerWidth
      H = canvas.height = window.innerHeight
      buildNodes(); buildParticles(); buildStars(); buildMatrix()
    }

    /* ── Draw modes ── */

    function drawNeural() {
      const sf = spd / 50
      nodes.forEach(n => {
        n.x += n.vx * sf; n.y += n.vy * sf
        if (n.x < 0 || n.x > W) n.vx *= -1
        if (n.y < 0 || n.y > H) n.vy *= -1
      })
      const maxDist = 120 + dens
      for (let i = 0; i < nodes.length; i++) {
        for (let j = i + 1; j < nodes.length; j++) {
          const dx = nodes[j].x - nodes[i].x
          const dy = nodes[j].y - nodes[i].y
          const d  = Math.sqrt(dx * dx + dy * dy)
          if (d < maxDist) {
            ctx.beginPath()
            ctx.strokeStyle = `rgba(255,45,107,${(1 - d / maxDist) * 0.2})`
            ctx.lineWidth = 0.6
            ctx.moveTo(nodes[i].x, nodes[i].y)
            ctx.lineTo(nodes[j].x, nodes[j].y)
            ctx.stroke()
          }
        }
      }
      nodes.forEach(n => {
        ctx.beginPath()
        ctx.arc(n.x, n.y, n.r, 0, Math.PI * 2)
        ctx.fillStyle = n.col
        ctx.globalAlpha = 0.6
        ctx.fill()
        ctx.globalAlpha = 1
      })
    }

    function drawWaves() {
      const sf = spd / 50
      const waves = [
        { col: CRIMSON, amp: 40, freq: 0.012, off: t * 0.02 * sf },
        { col: MINT,    amp: 30, freq: 0.018, off: t * 0.015 * sf + 1 },
        { col: AMBER,   amp: 25, freq: 0.022, off: t * 0.025 * sf + 2 },
      ]
      waves.forEach(w => {
        ctx.beginPath()
        for (let x = 0; x <= W; x += 3) {
          const y = H / 2 + Math.sin(x * w.freq + w.off) * w.amp * (0.5 + 0.5 * Math.sin(t * 0.01 * sf))
          x === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y)
        }
        ctx.strokeStyle = w.col + '55'
        ctx.lineWidth = 1.5
        ctx.stroke()
      })
    }

    function drawOrbital() {
      const sf = spd / 50
      const cx = W / 2, cy = H / 2
      const rings = [
        { rx: W * 0.30, ry: H * 0.18, col: CRIMSON, dots: 3, speed:  0.015 * sf },
        { rx: W * 0.22, ry: H * 0.28, col: MINT,    dots: 2, speed: -0.010 * sf },
        { rx: W * 0.38, ry: H * 0.10, col: AMBER,   dots: 4, speed:  0.008 * sf },
      ]
      rings.forEach((ring, ri) => {
        ctx.beginPath()
        ctx.ellipse(cx, cy, ring.rx, ring.ry, ri * 0.6, 0, Math.PI * 2)
        ctx.strokeStyle = ring.col + '33'
        ctx.lineWidth = 1
        ctx.stroke()
        for (let d = 0; d < ring.dots; d++) {
          const angle = t * ring.speed + (d / ring.dots) * Math.PI * 2
          const x = cx + Math.cos(angle) * ring.rx
          const y = cy + Math.sin(angle) * ring.ry
          ctx.beginPath()
          ctx.arc(x, y, 4, 0, Math.PI * 2)
          ctx.fillStyle = ring.col
          ctx.shadowColor = ring.col
          ctx.shadowBlur  = 8
          ctx.fill()
          ctx.shadowBlur = 0
        }
      })
    }

    function drawParticles() {
      const sf = spd / 50
      particles.forEach(p => {
        p.x += p.vx * sf; p.y += p.vy * sf
        if (p.x < 0) p.x = W; if (p.x > W) p.x = 0
        if (p.y < 0) p.y = H; if (p.y > H) p.y = 0
      })
      const maxD = 80 + dens * 0.5
      for (let i = 0; i < particles.length; i++) {
        for (let j = i + 1; j < particles.length; j++) {
          const dx = particles[j].x - particles[i].x
          const dy = particles[j].y - particles[i].y
          const d  = Math.sqrt(dx * dx + dy * dy)
          if (d < maxD) {
            ctx.beginPath()
            ctx.strokeStyle = `rgba(0,245,212,${0.2 * (1 - d / maxD)})`
            ctx.lineWidth = 0.5
            ctx.moveTo(particles[i].x, particles[i].y)
            ctx.lineTo(particles[j].x, particles[j].y)
            ctx.stroke()
          }
        }
      }
      particles.forEach(p => {
        ctx.beginPath()
        ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2)
        ctx.fillStyle = p.col
        ctx.globalAlpha = 0.7
        ctx.fill()
        ctx.globalAlpha = 1
      })
    }

    function drawVortex() {
      const sf = spd / 50
      const cx = W / 2, cy = H / 2
      const count = Math.round(40 + dens * 1.5)
      for (let i = 0; i < count; i++) {
        const angle  = (i / count) * Math.PI * 6 + t * 0.02 * sf
        const radius = (i / count) * Math.min(W, H) * 0.4
        const a = i / count
        ctx.beginPath()
        ctx.arc(cx + Math.cos(angle) * radius, cy + Math.sin(angle) * radius, 1.5, 0, Math.PI * 2)
        ctx.fillStyle  = a < 0.33 ? CRIMSON : a < 0.66 ? MINT : AMBER
        ctx.globalAlpha = a * 0.7
        ctx.fill()
        ctx.globalAlpha = 1
      }
    }

    function drawMatrix() {
      const sf = spd / 50
      ctx.font = '10px monospace'
      matrixCols.forEach(col => {
        col.y += col.speed * sf * 2
        if (col.y > H + 80) { col.y = -40; col.chars = Math.round(3 + Math.random() * 8) }
        for (let i = 0; i < col.chars; i++) {
          const y = col.y - i * 14
          if (y < 0 || y > H) continue
          ctx.fillStyle = i === 0 ? PHOSPHOR : `rgba(160,255,50,${(1 - i / col.chars) * 0.4})`
          ctx.fillText(String.fromCharCode(0x30A0 + Math.floor(Math.random() * 96)), col.x, y)
        }
      })
    }

    function drawConstellation() {
      const sf = spd / 50
      stars.forEach(s => {
        s.x += s.vx * sf; s.y += s.vy * sf
        if (s.x < 0 || s.x > W) s.vx *= -1
        if (s.y < 0 || s.y > H) s.vy *= -1
      })
      const maxD = 100 + dens
      for (let i = 0; i < stars.length; i++) {
        for (let j = i + 1; j < stars.length; j++) {
          const dx = stars[j].x - stars[i].x
          const dy = stars[j].y - stars[i].y
          const d  = Math.sqrt(dx * dx + dy * dy)
          if (d < maxD) {
            ctx.beginPath()
            ctx.strokeStyle = `rgba(0,245,212,${0.25 * (1 - d / maxD)})`
            ctx.lineWidth = 0.5
            ctx.moveTo(stars[i].x, stars[i].y)
            ctx.lineTo(stars[j].x, stars[j].y)
            ctx.stroke()
          }
        }
      }
      stars.forEach(s => {
        ctx.beginPath()
        ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2)
        ctx.fillStyle   = MINT
        ctx.globalAlpha = 0.6
        ctx.fill()
        ctx.globalAlpha = 1
      })
    }

    function loop() {
      raf = requestAnimationFrame(loop)
      t++
      ctx.clearRect(0, 0, W, H)
      if      (mode === 'neural')        drawNeural()
      else if (mode === 'waves')         drawWaves()
      else if (mode === 'orbital')       drawOrbital()
      else if (mode === 'particles')     drawParticles()
      else if (mode === 'vortex')        drawVortex()
      else if (mode === 'matrix')        drawMatrix()
      else if (mode === 'constellation') drawConstellation()
      // 'off' — no draw, just clear
    }

    window.addEventListener('resize', resize)
    resize()
    loop()

    return () => {
      cancelAnimationFrame(raf)
      window.removeEventListener('resize', resize)
    }
  }, [mode, speed, density])

  return (
    <canvas
      ref={canvasRef}
      id="vc-canvas"
      style={{ opacity }}
      aria-hidden="true"
    />
  )
}
