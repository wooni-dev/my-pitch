import { useEffect, useState } from "react";

/**
 * sessionStorage에서 악보 데이터를 로드하는 custom hook
 * @param fallbackData - sessionStorage에 데이터가 없을 때 사용할 기본 데이터
 * @returns [data, isLoaded] - 로드된 데이터와 로딩 완료 여부
 */
export function useSheetMusicData<T>(fallbackData: T): [T, boolean] {
  const [data, setData] = useState<T>(fallbackData);
  const [isLoaded, setIsLoaded] = useState(false);

  useEffect(() => {
    if (isLoaded) return;

    const loadSheetMusic = () => {
      try {
        // sessionStorage에서 데이터 가져오기 (브라우저 탭 닫으면 자동 삭제됨)
        const storedData = sessionStorage.getItem('sheetMusicData');

        if (storedData) {
          const apiResponse = JSON.parse(storedData) as T;
          
          // API 응답 콘솔에 출력
          if (apiResponse) {
            console.log('=== Sheet Music API Data ===');
            console.log(apiResponse);
            setData(apiResponse);
            setIsLoaded(true);
          } else {
            throw new Error('데이터가 없습니다');
          }
        } else {
          // 저장된 데이터가 없으면 fallback 데이터 사용
          console.log('=== Fallback Sheet Music Data ===');
          console.log(fallbackData);
          setData(fallbackData);
          setIsLoaded(true);
        }
      } catch (err) {
        console.error('데이터 로드 오류:', err);
        // 에러 발생 시에도 fallback 데이터 사용
        console.log('=== Fallback Sheet Music Data (Error) ===');
        console.log(fallbackData);
        setData(fallbackData);
        setIsLoaded(true);
      }
    };

    loadSheetMusic();
  }, [isLoaded, fallbackData]);

  return [data, isLoaded];
}

