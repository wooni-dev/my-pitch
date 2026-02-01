import { useEffect, RefObject, useState } from "react";

/**
 * 엘리먼트의 크기 변화를 감지하는 custom hook
 * @param elementRef - 크기를 감지할 엘리먼트의 ref 객체
 * @returns resizeTrigger - 리사이즈될 때마다 증가하는 숫자 값
 */
export function useResizeObserver<T extends HTMLElement>(
  elementRef: RefObject<T | null>
): number {
  const [resizeTrigger, setResizeTrigger] = useState(0);

  useEffect(() => {
    // ref가 설정될 때까지 체크하는 함수
    const checkElement = () => {
      const element = elementRef.current;
      if (!element) {
        // element가 아직 없으면 다음 프레임에서 다시 체크
        requestAnimationFrame(checkElement);
        return;
      }

      // ResizeObserver 생성 및 설정
      const resizeObserver = new ResizeObserver((entries) => {
        for (const entry of entries) {
          setResizeTrigger(prev => prev + 1);
        }
      });

      resizeObserver.observe(element);

      // cleanup 함수를 위한 플래그
      let isCleanedUp = false;
      
      // cleanup 함수 반환
      return () => {
        if (!isCleanedUp) {
          resizeObserver.disconnect();
          isCleanedUp = true;
        }
      };
    };

    // 첫 체크 시작
    const cleanup = checkElement();
    
    // cleanup이 함수가 아닐 수도 있으므로 체크
    return () => {
      if (typeof cleanup === 'function') {
        cleanup();
      }
    };
  }, []); // 빈 배열로 한 번만 실행

  return resizeTrigger;
}

