"use client";

import { useEffect, useRef, useState } from "react";
import fallbackSheetMusicData from "../../api.json";
import { useResizeObserver } from "../hooks/useResizeObserver";
import { useSheetMusicData } from "../hooks/useSheetMusicData";
import { initializeRenderer } from "./utils/rendererUtils";
import { renderStaveGrid } from "./utils/staveGridUtils";
import { convertApiDataToStaves } from "./utils/noteConverter";
import type { ApiSheetMusicData } from "./utils/noteConverter";

export default function SheetMusicPage() {
  const containerRef = useRef<HTMLDivElement>(null);
  const audioRef = useRef<HTMLAudioElement>(null);
  
  // 오디오 재생 상태
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const animationFrameRef = useRef<number>();
  const lastActiveNoteIndexRef = useRef<number>(-1);
  
  // 컨테이너 크기 변화 감지
  const resizeTrigger = useResizeObserver(containerRef);
  
  // 악보 데이터 로드
  const [sheetMusicData, dataLoaded] = useSheetMusicData(fallbackSheetMusicData);
  
  // 제목 추출 (original_filename에서 확장자 제거)
  const apiData = sheetMusicData as ApiSheetMusicData;
  const title = apiData.original_filename 
    ? apiData.original_filename.replace(/\.(mp3|wav|m4a)$/i, '') 
    : '악보';
  
  // 오디오 URL 추출
  const audioUrl = apiData.file_url || '';
  
  // clef에 따른 하이라이트 색상 설정
  const highlightColors = apiData.clef === 'bass' 
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

  // 오디오 종료 이벤트 처리
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    const handleEnded = () => {
      setIsPlaying(false);
      setCurrentTime(0);
      lastActiveNoteIndexRef.current = -1;
      
      // 모든 하이라이트 제거
      const svgElement = containerRef.current?.querySelector('svg');
      if (svgElement) {
        const highlights = svgElement.querySelectorAll('.note-highlight');
        highlights.forEach(highlight => highlight.remove());
      }
      
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
  }, []);

  // 음표 하이라이트 업데이트
  useEffect(() => {
    if (!containerRef.current) return;

    const svgElement = containerRef.current.querySelector('svg');
    if (!svgElement) return;

    const noteElements = svgElement.querySelectorAll('.vf-stavenote[data-start-time]');
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
      audioRef.current.currentTime = 0;
      audioRef.current.pause();
      setIsPlaying(false);
      setCurrentTime(0);
      lastActiveNoteIndexRef.current = -1;
      
      // 모든 하이라이트 제거
      const svgElement = containerRef.current?.querySelector('svg');
      if (svgElement) {
        const highlights = svgElement.querySelectorAll('.note-highlight');
        highlights.forEach(highlight => highlight.remove());
      }
      
      // 맨 위로 스크롤
      window.scrollTo({
        top: 0,
        behavior: 'smooth'
      });
    }
  };

  // VexFlow로 악보 그리기
  useEffect(() => {
    if (!dataLoaded || !containerRef.current) return;

    // 기존 SVG 제거
    containerRef.current.innerHTML = '';

    try {
      // API 데이터를 마디별 노트 배열로 변환
      const stavesData = convertApiDataToStaves(apiData, 4); // 마디당 4박자 (4/4 박자)
      const totalStaveCount = stavesData.length;
      
      const containerWidth = containerRef.current.clientWidth;
      
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
  }, [dataLoaded, resizeTrigger, sheetMusicData]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-black font-sans">
      <main className="flex min-h-screen w-full max-w-7xl flex-col items-center justify-center py-16 px-4">
        <div className="w-full bg-[#c8dae6] rounded-lg shadow-xl p-8">
          <div className="text-center mb-6">
            <h1 className="text-3xl font-bold text-gray-800">{title}</h1>
          </div>
          
          <div 
            ref={containerRef} 
            className="w-full bg-[#c8dae6] overflow-x-auto"
          />
          
          {/* 플로팅 오디오 컨트롤 버튼 - 오른쪽 하단 고정 */}
          <div className="fixed bottom-8 right-8 z-50">
            <audio ref={audioRef} src={audioUrl} />
            
            <div className={`group flex items-center gap-3 bg-gray-900/80 backdrop-blur-md px-4 py-3 rounded-2xl border border-white/10 shadow-xl transition-all duration-300
                            ${isPlaying ? 'opacity-20 scale-90 hover:opacity-100 hover:scale-100' : 'opacity-100 scale-100'}`}>
              {/* 처음으로 버튼 */}
              <button
                onClick={handleReset}
                className="w-10 h-10 flex items-center justify-center rounded-full bg-white/10 hover:bg-white/20 transition-all active:scale-95 cursor-pointer"
                aria-label="처음으로"
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="white" opacity="0.9">
                  <path d="M6 6h2v12H6zm3.5 6l8.5 6V6z" />
                </svg>
              </button>
              
              {/* 재생/정지 버튼 */}
              {!isPlaying ? (
                <button
                  onClick={handlePlay}
                  className="w-12 h-12 flex items-center justify-center rounded-full bg-white/90 hover:bg-white transition-all hover:scale-105 active:scale-95 shadow-lg cursor-pointer flex-shrink-0"
                  aria-label="재생"
                >
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="#1f2937">
                    <path d="M8 5v14l11-7z" />
                  </svg>
                </button>
              ) : (
                <button
                  onClick={handlePause}
                  className="w-12 h-12 flex items-center justify-center rounded-full bg-white/90 hover:bg-white transition-all hover:scale-105 active:scale-95 shadow-lg cursor-pointer flex-shrink-0"
                  aria-label="정지"
                >
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="#1f2937">
                    <path d="M6 4h4v16H6V4zm8 0h4v16h-4V4z" />
                  </svg>
                </button>
              )}
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}