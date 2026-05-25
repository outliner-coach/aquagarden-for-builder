/**
 * 수조 인터랙션(먹이주기·놀래키기·휠 확대)이 가능한 상태인지 판정한다.
 * 마우스 투과 ON이면 입력이 뒤 화면으로 통과하고, 수조 숨김 ON이면 캔버스가 없어 모두 불가.
 * FoodLure/FishDialogue의 게이트, 휠 줌 게이트, 패널 비활성 표시가 모두 이 식을 공유한다.
 */
export function computeInteractive(clickThrough: boolean, hidden: boolean): boolean {
  return !clickThrough && !hidden
}
