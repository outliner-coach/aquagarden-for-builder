import { CAMERA } from '../../shared/config'

/**
 * 검사용 궤도(orbit) 카메라 — 순수 계산.
 *
 * 프로덕트 카메라는 정면 고정(0,0,5)이지만, "다른 각도에서 씬이 어떻게 보이는가"를
 * 확인하는 QA 훅(__AQUA_SET_CAMERA__, AQUA_SMOKE_CAM)이 이 계산을 쓴다.
 * CAMERA.orbit.target을 중심으로 yaw(수평)·pitch(고도)·distance 구면 좌표 궤도.
 * 불변식: yaw 0·pitch 0·기본 거리 = 기존 고정 카메라 위치와 정확히 일치(하위호환 앵커,
 * cameraHelpers.test 가드).
 */

export interface OrbitPose {
  readonly position: { x: number; y: number; z: number }
  readonly target: { x: number; y: number; z: number }
}

/**
 * yaw(도, +=오른쪽 궤도)·pitch(도, +=위에서 내려보기)·distance(월드, 생략 시 기본)로
 * 카메라 위치와 바라볼 타깃을 계산한다.
 */
export function orbitCameraPose(
  yawDeg: number,
  pitchDeg: number,
  distance: number = CAMERA.orbit.defaultDist,
): OrbitPose {
  const t = CAMERA.orbit.target
  const yaw = (yawDeg * Math.PI) / 180
  const pitch = (pitchDeg * Math.PI) / 180
  const horiz = Math.cos(pitch) * distance
  return {
    position: {
      x: t.x + Math.sin(yaw) * horiz,
      y: t.y + Math.sin(pitch) * distance,
      z: t.z + Math.cos(yaw) * horiz,
    },
    target: t,
  }
}

export interface OrbitAngles {
  readonly yaw: number
  readonly pitch: number
}

/**
 * 캔버스 드래그 델타(px) → 궤도 각도(도). 부호는 OrbitControls 관례(오른쪽 드래그 =
 * 카메라가 왼쪽 궤도로 = 씬이 오른쪽으로 도는 느낌), 아래로 끌면 내려보기(pitch↑).
 * 각도는 무대 세트가 성립하는 CAMERA.orbit.drag 범위로 항상 클램프한다.
 */
export function applyOrbitDrag(
  yawDeg: number,
  pitchDeg: number,
  dxPx: number,
  dyPx: number,
  cfg: typeof CAMERA.orbit.drag = CAMERA.orbit.drag,
): OrbitAngles {
  const yaw = Math.max(cfg.minYaw, Math.min(cfg.maxYaw, yawDeg - dxPx * cfg.yawPerPx))
  const pitch = Math.max(cfg.minPitch, Math.min(cfg.maxPitch, pitchDeg + dyPx * cfg.pitchPerPx))
  return { yaw, pitch }
}

/**
 * 각도 지수 수렴 한 스텝(더블클릭 정면 복귀용 — 무드 전환의 지수 수렴과 같은 패턴).
 * 타깃 근방 snapEps 안에 들면 정확히 타깃으로 스냅해 미세 진동을 막는다.
 */
export function approachAngle(
  current: number,
  target: number,
  dt: number,
  rate: number,
  snapEps = 0.05,
): number {
  const t = Math.min(1, dt * rate)
  const next = current + (target - current) * t
  return Math.abs(next - target) <= snapEps ? target : next
}
