/**
 * 배경 테마 순수 헬퍼 (TDD).
 */

/**
 * 저장된(또는 외부 입력) themeId 값의 유효성을 검사해 사용할 테마 id를 반환한다.
 * 비문자열이거나 등록되지 않은(유령) id는 defaultId로 대체한다(하위호환 보정).
 */
export function resolveThemeId(
  saved: unknown,
  validIds: readonly string[],
  defaultId: string,
): string {
  if (typeof saved !== 'string') return defaultId
  return validIds.includes(saved) ? saved : defaultId
}
