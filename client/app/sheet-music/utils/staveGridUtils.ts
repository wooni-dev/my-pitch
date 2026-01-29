import { Stave, StaveNote, BarlineType } from "vexflow";
import { createStave } from "./staveUtils";
import { drawNotesOnStave } from "./noteUtils";
import { calculateStaveWidth } from "./staveWidthUtils";
import { getStaveIndex } from "./layoutUtils";
import { STAVE_HEIGHT, STAVE_ROW_MARGIN } from "./constants";
import type { RendererInitResult } from "./rendererUtils";

/**
 * 마디 그리드 렌더링 옵션
 */
export interface RenderStaveGridOptions {
  context: RendererInitResult['context'];
  totalStaveCount: number;
  stavesPerRow: number;
  rows: number;
  staveWidth: number;
  clef?: string; // 음자리표 (treble, bass 등)
  stavesData?: StaveNote[][]; // 마디별 노트 데이터 (선택적)
}

/**
 * 마디 그리드를 생성하고 렌더링합니다.
 * @param options 렌더링 옵션
 * @returns 생성된 마디 그리드 (2D 배열)
 */
export function renderStaveGrid(options: RenderStaveGridOptions): Stave[][] {
  const { 
    context, 
    totalStaveCount, 
    stavesPerRow, 
    rows, 
    staveWidth, 
    clef = "treble",
    stavesData 
  } = options;

  // 2D 배열로 마디 저장 (행별로 관리)
  const staveGrid: Stave[][] = Array.from({ length: rows }, () => []);

  // 마디 생성 (행 우선 순회)
  for (let row = 0; row < rows; row++) {
    // 현재 행의 실제 마디 개수 계산 (마지막 행은 부족할 수 있음)
    const stavesInThisRow = Math.min(
      stavesPerRow,
      totalStaveCount - row * stavesPerRow
    );

    let currentX = 0; // 현재 행에서 x 위치 누적

    for (let col = 0; col < stavesPerRow; col++) {
      const staveIndex = getStaveIndex(row, col, stavesPerRow);

      // 총 마디 개수를 초과하면 종료
      if (staveIndex >= totalStaveCount) break;

      // 행의 첫 번째와 마지막 마디인지 확인
      const isFirstInRow = col === 0;
      const isLastInRow = col === stavesInThisRow - 1;

      // 마디 너비 계산
      const width = calculateStaveWidth(
        staveWidth,
        isFirstInRow,
        isLastInRow,
        stavesInThisRow,
        stavesPerRow
      );

      // 마지막 마디인지 확인
      const isLastStave = staveIndex === totalStaveCount - 1;
      
      // 마디 생성 (행 간격을 고려한 y 위치)
      const { stave, noteSpaceWidth } = createStave({
        x: currentX,
        y: row * (STAVE_HEIGHT + STAVE_ROW_MARGIN),
        width,
        context,
        clef: isFirstInRow ? clef : undefined,
        clefRightMargin: 0,
        noteSpaceRightMargin: 20,
        endBarType: isLastStave ? BarlineType.END : undefined, // 마지막 마디에만 종지선 추가
      });

      currentX += width; // 다음 마디의 x 위치 계산
      staveGrid[row][col] = stave;

      // 음표 데이터 가져오기
      const notes = stavesData && stavesData[staveIndex] 
        ? stavesData[staveIndex] 
        : []; // 데이터가 없으면 빈 마디

      // 음표가 있으면 마디에 그리기
      if (notes.length > 0) {
        drawNotesOnStave({
          context,
          stave,
          notes,
          noteSpaceWidth,
          numBeats: 4, // 한 마디에 몇 박자 (4박자)
          beatValue: 4, // 몇 분음표가 1박인지 (4분음표 = 1박)
        });
      }
    }
  }

  return staveGrid;
}

