/**
 * 바위 변위(노이즈) 순수 헬퍼.
 * 정12면체(classic) 대신 아이코사헤드론 + 위치기반 해시 변위로 로우폴리 자연스러운 바위를
 * 만든다. 렌더링(지오메트리 조립·flatShading)은 Aquascape가 담당하고, 여기는 결정적 계산만
 * 둔다(TDD 대상).
 *
 * CRITICAL: flat-shading 지오메트리(예: IcosahedronGeometry)는 같은 위치의 버텍스가 면마다
 * 중복 등장한다(공유 코너/엣지 중점이 삼각형마다 독립된 버텍스로 저장됨). 변위를 버텍스
 * **인덱스**가 아니라 **위치 값** 기반 해시로 계산해야, 같은 자리의 중복 버텍스들이 같은
 * 변위를 받아 면이 찢어지지 않는다. three.js의 폴리헤드론 서브디비전은 공유 엣지의 중점을
 * 양쪽 삼각형에서 서로 다른 순서로 lerp 계산할 수 있어 극미한(ULP) 부동소수 오차가 날 수
 * 있으므로, 해시 입력 좌표는 양자화(quantize)해 그 오차에 강건하게 만든다.
 */

/** 부동소수 좌표를 고정 소수 자리로 양자화한다(ULP급 오차를 같은 키로 합치기 위함). */
function quantize(v: number): number {
  // 소수 5자리: icosahedron 스케일(반경~1)에서 ULP 오차(~1e-15)보다 훨씬 크고,
  // 서브디비전으로 생긴 인접 버텍스 간 실제 거리(수십~수백분의 1 단위)보다는 훨씬 작다.
  const PRECISION = 100_000
  return Math.round(v * PRECISION) / PRECISION
}

/** 위치(x,y,z)+시드를 [0,1) 결정적 해시로 매핑한다(GLSL 관례의 sine-hash, Math.random 미사용). */
function hashPosition3(x: number, y: number, z: number, seed: number): number {
  const qx = quantize(x)
  const qy = quantize(y)
  const qz = quantize(z)
  const s = Math.sin(qx * 12.9898 + qy * 78.233 + qz * 37.719 + seed * 0.5453) * 43758.5453123
  return s - Math.floor(s)
}

/**
 * 버텍스별 위치 기반 해시 노이즈로 반경 방향 변위를 적용한다.
 *
 * - 같은 시드 → 동일 출력(결정적, `Math.random` 미사용).
 * - 각 버텍스의 변위 벡터 길이(반경 방향 스칼라의 절대값) ≤ strength.
 * - 같은 위치(x,y,z) 입력 → 같은 출력(버텍스 인덱스와 무관) — flat-shading 중복 버텍스 가드.
 * - NaN 없음(원점 버텍스는 0으로 나누기 가드로 무변위 처리).
 *
 * @param basePositions 버텍스 위치 플랫 배열 [x0,y0,z0, x1,y1,z1, ...]
 * @param seed 결정적 시드
 * @param strength 최대 변위량(반경 방향 스칼라, 오브젝트 로컬 유닛)
 */
export function displaceRockPositions(
  basePositions: ArrayLike<number>,
  seed: number,
  strength: number,
): Float32Array {
  const count = basePositions.length
  const out = new Float32Array(count)

  for (let i = 0; i < count; i += 3) {
    const x = basePositions[i]
    const y = basePositions[i + 1]
    const z = basePositions[i + 2]

    // 반경(원점→버텍스) 방향 단위벡터. 원점 버텍스(길이 0)는 변위 없음으로 가드(NaN 방지).
    const len = Math.sqrt(x * x + y * y + z * z)
    const invLen = len > 1e-8 ? 1 / len : 0
    const nx = x * invLen
    const ny = y * invLen
    const nz = z * invLen

    const h = hashPosition3(x, y, z, seed) // [0,1)
    const d = (h * 2 - 1) * strength // [-strength, strength]

    out[i] = x + nx * d
    out[i + 1] = y + ny * d
    out[i + 2] = z + nz * d
  }

  return out
}
