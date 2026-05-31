/**
 * "바닥 기는 청소부"(새우) 전용 거동 순수 헬퍼.
 *
 * 일반 어종의 자유 유영과 달리, 새우는 모래바닥 근처 띠에 머물며
 * 수평 위주로 종종거린다. 그 두 특성을 부수효과 없는 순수 함수로 분리해
 * `Fish.update`가 호출하고, 여기서 결정적 유닛테스트로 가드한다.
 */

/**
 * 모래바닥 위 목표 높이(`floorY + offset`)로 끌어당기는 선형 수직 스프링 힘.
 * 목표보다 위면 음수(아래로), 아래면 양수(위로). 변위와 `pull`에 비례한다.
 *
 * @param y      현재 높이
 * @param floorY 바닥 높이(FISH.bounds.minY)
 * @param offset 바닥 위로 띄울 목표 높이(띠 중심)
 * @param pull   부착력(스프링 상수)
 */
export function floorBiasForce(
  y: number,
  floorY: number,
  offset: number,
  pull: number,
): number {
  const targetY = floorY + offset
  return (targetY - y) * pull
}

/**
 * 종종거림(scuttle) 속도 envelope. 한 주기 동안 멈칫(경계)→전진(중앙)→멈칫으로
 * 부드럽게 진동해 새우 특유의 끊기는 이동감을 만든다.
 * phase=0(주기 경계)에서 `minFactor`, 주기 중앙에서 1.0. 반환값 ∈ [minFactor, 1].
 *
 * @param phase     누적 위상(초)
 * @param period    종종거림 한 주기(초)
 * @param minFactor 멈칫 구간 최저 속도 비율(0=완전정지)
 */
export function scuttleSpeedFactor(
  phase: number,
  period: number,
  minFactor: number,
): number {
  const t = ((phase % period) + period) % period // [0, period)
  const pulse = (1 - Math.cos((2 * Math.PI * t) / period)) / 2 // 0→1→0
  return minFactor + (1 - minFactor) * pulse
}
