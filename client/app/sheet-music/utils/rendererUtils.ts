import { Renderer } from "vexflow";
import { calculateStavesPerRow, calculateStaveLayout } from "./layoutUtils";
import { STAVE_HEIGHT, STAVE_ROW_MARGIN } from "./constants";

/**
 * VexFlow 렌더러 초기화 결과
 */
export interface RendererInitResult {
  renderer: Renderer;
  context: ReturnType<Renderer['getContext']>;
  stavesPerRow: number;
  rows: number;
  staveWidth: number;
}

/**
 * VexFlow 렌더러를 초기화하고 레이아웃을 계산합니다.
 * @param container 렌더링할 HTML 요소
 * @param containerWidth 컨테이너 너비
 * @param totalStaveCount 총 마디 개수
 * @returns 렌더러 초기화 결과
 */
export function initializeRenderer(
  container: HTMLDivElement,
  containerWidth: number,
  totalStaveCount: number
): RendererInitResult {
  // 렌더러 생성
  const renderer = new Renderer(container, Renderer.Backends.SVG);

  // 한 줄당 마디 개수 계산 (반응형)
  const stavesPerRow = calculateStavesPerRow(containerWidth);
  const { rows } = calculateStaveLayout(totalStaveCount, stavesPerRow);

  // 전체 캔버스 크기 설정 (마디 높이 * 행 개수 + 행 사이 간격 + 마지막 줄 아래 여백)
  const totalHeight = STAVE_HEIGHT * rows + STAVE_ROW_MARGIN * rows;
  renderer.resize(containerWidth, totalHeight);
  const context = renderer.getContext();

  // 각 마디의 너비 (한 줄 전체 너비를 마디 개수로 나눔)
  const staveWidth = containerWidth / stavesPerRow;

  return {
    renderer,
    context,
    stavesPerRow,
    rows,
    staveWidth,
  };
}

