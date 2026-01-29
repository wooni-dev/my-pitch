"use client";

import { useEffect, useRef } from "react";
import fallbackSheetMusicData from "../../api.json";
import { useResizeObserver } from "../hooks/useResizeObserver";
import { useSheetMusicData } from "../hooks/useSheetMusicData";
import { initializeRenderer } from "./utils/rendererUtils";
import { renderStaveGrid } from "./utils/staveGridUtils";
import { convertApiDataToStaves } from "./utils/noteConverter";
import type { ApiSheetMusicData } from "./utils/noteConverter";

export default function SheetMusicPage() {
  const containerRef = useRef<HTMLDivElement>(null);
  
  // 컨테이너 크기 변화 감지
  const resizeTrigger = useResizeObserver(containerRef);
  
  // 악보 데이터 로드
  const [sheetMusicData, dataLoaded] = useSheetMusicData(fallbackSheetMusicData);
  
  // 제목 추출 (original_filename에서 확장자 제거)
  const apiData = sheetMusicData as ApiSheetMusicData;
  const title = apiData.original_filename 
    ? apiData.original_filename.replace(/\.(mp3|wav|m4a)$/i, '') 
    : '악보';

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
        </div>
      </main>
    </div>
  );
}