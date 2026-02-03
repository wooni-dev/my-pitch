"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useResizeObserver } from "../hooks/useResizeObserver";
import { useSheetMusicData } from "../hooks/useSheetMusicData";
import { initializeRenderer } from "./utils/rendererUtils";
import { renderStaveGrid } from "./utils/staveGridUtils";
import { convertApiDataToStaves } from "./utils/noteConverter";
import type { ApiSheetMusicData } from "./utils/noteConverter";
import UploadingModal from "../components/UploadingModal";

export default function SheetMusicPage() {
  const router = useRouter();
  const containerRef = useRef<HTMLDivElement>(null);
  const audioRef = useRef<HTMLAudioElement>(null);
  const titleRef = useRef<HTMLHeadingElement>(null);
  
  // 오디오 재생 상태
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const animationFrameRef = useRef<number | undefined>(undefined);
  const lastActiveNoteIndexRef = useRef<number>(-1);
  
  // 상단바 제목 상태
  const [showTitleInHeader, setShowTitleInHeader] = useState(false);
  
  // 컨테이너 크기 변화 감지
  const resizeTrigger = useResizeObserver(containerRef);
  
  // 악보 데이터 로드
  const [sheetMusicData, dataLoaded, loadError] = useSheetMusicData<ApiSheetMusicData>();
  
  // 제목 추출 (original_filename에서 확장자 제거)
  const apiData = sheetMusicData;
  const title = apiData?.original_filename 
    ? apiData.original_filename.replace(/\.(mp3|wav|m4a)$/i, '') 
    : '악보';
  
  // 오디오 URL 추출
  const audioUrl = apiData?.file_url || '';
  
  // 시간을 MM:SS 형식으로 변환
  const formatTime = (time: number) => {
    if (isNaN(time)) return '00:00';
    const minutes = Math.floor(time / 60);
    const seconds = Math.floor(time % 60);
    return `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
  };
  
  // clef에 따른 하이라이트 색상 설정
  const highlightColors = apiData?.clef === 'bass' 
    ? { fill: '#3B82F6', stroke: '#2563EB' } // 남성 보컬 (파란색)
    : { fill: '#EC4899', stroke: '#DB2777' }; // 여성 보컬 (핑크색)
  
  // 오디오 시간 업데이트 함수
  const updateCurrentTime = () => {
    if (audioRef.current && isPlaying) {
      setCurrentTime(audioRef.current.currentTime);
      animationFrameRef.current = requestAnimationFrame(updateCurrentTime);
    }
  };

  // 재생 상태 변경 시 시간 업데이트 시작/중지
  useEffect(() => {
    if (isPlaying) {
      animationFrameRef.current = requestAnimationFrame(updateCurrentTime);
    } else {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    }
    
    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, [isPlaying]);

  // 오디오 duration 로드
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    const handleLoadedMetadata = () => {
      setDuration(audio.duration);
    };

    audio.addEventListener('loadedmetadata', handleLoadedMetadata);
    
    // 이미 로드되었을 경우
    if (audio.duration) {
      setDuration(audio.duration);
    }
    
    return () => {
      audio.removeEventListener('loadedmetadata', handleLoadedMetadata);
    };
  }, [audioUrl]);

  // 스크롤 이벤트로 상단바 제목 전환
  useEffect(() => {
    const handleScroll = () => {
      if (!titleRef.current) return;
      
      const titleRect = titleRef.current.getBoundingClientRect();
      // 제목이 화면 위로 벗어나면 상단바에 표시
      setShowTitleInHeader(titleRect.bottom < 64); // 64px는 상단바 높이
    };

    window.addEventListener('scroll', handleScroll);
    
    return () => {
      window.removeEventListener('scroll', handleScroll);
    };
  }, []);

  // 오디오 종료 이벤트 처리
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    const handleEnded = () => {
      // ref 값을 먼저 초기화 (state 업데이트 전)
      lastActiveNoteIndexRef.current = -1;
      
      // state 업데이트 (useEffect 트리거)
      setIsPlaying(false);
      setCurrentTime(0);
      
      // 맨 위로 스크롤
      window.scrollTo({
        top: 0,
        behavior: 'smooth'
      });
    };

    audio.addEventListener('ended', handleEnded);
    
    return () => {
      audio.removeEventListener('ended', handleEnded);
    };
  }, [audioUrl]); // audioUrl 의존성 추가로 오디오 변경 시 이벤트 재등록

  // 음표 하이라이트 업데이트
  useEffect(() => {
    if (!containerRef.current) return;

    const svgElement = containerRef.current.querySelector('svg');
    if (!svgElement) return;

    const noteElements = svgElement.querySelectorAll('.vf-stavenote[data-start-time]');
    
    // 재생이 끝났거나 정지 상태에서 currentTime이 0이면 모든 하이라이트 제거
    if (!isPlaying && currentTime === 0) {
      noteElements.forEach((element) => {
        const existingHighlight = element.querySelector('.note-highlight');
        if (existingHighlight) {
          existingHighlight.remove();
        }
      });
      return; // 더 이상 진행하지 않음
    }
    
    let activeNoteElement: Element | null = null;
    let currentActiveIndex = -1;
    
    // 현재 재생 중인 음표 찾기
    noteElements.forEach((element, index) => {
      const startTime = parseFloat(element.getAttribute('data-start-time') || '0');
      const endTime = parseFloat(element.getAttribute('data-end-time') || '0');
      
      // 현재 재생 시간이 음표의 시작 시간을 지났는지 확인
      if (currentTime >= startTime) {
        // 가장 최근에 시작된 음표 찾기
        if (index > currentActiveIndex) {
          currentActiveIndex = index;
          activeNoteElement = element;
        }
      }
    });
    
    // 활성 음표가 있으면 인덱스 업데이트
    if (currentActiveIndex !== -1) {
      lastActiveNoteIndexRef.current = currentActiveIndex;
    }
    
    // 활성 음표가 없으면 마지막 음표 사용
    if (!activeNoteElement && lastActiveNoteIndexRef.current !== -1) {
      activeNoteElement = noteElements[lastActiveNoteIndexRef.current];
    }
    
    // 모든 하이라이트 제거
    noteElements.forEach((element) => {
      const existingHighlight = element.querySelector('.note-highlight');
      if (existingHighlight) {
        existingHighlight.remove();
      }
    });
    
    // 활성 음표에 하이라이트 추가
    if (activeNoteElement) {
      // 음표의 bounding box 가져오기
      const bbox = (activeNoteElement as SVGGraphicsElement).getBBox();
      
      // 5선보의 정확한 중심선 y 좌표
      const staveCenterY = parseFloat(activeNoteElement.getAttribute('data-stave-center-y') || '0');
      
      // 하이라이트 높이 (5선보 + 음표 stem을 포함)
      const noteHeadHeight = 100;
      const highlightY = staveCenterY - noteHeadHeight / 2;
      
      // 사각형 하이라이트 생성
      const highlight = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
      highlight.classList.add('note-highlight');
      highlight.setAttribute('x', String(bbox.x - 5));
      highlight.setAttribute('y', String(highlightY));
      highlight.setAttribute('width', String(bbox.width + 10));
      highlight.setAttribute('height', String(noteHeadHeight));
      highlight.setAttribute('fill', highlightColors.fill);
      highlight.setAttribute('fill-opacity', '0.35');
      highlight.setAttribute('stroke', highlightColors.stroke);
      highlight.setAttribute('stroke-width', '2.5');
      highlight.setAttribute('rx', '4');
      
      // 음표 뒤에 하이라이트 삽입 (배경으로)
      activeNoteElement.insertBefore(highlight, activeNoteElement.firstChild);
    }

    // 활성 음표가 있으면 해당 위치로 스크롤
    if (activeNoteElement && isPlaying) {
      const noteRect = activeNoteElement.getBoundingClientRect();
      const windowHeight = window.innerHeight;
      
      // 음표가 화면의 중앙 50% 영역 밖에 있는지 확인
      const isOutOfCenterView = 
        noteRect.top < windowHeight * 0.25 || 
        noteRect.bottom > windowHeight * 0.75;
      
      // 화면 중앙 영역을 벗어나면 스크롤
      if (isOutOfCenterView) {
        // 음표를 화면 중앙으로 이동
        const noteCenter = noteRect.top + noteRect.height / 2;
        const targetScroll = window.scrollY + noteCenter - windowHeight / 2;
        
        window.scrollTo({
          top: targetScroll,
          behavior: 'smooth'
        });
      }
    }
  }, [currentTime, isPlaying]);

  // 오디오 컨트롤 함수들
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
  
  const handleReset = () => {
    if (audioRef.current) {
      // ref 값을 먼저 초기화
      lastActiveNoteIndexRef.current = -1;
      
      // 오디오 초기화
      audioRef.current.currentTime = 0;
      audioRef.current.pause();
      
      // state 업데이트 (useEffect 트리거)
      setIsPlaying(false);
      setCurrentTime(0);
      
      // 맨 위로 스크롤
      window.scrollTo({
        top: 0,
        behavior: 'smooth'
      });
    }
  };
  
  const handleSkipBackward = () => {
    if (audioRef.current) {
      audioRef.current.currentTime = Math.max(0, audioRef.current.currentTime - 10);
      setCurrentTime(audioRef.current.currentTime);
    }
  };
  
  const handleSkipForward = () => {
    if (audioRef.current) {
      audioRef.current.currentTime = Math.min(
        audioRef.current.duration || 0,
        audioRef.current.currentTime + 10
      );
      setCurrentTime(audioRef.current.currentTime);
    }
  };

  // VexFlow로 악보 그리기
  useEffect(() => {
    if (!dataLoaded || !containerRef.current || !apiData) return;

    // 기존 SVG 제거
    containerRef.current.innerHTML = '';

    try {
      // API 데이터를 마디별 노트 배열로 변환
      const stavesData = convertApiDataToStaves(apiData, 4); // 마디당 4박자 (4/4 박자)
      const totalStaveCount = stavesData.length;
      
      // 리사이즈할 때마다 최신 너비를 가져옴
      const containerWidth = containerRef.current.getBoundingClientRect().width;
      
      // 렌더러 초기화 및 레이아웃 계산
      const { context, stavesPerRow, rows, staveWidth } = initializeRenderer(
        containerRef.current,
        containerWidth,
        totalStaveCount
      );
      
      // 마디 그리드 생성 및 렌더링
      const { staveCenterYPositions } = renderStaveGrid({
        context,
        totalStaveCount,
        stavesPerRow,
        rows,
        staveWidth,
        clef: "treble", // 항상 treble clef로 표시 (bass인 경우 음표는 1옥타브 올려서 변환됨)
        stavesData, // 변환된 노트 데이터 전달
      });

      // 렌더링 후 각 음표에 시간 정보를 data attribute로 추가
      const svgElement = containerRef.current.querySelector('svg');
      if (svgElement && apiData.notes) {
        // VexFlow가 생성한 모든 음표 요소 찾기 (vf-stavenote 클래스)
        const noteElements = svgElement.querySelectorAll('.vf-stavenote');
        
        // 원본 API 노트 데이터와 매핑 (쉼표 제외)
        let noteIndex = 0;
        let currentStaveIndex = 0;
        let notesInCurrentStave = 0;
        
        noteElements.forEach((element, i) => {
          // 쉼표가 아닌 경우에만 시간 정보 추가
          if (noteIndex < apiData.notes.length) {
            const apiNote = apiData.notes[noteIndex];
            
            // 현재 마디의 음표 개수 확인 (마디 변경 시점 파악)
            if (stavesData && stavesData[currentStaveIndex]) {
              if (notesInCurrentStave >= stavesData[currentStaveIndex].length) {
                currentStaveIndex++;
                notesInCurrentStave = 0;
              }
            }
            
            // 마디의 중심 y 좌표 가져오기
            const staveCenterY = staveCenterYPositions[currentStaveIndex] || 0;
            
            element.setAttribute('data-note-index', String(noteIndex));
            element.setAttribute('data-start-time', String(apiNote.start_time));
            element.setAttribute('data-end-time', String(apiNote.end_time));
            element.setAttribute('data-stave-index', String(currentStaveIndex));
            element.setAttribute('data-stave-center-y', String(staveCenterY));
            
            notesInCurrentStave++;
            
            // 클릭 가능하도록 스타일 및 호버 효과 추가
            (element as HTMLElement).style.cursor = 'pointer';
            (element as HTMLElement).style.transition = 'opacity 0.2s';
            
            // 호버 효과
            element.addEventListener('mouseenter', () => {
              (element as HTMLElement).style.opacity = '0.6';
            });
            
            element.addEventListener('mouseleave', () => {
              (element as HTMLElement).style.opacity = '1';
            });
            
            // 클릭 이벤트 추가
            element.addEventListener('click', () => {
              const startTime = parseFloat(element.getAttribute('data-start-time') || '0');
              
              if (audioRef.current) {
                // 오디오 시간을 클릭한 음표 시작 시간으로 설정
                audioRef.current.currentTime = startTime;
                setCurrentTime(startTime);
                
                // 해당 음표로 스크롤
                const noteRect = element.getBoundingClientRect();
                const windowHeight = window.innerHeight;
                const noteCenter = noteRect.top + noteRect.height / 2;
                const targetScroll = window.scrollY + noteCenter - windowHeight / 2;
                
                window.scrollTo({
                  top: targetScroll,
                  behavior: 'smooth'
                });
              }
            });
            
            noteIndex++;
          }
        });
      }

    } catch (error) {
      console.error('VexFlow 렌더링 오류:', error);
    }
  }, [dataLoaded, resizeTrigger, sheetMusicData, apiData]);

  // 데이터 로딩 에러 처리
  if (dataLoaded && loadError) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-black font-sans">
        <div className="max-w-md w-full mx-4 bg-white dark:bg-zinc-900 rounded-2xl p-8 shadow-2xl border border-zinc-200 dark:border-zinc-800">
          <div className="text-center space-y-4">
            <svg 
              className="w-16 h-16 mx-auto text-red-500" 
              fill="none" 
              stroke="currentColor" 
              viewBox="0 0 24 24"
            >
              <path 
                strokeLinecap="round" 
                strokeLinejoin="round" 
                strokeWidth={2} 
                d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" 
              />
            </svg>
            <h2 className="text-xl font-semibold text-zinc-900 dark:text-zinc-100">
              데이터 로드 실패
            </h2>
            <p className="text-sm text-zinc-600 dark:text-zinc-400">
              {loadError}
            </p>
            <button
              onClick={() => router.push('/')}
              className="w-full mt-4 px-4 py-3 bg-black text-white dark:bg-white dark:text-black rounded-lg font-medium hover:bg-zinc-800 dark:hover:bg-zinc-200 transition-colors cursor-pointer"
            >
              홈으로 돌아가기
            </button>
          </div>
        </div>
      </div>
    );
  }
  
  // 데이터가 없으면 로딩 표시
  if (!sheetMusicData) {
    return <UploadingModal isOpen={true} title="악보 불러오는 중" message="잠시만 기다려주세요..." />;
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-black font-sans">
      {/* 상단 메뉴바 - 네비게이션 */}
      <div className={`fixed top-0 left-0 right-0 z-50 bg-gray-900/95 backdrop-blur-md border-b border-white/10 transition-all duration-300
                      ${isPlaying ? 'opacity-30 hover:opacity-100' : 'opacity-100'}`}>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            {/* 왼쪽: 홈 버튼 */}
            <button
              onClick={() => router.push('/')}
              className="group flex items-center gap-2 px-3 py-2 rounded-lg hover:bg-white/10 transition-all active:scale-95 cursor-pointer"
              aria-label="홈으로 돌아가기"
            >
              <svg
                className="w-5 h-5 text-white/90 transition-transform group-hover:scale-110"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6"
                />
              </svg>
              <span className="text-sm font-medium text-white/90 hidden sm:inline">홈으로</span>
            </button>

            {/* 중앙: 곡 제목 (스크롤 시 동적 변경) */}
            <div className="flex-1 text-center px-4">
              <h1 className="text-lg sm:text-xl font-bold text-white/90 truncate transition-opacity duration-300">
                {showTitleInHeader ? title : 'My Pitch'}
              </h1>
            </div>

            {/* 오른쪽: 빈 공간 (대칭을 위해) */}
            <div className="w-[43px]"></div>
          </div>
        </div>
      </div>

      <main className="flex min-h-screen w-full max-w-7xl flex-col items-center justify-center py-4 px-4 pt-20 pb-28">
        <div className="w-full bg-white rounded-lg shadow-xl p-8 mb-8">
          {/* 악보 제목 */}
          <div className="text-center mb-8">
            <h1 ref={titleRef} className="text-3xl font-bold text-gray-800">
              {title}
            </h1>
          </div>
          
          <div 
            ref={containerRef} 
            className="w-full bg-white"
          />
        </div>
      </main>

      {/* 하단 미디어 컨트롤 바 */}
      <div className={`fixed bottom-0 left-0 right-0 z-50 bg-gray-900/95 backdrop-blur-md border-t border-white/10 transition-all duration-300
                      ${isPlaying ? 'opacity-30 hover:opacity-100' : 'opacity-100'}`}>
        <audio ref={audioRef} src={audioUrl} />
        
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-20">
            {/* 왼쪽: 현재 시간 */}
            <div className="w-16 text-center">
              <span className="text-sm font-medium text-white/90 tabular-nums">
                {formatTime(currentTime)}
              </span>
            </div>

            {/* 중앙: 컨트롤 버튼들 */}
            <div className="flex items-center gap-3">
              {/* 처음으로 */}
              <button
                onClick={handleReset}
                className="w-10 h-10 flex items-center justify-center rounded-full bg-white/10 hover:bg-white/20 transition-all active:scale-95 cursor-pointer"
                aria-label="처음으로"
              >
                <svg width="20" height="20" viewBox="0 0 24 24" fill="white" opacity="0.9">
                  <path d="M6 6h2v12H6zm3.5 6l8.5 6V6z" />
                </svg>
              </button>
              
              {/* 10초 뒤로 */}
              <button
                onClick={handleSkipBackward}
                className="w-10 h-10 flex items-center justify-center rounded-full bg-white/10 hover:bg-white/20 transition-all active:scale-95 cursor-pointer"
                aria-label="10초 뒤로"
              >
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2">
                  <path d="M11 19l-7-7 7-7m8 14l-7-7 7-7" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </button>
              
              {/* 재생/정지 버튼 */}
              {!isPlaying ? (
                <button
                  onClick={handlePlay}
                  className="w-14 h-14 flex items-center justify-center rounded-full bg-white/90 hover:bg-white transition-all hover:scale-105 active:scale-95 shadow-lg cursor-pointer"
                  aria-label="재생"
                >
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="#1f2937">
                    <path d="M8 5v14l11-7z" />
                  </svg>
                </button>
              ) : (
                <button
                  onClick={handlePause}
                  className="w-14 h-14 flex items-center justify-center rounded-full bg-white/90 hover:bg-white transition-all hover:scale-105 active:scale-95 shadow-lg cursor-pointer"
                  aria-label="정지"
                >
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="#1f2937">
                    <path d="M6 4h4v16H6V4zm8 0h4v16h-4V4z" />
                  </svg>
                </button>
              )}
              
              {/* 10초 앞으로 */}
              <button
                onClick={handleSkipForward}
                className="w-10 h-10 flex items-center justify-center rounded-full bg-white/10 hover:bg-white/20 transition-all active:scale-95 cursor-pointer"
                aria-label="10초 앞으로"
              >
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2">
                  <path d="M13 5l7 7-7 7M5 5l7 7-7 7" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </button>
            </div>

            {/* 오른쪽: 전체 시간 */}
            <div className="w-16 text-center">
              <span className="text-sm font-medium text-white/90 tabular-nums">
                {formatTime(duration)}
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}