import { StaveNote, Accidental, Stem } from "vexflow";

/**
 * API 노트 데이터를 VexFlow 악보로 변환하는 유틸리티
 * 
 * 이 서비스의 목적:
 * - 사용자가 올바른 음정(pitch)을 내고 있는지 확인
 * - 노래방에서 정확한 음높이로 부르고 있는지 시각적으로 확인
 * 
 * 설계 철학:
 * - 모든 음표를 4분음표로 통일 (음높이에 집중)
 * - 4/4 박자로 통일 (일관성 있는 악보)
 * - duration(시간)은 참고용, 박자 계산에 사용하지 않음
 */

/**
 * API 노트 데이터 타입
 */
export interface ApiNote {
  note: string;
  duration: number;
  start_time: number;
  end_time: number;
}

/**
 * API 응답 데이터 타입
 */
export interface ApiSheetMusicData {
  clef: string;
  notes: ApiNote[];
  file_url?: string;
  original_filename?: string;
}

/**
 * 노트 이름을 VexFlow 형식으로 변환
 * 예: "E3" -> "e/3", "D♯3" -> "d/3" (샾은 Accidental로 별도 처리)
 * 
 * @param noteName - 변환할 노트 이름 (예: "E3", "D♯3")
 * @param octaveShift - 옥타브 이동 값 (기본값: 0, bass clef의 경우 1)
 */
function convertNoteNameToVexFlow(noteName: string, octaveShift: number = 0): { key: string; accidental?: string } {
  // 노트 이름과 옥타브 분리
  const match = noteName.match(/^([A-G])([♯♭#b]?)(\d+)$/);
  
  if (!match) {
    throw new Error(`Invalid note format: ${noteName}`);
  }
  
  const [, note, accidental, octave] = match;
  const vexFlowNote = note.toLowerCase();
  // 옥타브에 shift 적용
  const adjustedOctave = parseInt(octave) + octaveShift;
  const vexFlowKey = `${vexFlowNote}/${adjustedOctave}`;
  
  // 샾(♯, #) 또는 플랫(♭, b) 변환
  let vexFlowAccidental: string | undefined;
  if (accidental === '♯' || accidental === '#') {
    vexFlowAccidental = '#';
  } else if (accidental === '♭' || accidental === 'b') {
    vexFlowAccidental = 'b';
  }
  
  return { key: vexFlowKey, accidental: vexFlowAccidental };
}

/**
 * 지속 시간(초)을 VexFlow duration으로 변환
 * 
 * 이 서비스의 목적은 사용자가 올바른 음정을 내고 있는지 확인하는 것이므로,
 * 모든 음표를 4분음표로 통일하여 음높이에 집중할 수 있도록 합니다.
 * 
 * @param durationInSeconds - 사용되지 않음 (호환성을 위해 유지)
 * @returns 항상 4분음표 ("q")
 */
function convertDurationToVexFlow(durationInSeconds: number): string {
  return "q";  // 모든 음표를 4분음표로 통일
}

/**
 * VexFlow duration을 박자 값으로 변환 (4/4 박자 기준)
 * 
 * 모든 음표가 4분음표로 통일되어 있으므로 항상 1박자를 반환합니다.
 * 쉼표는 여전히 다양한 길이를 지원합니다.
 * 
 * @param duration - VexFlow duration 문자열
 * @returns 박자 값 (1 = 1박자)
 */
function durationToBeats(duration: string): number {
  // 쉼표는 다양한 길이 지원
  const restDurations: { [key: string]: number } = {
    'wr': 4,   // 온쉼표 = 4박자
    'hr': 2,   // 2분쉼표 = 2박자
    'qr': 1,   // 4분쉼표 = 1박자
    '8r': 0.5, // 8분쉼표 = 0.5박자
    '16r': 0.25, // 16분쉼표 = 0.25박자
  };
  
  // 쉼표면 맵에서 찾기
  if (duration.endsWith('r')) {
    return restDurations[duration] || 1;
  }
  
  // 모든 음표는 4분음표 = 1박자
  return 1;
}

/**
 * 음표의 stem 방향을 결정하는 함수
 * treble clef 기준으로 중간선(B/4)을 기준으로 위/아래 판단
 * 
 * @param noteKey - VexFlow 형식의 음표 키 (예: "c/4", "e/5")
 * @returns Stem.UP (위로) 또는 Stem.DOWN (아래로)
 */
function determineStemDirection(noteKey: string): number {
  // 음표와 옥타브 파싱 (예: "c/4" -> note="c", octave=4)
  const [noteLetter, octaveStr] = noteKey.split('/');
  const octave = parseInt(octaveStr);
  
  // 음표를 숫자로 변환 (비교를 위해)
  const noteValues: { [key: string]: number } = {
    'c': 0, 'd': 1, 'e': 2, 'f': 3, 'g': 4, 'a': 5, 'b': 6
  };
  
  const noteValue = noteValues[noteLetter.toLowerCase()];
  const middleLineValue = noteValues['b']; // 중간선은 B
  const middleLineOctave = 4; // B/4
  
  // 현재 음표의 전체 높이 계산 (옥타브 * 7 + 음표값)
  const currentHeight = octave * 7 + noteValue;
  const middleLineHeight = middleLineOctave * 7 + middleLineValue;
  
  // 중간선보다 위에 있으면 꼬리를 아래로, 아래에 있으면 꼬리를 위로
  // 정확히 중간선에 있으면 관습적으로 아래로
  if (currentHeight >= middleLineHeight) {
    return Stem.DOWN; // 꼬리 아래로
  } else {
    return Stem.UP; // 꼬리 위로
  }
}

/**
 * API 노트 데이터를 VexFlow StaveNote로 변환
 * 
 * 음정(pitch)만 정확하게 변환하고, 모든 음표는 4분음표로 통일합니다.
 * 이를 통해 사용자가 올바른 음높이를 내고 있는지 쉽게 확인할 수 있습니다.
 * 
 * @param apiNote - API 노트 데이터
 * @param octaveShift - 옥타브 이동 값 (기본값: 0)
 */
export function convertApiNoteToStaveNote(apiNote: ApiNote, octaveShift: number = 0): StaveNote {
  const { key, accidental } = convertNoteNameToVexFlow(apiNote.note, octaveShift);
  const duration = convertDurationToVexFlow(apiNote.duration);
  
  // stem 방향 결정
  const stemDirection = determineStemDirection(key);
  
  const staveNote = new StaveNote({
    keys: [key],
    duration: duration,
    stemDirection: stemDirection,
  });
  
  // 샾/플랫 추가
  if (accidental) {
    staveNote.addModifier(new Accidental(accidental), 0);
  }
  
  return staveNote;
}

/**
 * 노트 배열을 마디 단위로 그룹화 (4/4 박자 기준)
 * 
 * 모든 음표가 4분음표(1박자)로 통일되어 있으므로,
 * 각 마디에 정확히 4개의 음표가 들어갑니다.
 * 
 * @param notes - 변환된 StaveNote 배열
 * @param beatsPerStave - 마디당 박자 수 (기본값: 4, 즉 4/4 박자)
 * @returns 마디별로 그룹화된 노트 배열
 */
export function groupNotesIntoStaves(
  notes: StaveNote[], 
  beatsPerStave: number = 4
): StaveNote[][] {
  const staves: StaveNote[][] = [];
  let currentStave: StaveNote[] = [];
  let currentBeats = 0;
  
  for (const note of notes) {
    const duration = note.getDuration();
    const noteBeats = durationToBeats(duration);
    
    // 현재 마디에 추가하면 박자를 초과하는 경우
    if (currentBeats + noteBeats > beatsPerStave && currentStave.length > 0) {
      // 현재 마디가 부족하면 쉼표로 채우기
      const remainingBeats = beatsPerStave - currentBeats;
      if (remainingBeats > 0) {
        currentStave.push(...fillWithRests(remainingBeats));
      }
      
      staves.push(currentStave);
      currentStave = [];
      currentBeats = 0;
    }
    
    // 현재 마디에 음표 추가
    currentStave.push(note);
    currentBeats += noteBeats;
    
    // 정확히 마디를 채운 경우
    if (currentBeats === beatsPerStave) {
      staves.push(currentStave);
      currentStave = [];
      currentBeats = 0;
    }
  }
  
  // 마지막 마디 처리
  if (currentStave.length > 0) {
    const remainingBeats = beatsPerStave - currentBeats;
    if (remainingBeats > 0) {
      currentStave.push(...fillWithRests(remainingBeats));
    }
    staves.push(currentStave);
  }
  
  return staves;
}

/**
 * 남은 박자를 쉼표로 채우기
 * @param beats - 채워야 할 박자 수
 * @returns 쉼표 배열
 */
function fillWithRests(beats: number): StaveNote[] {
  const rests: StaveNote[] = [];
  let remaining = beats;
  
  // 큰 쉼표부터 채우기
  while (remaining > 0) {
    if (remaining >= 4) {
      rests.push(new StaveNote({ keys: ["b/4"], duration: "wr" })); // 온쉼표
      remaining -= 4;
    } else if (remaining >= 2) {
      rests.push(new StaveNote({ keys: ["b/4"], duration: "hr" })); // 2분쉼표
      remaining -= 2;
    } else if (remaining >= 1) {
      rests.push(new StaveNote({ keys: ["b/4"], duration: "qr" })); // 4분쉼표
      remaining -= 1;
    } else if (remaining >= 0.5) {
      rests.push(new StaveNote({ keys: ["b/4"], duration: "8r" })); // 8분쉼표
      remaining -= 0.5;
    } else {
      rests.push(new StaveNote({ keys: ["b/4"], duration: "16r" })); // 16분쉼표
      remaining -= 0.25;
    }
  }
  
  return rests;
}

/**
 * API 응답 데이터를 마디별 노트 배열로 변환
 * 
 * 모든 음표를 4분음표로 변환하고 4/4 박자로 그룹화합니다.
 * 각 마디는 4개의 음표(4박자)를 포함하며, 부족한 경우 쉼표로 채웁니다.
 * 
 * clef가 'bass'인 경우, 모든 음표를 1옥타브 올려서 변환합니다.
 * 이는 bass clef의 낮은 음역대를 treble clef 오선지에서 읽기 쉽게 표시하기 위함입니다.
 * 
 * @param data - API 응답 데이터
 * @param beatsPerStave - 마디당 박자 수 (기본값: 4, 즉 4/4 박자)
 * @returns 마디별로 그룹화된 노트 배열
 */
export function convertApiDataToStaves(
  data: ApiSheetMusicData,
  beatsPerStave: number = 4
): StaveNote[][] {
  // bass clef인 경우 1옥타브 올림, treble인 경우 그대로
  const octaveShift = data.clef === 'bass' ? 1 : 0;
  
  // API 노트를 StaveNote로 변환 (모든 음표는 4분음표로 통일)
  const staveNotes = data.notes.map(apiNote => 
    convertApiNoteToStaveNote(apiNote, octaveShift)
  );
  
  // 마디 단위로 그룹화 (4/4 박자 기준)
  return groupNotesIntoStaves(staveNotes, beatsPerStave);
}

