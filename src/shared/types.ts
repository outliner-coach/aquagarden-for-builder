export interface AppSettings {
  fishCount: number
  brightness01: number
  hidden: boolean
  clickThrough: boolean
}

export interface MoveWindowByPayload {
  dx: number
  dy: number
}

export interface SetClickThroughPayload {
  enabled: boolean
}

export interface SetVisibilityPayload {
  hidden: boolean
}

export interface AquaBridge {
  moveWindowBy(dx: number, dy: number): void
  setClickThrough(enabled: boolean): void
  toggleVisibility(hidden: boolean): void
  setAlwaysOnTop(enabled: boolean): void
}
