import { StaveNote, Voice, Formatter, RenderContext, Stave } from "vexflow";

// 음표 그리기 설정 타입
export interface DrawNotesConfig {
  context: RenderContext;
  stave: Stave;
  notes: StaveNote[];
  noteSpaceWidth: number;
  numBeats?: number;
  beatValue?: number;
}

/**
 * 마디에 음표를 그리는 함수 (중앙 정렬)
 * @param config - 음표 그리기 설정
 */
export function drawNotesOnStave(config: DrawNotesConfig): void {
  const { 
    context, 
    stave, 
    notes, 
    noteSpaceWidth, 
    numBeats = 4, 
    beatValue = 4 
  } = config;

  // Voice 생성 및 음표 추가
  const voice = new Voice({ 
    numBeats,   // 한 마디에 몇 박자
    beatValue   // 몇 분음표가 1박인지
  });
  voice.addTickables(notes);

  // 음표 간격 포맷팅 (voice 내부 음표 위치 계산)
  new Formatter().joinVoices([voice]).format([voice], noteSpaceWidth);
  
  // 실제 음표들이 차지하는 너비 계산 (중앙 정렬용)
  const tickables = voice.getTickables();
  if (tickables.length > 0) {
    const firstNote = tickables[0];
    const lastNote = tickables[tickables.length - 1];
    
    // 첫 음표 시작 ~ 마지막 음표 끝까지의 실제 너비
    const actualNotesWidth = (lastNote.getX() + lastNote.getWidth()) - firstNote.getX();
    
    // 남는 공간 계산
    const remainingSpace = noteSpaceWidth - actualNotesWidth;
    
    // 남는 공간의 절반만큼 음표 시작점을 오른쪽으로 이동 (중앙 정렬)
    if (remainingSpace > 0) {
      const currentNoteStartX = stave.getNoteStartX();
      stave.setNoteStartX(currentNoteStartX + remainingSpace / 2);
    }
  }
  
  // 악보에 그리기
  voice.draw(context, stave);
}

