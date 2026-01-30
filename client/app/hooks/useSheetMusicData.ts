import { useEffect, useState } from "react";

/**
 * sessionStorage에서 악보 데이터를 로드하는 custom hook
 * @returns [data, isLoaded, error] - 로드된 데이터, 로딩 완료 여부, 에러 메시지
 */
export function useSheetMusicData<T>(): [T | null, boolean, string | null] {
  const [data, setData] = useState<T | null>(null);
  const [isLoaded, setIsLoaded] = useState(false);
  const [error, setError] = useState<string | null>(null);

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
            throw new Error('데이터가 유효하지 않습니다');
          }
        } else {
          // 저장된 데이터가 없음
          setError('악보 데이터를 찾을 수 없습니다. 먼저 음악 파일을 업로드해주세요.');
          setIsLoaded(true);
        }
      } catch (err) {
        console.error('데이터 로드 오류:', err);
        setError('데이터를 불러오는 중 오류가 발생했습니다.');
        setIsLoaded(true);
      }
    };

    loadSheetMusic();
  }, [isLoaded]);

  return [data, isLoaded, error];
}

