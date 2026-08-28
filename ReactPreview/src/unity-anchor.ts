export type UnityPoint = [number, number]
export type UnityVector3 = [number, number, number]
export type UnityAnchors = [number, number, number, number]

export interface UnityAnchorLayout {
  anchors: UnityAnchors
  pivot: UnityPoint
  position: UnityVector3
  size: UnityPoint
  parentWidth: number
  parentHeight: number
}

export interface UnityLayoutRect {
  left: number
  bottom: number
  width: number
  height: number
}

export interface UnityLayoutMargins {
  left: number
  right: number
  top: number
  bottom: number
}

const nodeSelector = '[data-component], [data-prefab-child-path]'

export function parseUnityVector(raw: string | undefined, count: 2, fallback: UnityPoint): UnityPoint
export function parseUnityVector(raw: string | undefined, count: 3, fallback: UnityVector3): UnityVector3
export function parseUnityVector(raw: string | undefined, count: 4, fallback: UnityAnchors): UnityAnchors
export function parseUnityVector(raw: string | undefined, count: number, fallback: number[]): number[] {
  if (!raw) return [...fallback]
  const values = raw
    .replace(/[()]/g, '')
    .split(',')
    .map((item) => Number(item.trim()))
  return values.length === count && values.every(Number.isFinite) ? values : [...fallback]
}

export function formatUnityNumber(value: number): string {
  const rounded = Math.abs(value) < 0.00005 ? 0 : value
  if (Number.isInteger(rounded)) return String(rounded)
  return rounded.toFixed(4).replace(/0+$/, '').replace(/\.$/, '')
}

export function formatUnityVector(values: number[]): string {
  return '(' + values.map(formatUnityNumber).join(', ') + ')'
}

export function clamp01(value: number): number {
  return Math.min(1, Math.max(0, value))
}

export function readUnityAnchorLayout(element: HTMLElement): UnityAnchorLayout | null {
  const parent = element.parentElement?.closest<HTMLElement>(nodeSelector) ?? null
  if (!parent) return null

  const parentWidth = Number(parent.dataset.previewWidth)
  const parentHeight = Number(parent.dataset.previewHeight)
  if (!Number.isFinite(parentWidth) || !Number.isFinite(parentHeight) || parentWidth <= 0 || parentHeight <= 0)
    return null

  const declaredAnchors = parseUnityVector(element.dataset.anchors, 4, [0.5, 0.5, 0.5, 0.5])
  const anchorMin = parseUnityVector(element.dataset.anchorMin, 2, [declaredAnchors[0], declaredAnchors[1]])
  const anchorMax = parseUnityVector(element.dataset.anchorMax, 2, [declaredAnchors[2], declaredAnchors[3]])
  return {
    anchors: [anchorMin[0], anchorMin[1], anchorMax[0], anchorMax[1]],
    pivot: parseUnityVector(element.dataset.pivot, 2, [0.5, 0.5]),
    position: parseUnityVector(element.dataset.pos, 3, [0, 0, 0]),
    size: parseUnityVector(element.dataset.size, 2, [160, 20]),
    parentWidth,
    parentHeight,
  }
}

export function rectFromAnchorLayout(layout: UnityAnchorLayout): UnityLayoutRect {
  const [anchorMinX, anchorMinY, anchorMaxX, anchorMaxY] = layout.anchors
  const width = layout.parentWidth * (anchorMaxX - anchorMinX) + layout.size[0]
  const height = layout.parentHeight * (anchorMaxY - anchorMinY) + layout.size[1]
  // Unity 使用 pivot 在锚点矩形内插值得到 anchoredPosition 的参考点。
  const anchorReferenceX = layout.parentWidth * (anchorMinX + (anchorMaxX - anchorMinX) * layout.pivot[0])
  const anchorReferenceY = layout.parentHeight * (anchorMinY + (anchorMaxY - anchorMinY) * layout.pivot[1])
  return {
    left: anchorReferenceX + layout.position[0] - layout.pivot[0] * width,
    bottom: anchorReferenceY + layout.position[1] - layout.pivot[1] * height,
    width,
    height,
  }
}

export function layoutForRect(
  source: UnityAnchorLayout,
  rect: UnityLayoutRect,
  anchors: UnityAnchors = source.anchors,
  pivot: UnityPoint = source.pivot,
): UnityAnchorLayout {
  const anchorWidth = source.parentWidth * (anchors[2] - anchors[0])
  const anchorHeight = source.parentHeight * (anchors[3] - anchors[1])
  const anchorReferenceX = source.parentWidth * (anchors[0] + (anchors[2] - anchors[0]) * pivot[0])
  const anchorReferenceY = source.parentHeight * (anchors[1] + (anchors[3] - anchors[1]) * pivot[1])
  const pivotPositionX = rect.left + pivot[0] * rect.width
  const pivotPositionY = rect.bottom + pivot[1] * rect.height
  return {
    ...source,
    anchors: [...anchors],
    pivot: [...pivot],
    position: [
      pivotPositionX - anchorReferenceX,
      pivotPositionY - anchorReferenceY,
      source.position[2],
    ],
    size: [rect.width - anchorWidth, rect.height - anchorHeight],
  }
}

export function preserveRectWithAnchors(
  source: UnityAnchorLayout,
  anchors: UnityAnchors,
  pivot: UnityPoint = source.pivot,
): UnityAnchorLayout {
  return layoutForRect(source, rectFromAnchorLayout(source), anchors, pivot)
}

export function marginsFromAnchorLayout(layout: UnityAnchorLayout): UnityLayoutMargins {
  const rect = rectFromAnchorLayout(layout)
  return {
    left: rect.left - layout.parentWidth * layout.anchors[0],
    right: layout.parentWidth * layout.anchors[2] - rect.left - rect.width,
    bottom: rect.bottom - layout.parentHeight * layout.anchors[1],
    top: layout.parentHeight * layout.anchors[3] - rect.bottom - rect.height,
  }
}

export function layoutWithMargins(
  source: UnityAnchorLayout,
  margins: UnityLayoutMargins,
): UnityAnchorLayout {
  const left = source.parentWidth * source.anchors[0] + margins.left
  const right = source.parentWidth * source.anchors[2] - margins.right
  const bottom = source.parentHeight * source.anchors[1] + margins.bottom
  const top = source.parentHeight * source.anchors[3] - margins.top
  return layoutForRect(source, {
    left,
    bottom,
    width: right - left,
    height: top - bottom,
  })
}

export function horizontalStretch(layout: UnityAnchorLayout): boolean {
  return Math.abs(layout.anchors[0] - layout.anchors[2]) > 0.0001
}

export function verticalStretch(layout: UnityAnchorLayout): boolean {
  return Math.abs(layout.anchors[1] - layout.anchors[3]) > 0.0001
}
