import * as THREE from 'three'
import type { SceneEntity } from '../core/SceneRoot'
import { ObjectPool } from '../core/ObjectPool'
import { Fish } from './Fish'
import type { FishKind } from './Fish'
import { nextActiveCount } from './fishHelpers'
import { computeBoidsSteer } from './boids'
import type { BoidAgent } from './boids'
import { FISH, BOIDS } from '../../shared/config'
import { clampFishCount } from '../../shared/clamp'

const SCHOOLING_RATIO = 0.6

const BOIDS_WEIGHTS = {
  separationWeight: BOIDS.separationWeight,
  alignmentWeight: BOIDS.alignmentWeight,
  cohesionWeight: BOIDS.cohesionWeight,
}
const BOIDS_RADII = {
  separationRadius: BOIDS.separationRadius,
  alignmentRadius: BOIDS.alignmentRadius,
  cohesionRadius: BOIDS.cohesionRadius,
}

export class FishSchool implements SceneEntity {
  readonly object3d: THREE.Group
  private readonly _pool: ObjectPool<Fish>
  private readonly _allFish: Fish[] = []
  private _targetCount: number
  private _nextSeed = 0
  private readonly _agentBuf: BoidAgent[] = []

  constructor() {
    this.object3d = new THREE.Group()
    this._pool = new ObjectPool<Fish>(
      () => this._createFish(),
      (fish) => fish.setVisible(false),
    )
    this._targetCount = FISH.default
  }

  setCount(n: number): void {
    this._targetCount = clampFishCount(n)
  }

  update(dt: number): void {
    const current = this._pool.activeCount

    if (current < this._targetCount) {
      const next = nextActiveCount(current, this._targetCount, FISH.spawnPerTick)
      const toSpawn = next - current
      for (let i = 0; i < toSpawn; i++) {
        this._nextSeed++
        const fish = this._pool.acquire()
        fish.reset(this._nextSeed, this._assignKind())
      }
    } else if (current > this._targetCount) {
      this._pool.setActiveCount(this._targetCount)
    }

    // Boids: schooling 물고기만 조향 적용
    this._applyBoids()

    this._pool.forEachActive((fish) => fish.update(dt))
  }

  dispose(): void {
    for (const fish of this._allFish) {
      fish.dispose()
    }
    this._allFish.length = 0
  }

  private _applyBoids(): void {
    // schooling 물고기의 BoidAgent 목록 수집 (재할당 방지)
    this._agentBuf.length = 0
    const schoolingFish: Fish[] = []

    this._pool.forEachActive((fish) => {
      if (fish.kind === 'schooling') {
        schoolingFish.push(fish)
        this._agentBuf.push({
          position: fish.position,
          velocity: fish.velocity,
        })
      }
    })

    if (schoolingFish.length < 2) return

    const steer = new THREE.Vector3()
    for (let i = 0; i < schoolingFish.length; i++) {
      const self = this._agentBuf[i]
      // 자기 자신을 제외한 이웃 (O(n) 슬라이스 대신 전체 전달 후 내부 필터링)
      const neighbors = this._agentBuf.filter((_, j) => j !== i)
      const s = computeBoidsSteer(self, neighbors, BOIDS_WEIGHTS, BOIDS_RADII)

      // maxSteer 제한
      const mag = Math.sqrt(s.x * s.x + s.y * s.y + s.z * s.z)
      if (mag > BOIDS.maxSteer) {
        const scale = BOIDS.maxSteer / mag
        steer.set(s.x * scale, s.y * scale, s.z * scale)
      } else {
        steer.set(s.x, s.y, s.z)
      }

      schoolingFish[i].applySteer(steer)
    }
  }

  private _createFish(): Fish {
    const fish = new Fish()
    this.object3d.add(fish.mesh)
    this._allFish.push(fish)
    return fish
  }

  private _assignKind(): FishKind {
    return Math.random() < SCHOOLING_RATIO ? 'schooling' : 'individual'
  }
}
