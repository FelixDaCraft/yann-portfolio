/**
 * three-mesh.ts — Triangulated terrain wireframe (perspective camera).
 * Cible visuelle : background wireframe montagneux en vue rasante,
 * comme une carte topographique en 3D fuyant vers l'horizon.
 *
 * Exports:
 *   initMesh3D(canvas) → cleanup fn
 */

import { Renderer, Camera, Geometry, Program, Mesh, Vec3 } from 'ogl'
import type { OGLRenderingContext } from 'ogl'

// ─── Vertex shader ────────────────────────────────────────────────────────────
// Terrain : multi-fréquence pour créer collines/vallées comme dans l'image.
// Le mouvement est lent — le relief glisse sur le plan en ~50s.
const VERT = /* glsl */ `
  precision mediump float;
  attribute vec3 position;

  uniform mat4 modelViewMatrix;
  uniform mat4 projectionMatrix;
  uniform float uTime;
  uniform float uAmplitude;

  // Terrain montagneux : fréquences calibrées sur planeSize 450.
  float heightAt(vec2 p) {
    float h = 0.0;
    h += sin(p.x * 0.055 + p.y * 0.038) * cos(p.y * 0.048 - p.x * 0.03) * 1.0;
    h += sin(p.x * 0.13 - p.y * 0.085) * 0.40;
    h += cos(p.x * 0.25 + p.y * 0.21) * 0.16;
    return h;
  }

  void main() {
    vec3 pos = position;
    float t = uTime * 0.00012;

    // Le terrain glisse lentement vers l'avant — comme un drone qui survole.
    vec2 sample = pos.xz + vec2(t * 3.0, t * 1.7);
    pos.y += heightAt(sample) * uAmplitude;

    gl_Position = projectionMatrix * modelViewMatrix * vec4(pos, 1.0);
  }
`

// ─── Fragment shader ──────────────────────────────────────────────────────────
const FRAG = /* glsl */ `
  precision mediump float;
  void main() {
    // Blanc cassé proche #ededf0, alpha 0.45 — wireframe lisible mais discret.
    gl_FragColor = vec4(0.93, 0.93, 0.94, 0.45);
  }
`

// ─── Geometry : triangulated plane wireframe ──────────────────────────────────
// Chaque quad de la grille est divisé en 2 triangles via une diagonale.
// On dessine les 2 côtés (horizontal + vertical) + la diagonale top-left → bottom-right.
function buildTriangulatedPlane(
  gl: OGLRenderingContext,
  segs: number,
  size: number,
): Geometry {
  const n = segs + 1
  const positions = new Float32Array(n * n * 3)
  const halfSize = size / 2

  let vi = 0
  for (let iz = 0; iz < n; iz++) {
    for (let ix = 0; ix < n; ix++) {
      positions[vi++] = (ix / segs) * size - halfSize // X
      positions[vi++] = 0                             // Y (relief appliqué en shader)
      positions[vi++] = (iz / segs) * size - halfSize // Z
    }
  }

  const lines: number[] = []

  // Horizontales (le long de X) et verticales (le long de Z)
  for (let iz = 0; iz < n; iz++) {
    for (let ix = 0; ix < segs; ix++) {
      const a = iz * n + ix
      lines.push(a, a + 1)
    }
  }
  for (let ix = 0; ix < n; ix++) {
    for (let iz = 0; iz < segs; iz++) {
      const a = iz * n + ix
      lines.push(a, a + n)
    }
  }
  // Diagonales (top-left → bottom-right de chaque quad) → triangulation
  for (let iz = 0; iz < segs; iz++) {
    for (let ix = 0; ix < segs; ix++) {
      const a = iz * n + ix
      const c = (iz + 1) * n + (ix + 1)
      lines.push(a, c)
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
  const isMobile     = window.innerWidth < 768
  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches

  const segs = isMobile ? 70 : 110
  const planeSize = 450

  // ── Renderer ────────────────────────────────────────────────────────────────
  const renderer = new Renderer({
    canvas,
    alpha: true,
    antialias: true,            // antialias bénéfique pour fines lignes wireframe
    powerPreference: 'low-power',
    dpr: Math.min(window.devicePixelRatio, 2),
  })
  const gl = renderer.gl
  gl.clearColor(0, 0, 0, 0)
  gl.enable(gl.BLEND)
  gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA)

  // ── Perspective camera ──────────────────────────────────────────────────────
  // Vue plongeante ~35° vers le bas, terrain qui remplit l'écran.
  const camera = new Camera(gl, { fov: 60, near: 0.1, far: 1200 })
  camera.position.set(0, 50, 30)
  camera.lookAt([0, -10, -150] as unknown as Vec3)

  const resize = (): void => {
    const w = window.innerWidth
    const h = window.innerHeight
    renderer.setSize(w, h)
    canvas.style.width  = w + 'px'
    canvas.style.height = h + 'px'
    camera.perspective({ aspect: w / h })
  }
  resize()
  window.addEventListener('resize', resize, { passive: true })

  // ── Geometry + Mesh ─────────────────────────────────────────────────────────
  const geometry = buildTriangulatedPlane(gl, segs, planeSize)

  const uTime      = { value: 0 }
  const uAmplitude = { value: isMobile ? 16.0 : 22.0 }

  const program = new Program(gl, {
    vertex:    VERT,
    fragment:  FRAG,
    uniforms:  { uTime, uAmplitude },
    transparent: true,
    depthTest:   false,
    depthWrite:  false,
  })

  const mesh = new Mesh(gl, { geometry, program, mode: gl.LINES })
  // Terrain centré devant la caméra, qui le surplombe.
  mesh.position.set(0, 0, -150)

  // ── RAF loop ────────────────────────────────────────────────────────────────
  let rafId  = 0
  let paused = false

  const tick = (t: number): void => {
    rafId = requestAnimationFrame(tick)
    if (paused) return
    if (!reduceMotion) uTime.value = t
    renderer.render({ scene: mesh, camera })
    if (!canvas.classList.contains('is-ready')) canvas.classList.add('is-ready')
  }
  rafId = requestAnimationFrame(tick)

  // ── Page visibility ─────────────────────────────────────────────────────────
  const onVisibility = (): void => { paused = document.hidden }
  document.addEventListener('visibilitychange', onVisibility)

  // ── Cleanup ─────────────────────────────────────────────────────────────────
  return (): void => {
    cancelAnimationFrame(rafId)
    window.removeEventListener('resize', resize)
    document.removeEventListener('visibilitychange', onVisibility)
    geometry.remove()
    program.remove()
    gl.getExtension('WEBGL_lose_context')?.loseContext()
  }
}
