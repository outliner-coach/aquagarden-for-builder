/**
 * 커스틱 2중 UV 스크롤에 사용되는 오프셋을 계산한다.
 * 동일 입력에 대해 항상 같은 결과를 반환하며, 시간에 선형 비례한다.
 *
 * @param time  누적 시간(초)
 * @param speed 스크롤 속도 (단위/초)
 * @param angle 스크롤 방향 (라디안)
 * @returns UV 오프셋 { x, y }
 */
export function causticUvOffset(
  time: number,
  speed: number,
  angle: number,
): { x: number; y: number } {
  return {
    x: Math.cos(angle) * speed * time,
    y: Math.sin(angle) * speed * time,
  }
}
