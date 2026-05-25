export interface AppSettings {
  fishCount: number
  brightness01: number
  hidden: boolean
  clickThrough: boolean
  sceneTransparency01: number
  zoom: number
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
}
