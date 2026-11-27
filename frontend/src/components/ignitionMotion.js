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

  const vec2 HUB = vec2(0.514, 0.478);
  const vec3 MINT = vec3(0.35, 0.96, 0.89);
  const vec3 COPPER = vec3(1.0, 0.41, 0.22);
  const vec3 WHITE_GOLD = vec3(1.0, 0.93, 0.68);

  float pulse(float start, float peak, float hold, float end) {
    return smoothstep(start, peak, u_progress) * (1.0 - smoothstep(hold, end, u_progress));
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
    mat2 twist = mat2(0.83, -0.55, 0.55, 0.83);
    return noise(p) * 0.54
      + noise(twist * p * 2.07) * 0.30
      + noise(p * 4.12 + vec2(7.1, 2.7)) * 0.16;
  }

  float bell(float distance) {
    return exp(-distance * distance);
  }

  vec4 over(vec4 below, vec3 color, float alpha) {
    return vec4(color * alpha, alpha) + below * (1.0 - alpha);
  }

  // Two counterflowing drafts curl across the horizontal rail toward the hub.
  vec2 intake(vec2 p, float side) {
    float phase = u_progress;
    float travel = side * p.x;
    float draft = pulse(0.015, 0.14, 0.27, 0.43);
    if (draft <= 0.0 || travel <= 0.015 || travel >= 0.36 || abs(p.y) > 0.23) return vec2(0.0);
    float head = mix(0.29, 0.021, smoothstep(0.024, 0.35, phase - side * 0.012));
    float direction = clamp(travel / 0.31, 0.0, 1.0);
    float bow = side * sin(direction * 3.14159) * (0.033 + 0.008 * sin(phase * 17.0));
    float gap = p.y - bow;
    float range = smoothstep(0.015, 0.043, travel) * (1.0 - smoothstep(0.24, 0.36, travel));
    float grain = wisps(vec2(travel * 20.0 + phase * 25.0, gap * 41.0 - side * 0.8));
    float wake = bell((travel - head - 0.058) * 10.5);
    float fog = bell(gap / (0.013 + 0.045 * direction)) * smoothstep(0.28, 0.72, grain);
    float filament = bell((travel - head) * 24.0) * bell(gap / 0.006) * (0.58 + 0.42 * grain);
    return vec2(fog * wake, filament) * range * draft;
  }

  float sparks(vec2 p, float bend) {
    // Advection in emitter space, so individual flecks rise with the hot wake.
    float lift = -p.y;
    vec2 field = vec2((p.x - bend) * 62.0 + sin(lift * 28.0) * 0.54,
      lift * 57.0 - u_progress * 48.0);
    vec2 cell = floor(field);
    float seed = hash(cell);
    vec2 center = 0.18 + 0.64 * vec2(hash(cell + 6.1), hash(cell - 7.3));
    vec2 gap = fract(field) - center;
    float ember = 1.0 - smoothstep(0.035, 0.085, length(gap * vec2(1.25, 0.78)));
    float tail = exp(-abs(gap.x) * 52.0 - abs(gap.y + 0.043) * 13.0) * 0.56;
    return (ember + tail) * step(0.57, seed);
  }

  void main() {
    vec2 p = v_uv - HUB;
    float phase = u_progress;
    float reveal = pulse(0.012, 0.10, 0.81, 0.98);
    if (reveal <= 0.0 || abs(p.x) > 0.37 || abs(p.y) > 0.48) {
      gl_FragColor = texture2D(u_art, v_uv);
      return;
    }

    float heat = pulse(0.29, 0.43, 0.62, 0.90);
    float charge = pulse(0.20, 0.365, 0.45, 0.69);
    float rise = -p.y;
    float height = clamp(rise / 0.40, 0.0, 1.0);
    float reach = mix(0.012, 0.44, smoothstep(0.29, 0.64, phase));
    float head = smoothstep(-0.018, 0.032, rise) * (1.0 - smoothstep(reach - 0.080, reach + 0.015, rise));
    float bend = height * (0.027 * sin(rise * 21.0 - phase * 12.0) + 0.009 * sin(rise * 42.0 - phase * 21.0));
    float crosswind = p.x - bend;
    float eddy = noise(vec2(p.x * 36.0 + 2.4, rise * 22.0 - phase * 15.0));
    float corridor = (0.012 + height * height * 0.065);
    float thermal = bell(crosswind / (corridor + 0.023)) * head * heat;
    vec2 refraction = vec2((eddy - 0.5) * 0.019, (eddy - 0.5) * 0.006) * thermal;
    vec4 art = texture2D(u_art, v_uv + refraction);

    vec2 draft = intake(p, -1.0) + intake(p, 1.0);
    art = over(art, MINT, draft.x * reveal * 0.52);
    art = over(art, vec3(0.81, 1.0, 0.91), draft.y * reveal * 0.72);

    vec2 plume = vec2(crosswind * 42.0 + (eddy - 0.5) * height * 2.3, rise * 23.0 - phase * 18.0);
    float turbulence = thermal > 0.0005 ? wisps(plume) : 0.4;
    float haze = smoothstep(0.25, 0.76, turbulence);
    float plumeEnvelope = bell(crosswind / corridor) * head * heat;
    vec3 plumeColor = mix(vec3(0.84, 0.20, 0.16), COPPER, (1.0 - height) * 0.75 + haze * 0.22);
    art = over(art, plumeColor, haze * thermal * reveal * 0.56);
    art = over(art, COPPER, plumeEnvelope * haze * reveal * 0.70);

    float filament = crosswind - (turbulence - 0.4) * (0.008 + 0.027 * height);
    float jet = bell(filament / (0.006 + height * 0.016));
    float temperature = 1.0 - smoothstep(0.13, 0.94, height);
    art = over(art, mix(COPPER, WHITE_GOLD, 0.41 + temperature * 0.49),
      jet * plumeEnvelope * (0.23 + 0.67 * haze) * reveal);
    art = over(art, WHITE_GOLD, sparks(p, bend) * bell(crosswind / (0.106 + height * 0.032)) * head * heat * reveal * 0.69);

    float radius = length(p);
    float lip = bell((radius - 0.058) * 170.0);
    float core = bell(radius / 0.031);
    float hotMetal = lip * (0.48 + 0.52 * eddy) + core * 0.64;
    art = over(art, WHITE_GOLD, hotMetal * charge * reveal * 0.70);

    // After the exhaust clears the chamber, warm light trails down its spine.
    float exhaust = pulse(0.40, 0.51, 0.66, 0.92);
    float wave = mix(0.04, 0.37, smoothstep(0.43, 0.84, phase));
    float trail = bell((p.y - wave) * 21.0) * bell((p.x + 0.004) / 0.026);
    gl_FragColor = over(art, COPPER, trail * smoothstep(0.039, 0.08, p.y) * exhaust * reveal * 0.60);
  }
`

export function createIgnitionTimeline(svg, unavailable) {
  return createRasterLogoTimeline(svg, unavailable, { fragment: FRAGMENT, duration: 4.48, maxSize: 640, repeatDelay: 0.18 })
}
