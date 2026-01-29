import { STAVE_WIDTH_OFFSET } from "./constants";

/**
 * 마디의 너비를 계산합니다.
 * @param staveWidth 기본 마디 너비
 * @param isFirstInRow 행의 첫 번째 마디인지 여부
 * @param isLastInRow 행의 마지막 마디인지 여부
 * @param stavesInThisRow 현재 행의 마디 개수
 * @param stavesPerRow 한 줄에 들어가야 하는 마디 개수
 * @returns 계산된 마디 너비
 */
export function calculateStaveWidth(
  staveWidth: number,
  isFirstInRow: boolean,
  isLastInRow: boolean,
  stavesInThisRow: number,
  stavesPerRow: number
): number {
  let width = staveWidth;
  
  // 한 줄을 다 채운 경우에만 OFFSET 적용
  const isRowFull = stavesInThisRow === stavesPerRow;
  
  if (isFirstInRow && stavesInThisRow === 1) {
    // 한 줄에 마디가 1개일 경우에만 오른쪽 여백 빼기
    width = staveWidth - STAVE_WIDTH_OFFSET;
  } else if (isLastInRow && stavesInThisRow > 1 && isRowFull) {
    // 한 줄을 다 채웠고, 마디가 여러 개일 때 마지막 마디만 오른쪽 여백 빼기
    width = staveWidth - STAVE_WIDTH_OFFSET;
  }
  
  return width;
}

