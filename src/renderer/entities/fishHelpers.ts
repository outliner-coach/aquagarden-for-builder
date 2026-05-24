/**
 * 매 틱 목표 개체수를 향해 perTick 이하로 수렴하는 다음 활성 수를 계산한다.
 * 증가는 점진적(perTick씩), 감소는 즉시.
 */
export function nextActiveCount(
  current: number,
  target: number,
  perTick: number,
): number {
  if (current < target) {
    return Math.min(current + perTick, target)
  }
  return target
}

/**
 * 시드로부터 결정적 헤엄 애니메이션 위상 오프셋을 생성한다.
 * 반환값은 [0, 2π) 범위.
 */
export function seedToPhase(seed: number): number {
  const hash = Math.sin(seed * 127.1 + 311.7) * 43758.5453
  const frac = hash - Math.floor(hash)
  return Math.abs(frac) * Math.PI * 2
}

/**
 * 현재 이동 속도에 비례해 셰이더 바디 벤딩 진폭을 계산한다.
 * 비율은 [0.3, 2.0] 범위로 클램프.
 */
export function swimAmplitudeFor(
  currentSpeed: number,
  baseSpeed: number,
  baseAmp: number,
): number {
  if (baseSpeed <= 0) return baseAmp
  const ratio = Math.max(0.3, Math.min(currentSpeed / baseSpeed, 2.0))
  return baseAmp * ratio
}

/**
 * 속도(vx, vz)를 바라보는 mesh의 Y축 회전(yaw)을 계산한다.
 * 물고기 geometry는 머리가 +X를 향하도록 정렬돼 있다는 규약을 가정한다.
 */
export function headingYaw(vx: number, vz: number): number {
  return -Math.atan2(vz, vx)
}

/**
 * 주어진 yaw로 회전했을 때 mesh 로컬 +X(머리)가 가리키는 월드 XZ 방향.
 * THREE rotation.y=θ 는 (1,0,0) → (cosθ, 0, -sinθ) 로 매핑한다.
 * (테스트용: 머리가 진행 방향을 앞서가는지 — 꼬리-앞 회귀 방지 — 검증)
 */
export function forwardDirAfterYaw(yaw: number): { x: number; z: number } {
  return { x: Math.cos(yaw), z: -Math.sin(yaw) }
}
