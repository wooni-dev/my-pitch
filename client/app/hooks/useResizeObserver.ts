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
    if (!elementRef.current) return;

    const resizeObserver = new ResizeObserver(() => {
      // 크기 변경 시 resizeTrigger 증가
      setResizeTrigger(prev => prev + 1);
    });

    resizeObserver.observe(elementRef.current);

    return () => {
      resizeObserver.disconnect();
    };
  }, [elementRef]);

  return resizeTrigger;
}

