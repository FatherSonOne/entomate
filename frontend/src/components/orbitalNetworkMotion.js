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

  const float TAU = 6.2831853;
  const vec2 HUB = vec2(0.5, 0.501);

  float hash(vec2 seed) {
    vec3 p = fract(vec3(seed.xyx) * 0.1031);
    p += dot(p, p.yzx + 33.33);
    return fract((p.x + p.y) * p.z);
  }

  float noise(vec2 p) {
    vec2 cell = floor(p);
    vec2 f = fract(p);
    f = f * f * (3.0 - 2.0 * f);
    return mix(mix(hash(cell), hash(cell + vec2(1.0, 0.0)), f.x),
      mix(hash(cell + vec2(0.0, 1.0)), hash(cell + vec2(1.0)), f.x), f.y);
  }

  float cloud(vec2 p) {
    mat2 turn = mat2(0.82, 0.57, -0.57, 0.82);
    float f = noise(p) * 0.54;
    p = turn * p * 2.05;
    f += noise(p) * 0.27;
    p = turn * p * 2.07;
    f += noise(p) * 0.13;
    return f + noise(turn * p * 2.04) * 0.06;
  }

  float vapor(vec2 orbit, float phase) {
    // Carry the turbulence along the ellipse, with slower eddies in its wake.
    float radius = length(orbit);
    float angle = phase - 1.4 * radius;
    mat2 turn = mat2(cos(angle), sin(angle), -sin(angle), cos(angle));
    vec2 lane = turn * orbit * 4.8;
    vec2 eddy = vec2(noise(lane * 0.79 + vec2(1.8, 7.1)), noise(lane * 0.82 - vec2(6.2, 2.1)));
    float density = cloud(lane + (eddy - 0.5) * 2.9);
    float edge = (radius - 0.94) * 3.4;
    float ribbon = exp(-edge * edge);
    return smoothstep(0.34, 0.78, density) * ribbon;
  }

  float dust(vec2 orbit, float phase) {
    float radius = length(orbit);
    float angle = atan(orbit.y, orbit.x) / TAU + 0.5;
    vec2 p = vec2(angle * 52.0 - u_progress * 52.0, radius * 19.0 + 0.25 * sin(phase + angle * TAU * 3.0));
    vec2 cell = vec2(mod(floor(p.x), 52.0), floor(p.y));
    float state = hash(cell);
    vec2 center = 0.17 + 0.66 * vec2(hash(cell + 7.1), hash(cell + 13.7));
    vec2 d = fract(p) - center;
    float speck = 1.0 - smoothstep(0.012, 0.086, length(d * vec2(1.22, 1.0)));
    float trail = exp(-abs(d.x + 0.054) * 19.0 - abs(d.y) * 45.0) * 0.36;
    float lane = smoothstep(0.67, 0.86, radius) * (1.0 - smoothstep(1.02, 1.21, radius));
    float twinkle = 0.64 + 0.36 * sin(phase * 2.0 + state * TAU);
    return (speck + trail) * step(0.53, state) * lane * twinkle;
  }

  float transmission(vec2 p, vec2 source, float bend, float start) {
    float time = (u_progress - start) / 0.35;
    if (time <= 0.0 || time >= 1.0) return 0.0;
    vec2 axis = HUB - source;
    vec2 normal = normalize(vec2(-axis.y, axis.x));
    vec2 offset = p - source;
    float along = dot(offset, axis) / dot(axis, axis);
    float arc = sin(clamp(along, 0.0, 1.0) * 3.1415927) * bend;
    float distance = abs(dot(offset, normal) - arc);
    float head = time * 1.22 - 0.11;
    float streak = exp(-abs(along - head) * 18.0);
    float lane = smoothstep(-0.03, 0.04, along) * (1.0 - smoothstep(0.97, 1.02, along));
    float filament = 0.58 * exp(-distance * 360.0) + 0.42 * exp(-distance * 105.0);
    return streak * lane * filament * sin(time * 3.1415927);
  }

  vec4 over(vec4 under, vec3 color, float alpha) {
    return vec4(color * alpha, alpha) + under * (1.0 - alpha);
  }

  void main() {
    vec4 art = texture2D(u_art, v_uv);
    float reveal = smoothstep(0.015, 0.15, u_progress) * (1.0 - smoothstep(0.83, 0.99, u_progress));
    if (reveal == 0.0) {
      gl_FragColor = art;
      return;
    }

    float phase = u_progress * TAU;
    vec2 ellipse = (v_uv - vec2(0.5, 0.49)) / vec2(0.421, 0.278);
    float mist = vapor(ellipse, phase);
    float temperature = smoothstep(-0.73, 0.65, ellipse.x + 0.31 * sin(phase));
    vec3 mistColor = mix(vec3(0.66, 0.34, 0.44), vec3(0.29, 0.79, 0.82), temperature);
    float mistAlpha = mist * reveal * 0.49;
    vec4 below = vec4(mistColor * mistAlpha, mistAlpha);
    vec4 surface = art + below * (1.0 - art.a);
    surface = over(surface, mistColor, mistAlpha * 0.28);

    float motes = dust(ellipse, phase) * reveal;
    vec3 dustColor = mix(vec3(1.0, 0.65, 0.36), vec3(0.56, 1.0, 0.96), temperature);
    surface = over(surface, dustColor, motes * 0.76);

    float amber = transmission(v_uv, vec2(0.329, 0.337), 0.023, 0.12)
      + transmission(v_uv, vec2(0.172, 0.505), -0.014, 0.45);
    float teal = transmission(v_uv, vec2(0.730, 0.377), -0.031, 0.23)
      + transmission(v_uv, vec2(0.726, 0.650), 0.026, 0.34);
    surface = over(surface, vec3(1.0, 0.74, 0.41), clamp(amber * reveal, 0.0, 0.85));
    surface = over(surface, vec3(0.71, 1.0, 0.96), clamp(teal * reveal, 0.0, 0.86));

    vec2 hub = v_uv - HUB;
    float turn = atan(hub.y, hub.x);
    float ring = exp(-abs(length(hub) - 0.145) * 230.0);
    float sweep = pow(max(0.0, cos(turn - phase * 1.6)), 9.0);
    float charge = smoothstep(0.43, 0.57, u_progress) * (1.0 - smoothstep(0.69, 0.86, u_progress));
    surface = over(surface, vec3(0.78, 0.98, 1.0), ring * sweep * charge * reveal * 0.84);
    gl_FragColor = surface;
  }
`

export function createOrbitalNetworkTimeline(svg, unavailable) {
  return createRasterLogoTimeline(svg, unavailable, { fragment: FRAGMENT, duration: 5.6, maxSize: 700 })
}
