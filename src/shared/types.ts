export interface AppSettings {
  fishCount: number
  brightness01: number
  hidden: boolean
  clickThrough: boolean
  sceneTransparency01: number
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
}

export interface AquaBridge {
  moveWindowBy(dx: number, dy: number): void
  /** 수조 영역 클릭 통과 on/off (forward:true로 컨트롤 hover는 계속 감지) */
  setMouseIgnore(ignore: boolean): void
  /** 패널 확장/축소에 맞춰 창 높이 조정 (잘림 방지) */
  setWindowHeight(height: number): void
  setAlwaysOnTop(enabled: boolean): void
  /** 창 크기(width/height) 변경. main에서 현재 위치(좌상단)를 유지하며 화면 안으로 클램프(중앙정렬 안 함). */
  setWindowSize(width: number, height: number): void
  /** 앱 종료. frameless·always-on-top 오버레이라 메뉴/X가 없으므로 패널의 종료 버튼이 호출. (main에서 app.quit) */
  quitApp(): void
}
