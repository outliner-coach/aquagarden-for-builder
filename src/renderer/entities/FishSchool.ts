import * as THREE from 'three'
import type { SceneEntity } from '../core/SceneRoot'
import { ObjectPool } from '../core/ObjectPool'
import { Fish } from './Fish'
import type { FishKind } from './Fish'
import { nextActiveCount } from './fishHelpers'
import { FISH } from '../../shared/config'
import { clampFishCount } from '../../shared/clamp'

const SCHOOLING_RATIO = 0.6

export class FishSchool implements SceneEntity {
  readonly object3d: THREE.Group
  private readonly _pool: ObjectPool<Fish>
  private readonly _allFish: Fish[] = []
  private _targetCount: number
  private _nextSeed = 0

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

    this._pool.forEachActive((fish) => fish.update(dt))
  }

  dispose(): void {
    for (const fish of this._allFish) {
      fish.dispose()
    }
    this._allFish.length = 0
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
