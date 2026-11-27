import { createRasterLogoTimeline } from './rasterLogoMotion'

const FRAGMENT = `
  #ifdef GL_FRAGMENT_PRECISION_HIGH
  precision highp float;
  #else
  precision mediump float;
  #endif
  varying mediump vec2 v_uv;
  uniform sampler2D u_art;
  uniform float u_progress;

  const vec2 HEART = vec2(0.485, 0.493);
  const vec3 MINT = vec3(0.35, 0.87, 0.82);
  const vec3 GLASS = vec3(0.70, 0.98, 1.0);
  const vec3 AMBER = vec3(1.0, 0.58, 0.28);
  const vec3 GOLD = vec3(1.0, 0.86, 0.59);

  float pulse(float start, float peak, float hold, float end) {
    return smoothstep(start, peak, u_progress) * (1.0 - smoothstep(hold, end, u_progress));
  }

  float bell(float distance) {
    return exp(-distance * distance);
  }

  float hash(vec2 cell) {
    vec3 p = fract(vec3(cell.xyx) * 0.1031);
    p += dot(p, p.yzx + 33.33);
    return fract((p.x + p.y) * p.z);
  }

  float noise(vec2 p) {
    vec2 cell = floor(p);
    vec2 f = fract(p);
    f = f * f * (3.0 - 2.0 * f);
    return mix(mix(hash(cell), hash(cell + vec2(1.0, 0.0)), f.x),
      mix(hash(cell + vec2(0.0, 1.0)), hash(cell + vec2(1.0, 1.0)), f.x), f.y);
  }

  float wisps(vec2 p) {
    mat2 twist = mat2(0.77, -0.638, 0.638, 0.77);
    return noise(p) * 0.56 + noise(twist * p * 2.04) * 0.28 + noise(p * 4.27 + 6.1) * 0.16;
  }

  vec4 over(vec4 below, vec3 tint, float alpha) {
    return vec4(tint * alpha, alpha) + below * (1.0 - alpha);
  }

  float motes(vec2 p) {
    vec2 field = p * vec2(75.0, 66.0);
    vec2 cell = floor(field);
    vec2 jitter = 0.19 + 0.62 * vec2(hash(cell - 4.5), hash(cell + 11.9));
    float d = length(fract(field) - jitter);
    return (1.0 - smoothstep(0.025, 0.092, d)) * step(0.62, hash(cell));
  }

  void main() {
    float phase = u_progress;
    float visible = pulse(0.013, 0.11, 0.84, 0.995);
    if (visible <= 0.0) {
      gl_FragColor = texture2D(u_art, v_uv);
      return;
    }

    vec2 hub = v_uv - HEART;
    float hubDistance = length(hub);
    float direction = atan(hub.y, hub.x);
    if (direction < -3.05) direction += 6.2831853;

    // Each lobe bends away from its fixed seams with independent timing.
    vec4 profile;
    vec2 seam;
    float start;
    float side;
    if (direction < -1.57) {
      profile = vec4(0.285, 0.279, 0.168, 0.167);
      seam = vec2(-3.05, -1.57);
      start = 0.035;
      side = -1.0;
    } else if (direction < -0.105) {
      profile = vec4(0.693, 0.268, 0.173, 0.176);
      seam = vec2(-1.57, -0.105);
      start = 0.108;
      side = 1.0;
    } else if (direction < 1.115) {
      profile = vec4(0.748, 0.679, 0.161, 0.177);
      seam = vec2(-0.105, 1.115);
      start = 0.186;
      side = -1.0;
    } else if (direction < 2.105) {
      profile = vec4(0.478, 0.767, 0.173, 0.181);
      seam = vec2(1.115, 2.105);
      start = 0.252;
      side = -1.0;
    } else {
      profile = vec4(0.234, 0.669, 0.167, 0.177);
      seam = vec2(2.105, 3.2331853);
      start = 0.306;
      side = 1.0;
    }

    vec2 axis = normalize(profile.xy - HEART);
    vec2 tangent = vec2(-axis.y, axis.x);
    vec2 rel = v_uv - profile.xy;
    vec2 shape = vec2(dot(rel, axis), dot(rel, tangent)) / profile.zw;
    float r = length(shape);
    float loosen = smoothstep(0.0, 0.24, min(direction - seam.x, seam.y - direction));
    float opening = pulse(start, start + 0.26, start + 0.32, start + 0.62);
    float turn = sin(shape.x * 1.8 - (phase - start) * 8.4);
    float hinge = bell(r * 0.78) * opening * loosen * (1.0 - smoothstep(1.67, 2.28, r));
    vec2 shift = -(axis * (0.061 + shape.x * 0.019)
      + tangent * (0.023 * turn * (0.54 + 0.46 * r) * side)) * hinge;

    float sweep = pulse(start + 0.025, start + 0.13, start + 0.33, start + 0.48) * loosen;
    float turnAt = mix(2.78, -2.38, smoothstep(start + 0.01, start + 0.46, phase));
    float angle = atan(shape.y * side, shape.x);
    float crest = bell((1.0 - cos(angle - turnAt)) * 4.6);
    float drag = bell((1.0 - cos(angle - turnAt - 0.53)) * 2.55);
    float veil = bell((r - 0.92) / 0.34) * drag * sweep;
    float rim = bell((r - 0.97) / 0.088) * crest * sweep;
    vec2 drift = (tangent * cos(angle) - axis * sin(angle) * side) * veil;

    float anchored = smoothstep(0.107, 0.28, hubDistance);
    vec2 innerVeil = hub / vec2(0.203, 0.165);
    float innerRadius = length(innerVeil);
    float innerAngle = atan(innerVeil.y, innerVeil.x);
    float unwind = bell((innerRadius - 1.06) * 3.8) * pulse(0.32, 0.54, 0.75, 0.94);
    float ripple = sin(innerAngle * 3.0 - phase * 17.0);
    vec2 rippleShift = (vec2(-hub.y, hub.x) * 0.071 + hub * 0.039) * ripple * unwind;
    vec4 art = texture2D(u_art, v_uv + (shift * anchored + rippleShift) * visible);

    float glassPresence = smoothstep(0.03, 0.56, art.a);
    if (veil > 0.0001) {
      vec2 wind = (v_uv + shift * 3.1) * 17.0
        + drift * 1.46 + vec2(phase * 3.7, -phase * 5.2);
      float filament = smoothstep(0.27, 0.74, wisps(wind));
      vec2 margin = min(v_uv, 1.0 - v_uv);
      float falloff = smoothstep(0.015, 0.071, min(margin.x, margin.y));
      float film = veil * visible * falloff;
      float trail = rim * visible * falloff;
      art = over(art, MINT, film * filament * (0.34 + glassPresence * 0.28));
      art = over(art, GLASS, trail * (0.13 + glassPresence * 0.44) * (0.25 + 0.75 * filament));
      float dust = motes(v_uv + shift + drift * 0.024 + vec2(phase * 0.044, phase * -0.021));
      art = over(art, GLASS, dust * film * 0.72);
    }

    // Amber returns through the inner ribbon after the glass has opened.
    float returnHead = mix(-0.48, -4.74, smoothstep(0.39, 0.89, phase));
    float returnWave = bell((1.0 - cos(innerAngle - returnHead)) * 3.6);
    float ribbon = bell((innerRadius - 0.98) * 6.1) * unwind * returnWave;
    float warmPixels = smoothstep(0.017, 0.30, art.r - art.b);
    art = over(art, AMBER, ribbon * warmPixels * visible * 0.68);

    float first = pulse(0.015, 0.11, 0.21, 0.38);
    float last = pulse(0.51, 0.68, 0.75, 0.93);
    float lattice = bell(hub.x / 0.111) * bell(hub.y / 0.067);
    float run = mix(-0.089, 0.096, smoothstep(0.019, 0.35, phase));
    float charge = (first * bell((hub.x - run) / 0.052) + last * 0.58) * lattice;
    gl_FragColor = over(art, GOLD, charge * warmPixels * visible * 0.65);
  }
`

export function createBloomTimeline(svg, unavailable) {
  return createRasterLogoTimeline(svg, unavailable, { fragment: FRAGMENT, duration: 4.62, maxSize: 640, repeatDelay: 0.22 })
}
