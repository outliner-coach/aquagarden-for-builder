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

export interface AquaBridge {
  moveWindowBy(dx: number, dy: number): void
  /** 수조 영역 클릭 통과 on/off (forward:true로 컨트롤 hover는 계속 감지) */
  setMouseIgnore(ignore: boolean): void
  /** 패널 확장/축소에 맞춰 창 높이 조정 (잘림 방지) */
  setWindowHeight(height: number): void
  setAlwaysOnTop(enabled: boolean): void
}
