/**
 * 창의 마우스 이벤트 무시(click-through) 여부를 결정하는 순수 함수.
 *
 * passthrough(수조 숨김 또는 마우스 투과가 켜진 상태) 중이면 수조 영역의 클릭을
 * 뒤쪽 화면으로 통과시킨다. 단, 컨트롤(플로팅 버튼/패널) 위에 마우스가 있으면
 * 그 컨트롤은 계속 조작할 수 있어야 하므로 무시하지 않는다.
 *
 * panelExpanded: 패널이 펼쳐진 동안은 투과를 통째로 일시 해제한다. hover 감지
 * (mouseenter→IPC→setIgnoreMouseEvents)가 빠른 이동+클릭보다 늦으면 패널 위 첫 클릭이
 * 뒤 화면으로 새어(라이브 QA에서 토글·종료 클릭이 뒤 앱에 전달) 위험하다. 패널이 열려
 * 있다는 것은 사용자가 컨트롤을 조작 중이라는 뜻이므로 이 동안 수조 투과를 멈추는 것이 안전하다.
 *
 * 이 규칙이 깨지면(예: passthrough 중 항상 무시) 패널을 다시 못 눌러 잠긴다.
 */
export function computeMouseIgnore(
  passthrough: boolean,
  hoveringControls: boolean,
  panelExpanded = false,
): boolean {
  return passthrough && !hoveringControls && !panelExpanded
}
