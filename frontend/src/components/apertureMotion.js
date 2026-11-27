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

  const vec2 DIAL = vec2(0.484, 0.499);
  const vec2 LENS = vec2(0.342, 0.497);
  const vec3 GOLD = vec3(1.0, 0.62, 0.31);
  const vec3 IVORY = vec3(1.0, 0.92, 0.73);
  const vec3 GLASS = vec3(0.63, 0.98, 0.89);

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

  vec4 over(vec4 below, vec3 tint, float alpha) {
    return vec4(tint * alpha, alpha) + below * (1.0 - alpha);
  }

  // Fold the light sheet around the offset lens as it crosses the open dial.
  float wave(vec2 p, float front) {
    float height = p.y / (0.049 + front * 0.39);
    float bend = (0.018 + front * 0.27) * height * height;
    float curl = sin(height * 3.9 + u_progress * 12.0) * front * 0.023;
    return p.x - front + bend + curl;
  }

  float dust(vec2 p) {
    vec2 field = p * vec2(72.0, 54.0) + vec2(u_progress * 20.0, -u_progress * 6.7);
    vec2 cell = floor(field);
    vec2 center = 0.20 + 0.60 * vec2(hash(cell + 6.7), hash(cell - 9.3));
    vec2 gap = fract(field) - center;
    float spark = 1.0 - smoothstep(0.021, 0.089, length(gap * vec2(0.88, 1.09)));
    return spark * step(0.55, hash(cell));
  }

  void main() {
    float phase = u_progress;
    float visible = pulse(0.012, 0.107, 0.82, 0.98);
    if (visible <= 0.0) {
      gl_FragColor = texture2D(u_art, v_uv);
      return;
    }

    vec2 dial = v_uv - DIAL;
    vec2 lens = v_uv - LENS;
    float radius = length(dial);
    float angle = atan(dial.y, dial.x);

    // Two specular ridges travel along the machined rails and draw the
    // colored rims slightly inward as they pass.
    float arc = smoothstep(-1.77, -1.55, angle) * (1.0 - smoothstep(1.48, 1.69, angle));
    float top = mix(-1.72, 0.42, smoothstep(0.018, 0.40, phase));
    float bottom = mix(1.67, -0.34, smoothstep(0.048, 0.43, phase));
    float advance = pulse(0.016, 0.104, 0.33, 0.51) * arc;
    float amber = bell((angle - top) * 5.6) * advance;
    float mint = bell((angle - bottom) * 6.2) * advance;
    float bend = bell((radius - 0.361) * 15.0) * (amber - mint) * 0.0085;

    float gathering = pulse(0.266, 0.38, 0.60, 0.714);
    float front = mix(0.563, 0.0, smoothstep(0.26, 0.702, phase));
    float slit = 0.049 + front * 0.39;
    float fan = bell(lens.y / slit * 0.91);
    float gap = wave(lens, front);
    float curvedGlass = bell(gap / 0.027) * fan * gathering;
    vec2 shift = normalize(dial + vec2(0.00001, 0.0)) * bend
      + vec2(gap * 0.59, lens.y * -0.054) * curvedGlass;
    vec4 art = texture2D(u_art, v_uv + shift);

    float brassTrack = bell((radius - 0.383) * 36.0) * 0.46 + bell((radius - 0.407) * 173.0) * 0.33;
    float mintTrack = bell((radius - 0.334) * 89.0) * 0.50 + bell((radius - 0.429) * 146.0) * 0.24;
    art = over(art, IVORY, brassTrack * amber * visible);
    art = over(art, GLASS, mintTrack * mint * visible);

    // The warm edge lags the cooler one like two colors through curved glass.
    float interference = 0.78 + 0.22 * cos(lens.y * 111.0 - phase * 32.0 + sin(lens.y * 38.0) * 1.4);
    float goldEdge = bell((gap - 0.008) / 0.0065) * 0.64 + bell((gap - 0.022) / 0.031) * 0.30;
    float coolEdge = bell((gap + 0.009) / 0.004) * 0.58 + bell((gap + 0.034) / 0.025) * 0.17;
    float wash = fan * gathering * visible * interference;
    art = over(art, GOLD, goldEdge * wash);
    art = over(art, GLASS, coolEdge * wash);
    art = over(art, IVORY, curvedGlass * visible * 0.25);
    if (gathering > 0.0 && abs(gap) < 0.16 && abs(lens.y) < slit * 2.0) {
      float flecks = dust(lens) * bell((gap - 0.028) / 0.076);
      art = over(art, IVORY, flecks * fan * gathering * visible * 0.76);
    }

    // The fixed lens catches the sheet, then its etched rings light in order.
    float distance = length(lens);
    float capture = pulse(0.52, 0.684, 0.75, 0.93);
    float falloff = bell(distance / 0.044);
    float iris = bell((distance - 0.031) * 205.0);
    float expansion = mix(0.032, 0.132, smoothstep(0.62, 0.88, phase));
    float echo = bell((distance - expansion) * 175.0)
      * pulse(0.62, 0.70, 0.80, 0.93);
    float beam = bell(lens.y / 0.0036) * bell(lens.x / 0.123);
    art = over(art, GOLD, (echo * 0.63 + falloff * capture * 0.36) * visible);
    gl_FragColor = over(art, IVORY, (iris * 0.43 + beam * 0.24) * capture * visible);
  }
`

export function createApertureTimeline(svg, unavailable) {
  return createRasterLogoTimeline(svg, unavailable, { fragment: FRAGMENT, duration: 4.32, maxSize: 640, repeatDelay: 0.2 })
}
