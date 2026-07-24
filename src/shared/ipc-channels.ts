export const IPC = {
  MOVE_WINDOW_BY: 'overlay:move-window-by',
  SET_ALWAYS_ON_TOP: 'overlay:set-always-on-top',
  SET_MOUSE_IGNORE: 'overlay:set-mouse-ignore',
  SET_WINDOW_HEIGHT: 'overlay:set-window-height',
  SET_WINDOW_SIZE: 'overlay:set-window-size',
  SET_WINDOW_BOUNDS: 'overlay:set-window-bounds',
  QUIT_APP: 'overlay:quit-app',
  /** 토큰 사용량 조회 — 앱 유일의 요청/응답(invoke) 채널. 나머지는 모두 단방향 send. */
  GET_TOKEN_USAGE: 'api:get-token-usage',
} as const
