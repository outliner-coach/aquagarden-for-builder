/**
 * 창의 마우스 이벤트 무시(click-through) 여부를 결정하는 순수 함수.
 *
 * passthrough(수조 숨김 또는 마우스 투과가 켜진 상태) 중이면 수조 영역의 클릭을
 * 뒤쪽 화면으로 통과시킨다. 단, 컨트롤(플로팅 버튼/패널) 위에 마우스가 있으면
 * 그 컨트롤은 계속 조작할 수 있어야 하므로 무시하지 않는다.
 *
 * 이 규칙이 깨지면(예: passthrough 중 항상 무시) 패널을 다시 못 눌러 잠긴다.
 */
export function computeMouseIgnore(
  passthrough: boolean,
  hoveringControls: boolean,
): boolean {
  return passthrough && !hoveringControls
}
