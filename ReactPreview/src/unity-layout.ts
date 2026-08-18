type Point = [number, number]
type RectAnchors = [number, number, number, number]

export interface UnityLayoutOptions {
  canvasWidth: number
  canvasHeight: number
  referenceWidth?: number
  referenceHeight?: number
}

function numbers(value: string | undefined, count: number, fallback: number[]): number[] {
  if (!value) return fallback
  const parsed = value
    .replace(/[()]/g, '')
    .split(',')
    .map((item) => Number(item.trim()))
  return parsed.length === count && parsed.every(Number.isFinite) ? parsed : fallback
}

function directGeneratedChildren(parent: HTMLElement): HTMLElement[] {
  return Array.from(parent.querySelectorAll<HTMLElement>('[data-component]')).filter((child) => {
    let current = child.parentElement
    while (current && current !== parent) {
      if (current.dataset.component || current.dataset.prefabChildPath) return false
      current = current.parentElement
    }
    return current === parent
  })
}

function applyLayoutGroup(parent: HTMLElement): void {
  const type = parent.dataset.layoutGroup
  if (type !== 'Horizontal' && type !== 'Vertical' && type !== 'Grid') return

  const children = directGeneratedChildren(parent)
  const [left, right, top, bottom] = numbers(parent.dataset.layoutPadding, 4, [0, 0, 0, 0])
  const parentWidth = Number(parent.dataset.previewWidth ?? 0)
  const parentHeight = Number(parent.dataset.previewHeight ?? 0)

  if (type === 'Grid') {
    applyGridLayout(parent, children, parentWidth, parentHeight, left, right, top, bottom)
    return
  }

  const spacing = Number(parent.dataset.layoutSpacing ?? 0)
  let cursor = type === 'Horizontal' ? left : top

  children.forEach((child) => {
    const width = Number(child.dataset.previewWidth ?? 0)
    const height = Number(child.dataset.previewHeight ?? 0)
    if (type === 'Horizontal') {
      child.style.left = `${cursor}px`
      child.style.top = `${top + Math.max(0, parentHeight - top - bottom - height) / 2}px`
      cursor += width + spacing
    } else {
      child.style.left = `${left + Math.max(0, parentWidth - left - right - width) / 2}px`
      child.style.top = `${cursor}px`
      cursor += height + spacing
    }
  })
}

function applyGridLayout(
  parent: HTMLElement,
  children: HTMLElement[],
  parentWidth: number,
  parentHeight: number,
  left: number,
  right: number,
  top: number,
  bottom: number,
): void {
  const [cellWidth, cellHeight] = numbers(parent.dataset.layoutCellSize, 2, [0, 0])
  if (!(cellWidth > 0) || !(cellHeight > 0)) return

  const [columnSpacing, rowSpacing] = numbers(parent.dataset.layoutSpacing, 2, [0, 0])
  const constraint = parent.dataset.layoutConstraint ?? 'Flexible'
  const configuredCount = Math.max(1, Math.floor(Number(parent.dataset.layoutConstraintCount ?? 1)))
  const availableWidth = Math.max(0, parentWidth - left - right)
  const availableHeight = Math.max(0, parentHeight - top - bottom)
  let columnCount: number
  let rowCount: number

  if (constraint === 'FixedRowCount') {
    rowCount = configuredCount
    columnCount = Math.max(1, Math.ceil(children.length / rowCount))
  } else if (constraint === 'FixedColumnCount') {
    columnCount = configuredCount
    rowCount = Math.max(1, Math.ceil(children.length / columnCount))
  } else if (parent.dataset.layoutStartAxis === 'Vertical') {
    rowCount = Math.max(1, Math.floor((availableHeight + rowSpacing) / (cellHeight + rowSpacing)))
    columnCount = Math.max(1, Math.ceil(children.length / rowCount))
  } else {
    columnCount = Math.max(1, Math.floor((availableWidth + columnSpacing) / (cellWidth + columnSpacing)))
    rowCount = Math.max(1, Math.ceil(children.length / columnCount))
  }

  const contentWidth = columnCount * cellWidth + Math.max(0, columnCount - 1) * columnSpacing
  const contentHeight = rowCount * cellHeight + Math.max(0, rowCount - 1) * rowSpacing
  const alignment = parent.dataset.layoutChildAlignment ?? 'UpperLeft'
  const horizontalAlignment = alignment.endsWith('Right') ? 'Right' : alignment.endsWith('Center') ? 'Center' : 'Left'
  const verticalAlignment = alignment.startsWith('Lower') ? 'Lower' : alignment.startsWith('Middle') ? 'Middle' : 'Upper'
  const startOffsetX = horizontalAlignment === 'Right'
    ? Math.max(0, availableWidth - contentWidth)
    : horizontalAlignment === 'Center'
      ? Math.max(0, availableWidth - contentWidth) / 2
      : 0
  const startOffsetY = verticalAlignment === 'Lower'
    ? Math.max(0, availableHeight - contentHeight)
    : verticalAlignment === 'Middle'
      ? Math.max(0, availableHeight - contentHeight) / 2
      : 0
  const startCorner = parent.dataset.layoutStartCorner ?? 'UpperLeft'
  const startAxis = parent.dataset.layoutStartAxis ?? 'Horizontal'

  children.forEach((child, index) => {
    const logicalRow = startAxis === 'Vertical' ? index % rowCount : Math.floor(index / columnCount)
    const logicalColumn = startAxis === 'Vertical' ? Math.floor(index / rowCount) : index % columnCount
    const column = startCorner.endsWith('Right') ? columnCount - logicalColumn - 1 : logicalColumn
    const rowFromTop = startCorner.startsWith('Lower') ? rowCount - logicalRow - 1 : logicalRow

    child.style.left = `${left + startOffsetX + column * (cellWidth + columnSpacing)}px`
    child.style.top = `${top + startOffsetY + rowFromTop * (cellHeight + rowSpacing)}px`
    child.style.width = `${cellWidth}px`
    child.style.height = `${cellHeight}px`
  })
}

function rgba(value: string | undefined): string {
  const [r, g, b, a] = numbers(value, 4, [])
  if (![r, g, b, a].every(Number.isFinite)) return ''
  return `rgba(${Math.round(r * 255)}, ${Math.round(g * 255)}, ${Math.round(b * 255)}, ${a})`
}

function applyVisualAttributes(element: HTMLElement): void {
  const sprite = element.dataset.sprite
  if (sprite) {
    // 预览服务把 Unity 的 Assets 路径映射到只读资源地址，TSX 无需持有磁盘绝对路径。
    element.style.backgroundImage = `url("/unity-assets/${sprite.replace(/^Assets\//, '')}")`
    const fit = element.dataset.imageFit ?? (element.dataset.preserveAspect === 'true' ? 'Contain' : 'Stretch')
    element.style.backgroundSize = fit === 'Cover' ? 'cover' : fit === 'Contain' ? 'contain' : '100% 100%'
    element.style.backgroundPosition = 'center'
    element.style.backgroundRepeat = 'no-repeat'
  }

  const color = rgba(element.dataset.color)
  if (color) {
    if (element.dataset.component === 'UITextMesh') element.style.color = color
    else element.style.backgroundColor = color
  }

  if (element.dataset.fontSize) element.style.fontSize = `${element.dataset.fontSize}px`
  if (element.dataset.textAlign) element.style.textAlign = element.dataset.textAlign.toLowerCase()
  if (element.dataset.verticalAlign) {
    const vertical = element.dataset.verticalAlign
    element.style.alignItems = vertical === 'Top' ? 'start' : vertical === 'Bottom' ? 'end' : 'center'
  }
  const outlineColor = rgba(element.dataset.outlineColor)
  const outlineWidth = Number(element.dataset.outlineWidth ?? 0)
  if (outlineColor && outlineWidth > 0) {
    const shadow = [
      `${outlineWidth}px 0 ${outlineColor}`,
      `${-outlineWidth}px 0 ${outlineColor}`,
      `0 ${outlineWidth}px ${outlineColor}`,
      `0 ${-outlineWidth}px ${outlineColor}`,
    ]
    element.style.textShadow = shadow.join(', ')
  }
}

export function applyUnityLayout(container: HTMLElement, options: UnityLayoutOptions): void {
  const elements = Array.from(container.querySelectorAll<HTMLElement>('[data-component], [data-prefab-child-path]'))
  const root = elements[0]
  const isFixedReferenceRoot = root?.dataset.layoutMode?.toLowerCase() === 'fixedreference'
  const declaredRootSize = root ? numbers(root.dataset.size, 2, []) : []
  // 固定参考模式在动态逻辑画布中保持设计尺寸并居中，响应式模式则填充整个逻辑画布。
  const fixedRootWidth = isFixedReferenceRoot && declaredRootSize.length === 2 && declaredRootSize[0] > 0
    ? declaredRootSize[0]
    : options.referenceWidth ?? options.canvasWidth
  const fixedRootHeight = isFixedReferenceRoot && declaredRootSize.length === 2 && declaredRootSize[1] > 0
    ? declaredRootSize[1]
    : options.referenceHeight ?? options.canvasHeight

  elements.forEach((element) => {
    const isRoot = element === root
    const parent = isRoot
      ? null
      : element.parentElement?.closest<HTMLElement>('[data-component], [data-prefab-child-path]') ?? null
    const parentWidth = parent ? Number(parent.dataset.previewWidth ?? options.canvasWidth) : options.canvasWidth
    const parentHeight = parent ? Number(parent.dataset.previewHeight ?? options.canvasHeight) : options.canvasHeight
    const anchors = numbers(element.dataset.anchors, 4, [0.5, 0.5, 0.5, 0.5]) as RectAnchors
    const anchorMin = numbers(element.dataset.anchorMin, 2, [anchors[0], anchors[1]]) as Point
    const anchorMax = numbers(element.dataset.anchorMax, 2, [anchors[2], anchors[3]]) as Point
    const pivot = numbers(element.dataset.pivot, 2, [0.5, 0.5]) as Point
    const position = numbers(element.dataset.pos, 3, [0, 0, 0])
    const defaultSize = parent
      ? [160, 20]
      : isFixedReferenceRoot
        ? [fixedRootWidth, fixedRootHeight]
        : [options.canvasWidth, options.canvasHeight]
    const sizeDelta = numbers(element.dataset.size, 2, defaultSize)
    const width = isRoot
      ? (isFixedReferenceRoot ? fixedRootWidth : options.canvasWidth)
      : parentWidth * (anchorMax[0] - anchorMin[0]) + sizeDelta[0]
    const height = isRoot
      ? (isFixedReferenceRoot ? fixedRootHeight : options.canvasHeight)
      : parentHeight * (anchorMax[1] - anchorMin[1]) + sizeDelta[1]
    // Unity 在拉伸锚点下会按 pivot 在 anchorMin/anchorMax 之间插值锚点参考位置。
    const anchorReferenceX = parentWidth * (anchorMin[0] + (anchorMax[0] - anchorMin[0]) * pivot[0])
    const anchorReferenceY = parentHeight * (anchorMin[1] + (anchorMax[1] - anchorMin[1]) * pivot[1])
    const left = anchorReferenceX + position[0] - pivot[0] * width
    const bottom = anchorReferenceY + position[1] - pivot[1] * height

    element.dataset.previewWidth = String(width)
    element.dataset.previewHeight = String(height)
    element.style.position = 'absolute'
    element.style.boxSizing = 'border-box'
    element.style.left = `${parent ? left : (options.canvasWidth - width) / 2}px`
    element.style.top = `${parent ? parentHeight - bottom - height : (options.canvasHeight - height) / 2}px`
    element.style.width = `${width}px`
    element.style.height = `${height}px`
    element.style.display = element.dataset.visible === 'false' ? 'none' : ''
    element.style.opacity = element.dataset.alpha ?? ''
    applyVisualAttributes(element)
  })

  elements.forEach(applyLayoutGroup)
}
