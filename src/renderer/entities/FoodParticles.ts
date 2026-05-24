import * as THREE from 'three'
import type { SceneEntity } from '../core/SceneRoot'
import { FOOD, FISH } from '../../shared/config'
import { foodFallDelta } from './lureHelpers'

interface FoodParticle {
  active: boolean
  x: number
  y: number
  z: number
  age: number
}

/**
 * 풀링 기반 먹이 입자 엔티티.
 * spawn(point)으로 point 위에서 먹이를 생성, 낙하하다가 바닥/lifetime/섭취 시 비활성.
 */
export class FoodParticles implements SceneEntity {
  readonly object3d: THREE.Points
  private readonly _particles: FoodParticle[]
  private readonly _positions: Float32Array
  private readonly _alphas: Float32Array
  private readonly _geometry: THREE.BufferGeometry
  private readonly _material: THREE.ShaderMaterial
  private readonly _texture: THREE.CanvasTexture

  constructor() {
    const n = FOOD.maxParticles
    this._particles = []
    this._positions = new Float32Array(n * 3)
    this._alphas = new Float32Array(n)

    for (let i = 0; i < n; i++) {
      this._particles.push({ active: false, x: 0, y: -100, z: 0, age: 0 })
      this._positions[i * 3] = 0
      this._positions[i * 3 + 1] = -100
      this._positions[i * 3 + 2] = 0
      this._alphas[i] = 0
    }

    this._geometry = new THREE.BufferGeometry()
    this._geometry.setAttribute('position', new THREE.BufferAttribute(this._positions, 3))
    this._geometry.setAttribute('aAlpha', new THREE.BufferAttribute(this._alphas, 1))

    this._texture = this._createTexture()

    this._material = new THREE.ShaderMaterial({
      vertexShader: VERT,
      fragmentShader: FRAG,
      uniforms: {
        uMap: { value: this._texture },
        uPixelRatio: { value: Math.min(window.devicePixelRatio, 2) },
        uColor: { value: new THREE.Vector3(...FOOD.color) },
      },
      blending: THREE.NormalBlending,
      depthWrite: false,
      transparent: true,
    })

    this.object3d = new THREE.Points(this._geometry, this._material)
  }

  /** 지정된 월드 좌표 위에서 먹이 입자를 스폰한다. */
  spawn(point: THREE.Vector3, count: number = FOOD.spawnCount): void {
    let spawned = 0
    for (let i = 0; i < this._particles.length && spawned < count; i++) {
      if (!this._particles[i].active) {
        const p = this._particles[i]
        p.active = true
        p.x = point.x + (Math.random() - 0.5) * FOOD.spawnSpread
        p.y = point.y + FOOD.spawnYOffset
        p.z = point.z + (Math.random() - 0.5) * FOOD.spawnSpread
        p.age = 0
        spawned++
      }
    }
  }

  /** 현재 활성 먹이 입자 위치 배열을 반환한다. */
  activePositions(): { x: number; y: number; z: number; index: number }[] {
    const result: { x: number; y: number; z: number; index: number }[] = []
    for (let i = 0; i < this._particles.length; i++) {
      if (this._particles[i].active) {
        const p = this._particles[i]
        result.push({ x: p.x, y: p.y, z: p.z, index: i })
      }
    }
    return result
  }

  /** 특정 인덱스의 입자를 소비(비활성)한다. */
  consume(index: number): void {
    if (index >= 0 && index < this._particles.length) {
      this._particles[index].active = false
    }
  }

  /** 활성 입자가 있는지 여부 */
  get hasActive(): boolean {
    return this._particles.some((p) => p.active)
  }

  update(dt: number): void {
    const fallDy = foodFallDelta(dt, FOOD.fallSpeed)
    const floorY = FISH.bounds.minY

    for (let i = 0; i < this._particles.length; i++) {
      const p = this._particles[i]
      if (!p.active) {
        this._alphas[i] = 0
        continue
      }

      p.age += dt
      p.y += fallDy

      // 바닥 도달 또는 lifetime 초과 시 비활성
      if (p.y <= floorY || p.age >= FOOD.lifetime) {
        p.active = false
        this._alphas[i] = 0
        continue
      }

      this._positions[i * 3] = p.x
      this._positions[i * 3 + 1] = p.y
      this._positions[i * 3 + 2] = p.z
      this._alphas[i] = 1
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

  private _createTexture(): THREE.CanvasTexture {
    const res = 32
    const canvas = document.createElement('canvas')
    canvas.width = res
    canvas.height = res
    const ctx = canvas.getContext('2d')!
    const half = res / 2
    const gradient = ctx.createRadialGradient(half, half, 0, half, half, half)
    gradient.addColorStop(0, 'rgba(255,255,255,1)')
    gradient.addColorStop(0.6, 'rgba(255,255,255,0.7)')
    gradient.addColorStop(1, 'rgba(255,255,255,0)')
    ctx.fillStyle = gradient
    ctx.fillRect(0, 0, res, res)
    const tex = new THREE.CanvasTexture(canvas)
    tex.needsUpdate = true
    return tex
  }
}

const VERT = /* glsl */ `
attribute float aAlpha;
uniform float uPixelRatio;
varying float vAlpha;
void main() {
  vAlpha = aAlpha;
  vec4 mvPos = modelViewMatrix * vec4(position, 1.0);
  gl_PointSize = ${FOOD.size.toFixed(2)} * uPixelRatio * (300.0 / -mvPos.z);
  gl_Position = projectionMatrix * mvPos;
}
`

const FRAG = /* glsl */ `
uniform sampler2D uMap;
uniform vec3 uColor;
varying float vAlpha;
void main() {
  vec4 texel = texture2D(uMap, gl_PointCoord);
  gl_FragColor = vec4(uColor, texel.a * vAlpha);
}
`
