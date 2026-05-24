import * as THREE from 'three'
import type { SceneEntity } from '../core/SceneRoot'
import { BUBBLE } from '../../shared/config'
import { respawnIfAboveSurface, bubbleWobbleX } from './bubblesHelpers'

export class Bubbles implements SceneEntity {
  readonly object3d: THREE.Points
  private readonly _positions: Float32Array
  private readonly _baseX: Float32Array
  private readonly _phases: Float32Array
  private readonly _speeds: Float32Array
  private readonly _geometry: THREE.BufferGeometry
  private readonly _material: THREE.PointsMaterial
  private _time = 0

  constructor() {
    const n = BUBBLE.maxParticles

    this._positions = new Float32Array(n * 3)
    this._baseX = new Float32Array(n)
    this._phases = new Float32Array(n)
    this._speeds = new Float32Array(n)

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
    }

    this._geometry = new THREE.BufferGeometry()
    this._geometry.setAttribute(
      'position',
      new THREE.BufferAttribute(this._positions, 3),
    )

    this._material = new THREE.PointsMaterial({
      color: 0xffffff,
      size: BUBBLE.size,
      transparent: true,
      opacity: 0.4,
      depthWrite: false,
      sizeAttenuation: true,
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
      this._positions[idx + 1] = respawnIfAboveSurface(
        this._positions[idx + 1],
        BUBBLE.surfaceY,
        BUBBLE.floorY,
      )

      // 좌우 흔들림
      this._positions[idx] = this._baseX[i] + bubbleWobbleX(
        this._time,
        this._phases[i],
        BUBBLE.wobbleAmplitude,
        BUBBLE.wobbleSpeed,
      )
    }

    const attr = this._geometry.getAttribute('position') as THREE.BufferAttribute
    attr.needsUpdate = true
  }

  dispose(): void {
    this._geometry.dispose()
    this._material.dispose()
  }
}
