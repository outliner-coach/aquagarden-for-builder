/**
 * 배경 테마 세그먼트 버튼의 선택 상태 계산 (순수 로직, TDD).
 * ControlPanel은 DOM 생성/갱신 시 이 함수의 결과로 각 버튼의 aria-pressed·활성 클래스를 정한다.
 */

export interface ThemeSegmentOption {
  readonly id: string
  readonly displayName: string
}

export interface ThemeSegmentButtonState extends ThemeSegmentOption {
  readonly active: boolean
}

/**
 * 테마 옵션 목록 + 현재 선택된 id로 각 버튼의 active(선택) 여부를 계산한다.
 * 목록 순서를 보존한다(레지스트리 순서 = 렌더 순서). 일치하는 id가 없으면 전부 비활성
 * (방어적 분기 — 실제로는 resolveThemeId가 항상 유효 id를 보장해 발생하지 않는다).
 */
export function computeThemeSegmentState(
  options: readonly ThemeSegmentOption[],
  selectedId: string,
): ThemeSegmentButtonState[] {
  // 필드를 명시적으로 골라 담는다(스프레드 금지) — 호출측이 더 많은 필드를 가진 값을 넘겨도
  // (예: THEME_REGISTRY의 BackgroundTheme는 sandColor/plants/hardscape 등을 더 갖는다)
  // 반환 객체가 선언한 타입 그대로(id/displayName/active)만 담도록 보장한다.
  return options.map((opt) => ({ id: opt.id, displayName: opt.displayName, active: opt.id === selectedId }))
}
