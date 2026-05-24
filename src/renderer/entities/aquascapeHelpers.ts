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

/** generateHardscape에 전달할 설정. config.ts HARDSCAPE에서 유래한다. */
export interface HardscapeConfig {
  rockCount: number
  pebbleCount: number
  driftwoodCount: number
  clusterCount: number
  clusterSpread: number
  rock: {
    minScale: number
    maxScale: number
    maxHeightAboveSand: number
  }
  pebble: {
    minScale: number
    maxScale: number
  }
  driftwood: {
    minLength: number
    maxLength: number
    minRadius: number
    maxRadius: number
    maxHeightAboveSand: number
  }
}

/**
 * 결정적 시드 기반으로 바위·유목 배치를 생성한다.
 * 클러스터 기반 배치: 2~3개 군락 중심을 먼저 잡고 그 주변에 바위를 분포.
 * 모든 배치는 하단(sandY 기준 낮은 높이)에 한정되어 물고기 시야를 보존한다.
 */
export function generateHardscape(
  seed: number,
  area: { minX: number; maxX: number; minZ: number; maxZ: number },
  sandY: number,
  config?: HardscapeConfig,
): HardscapeResult {
  const rng = mulberry32(seed)
  const TWO_PI = Math.PI * 2

  const cfg: HardscapeConfig = config ?? {
    rockCount: 12,
    pebbleCount: 16,
    driftwoodCount: 4,
    clusterCount: 3,
    clusterSpread: 3.5,
    rock: { minScale: 0.18, maxScale: 0.55, maxHeightAboveSand: 0.7 },
    pebble: { minScale: 0.04, maxScale: 0.12 },
    driftwood: { minLength: 1.8, maxLength: 3.5, minRadius: 0.07, maxRadius: 0.13, maxHeightAboveSand: 0.9 },
  }

  const areaW = area.maxX - area.minX
  const areaD = area.maxZ - area.minZ

  // Generate cluster centers within the area
  const clusters: { cx: number; cz: number }[] = []
  for (let i = 0; i < cfg.clusterCount; i++) {
    clusters.push({
      cx: area.minX + areaW * (0.15 + rng() * 0.7),
      cz: area.minZ + areaD * (0.2 + rng() * 0.6),
    })
  }

  /** Place an item near a cluster center, clamped to area bounds. */
  function clusterPos(spread: number): { x: number; z: number } {
    const cluster = clusters[Math.floor(rng() * clusters.length)]
    const angle = rng() * TWO_PI
    const dist = rng() * spread
    const x = Math.max(area.minX, Math.min(area.maxX, cluster.cx + Math.cos(angle) * dist))
    const z = Math.max(area.minZ, Math.min(area.maxZ, cluster.cz + Math.sin(angle) * dist))
    return { x, z }
  }

  const rocks: Placement[] = []

  // Large rocks — clustered
  for (let i = 0; i < cfg.rockCount; i++) {
    const { x, z } = clusterPos(cfg.clusterSpread)
    const baseScale = cfg.rock.minScale + rng() * (cfg.rock.maxScale - cfg.rock.minScale)
    const scaleX = baseScale * (0.8 + rng() * 0.4)
    const scaleY = baseScale * (0.6 + rng() * 0.6)
    const scaleZ = baseScale * (0.8 + rng() * 0.4)
    const y = sandY + scaleY * 0.5 + rng() * (cfg.rock.maxHeightAboveSand - scaleY)
    const clampedY = Math.min(y, sandY + cfg.rock.maxHeightAboveSand)
    rocks.push({
      x, y: Math.max(sandY, clampedY), z,
      scaleX, scaleY, scaleZ,
      rotX: rng() * TWO_PI,
      rotY: rng() * TWO_PI,
      rotZ: rng() * TWO_PI * 0.3,
    })
  }

  // Pebbles — scattered around clusters with wider spread
  for (let i = 0; i < cfg.pebbleCount; i++) {
    const { x, z } = clusterPos(cfg.clusterSpread * 1.5)
    const baseScale = cfg.pebble.minScale + rng() * (cfg.pebble.maxScale - cfg.pebble.minScale)
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

  // Driftwood — placed near clusters, angled naturally
  const driftwood: Placement[] = []
  for (let i = 0; i < cfg.driftwoodCount; i++) {
    const { x, z } = clusterPos(cfg.clusterSpread * 1.2)
    const length = cfg.driftwood.minLength + rng() * (cfg.driftwood.maxLength - cfg.driftwood.minLength)
    const radius = cfg.driftwood.minRadius + rng() * (cfg.driftwood.maxRadius - cfg.driftwood.minRadius)
    const heightOffset = rng() * cfg.driftwood.maxHeightAboveSand * 0.4
    const y = sandY + heightOffset
    driftwood.push({
      x, y: Math.min(y, sandY + cfg.driftwood.maxHeightAboveSand), z,
      scaleX: length,
      scaleY: radius,
      scaleZ: radius * (0.8 + rng() * 0.4),
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
