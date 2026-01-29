/**
 * 화면 너비에 따른 한 줄당 마디 개수 계산
 * @param containerWidth - 컨테이너 너비
 * @returns 한 줄에 배치할 마디 개수
 */
export function calculateStavesPerRow(containerWidth: number): number {
  const MOBILE_BREAKPOINT = 640;
  const TABLET_BREAKPOINT = 1024;
  const TABLET_STAVE_WIDTH = TABLET_BREAKPOINT / 2; // ~512px (2개 기준)
  
  if (containerWidth < MOBILE_BREAKPOINT) {
    return 1; // 모바일: 1개/줄
  } else if (containerWidth < TABLET_BREAKPOINT) {
    return 2; // 태블릿: 2개/줄
  } else {
    // PC: 태블릿 기준 너비로 추가 마디 계산
    const extraWidth = containerWidth - TABLET_BREAKPOINT;
    const extraStaves = Math.floor(extraWidth / TABLET_STAVE_WIDTH);
    return 3 + extraStaves; // 3 + 추가 마디
  }
}

/**
 * 마디 레이아웃 정보 계산
 * @param totalStaves - 총 마디 개수
 * @param stavesPerRow - 한 줄당 마디 개수
 * @returns 행 개수와 한 줄당 마디 개수
 */
export function calculateStaveLayout(
  totalStaves: number,
  stavesPerRow: number
): { rows: number; stavesPerRow: number } {
  const rows = Math.ceil(totalStaves / stavesPerRow);
  return { rows, stavesPerRow };
}

/**
 * 행과 열을 마디 인덱스로 변환
 * @param row - 행 번호
 * @param col - 열 번호
 * @param stavesPerRow - 한 줄당 마디 개수
 * @returns 마디 인덱스
 */
export function getStaveIndex(
  row: number,
  col: number,
  stavesPerRow: number
): number {
  return row * stavesPerRow + col;
}

