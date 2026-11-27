import { gsap } from 'gsap/gsap-core.js'

const QUAD = {
  vertices: new Float32Array([0, 0, 1, 0, 0, 1, 1, 1]),
  indices: new Uint16Array([0, 2, 1, 1, 2, 3]),
}

export function createRasterGrid(size) {
  const vertices = []
  const indices = []
  for (let row = 0; row <= size; row++) {
    for (let col = 0; col <= size; col++) {
      vertices.push(col / size, row / size)
      if (row === size || col === size) continue
      const corner = row * (size + 1) + col
      const below = corner + size + 1
      indices.push(corner, below, corner + 1, corner + 1, below, below + 1)
    }
  }
  return { vertices: new Float32Array(vertices), indices: new Uint16Array(indices) }
}

const QUAD_VERTEX = `
  attribute vec2 a_uv;
  varying mediump vec2 v_uv;
  void main() {
    gl_Position = vec4(a_uv.x * 2.0 - 1.0, 1.0 - a_uv.y * 2.0, 0.0, 1.0);
    v_uv = a_uv;
  }
`

function createRenderer(canvas, image, { vertex = QUAD_VERTEX, fragment, mesh = QUAD, maxSize = Infinity }) {
  const scale = Math.min(1, maxSize / Math.max(image.naturalWidth, image.naturalHeight))
  canvas.width = Math.round(image.naturalWidth * scale)
  canvas.height = Math.round(image.naturalHeight * scale)
  const gl = canvas.getContext('webgl', { antialias: false, depth: false, stencil: false })
  if (!gl) return null

  const program = gl.createProgram()
  const shaders = [[gl.VERTEX_SHADER, vertex], [gl.FRAGMENT_SHADER, fragment]].map(([type, source]) => {
    const shader = gl.createShader(type)
    gl.shaderSource(shader, source)
    gl.compileShader(shader)
    gl.attachShader(program, shader)
    return shader
  })
  gl.linkProgram(program)
  shaders.forEach((shader) => gl.deleteShader(shader))
  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
    gl.deleteProgram(program)
    return null
  }

  gl.useProgram(program)
  const vertices = gl.createBuffer()
  gl.bindBuffer(gl.ARRAY_BUFFER, vertices)
  gl.bufferData(gl.ARRAY_BUFFER, mesh.vertices, gl.STATIC_DRAW)
  const uv = gl.getAttribLocation(program, 'a_uv')
  gl.enableVertexAttribArray(uv)
  gl.vertexAttribPointer(uv, 2, gl.FLOAT, false, 0, 0)

  const indices = gl.createBuffer()
  gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, indices)
  gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, mesh.indices, gl.STATIC_DRAW)

  const texture = gl.createTexture()
  gl.bindTexture(gl.TEXTURE_2D, texture)
  gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, true)
  gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, image)
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR)
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE)
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE)
  const progress = gl.getUniformLocation(program, 'u_progress')
  gl.viewport(0, 0, canvas.width, canvas.height)

  return {
    paint(value) {
      gl.clear(gl.COLOR_BUFFER_BIT)
      gl.uniform1f(progress, value)
      gl.drawElements(gl.TRIANGLES, mesh.indices.length, gl.UNSIGNED_SHORT, 0)
    },
    dispose() {
      gl.deleteTexture(texture)
      gl.deleteBuffer(vertices)
      gl.deleteBuffer(indices)
      gl.deleteProgram(program)
      gl.getExtension('WEBGL_lose_context')?.loseContext()
    },
  }
}

export function createRasterLogoTimeline(svg, unavailable, options) {
  const pose = { progress: 0 }
  const canvas = document.createElement('canvas')
  canvas.className = 'en-raster-motion-canvas'
  let image
  let renderer
  let playing = false
  const timeline = gsap.timeline({ paused: true, repeat: -1, repeatDelay: options.repeatDelay })
  timeline.to(pose, {
    progress: 1,
    duration: options.duration,
    ease: 'none',
    onUpdate: () => renderer?.paint(pose.progress),
  })

  return {
    play() {
      playing = true
      if (renderer) timeline.play()
      if (image) return

      image = new Image()
      image.onerror = unavailable
      image.onload = () => {
        renderer = createRenderer(canvas, image, options)
        if (!renderer) {
          unavailable()
          return
        }
        renderer.paint(pose.progress)
        svg.after(canvas)
        svg.style.opacity = '0'
        canvas.addEventListener('webglcontextlost', unavailable)
        if (playing) timeline.play()
      }
      image.src = svg.querySelector('image').getAttribute('href')
    },
    pause() {
      playing = false
      timeline.pause()
    },
    revert() {
      timeline.revert()
      if (image) {
        image.onload = null
        image.onerror = null
      }
      canvas.removeEventListener('webglcontextlost', unavailable)
      renderer?.dispose()
      canvas.remove()
      svg.style.removeProperty('opacity')
    },
  }
}
