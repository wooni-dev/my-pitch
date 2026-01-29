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
      renderStaveGrid({
        context,
        totalStaveCount,
        stavesPerRow,
        rows,
        staveWidth,
        clef: "treble", // 항상 treble clef로 표시 (bass인 경우 음표는 1옥타브 올려서 변환됨)
        stavesData, // 변환된 노트 데이터 전달
      });

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