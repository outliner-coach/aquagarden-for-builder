export interface AppSettings {
  fishCount: number
  brightness01: number
  hidden: boolean
  clickThrough: boolean
  sceneTransparency01: number
  zoom: number
  /** 켜진 특별 개체 종 id 목록. 유효성은 renderer에서 availableFeatures와 교집합으로 검증. */
  enabledFeatures: string[]
  /** 시간대 반응(무드) 조명 on/off. 하위호환: 없으면 false. */
  moodReactive: boolean
  /** 토큰 사용량 게이지·대사 표시 on/off. 하위호환: 없으면 표시(true). */
  showTokenUsage: boolean
  /** 배경 테마 id(themeRegistry 참조). 하위호환: 없거나 유령 id면 기본 테마('minimal'). */
  themeId?: string
  /**
   * 카메라 궤도 각도(도). 캔버스 드래그로 변경, 더블클릭 정면 복귀(0,0), 줌과 같은 영속 패턴.
   * 하위호환: 구버전 저장값엔 없음 — 없으면 0(정면), 로드 시 CAMERA.orbit.drag 범위로 클램프.
   */
  cameraYaw?: number
  cameraPitch?: number
}

export interface MoveWindowByPayload {
  dx: number
  dy: number
}

export interface SetMouseIgnorePayload {
  ignore: boolean
}

export interface SetWindowHeightPayload {
  height: number
}

export interface SetAlwaysOnTopPayload {
  enabled: boolean
}

export interface SetWindowSizePayload {
  width: number
  height: number
  /** true면 하단 가장자리를 고정한 채 크기 변경(패널을 위로 펼칠 때 바가 제자리 유지) */
  anchorBottom?: boolean
}

export interface SetWindowBoundsPayload {
  x: number
  y: number
  width: number
  height: number
}

export interface AquaBridge {
  moveWindowBy(dx: number, dy: number): void
  /** 수조 영역 클릭 통과 on/off (forward:true로 컨트롤 hover는 계속 감지) */
  setMouseIgnore(ignore: boolean): void
  /** 패널 확장/축소에 맞춰 창 높이 조정 (잘림 방지) */
  setWindowHeight(height: number): void
  setAlwaysOnTop(enabled: boolean): void
  /**
   * 창 크기(width/height) 변경. main에서 현재 위치를 유지하며 창이 놓인 디스플레이 안으로 클램프.
   * anchorBottom=true면 하단 가장자리를 고정(위로 펼침) — 기본은 좌상단 앵커.
   */
  setWindowSize(width: number, height: number, anchorBottom?: boolean): void
  /** 저장된 절대 위치/크기로 창을 복원한다(화면 안으로 클램프). 재시작 시 영속 복원용. */
  setWindowBounds(x: number, y: number, width: number, height: number): void
  /** 앱 종료. frameless·always-on-top 오버레이라 메뉴/X가 없으므로 패널의 종료 버튼이 호출. (main에서 app.quit) */
  quitApp(): void
  /** 계정 토큰 사용량 스냅샷 조회. 앱 유일의 요청/응답 IPC — main의 getTokenUsage를 호출한다(never throw). */
  getTokenUsage(): Promise<TokenUsage>
}

/** 토큰 사용량 창(5시간/주간) 하나의 스냅샷. pct는 0..1, resetsAt는 epoch 초. */
export interface TokenUsageWindow {
  pct: number
  resetsAt: number
}

/** 사용량 조회 상태. 'unavailable'이면 window 필드(fiveHour/weekly)는 없다. */
export type TokenUsageState = 'ok' | 'unavailable'

/**
 * 계정 토큰 사용량 스냅샷. state==='unavailable'이면 fiveHour/weekly는 생략된다.
 * 보안: 토큰/자격증명(accessToken 등) 필드를 절대 추가하지 않는다.
 */
export interface TokenUsage {
  state: TokenUsageState
  fiveHour?: TokenUsageWindow
  weekly?: TokenUsageWindow
  /** 조회 시각(epoch 초) — state==='ok'면 그 값을 실제로 받아온 시각. */
  fetchedAt: number
  /**
   * 이 스냅샷이 라이브 조회 성공이 아니라 main의 마지막 성공 캐시 재반환인지. 라이브가 실패
   * (429/네트워크/자격증명)해도 값을 이어 보여주되, 렌더러가 fresh로 오판하지 않게 하는 신호다.
   * (없음=fresh. 이 플래그 없이 캐시를 state:'ok'로 되돌려주던 시절엔 55시간 묵은 값이 현재값처럼 보였다.)
   */
  stale?: true
}

/**
 * 마지막 성공(state==='ok') 사용량 캐시 항목. 라이브 조회가 실패해도 직전 성공 스냅샷을
 * "N분 전 기준"으로 보여주기 위해 재시작 간 유지한다(AppSettings와 분리 — 사용자 설정이 아니라 캐시).
 * 보안: TokenUsage에는 자격증명 필드가 없다 — 사용률(%)·시각만 담긴다.
 */
export interface TokenUsageCache {
  usage: TokenUsage
  /** 저장 시각(epoch 초). 경과(age) = now − savedAt. */
  savedAt: number
}
