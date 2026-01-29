import { Stave, RenderContext } from "vexflow";

// 마디 생성 설정 타입
export interface StaveConfig {
  x: number;           // X 좌표 (가로 위치)
  y: number;           // Y 좌표 (세로 위치)
  width: number;       // 마디 너비
  context: RenderContext; // VexFlow 렌더링 컨텍스트
  clef?: string;       // 클레프 종류 (예: "treble", "bass") - 선택적
  keySignature?: string; // 조표 (예: "C", "Bb", "F#") - 선택적
  clefRightMargin?: number; // clef 오른쪽 외부 여백 (px) - 선택적
  noteSpaceRightMargin?: number; // 음표 배치 공간 오른쪽 외부 여백 (px) - 선택적
  endBarType?: number; // 종지선 타입 - 선택적
}

// 마디 생성 결과 타입
export interface StaveResult {
  stave: Stave;
  clefWidth: number;
  staveLeftPadding: number;  // clef 오른쪽 기본 여백
  noteSpaceWidth: number;    // 음표 배치 가능 공간
}

/**
 * clef 정보를 계산하는 함수
 * @param stave - 계산할 stave 객체
 * @param clef - clef 타입 (있으면 계산, 없으면 0 반환)
 * @returns { clefWidth, staveLeftPadding }
 */
function calculateClefMetrics(stave: Stave, clef?: string): { clefWidth: number; staveLeftPadding: number } {
  // 마디 왼쪽 안쪽 여백 계산용 임시 stave (clef 없음)
  const tempStave = new Stave(
    stave.getX(), 
    stave.getY(), 
    stave.getWidth()
  );
  const staveLeftPadding = tempStave.getNoteStartX() - tempStave.getX();
  
  // clef가 없으면 마디 왼쪽 안쪽 여백만 반환
  if (!clef) return { clefWidth: 0, staveLeftPadding };
  
  // 전체 clef 공간 계산 (clef 그래픽 + clef 오른쪽 여백)
  // = 음표 시작점 - 마디 시작점 - 마디 왼쪽 안쪽 여백
  const noteStartX = stave.getNoteStartX();
  const clefWidth = noteStartX - stave.getX() - staveLeftPadding;
  
  return { clefWidth, staveLeftPadding };
}

// 마디 생성 함수
export function createStave(config: StaveConfig): StaveResult {
  const { x, y, width, context, clef, keySignature, clefRightMargin = 0, noteSpaceRightMargin = 0, endBarType } = config;
  
  // Stave 객체 생성
  const stave = new Stave(x, y, width);
  
  // 클레프 추가 (옵션)
  if (clef) {
    stave.addClef(clef);
    
    // clef 오른쪽 외부 여백 적용
    if (clefRightMargin > 0) {
      const currentStart = stave.getNoteStartX();
      stave.setNoteStartX(currentStart + clefRightMargin);
    }
  }
  
  // 조표 추가 (옵션)
  if (keySignature) {
    stave.addKeySignature(keySignature);
  }
  
  // 종지선 타입 설정 (draw 전에 설정)
  if (endBarType !== undefined) {
    stave.setEndBarType(endBarType);
  }
  
  // 컨텍스트 설정 및 그리기
  stave.setContext(context).draw();
  
  // clef 정보 계산
  const { clefWidth, staveLeftPadding } = calculateClefMetrics(stave, clef);
  
  // 음표 배치 가능한 공간 계산
  const noteSpaceWidth = stave.getWidth() - staveLeftPadding - clefWidth - noteSpaceRightMargin;
  
  return { stave, clefWidth, staveLeftPadding, noteSpaceWidth };
}
