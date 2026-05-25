import type { AppSettings } from '../shared/types'
import { ZOOM } from '../shared/config'

/**
 * 재시작 간 유지되는 상태(localStorage). 렌더러 상태(설정·바 크기·창 위치)를 저장/복원한다.
 * 창 위치/크기 복원은 main이 화면 안으로 클램프하므로 모니터 구성이 바뀌어도 안전하다.
 */
export interface PersistedState {
  settings: AppSettings
  alwaysOnTop: boolean
  barWidth: number
  barHeight: number
  winX: number
  winY: number
}

const KEY = 'aquagarden.state.v1'

function isFiniteNumber(v: unknown): v is number {
  return typeof v === 'number' && Number.isFinite(v)
}

/** 저장된 상태를 읽는다. 없거나 형식이 어긋나면 null(기본값 사용). */
export function loadPersisted(): PersistedState | null {
  try {
    const raw = localStorage.getItem(KEY)
    if (!raw) return null
    const p = JSON.parse(raw) as Partial<PersistedState>
    const s = p?.settings
    if (
      !s ||
      !isFiniteNumber(s.fishCount) ||
      !isFiniteNumber(s.brightness01) ||
      !isFiniteNumber(s.sceneTransparency01) ||
      typeof s.hidden !== 'boolean' ||
      typeof s.clickThrough !== 'boolean' ||
      !isFiniteNumber(p.barWidth) ||
      !isFiniteNumber(p.barHeight) ||
      !isFiniteNumber(p.winX) ||
      !isFiniteNumber(p.winY)
    ) {
      return null
    }
    return {
      settings: {
        fishCount: s.fishCount,
        brightness01: s.brightness01,
        sceneTransparency01: s.sceneTransparency01,
        hidden: s.hidden,
        clickThrough: s.clickThrough,
        // zoom은 하위호환을 위해 하드 가드에 넣지 않고, 없거나 범위 밖이면 기본값으로 보정한다.
        zoom: isFiniteNumber(s.zoom)
          ? Math.max(ZOOM.min, Math.min(ZOOM.max, s.zoom))
          : ZOOM.default,
      },
      alwaysOnTop: typeof p.alwaysOnTop === 'boolean' ? p.alwaysOnTop : true,
      barWidth: p.barWidth,
      barHeight: p.barHeight,
      winX: p.winX,
      winY: p.winY,
    }
  } catch {
    return null
  }
}

export function savePersisted(state: PersistedState): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(state))
  } catch {
    /* 저장 실패는 무시(프라이빗 모드/용량 등) */
  }
}
