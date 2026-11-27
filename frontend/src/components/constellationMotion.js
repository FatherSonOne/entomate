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

  // The three mounted scopes and the glass dial in the original illustration.
  const vec2 WEST = vec2(0.257, 0.374);
  const vec2 EAST = vec2(0.757, 0.316);
  const vec2 SOUTH = vec2(0.251, 0.633);
  const vec2 DIAL = vec2(0.534, 0.509);
  const vec3 AMBER = vec3(1.0, 0.77, 0.45);
  const vec3 MINT = vec3(0.64, 1.0, 0.87);

  vec4 over(vec4 under, vec3 color, float alpha) {
    return vec4(color * alpha, alpha) + under * (1.0 - alpha);
  }

  // Draw a curved connection from scope to scope. The head is a narrow flare
  // with a softer parallel reflection, and the surveyed line remains briefly.
  vec2 trace(vec2 p, vec2 from, vec2 to, float bow, float start) {
    vec2 axis = to - from;
    vec2 normal = normalize(vec2(-axis.y, axis.x));
    float along = dot(p - from, axis) / dot(axis, axis);
    float phase = (u_progress - start) / 0.31;
    float head = mix(-0.10, 1.08, smoothstep(0.0, 1.0, phase));
    float lane = smoothstep(-0.02, 0.02, along) * (1.0 - smoothstep(0.98, 1.02, along));
    float curve = sin(clamp(along, 0.0, 1.0) * 3.1415927) * bow;
    float gap = dot(p - from, normal) - curve;
    float trail = exp(-abs(gap) * 590.0) * (1.0 - smoothstep(head - 0.06, head, along));
    float falloff = exp(-abs(along - head) * 17.0);
    float flare = falloff * (0.72 * exp(-abs(gap) * 245.0) + 0.22 * exp(-abs(gap - 0.007) * 180.0));
    float fade = 1.0 - smoothstep(0.72, 0.96, u_progress);
    return vec2(trail * 0.52, flare) * lane * fade * step(0.0, phase);
  }

  float beacon(vec2 p, vec2 center, float time, float phase) {
    float hit = exp(-abs(u_progress - time) * 27.0);
    vec2 d = p - center;
    float crossX = exp(-abs(d.x) * 530.0 - abs(d.y) * 85.0);
    float crossY = exp(-abs(d.y) * 530.0 - abs(d.x) * 78.0);
    float star = (crossX + crossY) * 0.40 + exp(-length(d) * 192.0) * 0.56;
    float haloRadius = 0.011 + clamp(phase, 0.0, 0.19) * 0.235;
    float halo = exp(-abs(length(d) - haloRadius) * 670.0) * 0.24;
    return clamp(star * hit + halo * smoothstep(0.0, 0.012, phase) * (1.0 - smoothstep(0.025, 0.19, phase)), 0.0, 1.0);
  }

  void main() {
    float visibility = smoothstep(0.02, 0.15, u_progress) * (1.0 - smoothstep(0.89, 0.98, u_progress));
    if (visibility == 0.0) {
      gl_FragColor = texture2D(u_art, v_uv);
      return;
    }

    // A narrow sheet of light crosses the curved glass. The engraving bends
    // through it and the two edges split into warm and cool reflections.
    vec2 lens = (v_uv - DIAL) / 0.211;
    vec2 axis = normalize(vec2(0.86, -0.51));
    vec2 tangent = vec2(-axis.y, axis.x);
    float focus = smoothstep(0.44, 0.53, u_progress) * (1.0 - smoothstep(0.84, 0.96, u_progress));
    float side = dot(lens, tangent);
    float edge = dot(lens, axis) + 0.22 * side * side;
    float position = mix(-1.1, 1.13, smoothstep(0.43, 0.93, u_progress));
    float gap = edge - position;
    float aperture = 1.0 - smoothstep(0.78, 1.02, length(lens));
    float sheet = exp(-gap * gap * 35.0) * aperture * focus;
    vec2 shift = axis * gap * sheet * 0.12;
    vec4 art = texture2D(u_art, v_uv + shift);
    float warm = exp(-abs(gap + 0.082) * 35.0) * 0.31;
    float cool = exp(-abs(gap - 0.087) * 45.0) * 0.29;
    art = over(art, AMBER, (warm + sheet * 0.21) * aperture * focus * visibility);
    art = over(art, MINT, cool * aperture * focus * visibility);

    vec2 first = trace(v_uv, WEST, EAST, -0.045, 0.10);
    vec2 second = trace(v_uv, EAST, SOUTH, -0.015, 0.23);
    vec2 third = trace(v_uv, SOUTH, WEST, -0.071, 0.37);
    art = over(art, AMBER, clamp(first.x + third.x, 0.0, 0.72) * visibility);
    art = over(art, MINT, second.x * visibility);
    art = over(art, vec3(1.0, 0.94, 0.75), clamp(first.y + third.y, 0.0, 0.84) * visibility);
    art = over(art, vec3(0.85, 1.0, 0.95), second.y * visibility);

    float stars = beacon(v_uv, WEST, 0.123, u_progress - 0.123)
      + beacon(v_uv, EAST, 0.38, u_progress - 0.38)
      + beacon(v_uv, SOUTH, 0.51, u_progress - 0.51)
      + beacon(v_uv, DIAL, 0.67, u_progress - 0.67);
    gl_FragColor = over(art, vec3(1.0, 0.94, 0.78), clamp(stars, 0.0, 0.9) * visibility);
  }
`

export function createConstellationTimeline(svg, unavailable) {
  return createRasterLogoTimeline(svg, unavailable, { fragment: FRAGMENT, duration: 5.04, maxSize: 768 })
}
