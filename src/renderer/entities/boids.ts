/**
 * Boids 군집 행동 — 순수 함수.
 * Three.js 의존 없이 {x,y,z} 평범한 벡터 타입만 사용.
 */

/* ── Types ── */

export interface Vec3 {
  x: number
  y: number
  z: number
}

export interface BoidAgent {
  position: Vec3
  velocity: Vec3
}

export interface BoidsWeights {
  separationWeight: number
  alignmentWeight: number
  cohesionWeight: number
}

export interface BoidsRadii {
  separationRadius: number
  alignmentRadius: number
  cohesionRadius: number
}

/* ── Helpers ── */

function distSq(a: Vec3, b: Vec3): number {
  const dx = a.x - b.x
  const dy = a.y - b.y
  const dz = a.z - b.z
  return dx * dx + dy * dy + dz * dz
}

/* ── Core rules ── */

/** 너무 가까운 이웃에서 멀어지는 벡터. 가까울수록 강하다. */
export function separation(self: BoidAgent, neighbors: BoidAgent[], radius: number): Vec3 {
  const r2 = radius * radius
  let sx = 0
  let sy = 0
  let sz = 0
  let count = 0

  for (const n of neighbors) {
    const d2 = distSq(self.position, n.position)
    if (d2 <= 0 || d2 >= r2) continue
    const d = Math.sqrt(d2)
    const factor = 1 / (d * d)
    sx += (self.position.x - n.position.x) * factor
    sy += (self.position.y - n.position.y) * factor
    sz += (self.position.z - n.position.z) * factor
    count++
  }

  if (count === 0) return { x: 0, y: 0, z: 0 }
  return { x: sx / count, y: sy / count, z: sz / count }
}

/** 이웃 평균 속도에 정렬하는 벡터. */
export function alignment(self: BoidAgent, neighbors: BoidAgent[]): Vec3 {
  if (neighbors.length === 0) return { x: 0, y: 0, z: 0 }

  let ax = 0
  let ay = 0
  let az = 0
  for (const n of neighbors) {
    ax += n.velocity.x
    ay += n.velocity.y
    az += n.velocity.z
  }
  const len = neighbors.length
  return {
    x: ax / len - self.velocity.x,
    y: ay / len - self.velocity.y,
    z: az / len - self.velocity.z,
  }
}

/** 이웃 무게중심으로 향하는 벡터. */
export function cohesion(self: BoidAgent, neighbors: BoidAgent[]): Vec3 {
  if (neighbors.length === 0) return { x: 0, y: 0, z: 0 }

  let cx = 0
  let cy = 0
  let cz = 0
  for (const n of neighbors) {
    cx += n.position.x
    cy += n.position.y
    cz += n.position.z
  }
  const len = neighbors.length
  return {
    x: cx / len - self.position.x,
    y: cy / len - self.position.y,
    z: cz / len - self.position.z,
  }
}

/** 세 힘을 가중합한 최종 조향 벡터. */
export function computeBoidsSteer(
  self: BoidAgent,
  neighbors: BoidAgent[],
  weights: BoidsWeights,
  radii: BoidsRadii,
): Vec3 {
  if (neighbors.length === 0) return { x: 0, y: 0, z: 0 }

  // 각 규칙별로 반경 내 이웃만 필터
  const sepNeighbors: BoidAgent[] = []
  const aliNeighbors: BoidAgent[] = []
  const cohNeighbors: BoidAgent[] = []

  const sr2 = radii.separationRadius * radii.separationRadius
  const ar2 = radii.alignmentRadius * radii.alignmentRadius
  const cr2 = radii.cohesionRadius * radii.cohesionRadius

  for (const n of neighbors) {
    const d2 = distSq(self.position, n.position)
    if (d2 < sr2) sepNeighbors.push(n)
    if (d2 < ar2) aliNeighbors.push(n)
    if (d2 < cr2) cohNeighbors.push(n)
  }

  const sep = separation(self, sepNeighbors, radii.separationRadius)
  const ali = alignment(self, aliNeighbors)
  const coh = cohesion(self, cohNeighbors)

  return {
    x: sep.x * weights.separationWeight + ali.x * weights.alignmentWeight + coh.x * weights.cohesionWeight,
    y: sep.y * weights.separationWeight + ali.y * weights.alignmentWeight + coh.y * weights.cohesionWeight,
    z: sep.z * weights.separationWeight + ali.z * weights.alignmentWeight + coh.z * weights.cohesionWeight,
  }
}
