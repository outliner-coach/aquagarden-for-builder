import * as THREE from 'three'
import type { SceneEntity } from '../core/SceneRoot'
import { BUBBLE } from '../../shared/config'
import { respawnIfAboveSurface, bubbleWobbleX, bubbleSizeForSeed, bubbleSurfaceFadeAlpha } from './bubblesHelpers'

/* ── 소프트 라디얼 알파 CanvasTexture 생성 ── */

function createSoftCircleTexture(resolution: number): THREE.CanvasTexture {
  const canvas = document.createElement('canvas')
  canvas.width = resolution
  canvas.height = resolution
  const ctx = canvas.getContext('2d')!
  const half = resolution / 2
  const gradient = ctx.createRadialGradient(half, half, 0, half, half, half)
  gradient.addColorStop(0, 'rgba(255,255,255,1)')
  gradient.addColorStop(0.4, 'rgba(255,255,255,0.6)')
  gradient.addColorStop(1, 'rgba(255,255,255,0)')
  ctx.fillStyle = gradient
  ctx.fillRect(0, 0, resolution, resolution)
  const tex = new THREE.CanvasTexture(canvas)
  tex.needsUpdate = true
  return tex
}

/* ── 기포 소프트 스프라이트 ShaderMaterial ── */

const BUBBLE_VERT = /* glsl */ `
attribute float aSize;
attribute float aAlpha;
uniform float uPixelRatio;
varying float vAlpha;
void main() {
  vAlpha = aAlpha;
  vec4 mvPos = modelViewMatrix * vec4(position, 1.0);
  gl_PointSize = aSize * uPixelRatio * (300.0 / -mvPos.z);
  gl_Position = projectionMatrix * mvPos;
}
`

const BUBBLE_FRAG = /* glsl */ `
uniform sampler2D uMap;
varying float vAlpha;
void main() {
  vec4 texel = texture2D(uMap, gl_PointCoord);
  gl_FragColor = vec4(1.0, 1.0, 1.0, texel.a * vAlpha);
}
`

export class Bubbles implements SceneEntity {
  readonly object3d: THREE.Points
  private readonly _positions: Float32Array
  private readonly _sizes: Float32Array
  private readonly _alphas: Float32Array
  private readonly _baseX: Float32Array
  private readonly _phases: Float32Array
  private readonly _speeds: Float32Array
  private readonly _seedValues: Float32Array
  private readonly _geometry: THREE.BufferGeometry
  private readonly _material: THREE.ShaderMaterial
  private readonly _texture: THREE.CanvasTexture
  private _time = 0

  constructor() {
    const n = BUBBLE.maxParticles

    this._positions = new Float32Array(n * 3)
    this._sizes = new Float32Array(n)
    this._alphas = new Float32Array(n)
    this._baseX = new Float32Array(n)
    this._phases = new Float32Array(n)
    this._speeds = new Float32Array(n)
    this._seedValues = new Float32Array(n)

    for (let i = 0; i < n; i++) {
      const x = (Math.random() - 0.5) * BUBBLE.spreadX
      const y = BUBBLE.floorY + Math.random() * (BUBBLE.surfaceY - BUBBLE.floorY)
      const z = -1 + Math.random() * 1.5

      this._positions[i * 3] = x
      this._positions[i * 3 + 1] = y
      this._positions[i * 3 + 2] = z

      this._baseX[i] = x
      this._phases[i] = Math.random() * Math.PI * 2
      this._speeds[i] = BUBBLE.riseSpeed * (0.6 + Math.random() * 0.8)

      const seed = Math.random()
      this._seedValues[i] = seed
      this._sizes[i] = bubbleSizeForSeed(seed, BUBBLE.sizeMin, BUBBLE.sizeMax)
      this._alphas[i] = bubbleSurfaceFadeAlpha(y, BUBBLE.surfaceY, BUBBLE.surfaceFadeRange)
    }

    this._geometry = new THREE.BufferGeometry()
    this._geometry.setAttribute('position', new THREE.BufferAttribute(this._positions, 3))
    this._geometry.setAttribute('aSize', new THREE.BufferAttribute(this._sizes, 1))
    this._geometry.setAttribute('aAlpha', new THREE.BufferAttribute(this._alphas, 1))

    this._texture = createSoftCircleTexture(BUBBLE.softSpriteRes)

    this._material = new THREE.ShaderMaterial({
      vertexShader: BUBBLE_VERT,
      fragmentShader: BUBBLE_FRAG,
      uniforms: {
        uMap: { value: this._texture },
        uPixelRatio: { value: Math.min(window.devicePixelRatio, 2) },
      },
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      transparent: true,
    })

    this.object3d = new THREE.Points(this._geometry, this._material)
  }

  update(dt: number): void {
    this._time += dt
    const n = BUBBLE.maxParticles

    for (let i = 0; i < n; i++) {
      const idx = i * 3

      // 상승
      this._positions[idx + 1] += this._speeds[i] * dt

      // 수면 도달 시 바닥으로 리스폰
      const prevY = this._positions[idx + 1]
      this._positions[idx + 1] = respawnIfAboveSurface(
        prevY,
        BUBBLE.surfaceY,
        BUBBLE.floorY,
      )

      // 리스폰됐으면 x 위치도 새로 설정
      if (this._positions[idx + 1] !== prevY) {
        const newX = (Math.random() - 0.5) * BUBBLE.spreadX
        this._baseX[i] = newX
        this._positions[idx] = newX
      }

      // 좌우 흔들림
      this._positions[idx] = this._baseX[i] + bubbleWobbleX(
        this._time,
        this._phases[i],
        BUBBLE.wobbleAmplitude,
        BUBBLE.wobbleSpeed,
      )

      // 수면 근처 페이드아웃
      this._alphas[i] = bubbleSurfaceFadeAlpha(
        this._positions[idx + 1],
        BUBBLE.surfaceY,
        BUBBLE.surfaceFadeRange,
      )
    }

    const posAttr = this._geometry.getAttribute('position') as THREE.BufferAttribute
    posAttr.needsUpdate = true
    const alphaAttr = this._geometry.getAttribute('aAlpha') as THREE.BufferAttribute
    alphaAttr.needsUpdate = true
  }

  dispose(): void {
    this._geometry.dispose()
    this._material.dispose()
    this._texture.dispose()
  }
}
