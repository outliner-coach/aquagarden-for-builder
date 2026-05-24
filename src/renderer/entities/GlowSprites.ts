import * as THREE from 'three'
import type { SceneEntity } from '../core/SceneRoot'
import { GLOW, LIGHT } from '../../shared/config'
import { glowOpacityForBrightness } from './glowHelpers'

/* ── 소프트 라디얼 글로우 CanvasTexture ── */

function createGlowTexture(resolution: number, color: readonly [number, number, number]): THREE.CanvasTexture {
  const canvas = document.createElement('canvas')
  canvas.width = resolution
  canvas.height = resolution
  const ctx = canvas.getContext('2d')!
  const half = resolution / 2
  const r = Math.round(color[0] * 255)
  const g = Math.round(color[1] * 255)
  const b = Math.round(color[2] * 255)
  const gradient = ctx.createRadialGradient(half, half, 0, half, half, half)
  gradient.addColorStop(0, `rgba(${r},${g},${b},1)`)
  gradient.addColorStop(0.3, `rgba(${r},${g},${b},0.5)`)
  gradient.addColorStop(1, `rgba(${r},${g},${b},0)`)
  ctx.fillStyle = gradient
  ctx.fillRect(0, 0, resolution, resolution)
  const tex = new THREE.CanvasTexture(canvas)
  tex.needsUpdate = true
  return tex
}

/* ── 글로우 스프라이트 ShaderMaterial ── */

const GLOW_VERT = /* glsl */ `
attribute float aPhase;
uniform float uTime;
uniform float uBaseOpacity;
uniform float uPulseSpeed;
uniform float uPixelRatio;
uniform float uSize;
varying float vAlpha;
void main() {
  // 펄스: 0.5 + 0.5 * sin(time * speed + phase)
  float pulse = 0.5 + 0.5 * sin(uTime * uPulseSpeed + aPhase);
  vAlpha = uBaseOpacity * (0.5 + 0.5 * pulse);
  vec4 mvPos = modelViewMatrix * vec4(position, 1.0);
  gl_PointSize = uSize * uPixelRatio * (300.0 / -mvPos.z);
  gl_Position = projectionMatrix * mvPos;
}
`

const GLOW_FRAG = /* glsl */ `
uniform sampler2D uMap;
varying float vAlpha;
void main() {
  vec4 texel = texture2D(uMap, gl_PointCoord);
  gl_FragColor = vec4(texel.rgb, texel.a * vAlpha);
}
`

/* ── 결정적 시드 기반 위치 생성 ── */

function pseudoRandom(seed: number, idx: number): number {
  const x = Math.sin(seed * 127.1 + idx * 311.7) * 43758.5453
  return x - Math.floor(x)
}

export class GlowSprites implements SceneEntity {
  readonly object3d: THREE.Points
  private readonly _positions: Float32Array
  private readonly _phases: Float32Array
  private readonly _basePositions: Float32Array
  private readonly _geometry: THREE.BufferGeometry
  private readonly _material: THREE.ShaderMaterial
  private readonly _texture: THREE.CanvasTexture
  private _time = 0
  private _brightness01: number = LIGHT.default01

  constructor() {
    const n = GLOW.count
    this._positions = new Float32Array(n * 3)
    this._basePositions = new Float32Array(n * 3)
    this._phases = new Float32Array(n)

    const seed = 777
    for (let i = 0; i < n; i++) {
      const x = (pseudoRandom(seed, i * 3) - 0.5) * GLOW.spreadX
      const y = GLOW.yMin + pseudoRandom(seed, i * 3 + 1) * (GLOW.yMax - GLOW.yMin)
      const z = GLOW.zMin + pseudoRandom(seed, i * 3 + 2) * (GLOW.zMax - GLOW.zMin)

      this._positions[i * 3] = x
      this._positions[i * 3 + 1] = y
      this._positions[i * 3 + 2] = z

      this._basePositions[i * 3] = x
      this._basePositions[i * 3 + 1] = y
      this._basePositions[i * 3 + 2] = z

      this._phases[i] = pseudoRandom(seed, i * 3 + 100) * Math.PI * 2
    }

    this._geometry = new THREE.BufferGeometry()
    this._geometry.setAttribute('position', new THREE.BufferAttribute(this._positions, 3))
    this._geometry.setAttribute('aPhase', new THREE.BufferAttribute(this._phases, 1))

    this._texture = createGlowTexture(GLOW.spriteRes, GLOW.color)

    const baseOpacity = glowOpacityForBrightness(this._brightness01, GLOW.minOpacity, GLOW.maxOpacity)

    this._material = new THREE.ShaderMaterial({
      vertexShader: GLOW_VERT,
      fragmentShader: GLOW_FRAG,
      uniforms: {
        uMap: { value: this._texture },
        uTime: { value: 0 },
        uBaseOpacity: { value: baseOpacity },
        uPulseSpeed: { value: GLOW.pulseSpeed },
        uPixelRatio: { value: Math.min(window.devicePixelRatio, 2) },
        uSize: { value: GLOW.size },
      },
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      transparent: true,
    })

    this.object3d = new THREE.Points(this._geometry, this._material)
  }

  setBrightness01(b01: number): void {
    this._brightness01 = Math.max(0, Math.min(1, b01))
    this._material.uniforms.uBaseOpacity.value = glowOpacityForBrightness(
      this._brightness01,
      GLOW.minOpacity,
      GLOW.maxOpacity,
    )
  }

  update(dt: number): void {
    this._time += dt
    this._material.uniforms.uTime.value = this._time

    const n = GLOW.count
    for (let i = 0; i < n; i++) {
      const idx = i * 3
      // 느린 드리프트: 기본 위치 주변으로 미세하게 떠돌기
      const phase = this._phases[i]
      this._positions[idx] = this._basePositions[idx] +
        Math.sin(this._time * GLOW.driftSpeed + phase) * 0.3
      this._positions[idx + 1] = this._basePositions[idx + 1] +
        Math.sin(this._time * GLOW.driftSpeed * 0.7 + phase + 1.5) * 0.15
    }

    const posAttr = this._geometry.getAttribute('position') as THREE.BufferAttribute
    posAttr.needsUpdate = true
  }

  dispose(): void {
    this._geometry.dispose()
    this._material.dispose()
    this._texture.dispose()
  }
}
