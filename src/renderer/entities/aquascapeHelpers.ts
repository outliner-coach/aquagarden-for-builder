/**
 * 시간을 누적한다.
 * @param prev 이전 누적 시간(초)
 * @param dt 프레임 경과 시간(초)
 * @returns 새 누적 시간
 */
export function advanceTime(prev: number, dt: number): number {
  return prev + dt
}

/**
 * 사인 기반 수초 흔들림 오프셋 계산.
 * @param time 현재 시간(초, 라디안 스케일)
 * @param phase 개별 수초의 위상 오프셋(라디안)
 * @param amplitude 최대 변위
 * @returns 흔들림 오프셋 값
 */
export function swayOffset(time: number, phase: number, amplitude: number): number {
  return Math.sin(time + phase) * amplitude
}

/**
 * 높이 가중 곡선: 루트(0)→0, 끝(1)→1, 단조 증가.
 * 버텍스 셰이더에서 흔들림 크기를 높이에 비례시키기 위한 순수 함수.
 */
export function swayHeightFactor(height01: number): number {
  const clamped = Math.max(0, Math.min(1, height01))
  return clamped * clamped
}

/* ── Hardscape placement ── */

export interface Placement {
  x: number
  y: number
  z: number
  scaleX: number
  scaleY: number
  scaleZ: number
  rotX: number
  rotY: number
  rotZ: number
}

export interface HardscapeResult {
  rocks: Placement[]
  driftwood: Placement[]
}

/**
 * 결정적 시드 기반으로 바위·유목 배치를 생성한다.
 * 모든 배치는 하단(sandY 기준 낮은 높이)에 한정되어 물고기 시야를 보존한다.
 */
export function generateHardscape(
  seed: number,
  area: { minX: number; maxX: number; minZ: number; maxZ: number },
  sandY: number,
): HardscapeResult {
  const rng = mulberry32(seed)
  const TWO_PI = Math.PI * 2

  // config에서 가져올 수도 있지만 순수함수 테스트를 위해 내부 상수 사용
  const ROCK_COUNT = 10
  const PEBBLE_COUNT = 14
  const DRIFTWOOD_COUNT = 2
  const ROCK_MIN_SCALE = 0.08
  const ROCK_MAX_SCALE = 0.3
  const PEBBLE_MIN_SCALE = 0.03
  const PEBBLE_MAX_SCALE = 0.08
  const ROCK_MAX_HEIGHT = 0.5
  const DRIFTWOOD_MAX_HEIGHT = 0.8
  const DW_MIN_LEN = 1.2
  const DW_MAX_LEN = 2.5

  const rocks: Placement[] = []

  // Large rocks
  for (let i = 0; i < ROCK_COUNT; i++) {
    const x = area.minX + rng() * (area.maxX - area.minX)
    const z = area.minZ + rng() * (area.maxZ - area.minZ)
    const baseScale = ROCK_MIN_SCALE + rng() * (ROCK_MAX_SCALE - ROCK_MIN_SCALE)
    const scaleX = baseScale * (0.8 + rng() * 0.4)
    const scaleY = baseScale * (0.6 + rng() * 0.6)
    const scaleZ = baseScale * (0.8 + rng() * 0.4)
    const y = sandY + scaleY * 0.5 + rng() * (ROCK_MAX_HEIGHT - scaleY)
    const clampedY = Math.min(y, sandY + ROCK_MAX_HEIGHT)
    rocks.push({
      x, y: Math.max(sandY, clampedY), z,
      scaleX, scaleY, scaleZ,
      rotX: rng() * TWO_PI,
      rotY: rng() * TWO_PI,
      rotZ: rng() * TWO_PI * 0.3,
    })
  }

  // Pebbles (small rocks)
  for (let i = 0; i < PEBBLE_COUNT; i++) {
    const x = area.minX + rng() * (area.maxX - area.minX)
    const z = area.minZ + rng() * (area.maxZ - area.minZ)
    const baseScale = PEBBLE_MIN_SCALE + rng() * (PEBBLE_MAX_SCALE - PEBBLE_MIN_SCALE)
    const y = sandY + baseScale * 0.3
    rocks.push({
      x, y, z,
      scaleX: baseScale * (0.9 + rng() * 0.2),
      scaleY: baseScale * (0.7 + rng() * 0.3),
      scaleZ: baseScale * (0.9 + rng() * 0.2),
      rotX: rng() * TWO_PI,
      rotY: rng() * TWO_PI,
      rotZ: rng() * 0.5,
    })
  }

  // Driftwood
  const driftwood: Placement[] = []
  for (let i = 0; i < DRIFTWOOD_COUNT; i++) {
    const x = area.minX + rng() * (area.maxX - area.minX)
    const z = area.minZ + rng() * (area.maxZ - area.minZ)
    const length = DW_MIN_LEN + rng() * (DW_MAX_LEN - DW_MIN_LEN)
    const heightOffset = rng() * DRIFTWOOD_MAX_HEIGHT * 0.4
    const y = sandY + heightOffset
    driftwood.push({
      x, y: Math.min(y, sandY + DRIFTWOOD_MAX_HEIGHT), z,
      scaleX: length,
      scaleY: 0.03 + rng() * 0.04,
      scaleZ: 0.03 + rng() * 0.04,
      rotX: (rng() - 0.5) * 0.4,
      rotY: rng() * TWO_PI,
      rotZ: (rng() - 0.5) * 0.3,
    })
  }

  return { rocks, driftwood }
}

/* ── Plant instance generation ── */

export interface PlantSpeciesParams {
  minHeight: number
  maxHeight: number
  minScale: number
  maxScale: number
  baseColor: [number, number, number]
  tipColor: [number, number, number]
  colorVariation: number
}

export interface PlantInstanceData {
  x: number
  z: number
  yaw: number
  height: number
  scale: number
  phase: number
  baseColor: [number, number, number]
  tipColor: [number, number, number]
}

/**
 * 결정적 의사 난수 생성기 (mulberry32).
 */
function mulberry32(seed: number): () => number {
  let s = seed | 0
  return () => {
    s = (s + 0x6d2b79f5) | 0
    let t = Math.imul(s ^ (s >>> 15), 1 | s)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

/**
 * 결정적 시드 기반으로 수초 인스턴스 배치를 생성한다.
 * 같은 시드·파라미터면 항상 같은 결과를 반환한다.
 */
export function generatePlantInstances(
  seed: number,
  count: number,
  area: { minX: number; maxX: number; minZ: number; maxZ: number },
  params: PlantSpeciesParams,
): PlantInstanceData[] {
  if (count <= 0) return []

  const rng = mulberry32(seed)
  const TWO_PI = Math.PI * 2
  const instances: PlantInstanceData[] = []

  for (let i = 0; i < count; i++) {
    const x = area.minX + rng() * (area.maxX - area.minX)
    const z = area.minZ + rng() * (area.maxZ - area.minZ)
    const yaw = rng() * TWO_PI * 0.9999 // keep < 2π
    const height = params.minHeight + rng() * (params.maxHeight - params.minHeight)
    const scale = params.minScale + rng() * (params.maxScale - params.minScale)
    const phase = rng() * TWO_PI * 0.9999

    const cv = params.colorVariation
    const baseColor: [number, number, number] = [
      params.baseColor[0] + (rng() - 0.5) * cv,
      params.baseColor[1] + (rng() - 0.5) * cv,
      params.baseColor[2] + (rng() - 0.5) * cv,
    ]
    const tipColor: [number, number, number] = [
      params.tipColor[0] + (rng() - 0.5) * cv,
      params.tipColor[1] + (rng() - 0.5) * cv,
      params.tipColor[2] + (rng() - 0.5) * cv,
    ]

    instances.push({ x, z, yaw, height, scale, phase, baseColor, tipColor })
  }

  return instances
}
