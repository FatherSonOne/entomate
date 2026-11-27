import { createRasterGrid, createRasterLogoTimeline } from './rasterLogoMotion'

const DURATION = 3.44

// Deform the illustrated artwork as one continuous surface. The three free
// curls carry the bending wave while the copper bus through the core holds.
const VERTEX = `
  attribute vec2 a_uv;
  uniform float u_progress;
  varying mediump vec2 v_uv;

  vec2 bend(vec2 center, vec2 radius, float start, float direction) {
    vec2 local = (a_uv - center) / radius;
    float weight = 1.0 - smoothstep(0.22, 1.19, length(local));
    float phase = clamp((u_progress - start - a_uv.y * 0.09) / 0.53, 0.0, 1.0);
    float envelope = sin(3.141593 * phase);
    float roll = sin(6.283185 * phase) * envelope * direction;
    vec2 turn = vec2(-local.y, local.x) * roll * 0.15;
    vec2 fold = vec2(-local.x * 0.041, local.y * 0.023) * envelope * envelope;
    return (turn + fold) * weight;
  }

  void main() {
    vec2 flow = bend(vec2(0.77, 0.29), vec2(0.29, 0.29), 0.00, -1.0)
      + bend(vec2(0.25, 0.24), vec2(0.27, 0.26), 0.12, 1.0)
      + bend(vec2(0.60, 0.78), vec2(0.29, 0.23), 0.30, 1.0);
    float bus = smoothstep(0.03, 0.145, abs(a_uv.y - 0.51));
    vec2 p = a_uv + flow * bus;
    gl_Position = vec4(p.x * 2.0 - 1.0, 1.0 - p.y * 2.0, 0.0, 1.0);
    v_uv = a_uv;
  }
`

const FRAGMENT = `
  precision mediump float;
  uniform sampler2D u_art;
  varying mediump vec2 v_uv;
  void main() { gl_FragColor = texture2D(u_art, v_uv); }
`

const mesh = createRasterGrid(32)

export function createOrbitTimeline(svg, unavailable) {
  return createRasterLogoTimeline(svg, unavailable, { vertex: VERTEX, fragment: FRAGMENT, mesh, duration: DURATION, repeatDelay: 0.24 })
}
