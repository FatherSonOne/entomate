import { createRasterGrid, createRasterLogoTimeline } from './rasterLogoMotion'

const VERTEX = `
  attribute vec2 a_uv;
  uniform float u_progress;
  varying mediump vec2 v_uv;
  varying mediump vec4 v_fold;

  const vec2 FRAME = vec2(0.501, 0.497);
  const vec2 HUB = vec2(0.574, 0.467);
  const float CAMERA = 1.17;

  float bell(float x) { return exp(-x * x); }

  void main() {
    vec2 relative = a_uv - FRAME;
    float radius = length(relative);
    vec2 outward = relative / max(radius, 0.0001);
    vec2 tangent = vec2(outward.y, -outward.x);
    float angle = atan(relative.y, -relative.x);
    float along = (angle + 1.79) / 3.68;
    float head = mix(-0.18, 1.22, smoothstep(0.014, 0.82, u_progress));
    float distance = along - head;
    float envelope = smoothstep(0.012, 0.11, u_progress) * (1.0 - smoothstep(0.77, 0.985, u_progress));
    float openArc = smoothstep(-1.98, -1.75, angle) * (1.0 - smoothstep(1.84, 2.17, angle));
    float ribbon = smoothstep(0.241, 0.341, radius) * (1.0 - smoothstep(0.451, 0.53, radius));
    float fixedHub = smoothstep(0.163, 0.263, length(a_uv - HUB));
    vec2 margin = min(a_uv, 1.0 - a_uv);
    float bounds = smoothstep(0.018, 0.088, min(margin.x, margin.y));
    float material = openArc * ribbon * fixedHub * bounds * envelope;

    float crest = bell(distance / 0.147) * material;
    float wake = bell((distance + 0.172) / 0.168) * material;
    float pitch = 1.45 * crest - 0.79 * wake;
    float thickness = radius - (0.308 + 0.018 * sin(angle * 2.0));
    // Turn the ribbon cross-section around the local tangent of its arc.
    float z = thickness * sin(pitch);
    vec2 p = a_uv + outward * thickness * (cos(pitch) - 1.0)
      + tangent * (0.018 * crest - 0.024 * wake);
    float w = 1.0 - z / CAMERA;
    vec2 origin = vec2(HUB.x * 2.0 - 1.0, 1.0 - HUB.y * 2.0);
    gl_Position = vec4(origin * w + (p - HUB) * vec2(2.0, -2.0), -z * 0.6, w);
    v_uv = a_uv;
    v_fold = vec4(pitch, crest, wake, along);
  }
`

const FRAGMENT = `
  #ifdef GL_FRAGMENT_PRECISION_HIGH
  precision highp float;
  #else
  precision mediump float;
  #endif
  uniform sampler2D u_art;
  uniform float u_progress;
  varying mediump vec2 v_uv;
  varying mediump vec4 v_fold;

  const vec2 HUB = vec2(0.574, 0.467);
  const vec2 FRAME = vec2(0.501, 0.497);
  const vec3 ICE = vec3(0.52, 0.96, 0.93);
  const vec3 ROSE = vec3(1.0, 0.65, 0.63);
  const vec3 COPPER = vec3(1.0, 0.82, 0.56);

  float bell(float x) { return exp(-x * x); }

  float hash(vec2 p) {
    vec3 s = fract(vec3(p.xyx) * 0.1031);
    s += dot(s, s.yzx + 33.33);
    return fract((s.x + s.y) * s.z);
  }
  float noise(vec2 p) {
    vec2 c = floor(p);
    vec2 f = fract(p);
    f = f * f * (3.0 - 2.0 * f);
    return mix(mix(hash(c), hash(c + vec2(1.0, 0.0)), f.x),
      mix(hash(c + vec2(0.0, 1.0)), hash(c + vec2(1.0, 1.0)), f.x), f.y);
  }
  vec4 over(vec4 below, vec3 color, float alpha) {
    return vec4(color * alpha, alpha) + below * (1.0 - alpha);
  }

  void main() {
    vec4 art = texture2D(u_art, v_uv);
    float phase = u_progress;
    if (phase <= 0.012 || phase >= 0.985) {
      gl_FragColor = art;
      return;
    }

    float radius = length(v_uv - FRAME);
    float material = smoothstep(0.025, 0.50, art.a);
    float pitch = v_fold.x;
    float active = v_fold.y + v_fold.z;

    if (active > 0.0005) {
      // A turning surface presents different faces to the cool and warm lights.
      float highlight = bell((pitch - 0.55) * 4.8) * v_fold.y;
      float reflection = bell((pitch + 0.36) * 4.0) * v_fold.z;
      art.rgb = min(vec3(art.a), art.rgb * (1.0 - 0.115 * v_fold.y + 0.23 * reflection));
      float band = bell((radius - 0.377 - pitch * 0.022) / 0.04);
      float contour = bell((radius - 0.411 - 0.012 * sin(v_fold.w * 23.0 - phase * 15.0)) / 0.012);
      art = over(art, ROSE, (band * highlight * 0.64 + contour * v_fold.y * 0.3) * material);
      art = over(art, ICE, (band * reflection * 0.57 + contour * v_fold.z * 0.19) * material);

      float gap = (radius - 0.412) / 0.066;
      vec2 current = vec2(v_fold.w * 14.0 - phase * 21.5, gap * 2.6 + pitch);
      float turbulence = noise(current) * 0.67 + noise(current * 2.13 + 4.2) * 0.33;
      float mist = bell(gap) * smoothstep(0.32, 0.78, turbulence) * (0.24 * v_fold.y + 0.5 * v_fold.z);
      art = over(art, mix(ICE, ROSE, v_fold.y), mist);

      vec2 cell = vec2(v_fold.w * 71.0 - phase * 89.0, (gap + 0.065 * sin(phase * 20.0)) * 7.5);
      vec2 seed = floor(cell);
      vec2 p = fract(cell) - (0.17 + 0.66 * vec2(hash(seed + 5.8), hash(seed - 7.1)));
      float fleck = 1.0 - smoothstep(0.02, 0.091, length(p));
      art = over(art, COPPER, fleck * step(0.52, hash(seed)) * bell(gap) * min(1.0, active) * 0.72);
    }

    // The anchored circuit catches a reflection when the fold reaches its root.
    vec2 hub = v_uv - HUB;
    float receive = smoothstep(0.47, 0.66, phase) * (1.0 - smoothstep(0.79, 0.972, phase));
    float lip = bell((length(hub) - 0.153) / 0.017);
    float face = bell((atan(hub.y, hub.x) - 1.79) / 0.77);
    gl_FragColor = over(art, COPPER, lip * face * material * receive * 0.52);
  }
`

const mesh = createRasterGrid(64)

export function createRibbonCatalystTimeline(svg, unavailable) {
  return createRasterLogoTimeline(svg, unavailable, {
    vertex: VERTEX, fragment: FRAGMENT, mesh, duration: 4.44, maxSize: 720, repeatDelay: 0.18,
  })
}
