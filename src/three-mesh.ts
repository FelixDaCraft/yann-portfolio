/**
 * three-mesh.ts — OGL wireframe grid background
 * Bundle: ~11.7kB gz (OGL 9.8 + this 1.9)
 *
 * Exports:
 *   initMesh3D(canvas)  → cleanup fn
 */

import { Renderer, Camera, Geometry, Program, Mesh } from 'ogl'
import type { OGLRenderingContext } from 'ogl'

// ─── Vertex shader ────────────────────────────────────────────────────────────
// UNE seule onde lente directionnelle qui traverse le plan de gauche à droite.
// Cycle complet ~40 secondes — "un terrain qui respire, pas un fond qui performe".
// Pas d'interaction souris (cliché 2021-2023 sur portfolios WebGL).
const VERT = /* glsl */ `
  precision mediump float;
  attribute vec3 position;

  uniform mat4 modelViewMatrix;
  uniform mat4 projectionMatrix;
  uniform float uTime;
  uniform float uAmplitude;

  void main() {
    vec3 pos = position;

    // Onde directionnelle unique : glisse vers la droite, cycle ~40s.
    // 2π / 40_000 ms ≈ 0.000157. On combine deux fréquences spatiales
    // pour éviter l'effet "vague de stade" trop régulier.
    float wave = sin(pos.x * 0.032 - uTime * 0.00016)
               * cos(pos.y * 0.020 - uTime * 0.00009);
    pos.z += wave * 18.0 * uAmplitude;

    gl_Position = projectionMatrix * modelViewMatrix * vec4(pos, 1.0);
  }
`

// ─── Fragment shader ──────────────────────────────────────────────────────────
const FRAG = /* glsl */ `
  precision mediump float;
  void main() {
    // --platine #c0c0c8 à 0.12 alpha — perceptible mais inconscient.
    // UI Designer reco : "un terrain qui respire, pas un fond qui performe".
    gl_FragColor = vec4(0.752, 0.752, 0.784, 0.12);
  }
`

// ─── Geometry : wireframe plane ───────────────────────────────────────────────
// OGL n'a pas de PlaneGeometry intégrée avec wireframe. On construit les
// positions et indices de lignes manuellement.
function buildWireframePlane(gl: OGLRenderingContext, segsX: number, segsY: number, size: number): Geometry {
  const nx = segsX + 1
  const ny = segsY + 1
  const positions = new Float32Array(nx * ny * 3)
  const halfSize = size / 2

  let vi = 0
  for (let iy = 0; iy < ny; iy++) {
    for (let ix = 0; ix < nx; ix++) {
      positions[vi++] = (ix / segsX) * size - halfSize
      positions[vi++] = (iy / segsY) * size - halfSize
      positions[vi++] = 0
    }
  }

  // Indices lignes : horizontales + verticales de la grille
  const lines: number[] = []
  for (let iy = 0; iy < ny; iy++) {
    for (let ix = 0; ix < segsX; ix++) {
      const a = iy * nx + ix
      lines.push(a, a + 1)
    }
  }
  for (let ix = 0; ix < nx; ix++) {
    for (let iy = 0; iy < segsY; iy++) {
      const a = iy * nx + ix
      lines.push(a, a + nx)
    }
  }

  return new Geometry(gl, {
    position: { size: 3, data: positions },
    index:    { data: new Uint32Array(lines) },
  })
}

// ─── Exports ──────────────────────────────────────────────────────────────────
export type CleanupFn = () => void

export function initMesh3D(canvas: HTMLCanvasElement): CleanupFn {
  const isMobile   = window.innerWidth < 768
  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches

  // Segments — épuré (Archetypal : "peu de nœuds, connexions épurées")
  const segs = isMobile ? 40 : 64

  // ── Renderer ────────────────────────────────────────────────────────────────
  const renderer = new Renderer({
    canvas,
    alpha:     true,
    antialias: false,   // pas nécessaire pour wireframe fin
    powerPreference: 'low-power',
  })
  const gl = renderer.gl
  gl.clearColor(0, 0, 0, 0)
  gl.enable(gl.BLEND)
  gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA)

  // ── Camera orthographique ────────────────────────────────────────────────────
  const camera = new Camera(gl, { near: 0.1, far: 500 })
  camera.position.z = 120

  const resize = (): void => {
    renderer.setSize(canvas.clientWidth, canvas.clientHeight)
    const aspect = canvas.clientWidth / canvas.clientHeight
    // Ortho frustum couvre 220 unités de large (grille ~200)
    const half = 110
    camera.orthographic({
      left:   -half,
      right:   half,
      top:     half / aspect,
      bottom: -half / aspect,
      near:    0.1,
      far:     500,
    })
  }

  resize()
  window.addEventListener('resize', resize, { passive: true })

  // ── Geometry + Mesh ──────────────────────────────────────────────────────────
  const geometry = buildWireframePlane(gl, segs, segs, 200)

  const uTime      = { value: 0 }
  const uAmplitude = { value: isMobile ? 0.55 : 1.0 }

  const program = new Program(gl, {
    vertex:    VERT,
    fragment:  FRAG,
    uniforms: {
      uTime,
      uAmplitude,
    },
    transparent: true,
    depthTest:   false,
    depthWrite:  false,
  })

  const mesh = new Mesh(gl, {
    geometry,
    program,
    mode: gl.LINES,
  })

  // Inclinaison de perspective — sol qui fuit vers l'horizon
  mesh.rotation.x = -0.28

  // ── RAF loop ─────────────────────────────────────────────────────────────────
  // Pas de mouse interaction : décision UI/Archetypal (cliché +
  // "système qui respire à son rythme, pas qui réagit à l'opérateur").
  let rafId  = 0
  let paused = false

  const tick = (t: number): void => {
    rafId = requestAnimationFrame(tick)
    if (paused) return
    if (!reduceMotion) {
      uTime.value = t
    }
    renderer.render({ scene: mesh, camera })
    // Fade-in au premier frame rendu
    if (canvas.style.opacity === '0') {
      canvas.style.opacity = '1'
    }
  }
  rafId = requestAnimationFrame(tick)

  // ── Page visibility (économie batterie) ──────────────────────────────────────
  const onVisibility = (): void => {
    paused = document.hidden
  }
  document.addEventListener('visibilitychange', onVisibility)

  // ── Cleanup ──────────────────────────────────────────────────────────────────
  return (): void => {
    cancelAnimationFrame(rafId)
    window.removeEventListener('resize', resize)
    document.removeEventListener('visibilitychange', onVisibility)
    geometry.remove()
    program.remove()
    gl.getExtension('WEBGL_lose_context')?.loseContext()
  }
}
