"use client";

import { useEffect, useState, useRef } from "react";
import { useRouter } from "next/navigation";
import { Renderer, Stave, StaveNote, Voice, Formatter, Accidental } from "vexflow";
import fallbackSheetMusicData from "../../api.json";

// 악보 레이아웃 상수
const SHEET_MUSIC_LAYOUT = {
  NOTE_WIDTH: 80,        // 음표 간 거리 (px)
  START_MARGIN: 50,      // 시작 여백 (4/4 박자 기호 오른쪽 padding)
  END_MARGIN: 50,         // 끝 여백 (px)
  CANVAS_HEIGHT: 250,     // 캔버스 높이 (px)
  SCROLL_PADDING: 50,     // 스크롤 시 여유 공간 (px)
};

export default function SheetMusicPage() {
  const router = useRouter();
  
  // 데이터 상태
  const [isLoading, setIsLoading] = useState(true);
  const [sheetMusicData, setSheetMusicData] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);
  
  // 오디오 관련 상태
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [currentNoteIndex, setCurrentNoteIndex] = useState(-1);
  
  // VexFlow 렌더링용
  const containerRef = useRef<HTMLDivElement>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  
  // sessionStorage를 사용하여 새로고침 시에도 데이터 유지 (브라우저 탭 닫으면 자동 삭제)
  const [dataLoaded, setDataLoaded] = useState(false);

  // API 데이터 가져오기
  useEffect(() => {
    if (dataLoaded) return;
    
    const loadSheetMusic = () => {
      try {
        setIsLoading(true);
        
        // sessionStorage에서 데이터 가져오기 (브라우저 탭 닫으면 자동 삭제됨)
        const storedData = sessionStorage.getItem('sheetMusicData');
        
        if (storedData) {
          const apiResponse = JSON.parse(storedData);
          
          // API 응답 사용
          if (apiResponse) {
            setSheetMusicData(apiResponse);
            setError(null);
            setDataLoaded(true);
            
            // sessionStorage 유지 (새로고침 시에도 데이터 보존, 탭 닫으면 자동 삭제)
          } else {
            throw new Error('데이터가 없습니다');
          }
        } else {
          // 저장된 데이터가 없으면 fallback 데이터 사용
          console.warn('저장된 데이터가 없습니다. Fallback 데이터를 사용합니다.');
          setSheetMusicData(fallbackSheetMusicData);
          setDataLoaded(true);
        }
      } catch (err) {
        console.error('데이터 로드 오류:', err);
        setError('데이터를 불러오는데 실패했습니다');
        // 에러 발생 시에도 fallback 데이터 사용
        setSheetMusicData(fallbackSheetMusicData);
        setDataLoaded(true);
      } finally {
        setIsLoading(false);
      }
    };

    loadSheetMusic();
  }, [dataLoaded]);

  // 오디오 플레이어 초기화
  useEffect(() => {
    if (!sheetMusicData?.file_url) {
      console.warn('file_url이 없습니다:', sheetMusicData);
      return;
    }

    console.log('오디오 URL:', sheetMusicData.file_url);
    
    const audio = new Audio();
    audioRef.current = audio;

    let animationFrameId: number;

    // requestAnimationFrame을 사용해 더 정밀하게 시간 업데이트 (약 60fps)
    const updateTime = () => {
      if (audio && !audio.paused) {
        setCurrentTime(audio.currentTime);
        animationFrameId = requestAnimationFrame(updateTime);
      }
    };

    const handlePlay = () => {
      animationFrameId = requestAnimationFrame(updateTime);
    };

    const handlePause = () => {
      if (animationFrameId) {
        cancelAnimationFrame(animationFrameId);
      }
    };

    const handleEnded = () => {
      setIsPlaying(false);
      if (animationFrameId) {
        cancelAnimationFrame(animationFrameId);
      }
    };

    const handleError = (e: Event) => {
      console.error('오디오 로드 에러:', e);
      console.error('오디오 에러 상세:', audio.error);
      setError(`오디오 파일을 로드할 수 없습니다: ${audio.error?.message || '알 수 없는 오류'}`);
    };

    const handleCanPlay = () => {
      console.log('오디오 로드 성공');
    };

    audio.addEventListener('play', handlePlay);
    audio.addEventListener('pause', handlePause);
    audio.addEventListener('ended', handleEnded);
    audio.addEventListener('error', handleError);
    audio.addEventListener('canplay', handleCanPlay);

    // src 설정은 이벤트 리스너 추가 후에
    audio.src = sheetMusicData.file_url;
    audio.load();

    return () => {
      audio.removeEventListener('play', handlePlay);
      audio.removeEventListener('pause', handlePause);
      audio.removeEventListener('ended', handleEnded);
      audio.removeEventListener('error', handleError);
      audio.removeEventListener('canplay', handleCanPlay);
      if (animationFrameId) {
        cancelAnimationFrame(animationFrameId);
      }
      audio.pause();
    };
  }, [sheetMusicData?.file_url]);

  // 현재 재생 중인 음표 찾기 (더 정밀한 타이밍)
  useEffect(() => {
    if (!sheetMusicData?.notes) return;

    // 현재 시간과 가장 가까운 음표 찾기
    let foundIndex = -1;
    
    for (let i = 0; i < sheetMusicData.notes.length; i++) {
      const note = sheetMusicData.notes[i];
      
      // 현재 시간이 음표의 시작 시간을 지났으면 해당 음표 선택
      if (currentTime >= note.start_time) {
        foundIndex = i;
      } else {
        // 다음 음표의 시작 시간을 아직 안 지났으면 중단
        break;
      }
    }

    // 새로운 음표가 발견되면 업데이트
    if (foundIndex >= 0 && foundIndex !== currentNoteIndex) {
      setCurrentNoteIndex(foundIndex);
    }
  }, [currentTime, sheetMusicData, currentNoteIndex]);

  // 현재 음표로 자동 스크롤 (화면을 벗어날 때 맨 왼쪽으로)
  useEffect(() => {
    if (currentNoteIndex < 0 || !scrollContainerRef.current || !sheetMusicData?.notes) return;

    const container = scrollContainerRef.current;
    
    // 음표 위치 계산
    // stave 시작(10px) + 클레프/박자(100px) + START_MARGIN + 음표별 위치
    const staveStart = 10;
    const clefAndTimeWidth = 100;
    const notePosition = staveStart + clefAndTimeWidth + SHEET_MUSIC_LAYOUT.START_MARGIN + currentNoteIndex * SHEET_MUSIC_LAYOUT.NOTE_WIDTH;

    // 현재 스크롤 위치와 보이는 영역
    const scrollLeft = container.scrollLeft;
    const containerWidth = container.clientWidth;
    const visibleEnd = scrollLeft + containerWidth;

    // 음표의 끝 위치
    const noteEnd = notePosition + SHEET_MUSIC_LAYOUT.NOTE_WIDTH;
    
    // 음표가 화면 오른쪽을 벗어났는지 확인
    if (noteEnd > visibleEnd - SHEET_MUSIC_LAYOUT.SCROLL_PADDING) {
      // 오른쪽을 벗어남 - 해당 음표를 맨 왼쪽에 위치시킴
      container.scrollTo({
        left: notePosition - SHEET_MUSIC_LAYOUT.SCROLL_PADDING,
        behavior: 'smooth'
      });
    }
  }, [currentNoteIndex, sheetMusicData]);

  // VexFlow 악보 렌더링
  useEffect(() => {
    if (!sheetMusicData?.notes || !containerRef.current) return;

    // 컨테이너 초기화
    containerRef.current.innerHTML = '';

    const VF = { Renderer, Stave, StaveNote, Voice, Formatter, Accidental };
    
    // 음표 변환 함수 (API 형식 → VexFlow 형식)
    const convertNoteFormat = (apiNote: string): string => {
      // 유니코드 음악 기호를 일반 기호로 변환
      const normalizedNote = apiNote.replace('♯', '#').replace('♭', 'b');
      
      // "F4" → "f/5", "C#5" → "c#/6", "Bb3" → "bb/4"
      const noteName = normalizedNote.charAt(0).toLowerCase();
      const restOfNote = normalizedNote.slice(1);
      const octave = parseInt(restOfNote.charAt(restOfNote.length - 1));
      const accidental = restOfNote.slice(0, -1).toLowerCase();
      
      // clef에 따라 옥타브 조정
      let adjustedOctave = octave;
      const clef = sheetMusicData.clef || 'treble'; // 기본값은 treble
      
      if (clef === 'bass') {
        // bass clef: 한 옥타브 올림
        adjustedOctave = octave + 1;
      }
      // treble clef: 그대로 사용 (조정 없음)
      
      return `${noteName}${accidental}/${adjustedOctave}`;
    };

    // 모든 음표를 한 줄에 표시
    const allNotes = sheetMusicData.notes;
    
    // 캔버스 크기 설정 (음표 개수에 따라 너비 동적 조정)
    const canvasWidth = allNotes.length * SHEET_MUSIC_LAYOUT.NOTE_WIDTH + 
                        SHEET_MUSIC_LAYOUT.START_MARGIN + 
                        SHEET_MUSIC_LAYOUT.END_MARGIN;
    const canvasHeight = SHEET_MUSIC_LAYOUT.CANVAS_HEIGHT;
    
    // 렌더러 생성
    const renderer = new VF.Renderer(
      containerRef.current, 
      VF.Renderer.Backends.SVG
    );
    renderer.resize(canvasWidth, canvasHeight);
    const context = renderer.getContext();

    // 오선지 생성 (하나의 연속된 오선지)
    const staveX = 10;
    const staveWidth = canvasWidth - staveX - 10;
    const stave = new VF.Stave(staveX, 40, staveWidth);
    const clef = sheetMusicData.clef || 'treble'; // API에서 받은 clef 값 사용 (기본값: treble)
    stave.addClef(clef).addTimeSignature('4/4');
    stave.setContext(context).draw();

    // 모든 음표 생성
    const staveNotes = allNotes.map((note: any, index: number) => {
      const vexNote = new VF.StaveNote({
        keys: [convertNoteFormat(note.note)],
        duration: 'q' // 모든 음표를 4분음표로 단순화
      });

      // 샤프(#) 또는 플랫(b) 추가
      const accidental = note.note.slice(1, -1);
      if (accidental === '#' || accidental === '♯') {
        vexNote.addModifier(new VF.Accidental('#'), 0);
      } else if (accidental === 'b' || accidental === '♭') {
        vexNote.addModifier(new VF.Accidental('b'), 0);
      }

      // 색상 설정
      if (index === currentNoteIndex) {
        // 현재 재생 중 - 빨간색
        vexNote.setStyle({ fillStyle: 'red', strokeStyle: 'darkred' });
      } else if (index < currentNoteIndex) {
        // 이미 지나감 - 회색
        vexNote.setStyle({ fillStyle: 'gray', strokeStyle: 'gray' });
      } else {
        // 아직 재생 안됨 - 검정색
        vexNote.setStyle({ fillStyle: 'black', strokeStyle: 'black' });
      }

      return vexNote;
    });

    // Voice 생성
    const voice = new VF.Voice({ 
      numBeats: allNotes.length, 
      beatValue: 4 
    });
    voice.addTickables(staveNotes);

    // 포맷팅 및 렌더링
    // 음표가 사용할 수 있는 공간 계산
    const availableWidth = staveWidth - SHEET_MUSIC_LAYOUT.START_MARGIN - SHEET_MUSIC_LAYOUT.END_MARGIN - 100;
    
    new VF.Formatter()
      .joinVoices([voice])
      .format([voice], availableWidth);

    // Stave의 음표 시작 위치를 조정 (클레프/박자 이후 + START_MARGIN)
    const defaultNoteStartX = stave.getNoteStartX();
    stave.setNoteStartX(defaultNoteStartX + SHEET_MUSIC_LAYOUT.START_MARGIN);
    
    voice.draw(context, stave);

  }, [sheetMusicData, currentNoteIndex]);

  // 오디오 컨트롤 함수
  const handlePlay = () => {
    if (audioRef.current) {
      audioRef.current.play();
      setIsPlaying(true);
    }
  };

  const handlePause = () => {
    if (audioRef.current) {
      audioRef.current.pause();
      setIsPlaying(false);
    }
  };

  const handleStop = () => {
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.currentTime = 0;
      setIsPlaying(false);
      setCurrentTime(0);
      setCurrentNoteIndex(-1); // 음표 강조 초기화
    }
    
    // 스크롤을 맨 왼쪽으로 이동
    if (scrollContainerRef.current) {
      scrollContainerRef.current.scrollTo({
        left: 0,
        behavior: 'smooth'
      });
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-zinc-50 font-sans dark:bg-black">
      <main className="flex min-h-screen w-full max-w-6xl flex-col items-center justify-center py-32 px-16 bg-white dark:bg-black">
        <div className="w-full space-y-8">
          <div className="text-center">
            <h1 className="text-4xl font-bold leading-tight tracking-tight text-black dark:text-zinc-50 mb-4">
              Sheet Music
            </h1>
            <p className="text-lg leading-8 text-zinc-600 dark:text-zinc-400">
              음악 파일이 성공적으로 분석되었습니다
            </p>
          </div>

          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-black dark:border-white"></div>
            </div>
          ) : error ? (
            <div className="bg-red-50 dark:bg-red-900/20 rounded-lg p-8 border border-red-200 dark:border-red-800">
              <div className="text-center space-y-4">
                <p className="text-lg font-medium text-red-900 dark:text-red-100">
                  오류가 발생했습니다
                </p>
                <p className="text-sm text-red-700 dark:text-red-300">
                  {error}
                </p>
              </div>
            </div>
          ) : (
            <>
              {/* 악보 표시 */}
              <div className="bg-zinc-50 dark:bg-zinc-900 rounded-lg p-8 border border-zinc-200 dark:border-zinc-800">
                <div className="text-center space-y-4">
                  <p className="text-lg font-medium text-zinc-900 dark:text-zinc-100 mb-4">
                    악보 생성이 완료되었습니다
                  </p>
                  <div 
                    ref={scrollContainerRef}
                    className="overflow-x-auto max-w-full"
                  >
                    <div
                      ref={containerRef}
                      id="vexflow-output"
                      className="bg-white rounded p-4 inline-block"
                    />
                  </div>
                </div>
              </div>

              {/* 오디오 컨트롤 */}
              <div className="bg-zinc-50 dark:bg-zinc-900 rounded-lg p-6 border border-zinc-200 dark:border-zinc-800">
                <div className="flex flex-col items-center gap-4">
                  <div className="text-sm text-zinc-600 dark:text-zinc-400">
                    재생 시간: {currentTime.toFixed(1)}초
                  </div>
                  
                  <div className="flex gap-2">
                    <button
                      onClick={handlePlay}
                      disabled={isPlaying}
                      className="px-6 py-2 rounded-full bg-blue-600 text-white disabled:bg-gray-400 hover:bg-blue-700 transition-colors"
                    >
                      ▶️ 재생
                    </button>
                    
                    <button
                      onClick={handlePause}
                      disabled={!isPlaying}
                      className="px-6 py-2 rounded-full bg-orange-600 text-white disabled:bg-gray-400 hover:bg-orange-700 transition-colors"
                    >
                      ⏸️ 일시정지
                    </button>
                    
                    <button
                      onClick={handleStop}
                      className="px-6 py-2 rounded-full bg-red-600 text-white hover:bg-red-700 transition-colors"
                    >
                      ⏹️ 정지
                    </button>
                  </div>
                </div>
              </div>
            </>
          )}

          {/* 하단 버튼 */}
          <div className="flex flex-col gap-4 sm:flex-row">
            <button
              onClick={() => router.push("/")}
              className="flex h-12 w-full items-center justify-center rounded-full border border-solid border-black/[.08] px-5 transition-colors hover:border-transparent hover:bg-black/[.04] dark:border-white/[.145] dark:hover:bg-[#1a1a1a] sm:w-auto sm:flex-1"
            >
              홈으로 돌아가기
            </button>
            <button
              onClick={() => {
                // sessionStorage 데이터 정리 (이미 로드 시 삭제됐지만 혹시 모를 경우 대비)
                sessionStorage.removeItem('sheetMusicData');
                router.push("/");
              }}
              className="flex h-12 w-full items-center justify-center gap-2 rounded-full bg-foreground px-5 text-background transition-colors hover:bg-[#383838] dark:hover:bg-[#ccc] sm:w-auto sm:flex-1"
            >
              새 파일 업로드
            </button>
          </div>
        </div>
      </main>
    </div>
  );
}