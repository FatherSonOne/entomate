import { createRasterGrid, createRasterLogoTimeline } from './rasterLogoMotion'

const VERTEX = `
  attribute vec2 a_uv;
  uniform float u_progress;
  varying mediump vec2 v_uv;
  varying mediump vec4 v_wave;

  const vec2 CENTER = vec2(0.499, 0.495);
  const float CAMERA = 1.08;

  float bell(float x) { return exp(-x * x); }

  void main() {
    vec2 spoke = a_uv - CENTER;
    float radius = length(spoke);
    vec2 direction = spoke / max(radius, 0.0001);
    float phase = u_progress;
    float first = mix(0.038, 0.336, smoothstep(0.015, 0.755, phase));
    float second = mix(0.038, 0.333, smoothstep(0.251, 0.985, phase));
    float plate = smoothstep(0.049, 0.100, radius) * (1.0 - smoothstep(0.318, 0.410, radius));
    float release = smoothstep(0.014, 0.112, phase) * (1.0 - smoothstep(0.64, 0.814, phase));
    float recall = smoothstep(0.247, 0.36, phase) * (1.0 - smoothstep(0.83, 0.993, phase));

    // A small phase difference on opposite sides makes the metal yield
    // unevenly while the pressure still travels outward on every spoke.
    float delay = (0.007 * direction.x - 0.009 * direction.y)
      * smoothstep(0.07, 0.21, radius);
    float d = (radius - first + delay) / 0.055;
    float q = (radius - second - delay * 0.55) / 0.051;
    float crest = bell(d) * plate * release;
    float valley = bell((radius - first + delay + 0.047) / 0.047) * plate * release;
    float echo = bell(q) * plate * recall;
    float trough = bell((radius - second - delay * 0.55 + 0.050) / 0.049) * plate * recall;

    // Height, radial spread and oblique viewing parallax are separate.
    float height = 0.069 * crest - 0.017 * valley + 0.033 * echo - 0.013 * trough;
    vec2 p = a_uv + direction * (0.007 * crest - 0.003 * valley + 0.004 * echo);
    float w = 1.0 - height / CAMERA;
    vec2 anchor = CENTER * vec2(2.0, -2.0) + vec2(-1.0, 1.0);
    vec2 projected = (p - CENTER) * vec2(2.0, -2.0) + height * vec2(0.14, 0.33);
    gl_Position = vec4(anchor * w + projected, -height * 0.7, w);
    v_uv = a_uv;
    v_wave = vec4(crest, echo, -2.51 * d * crest - 1.29 * q * echo, valley + trough * 0.55);
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
  varying mediump vec4 v_wave;

  const vec2 CENTER = vec2(0.499, 0.495);
  const vec2 BEACON = vec2(0.670, 0.683);
  const vec3 AMBER = vec3(1.0, 0.58, 0.26);
  const vec3 GOLD = vec3(1.0, 0.88, 0.61);
  const vec3 COPPER = vec3(1.0, 0.41, 0.23);
  const float TURN = 6.2831853;

  float bell(float x) { return exp(-x * x); }
  float pulse(float start, float peak, float hold, float end) {
    return smoothstep(start, peak, u_progress) * (1.0 - smoothstep(hold, end, u_progress));
  }
  float hash(vec2 seed) {
    vec3 p = fract(vec3(seed.xyx) * 0.1031);
    p += dot(p, p.yzx + 33.33);
    return fract((p.x + p.y) * p.z);
  }
  vec4 over(vec4 below, vec3 color, float alpha) {
    return vec4(color * alpha, alpha) + below * (1.0 - alpha);
  }

  void main() {
    vec4 art = texture2D(u_art, v_uv);
    float phase = u_progress;
    if (phase <= 0.012 || phase >= 0.993) {
      gl_FragColor = art;
      return;
    }
    vec2 spoke = v_uv - CENTER;
    float radius = length(spoke);
    vec2 axis = spoke / max(radius, 0.0001);
    float material = smoothstep(0.02, 0.64, art.a);
    vec3 normal = normalize(vec3(-axis * v_wave.z * 0.53, 1.0));
    float reflection = pow(max(0.0, dot(normal, normalize(vec3(-0.27, -0.48, 1.0)))), 9.0);
    float band = min(1.0, v_wave.x + v_wave.y * 0.73);
    art.rgb = min(vec3(art.a), art.rgb * (1.0 - v_wave.w * 0.29 + band * reflection * 0.42));
    art = over(art, mix(COPPER, GOLD, reflection), band * material * (0.25 + reflection * 0.37));

    float core = bell((radius - 0.062) / 0.013) * pulse(0.014, 0.152, 0.203, 0.412);
    art = over(art, GOLD, core * material * 0.68);

    // Each pressure front sends a faint skirt and dust outward from the rim.
    float spread = mix(0.237, 0.371, smoothstep(0.52, 0.94, phase));
    float shed = pulse(0.495, 0.643, 0.795, 0.978);
    if (shed > 0.0 && radius > 0.20 && radius < 0.44) {
      float angle = atan(spoke.y, spoke.x);
      float arc = 0.50 + 0.28 * cos(angle * 4.0 - phase * 4.6) + 0.19 * sin(angle * 9.0 + radius * 36.0);
      float wake = bell((radius - spread) / 0.024) * shed;
      art = over(art, COPPER, wake * arc * 0.19);
      vec2 cell = vec2((angle / TURN + 0.5) * 107.0 + phase * 4.9, radius * 103.0 - phase * 35.0);
      vec2 seed = floor(cell);
      vec2 gap = fract(cell) - (0.18 + 0.64 * vec2(hash(seed + 5.2), hash(seed - 8.7)));
      float dust = (1.0 - smoothstep(0.021, 0.087, length(gap))) * step(0.48, hash(seed));
      art = over(art, GOLD, dust * bell((radius - spread) / 0.049) * shed * 0.72);
    }

    float arrive = pulse(0.68, 0.795, 0.836, 0.977);
    float marker = bell(length(v_uv - BEACON) / 0.017);
    gl_FragColor = over(art, AMBER, marker * arrive * 0.76);
  }
`

const mesh = createRasterGrid(72)

export function createSignalCascadeTimeline(svg, unavailable) {
  return createRasterLogoTimeline(svg, unavailable, {
    vertex: VERTEX, fragment: FRAGMENT, mesh, duration: 4.26, maxSize: 720, repeatDelay: 0.22,
  })
}
