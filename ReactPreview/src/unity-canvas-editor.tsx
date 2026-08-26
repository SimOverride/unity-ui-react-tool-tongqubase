import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
  type ReactNode,
} from 'react'
import { createPortal } from 'react-dom'

type Point = [number, number]
type Vector3 = [number, number, number]
type Vector4 = [number, number, number, number]
type ResizeHandle = 'nw' | 'n' | 'ne' | 'e' | 'se' | 's' | 'sw' | 'w'

export type CanvasAttributeValue = string | null

export interface CanvasAttributeChange {
  attribute: string
  before: CanvasAttributeValue
  after: CanvasAttributeValue
}

interface CanvasBounds {
  left: number
  top: number
  width: number
  height: number
}

interface CanvasGuide {
  axis: 'x' | 'y'
  position: number
}

interface PointerSnapshot {
  clientX: number
  clientY: number
  altKey: boolean
}

interface CanvasInteraction {
  kind: 'move' | 'resize'
  pointerId: number
  element: HTMLElement
  handle?: ResizeHandle
  startClient: Point
  scale: Point
  startBounds: CanvasBounds
  startPosition: Vector3
  startSize: Point
  pivot: Point
  beforePosition: CanvasAttributeValue
  beforeSize: CanvasAttributeValue
  xGuides: number[]
  yGuides: number[]
}

interface UnityCanvasEditorProps {
  canvas: HTMLElement | null
  selectedElement: HTMLElement | null
  editMode: boolean
  interactionDisabled: boolean
  refreshKey: number
  onSelectElement: (element: HTMLElement) => void
  onPreviewChanges: (element: HTMLElement, changes: CanvasAttributeChange[]) => void
  onCommitChanges: (element: HTMLElement, changes: CanvasAttributeChange[]) => void
  onMessage: (message: string) => void
}

const nodeSelector = '[data-component], [data-prefab-child-path]'
const resizeHandles: ResizeHandle[] = ['nw', 'n', 'ne', 'e', 'se', 's', 'sw', 'w']
const gridSize = 5
const minimumSize = 10

function parseVector(raw: string | undefined, count: 2, fallback: Point): Point
function parseVector(raw: string | undefined, count: 3, fallback: Vector3): Vector3
function parseVector(raw: string | undefined, count: 4, fallback: Vector4): Vector4
function parseVector(raw: string | undefined, count: number, fallback: number[]): number[] {
  if (!raw) return fallback
  const values = raw
    .replace(/[()]/g, '')
    .split(',')
    .map((item) => Number(item.trim()))
  return values.length === count && values.every(Number.isFinite) ? values : fallback
}

function formatNumber(value: number): string {
  const rounded = Math.abs(value) < 0.0005 ? 0 : value
  if (Number.isInteger(rounded)) return String(rounded)
  return rounded.toFixed(3).replace(/0+$/, '').replace(/\.$/, '')
}

function formatVector(values: number[]): string {
  return '(' + values.map(formatNumber).join(', ') + ')'
}

function uniqueValues(values: number[]): number[] {
  return [...new Set(values.map((value) => Math.round(value * 1000) / 1000))]
}

function logicalBounds(element: HTMLElement, canvas: HTMLElement): CanvasBounds {
  const canvasRect = canvas.getBoundingClientRect()
  const elementRect = element.getBoundingClientRect()
  const scaleX = canvasRect.width > 0 ? canvasRect.width / canvas.clientWidth : 1
  const scaleY = canvasRect.height > 0 ? canvasRect.height / canvas.clientHeight : 1
  return {
    left: (elementRect.left - canvasRect.left) / scaleX,
    top: (elementRect.top - canvasRect.top) / scaleY,
    width: elementRect.width / scaleX,
    height: elementRect.height / scaleY,
  }
}

function directUnityChildren(parent: HTMLElement): HTMLElement[] {
  return Array.from(parent.querySelectorAll<HTMLElement>(nodeSelector)).filter((child) => {
    const unityParent = child.parentElement?.closest<HTMLElement>(nodeSelector) ?? null
    return unityParent === parent
  })
}

function collectGuideValues(element: HTMLElement, canvas: HTMLElement): { x: number[]; y: number[] } {
  const x = [0, canvas.clientWidth / 2, canvas.clientWidth]
  const y = [0, canvas.clientHeight / 2, canvas.clientHeight]
  const parent = element.parentElement?.closest<HTMLElement>(nodeSelector) ?? null

  if (parent) {
    const parentBounds = logicalBounds(parent, canvas)
    x.push(parentBounds.left, parentBounds.left + parentBounds.width / 2, parentBounds.left + parentBounds.width)
    y.push(parentBounds.top, parentBounds.top + parentBounds.height / 2, parentBounds.top + parentBounds.height)

    directUnityChildren(parent).forEach((sibling) => {
      if (sibling === element || sibling.style.display === 'none') return
      const bounds = logicalBounds(sibling, canvas)
      x.push(bounds.left, bounds.left + bounds.width / 2, bounds.left + bounds.width)
      y.push(bounds.top, bounds.top + bounds.height / 2, bounds.top + bounds.height)
    })
  }

  return { x: uniqueValues(x), y: uniqueValues(y) }
}

function pointAnchored(element: HTMLElement): boolean {
  const anchors = parseVector(element.dataset.anchors, 4, [0.5, 0.5, 0.5, 0.5])
  const anchorMin = parseVector(element.dataset.anchorMin, 2, [anchors[0], anchors[1]])
  const anchorMax = parseVector(element.dataset.anchorMax, 2, [anchors[2], anchors[3]])
  return Math.abs(anchorMin[0] - anchorMax[0]) < 0.0001 && Math.abs(anchorMin[1] - anchorMax[1]) < 0.0001
}

function editBlockReason(element: HTMLElement, canvas: HTMLElement): string {
  const sourceName = element.getAttribute('data-name')
  if (!sourceName) return '节点缺少静态 data-name，只能检查。'
  const sameNameCount = Array.from(canvas.querySelectorAll<HTMLElement>(nodeSelector))
    .filter((candidate) => candidate.getAttribute('data-name') === sourceName)
    .length
  if (sameNameCount !== 1) return '节点的 data-name 不唯一，只能检查。'

  const root = canvas.querySelector<HTMLElement>(nodeSelector)
  if (element === root) return '根节点由画布分辨率和根布局模式控制，不能直接拖动。'

  const parent = element.parentElement?.closest<HTMLElement>(nodeSelector) ?? null
  if (parent?.dataset.layoutGroup)
    return `当前节点由父级 ${parent.dataset.layoutGroup} 布局组控制，请调整布局组参数。`
  if (!pointAnchored(element))
    return '当前首版画布只直接调整点锚定节点；拉伸锚点请使用右侧精确布局。'
  return ''
}

function snapAxis(
  values: number[],
  delta: number,
  guides: number[],
  threshold: number,
): { delta: number; guide: number | null } {
  let bestDifference = Number.POSITIVE_INFINITY
  let bestGuide: number | null = null

  values.forEach((value) => {
    const moved = value + delta
    guides.forEach((guide) => {
      const difference = guide - moved
      if (Math.abs(difference) <= threshold && Math.abs(difference) < Math.abs(bestDifference)) {
        bestDifference = difference
        bestGuide = guide
      }
    })

    // 网格作为兜底吸附；父级和兄弟参考线距离更近时会优先命中。
    const gridGuide = Math.round(moved / gridSize) * gridSize
    const gridDifference = gridGuide - moved
    if (Math.abs(gridDifference) < Math.abs(bestDifference)) {
      bestDifference = gridDifference
      bestGuide = gridGuide
    }
  })

  return bestGuide === null
    ? { delta, guide: null }
    : { delta: delta + bestDifference, guide: bestGuide }
}

function resizeResult(interaction: CanvasInteraction, deltaX: number, deltaY: number): {
  position: Vector3
  size: Point
} {
  const handle = interaction.handle ?? 'se'
  let leftDelta = handle.includes('w') ? deltaX : 0
  let rightDelta = handle.includes('e') ? deltaX : 0
  let topDelta = handle.includes('n') ? deltaY : 0
  let bottomDelta = handle.includes('s') ? deltaY : 0

  if (interaction.startBounds.width + rightDelta - leftDelta < minimumSize) {
    if (handle.includes('w')) leftDelta = interaction.startBounds.width - minimumSize
    else rightDelta = minimumSize - interaction.startBounds.width
  }
  if (interaction.startBounds.height + bottomDelta - topDelta < minimumSize) {
    if (handle.includes('n')) topDelta = interaction.startBounds.height - minimumSize
    else bottomDelta = minimumSize - interaction.startBounds.height
  }

  const widthDelta = rightDelta - leftDelta
  const heightDelta = bottomDelta - topDelta
  const positionX = interaction.startPosition[0] + leftDelta + interaction.pivot[0] * widthDelta
  const positionY = interaction.startPosition[1] - topDelta - (1 - interaction.pivot[1]) * heightDelta
  return {
    position: [positionX, positionY, interaction.startPosition[2]],
    size: [interaction.startSize[0] + widthDelta, interaction.startSize[1] + heightDelta],
  }
}

export function UnityCanvasEditor({
  canvas,
  selectedElement,
  editMode,
  interactionDisabled,
  refreshKey,
  onSelectElement,
  onPreviewChanges,
  onCommitChanges,
  onMessage,
}: UnityCanvasEditorProps): ReactNode {
  const [selectionBounds, setSelectionBounds] = useState<CanvasBounds | null>(null)
  const [guides, setGuides] = useState<CanvasGuide[]>([])
  const [blockReason, setBlockReason] = useState('')
  const interactionRef = useRef<CanvasInteraction | null>(null)
  const pointerRef = useRef<PointerSnapshot | null>(null)
  const animationFrameRef = useRef<number | null>(null)

  const measureSelection = useCallback(() => {
    if (!canvas || !selectedElement || !canvas.contains(selectedElement)) {
      setSelectionBounds(null)
      setBlockReason('')
      return
    }
    setSelectionBounds(logicalBounds(selectedElement, canvas))
    setBlockReason(editBlockReason(selectedElement, canvas))
  }, [canvas, selectedElement])

  useLayoutEffect(measureSelection, [measureSelection, refreshKey])

  useEffect(() => {
    if (!canvas) return
    canvas.dataset.canvasEditing = String(editMode)
    if (selectedElement && canvas.contains(selectedElement)) {
      const reason = editBlockReason(selectedElement, canvas)
      selectedElement.dataset.canvasEditable = String(editMode && !reason)
    }
    return () => {
      delete canvas.dataset.canvasEditing
      if (selectedElement) delete selectedElement.dataset.canvasEditable
    }
  }, [canvas, editMode, refreshKey, selectedElement])

  const beginInteraction = useCallback((
    event: PointerEvent,
    element: HTMLElement,
    kind: CanvasInteraction['kind'],
    handle?: ResizeHandle,
  ) => {
    if (!canvas || interactionDisabled || event.button !== 0) return
    const reason = editBlockReason(element, canvas)
    if (reason) {
      onMessage(reason)
      return
    }

    const canvasRect = canvas.getBoundingClientRect()
    const bounds = logicalBounds(element, canvas)
    const guideValues = collectGuideValues(element, canvas)
    interactionRef.current = {
      kind,
      pointerId: event.pointerId,
      element,
      handle,
      startClient: [event.clientX, event.clientY],
      scale: [
        canvasRect.width > 0 ? canvasRect.width / canvas.clientWidth : 1,
        canvasRect.height > 0 ? canvasRect.height / canvas.clientHeight : 1,
      ],
      startBounds: bounds,
      startPosition: parseVector(element.dataset.pos, 3, [0, 0, 0]),
      startSize: parseVector(element.dataset.size, 2, [bounds.width, bounds.height]),
      pivot: parseVector(element.dataset.pivot, 2, [0.5, 0.5]),
      beforePosition: element.getAttribute('data-pos'),
      beforeSize: element.getAttribute('data-size'),
      xGuides: guideValues.x,
      yGuides: guideValues.y,
    }
    pointerRef.current = { clientX: event.clientX, clientY: event.clientY, altKey: event.altKey }
    setGuides([])
    document.body.classList.add('is-uirect-dragging')
    onMessage(kind === 'move' ? '拖动节点；按住 Alt 可临时关闭吸附。' : '调整节点尺寸；按住 Alt 可临时关闭吸附。')
    event.preventDefault()
    event.stopPropagation()
  }, [canvas, interactionDisabled, onMessage])

  const applyPointerSnapshot = useCallback((snapshot: PointerSnapshot) => {
    const interaction = interactionRef.current
    if (!canvas || !interaction) return

    let deltaX = (snapshot.clientX - interaction.startClient[0]) / interaction.scale[0]
    let deltaY = (snapshot.clientY - interaction.startClient[1]) / interaction.scale[1]
    const nextGuides: CanvasGuide[] = []
    const thresholdX = 6 / interaction.scale[0]
    const thresholdY = 6 / interaction.scale[1]

    if (!snapshot.altKey) {
      if (interaction.kind === 'move') {
        const xSnap = snapAxis(
          [
            interaction.startBounds.left,
            interaction.startBounds.left + interaction.startBounds.width / 2,
            interaction.startBounds.left + interaction.startBounds.width,
          ],
          deltaX,
          interaction.xGuides,
          thresholdX,
        )
        const ySnap = snapAxis(
          [
            interaction.startBounds.top,
            interaction.startBounds.top + interaction.startBounds.height / 2,
            interaction.startBounds.top + interaction.startBounds.height,
          ],
          deltaY,
          interaction.yGuides,
          thresholdY,
        )
        deltaX = xSnap.delta
        deltaY = ySnap.delta
        if (xSnap.guide !== null) nextGuides.push({ axis: 'x', position: xSnap.guide })
        if (ySnap.guide !== null) nextGuides.push({ axis: 'y', position: ySnap.guide })
      } else {
        const handle = interaction.handle ?? 'se'
        if (handle.includes('w') || handle.includes('e')) {
          const edge = handle.includes('w')
            ? interaction.startBounds.left
            : interaction.startBounds.left + interaction.startBounds.width
          const snap = snapAxis([edge], deltaX, interaction.xGuides, thresholdX)
          deltaX = snap.delta
          if (snap.guide !== null) nextGuides.push({ axis: 'x', position: snap.guide })
        }
        if (handle.includes('n') || handle.includes('s')) {
          const edge = handle.includes('n')
            ? interaction.startBounds.top
            : interaction.startBounds.top + interaction.startBounds.height
          const snap = snapAxis([edge], deltaY, interaction.yGuides, thresholdY)
          deltaY = snap.delta
          if (snap.guide !== null) nextGuides.push({ axis: 'y', position: snap.guide })
        }
      }
    }

    let changes: CanvasAttributeChange[]
    if (interaction.kind === 'move') {
      const position: Vector3 = [
        interaction.startPosition[0] + deltaX,
        interaction.startPosition[1] - deltaY,
        interaction.startPosition[2],
      ]
      changes = [{
        attribute: 'data-pos',
        before: interaction.beforePosition,
        after: formatVector(position),
      }]
    } else {
      const result = resizeResult(interaction, deltaX, deltaY)
      changes = [
        {
          attribute: 'data-pos',
          before: interaction.beforePosition,
          after: formatVector(result.position),
        },
        {
          attribute: 'data-size',
          before: interaction.beforeSize,
          after: formatVector(result.size),
        },
      ]
    }

    onPreviewChanges(interaction.element, changes)
    setGuides(nextGuides)
    setSelectionBounds(logicalBounds(interaction.element, canvas))
  }, [canvas, onPreviewChanges])

  useEffect(() => {
    const flushPointer = () => {
      animationFrameRef.current = null
      const snapshot = pointerRef.current
      if (snapshot) applyPointerSnapshot(snapshot)
    }

    const pointerMove = (event: PointerEvent) => {
      const interaction = interactionRef.current
      if (!interaction || interaction.pointerId !== event.pointerId) return
      pointerRef.current = { clientX: event.clientX, clientY: event.clientY, altKey: event.altKey }
      if (animationFrameRef.current === null)
        animationFrameRef.current = window.requestAnimationFrame(flushPointer)
      event.preventDefault()
    }

    const finishInteraction = (event: PointerEvent) => {
      const interaction = interactionRef.current
      if (!interaction || interaction.pointerId !== event.pointerId) return
      if (animationFrameRef.current !== null) {
        window.cancelAnimationFrame(animationFrameRef.current)
        animationFrameRef.current = null
      }
      applyPointerSnapshot({ clientX: event.clientX, clientY: event.clientY, altKey: event.altKey })

      const changes: CanvasAttributeChange[] = [{
        attribute: 'data-pos',
        before: interaction.beforePosition,
        after: interaction.element.getAttribute('data-pos'),
      }]
      if (interaction.kind === 'resize') {
        changes.push({
          attribute: 'data-size',
          before: interaction.beforeSize,
          after: interaction.element.getAttribute('data-size'),
        })
      }
      onCommitChanges(interaction.element, changes)
      interactionRef.current = null
      pointerRef.current = null
      setGuides([])
      document.body.classList.remove('is-uirect-dragging')
      event.preventDefault()
    }

    const cancelInteraction = () => {
      const interaction = interactionRef.current
      if (!interaction) return
      if (animationFrameRef.current !== null) {
        window.cancelAnimationFrame(animationFrameRef.current)
        animationFrameRef.current = null
      }
      onPreviewChanges(interaction.element, [
        { attribute: 'data-pos', before: interaction.beforePosition, after: interaction.beforePosition },
        ...(interaction.kind === 'resize'
          ? [{ attribute: 'data-size', before: interaction.beforeSize, after: interaction.beforeSize }]
          : []),
      ])
      interactionRef.current = null
      pointerRef.current = null
      setGuides([])
      document.body.classList.remove('is-uirect-dragging')
      onMessage('已取消本次画布操作。')
      measureSelection()
    }

    const pointerCancel = (event: PointerEvent) => {
      const interaction = interactionRef.current
      if (interaction?.pointerId === event.pointerId) cancelInteraction()
    }

    const keyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && interactionRef.current) {
        cancelInteraction()
        event.preventDefault()
      }
    }

    window.addEventListener('pointermove', pointerMove, { passive: false })
    window.addEventListener('pointerup', finishInteraction)
    window.addEventListener('pointercancel', pointerCancel)
    window.addEventListener('keydown', keyDown)
    return () => {
      window.removeEventListener('pointermove', pointerMove)
      window.removeEventListener('pointerup', finishInteraction)
      window.removeEventListener('pointercancel', pointerCancel)
      window.removeEventListener('keydown', keyDown)
      if (animationFrameRef.current !== null) window.cancelAnimationFrame(animationFrameRef.current)
      document.body.classList.remove('is-uirect-dragging')
    }
  }, [applyPointerSnapshot, measureSelection, onCommitChanges, onMessage, onPreviewChanges])

  useEffect(() => {
    if (!canvas) return

    const pointerDown = (event: PointerEvent) => {
      if (interactionDisabled) return
      const target = event.target instanceof Element ? event.target.closest<HTMLElement>(nodeSelector) : null
      if (!target || !canvas.contains(target)) return
      onSelectElement(target)
      if (!editMode) return
      beginInteraction(event, target, 'move')
    }

    const blockPreviewClick = (event: MouseEvent) => {
      if (!editMode || interactionDisabled) return
      const target = event.target instanceof Element ? event.target.closest<HTMLElement>(nodeSelector) : null
      if (!target || !canvas.contains(target)) return
      event.preventDefault()
      event.stopPropagation()
    }

    canvas.addEventListener('pointerdown', pointerDown, true)
    canvas.addEventListener('click', blockPreviewClick, true)
    return () => {
      canvas.removeEventListener('pointerdown', pointerDown, true)
      canvas.removeEventListener('click', blockPreviewClick, true)
    }
  }, [beginInteraction, canvas, editMode, interactionDisabled, onSelectElement])

  useEffect(() => {
    const keyDown = (event: KeyboardEvent) => {
      if (!editMode || interactionDisabled || !canvas || !selectedElement || interactionRef.current) return
      if (!['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(event.key)) return
      const target = event.target
      if (target instanceof HTMLInputElement || target instanceof HTMLSelectElement || target instanceof HTMLTextAreaElement)
        return
      if (target instanceof HTMLElement && target.isContentEditable) return

      const reason = editBlockReason(selectedElement, canvas)
      if (reason) {
        onMessage(reason)
        return
      }
      const step = event.shiftKey ? 10 : 1
      const position = parseVector(selectedElement.dataset.pos, 3, [0, 0, 0])
      const before = selectedElement.getAttribute('data-pos')
      if (event.key === 'ArrowLeft') position[0] -= step
      if (event.key === 'ArrowRight') position[0] += step
      if (event.key === 'ArrowUp') position[1] += step
      if (event.key === 'ArrowDown') position[1] -= step
      const change: CanvasAttributeChange = {
        attribute: 'data-pos',
        before,
        after: formatVector(position),
      }
      onPreviewChanges(selectedElement, [change])
      onCommitChanges(selectedElement, [change])
      setSelectionBounds(logicalBounds(selectedElement, canvas))
      event.preventDefault()
    }

    window.addEventListener('keydown', keyDown)
    return () => window.removeEventListener('keydown', keyDown)
  }, [canvas, editMode, interactionDisabled, onCommitChanges, onMessage, onPreviewChanges, selectedElement])

  if (!canvas) return null

  return createPortal(
    <div className="unity-canvas-overlay" aria-hidden="true">
      {guides.map((guide, index) => (
        <span
          className={`unity-canvas-guide is-${guide.axis}`}
          key={`${guide.axis}-${guide.position}-${index}`}
          style={guide.axis === 'x' ? { left: guide.position } : { top: guide.position }}
        />
      ))}
      {selectionBounds && selectedElement && (
        <div
          className={
            'unity-canvas-selection ' +
            (blockReason ? 'is-locked ' : '') +
            (editMode && !blockReason ? 'is-editable' : '')
          }
          style={{
            left: selectionBounds.left,
            top: selectionBounds.top,
            width: selectionBounds.width,
            height: selectionBounds.height,
          }}
          onPointerDown={(event: ReactPointerEvent<HTMLDivElement>) => {
            if (!editMode || blockReason) return
            // 选框覆盖区域内仍优先命中更深的实际 UI 节点，避免选中父节点后无法从画布选择子节点。
            const underlying = document.elementsFromPoint(event.clientX, event.clientY)
              .find((element): element is HTMLElement =>
                element instanceof HTMLElement &&
                element.matches(nodeSelector) &&
                canvas.contains(element))
            const interactionElement = underlying ?? selectedElement
            if (interactionElement !== selectedElement) onSelectElement(interactionElement)
            beginInteraction(event.nativeEvent, interactionElement, 'move')
            event.preventDefault()
            event.stopPropagation()
          }}
        >
          <div className="unity-canvas-selection-label">
            <strong>{selectedElement.dataset.name ?? selectedElement.dataset.component ?? '未命名节点'}</strong>
            <span>{Math.round(selectionBounds.width)} × {Math.round(selectionBounds.height)}</span>
          </div>
          {editMode && blockReason && <div className="unity-canvas-lock-message">{blockReason}</div>}
          {editMode && !blockReason && resizeHandles.map((handle) => (
            <button
              className={`unity-canvas-handle is-${handle}`}
              key={handle}
              type="button"
              aria-label={`从 ${handle} 方向调整尺寸`}
              onPointerDown={(event: ReactPointerEvent<HTMLButtonElement>) => {
                beginInteraction(event.nativeEvent, selectedElement, 'resize', handle)
                event.preventDefault()
                event.stopPropagation()
              }}
            />
          ))}
        </div>
      )}
    </div>,
    canvas,
  )
}
