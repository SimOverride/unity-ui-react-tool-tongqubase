import { useEffect, useRef, useState, type ReactNode } from 'react'
import type { CanvasAttributeChange } from './unity-canvas-editor'
import {
  clamp01,
  formatUnityNumber,
  formatUnityVector,
  horizontalStretch,
  layoutWithMargins,
  marginsFromAnchorLayout,
  preserveRectWithAnchors,
  readUnityAnchorLayout,
  rectFromAnchorLayout,
  verticalStretch,
  type UnityAnchorLayout,
  type UnityAnchors,
  type UnityPoint,
} from './unity-anchor'

interface AnchorLayoutEditorProps {
  nodeKey: string
  element: HTMLElement
  onPreviewChanges: (changes: CanvasAttributeChange[]) => void
  onCommitChanges: (changes: CanvasAttributeChange[]) => void
}

interface AxisPreset {
  key: string
  label: string
  min: number
  max: number
}

type LayoutMetric = 'x' | 'y' | 'z' | 'width' | 'height' | 'left' | 'right' | 'top' | 'bottom'

const horizontalPresets: AxisPreset[] = [
  { key: 'left', label: '左', min: 0, max: 0 },
  { key: 'center', label: '中', min: 0.5, max: 0.5 },
  { key: 'right', label: '右', min: 1, max: 1 },
  { key: 'stretch', label: '横拉伸', min: 0, max: 1 },
]

const verticalPresets: AxisPreset[] = [
  { key: 'top', label: '上', min: 1, max: 1 },
  { key: 'middle', label: '中', min: 0.5, max: 0.5 },
  { key: 'bottom', label: '下', min: 0, max: 0 },
  { key: 'stretch', label: '纵拉伸', min: 0, max: 1 },
]

function almostEqual(left: number, right: number): boolean {
  return Math.abs(left - right) < 0.0001
}

function currentValue(element: HTMLElement, attribute: string): string | null {
  return element.getAttribute(attribute)
}

function layoutChanges(
  element: HTMLElement,
  next: UnityAnchorLayout,
  options: { anchors?: boolean; pivot?: boolean; position?: boolean; size?: boolean },
): CanvasAttributeChange[] {
  const changes: CanvasAttributeChange[] = []
  const add = (attribute: string, after: string | null) => {
    changes.push({ attribute, before: currentValue(element, attribute), after })
  }

  if (options.anchors) {
    const hasSplitAnchors = element.hasAttribute('data-anchor-min') || element.hasAttribute('data-anchor-max')
    if (!hasSplitAnchors || element.hasAttribute('data-anchors'))
      add('data-anchors', formatUnityVector(next.anchors))
    // 已采用拆分声明时补齐并更新 Min/Max，避免再制造一套新的锚点数据源。
    if (hasSplitAnchors) {
      add('data-anchor-min', formatUnityVector([next.anchors[0], next.anchors[1]]))
      add('data-anchor-max', formatUnityVector([next.anchors[2], next.anchors[3]]))
    }
  }
  if (options.pivot) add('data-pivot', formatUnityVector(next.pivot))
  if (options.position) add('data-pos', formatUnityVector(next.position))
  if (options.size) add('data-size', formatUnityVector(next.size))
  return changes
}

function NumericField({
  label,
  value,
  nodeKey,
  onCommit,
}: {
  label: string
  value: number
  nodeKey: string
  onCommit: (value: number) => void
}): ReactNode {
  const formattedValue = formatUnityNumber(value)
  const [draft, setDraft] = useState(formattedValue)
  const [error, setError] = useState('')
  const skipCommitRef = useRef(false)

  useEffect(() => {
    setDraft(formattedValue)
    setError('')
  }, [formattedValue, nodeKey])

  return (
    <label className={'unity-anchor-number ' + (error ? 'has-error' : '')}>
      <span>{label}</span>
      <input
        inputMode="decimal"
        value={draft}
        onChange={(event) => {
          setDraft(event.target.value)
          setError('')
        }}
        onKeyDown={(event) => {
          if (event.key === 'Enter') event.currentTarget.blur()
          if (event.key === 'Escape') {
            skipCommitRef.current = true
            setDraft(formattedValue)
            setError('')
            event.currentTarget.blur()
          }
        }}
        onBlur={() => {
          if (skipCommitRef.current) {
            skipCommitRef.current = false
            return
          }
          const next = Number(draft)
          if (!Number.isFinite(next)) {
            setDraft(formattedValue)
            setError('请输入有效数字')
            return
          }
          onCommit(next)
        }}
      />
    </label>
  )
}

function metricDefinitions(layout: UnityAnchorLayout): Array<{ key: LayoutMetric; label: string; value: number }> {
  const margins = marginsFromAnchorLayout(layout)
  const horizontal = horizontalStretch(layout)
  const vertical = verticalStretch(layout)
  const horizontalMetrics: Array<{ key: LayoutMetric; label: string; value: number }> = horizontal
    ? [
        { key: 'left', label: '左边距', value: margins.left },
        { key: 'right', label: '右边距', value: margins.right },
      ]
    : [
        { key: 'x', label: 'X', value: layout.position[0] },
        { key: 'width', label: '宽', value: layout.size[0] },
      ]
  const verticalMetrics: Array<{ key: LayoutMetric; label: string; value: number }> = vertical
    ? [
        { key: 'top', label: '上边距', value: margins.top },
        { key: 'bottom', label: '下边距', value: margins.bottom },
      ]
    : [
        { key: 'y', label: 'Y', value: layout.position[1] },
        { key: 'height', label: '高', value: layout.size[1] },
      ]
  return [...horizontalMetrics, ...verticalMetrics, { key: 'z', label: 'Z', value: layout.position[2] }]
}

export function AnchorLayoutEditor({
  nodeKey,
  element,
  onPreviewChanges,
  onCommitChanges,
}: AnchorLayoutEditorProps): ReactNode {
  const [matchPivot, setMatchPivot] = useState(false)
  const layout = readUnityAnchorLayout(element)
  const parent = element.parentElement?.closest<HTMLElement>('[data-component], [data-prefab-child-path]') ?? null
  const controlledByLayoutGroup = Boolean(parent?.dataset.layoutGroup)

  if (!layout) {
    return <div className="unity-inspector-warning">根节点由画布分辨率和根布局模式控制，锚点不可在此修改。</div>
  }
  if (controlledByLayoutGroup) {
    return (
      <div className="unity-inspector-warning">
        当前节点由父级 {parent?.dataset.layoutGroup} 布局组控制，请调整布局组参数。
      </div>
    )
  }

  const commitLayout = (
    next: UnityAnchorLayout,
    options: { anchors?: boolean; pivot?: boolean; position?: boolean; size?: boolean },
  ) => {
    const changes = layoutChanges(element, next, options)
    onPreviewChanges(changes)
    onCommitChanges(changes)
  }

  const selectPreset = (horizontal: AxisPreset, vertical: AxisPreset) => {
    const anchors: UnityAnchors = [horizontal.min, vertical.min, horizontal.max, vertical.max]
    const pivot: UnityPoint = matchPivot
      ? [
          almostEqual(horizontal.min, horizontal.max) ? horizontal.min : 0.5,
          almostEqual(vertical.min, vertical.max) ? vertical.min : 0.5,
        ]
      : layout.pivot
    const next = preserveRectWithAnchors(layout, anchors, pivot)
    commitLayout(next, { anchors: true, pivot: matchPivot, position: true, size: true })
  }

  const changeAnchor = (index: number, value: number) => {
    const anchors: UnityAnchors = [...layout.anchors]
    const clamped = clamp01(value)
    if (index === 0) anchors[0] = Math.min(clamped, anchors[2])
    if (index === 1) anchors[1] = Math.min(clamped, anchors[3])
    if (index === 2) anchors[2] = Math.max(clamped, anchors[0])
    if (index === 3) anchors[3] = Math.max(clamped, anchors[1])
    const next = preserveRectWithAnchors(layout, anchors)
    commitLayout(next, { anchors: true, position: true, size: true })
  }

  const changePivot = (index: number, value: number) => {
    const pivot: UnityPoint = [...layout.pivot]
    pivot[index] = clamp01(value)
    const next = preserveRectWithAnchors(layout, layout.anchors, pivot)
    commitLayout(next, { pivot: true, position: true, size: true })
  }

  const changeMetric = (metric: LayoutMetric, value: number) => {
    let next: UnityAnchorLayout = {
      ...layout,
      position: [...layout.position],
      size: [...layout.size],
    }
    if (metric === 'x') next.position[0] = value
    else if (metric === 'y') next.position[1] = value
    else if (metric === 'z') next.position[2] = value
    else if (metric === 'width') next.size[0] = value
    else if (metric === 'height') next.size[1] = value
    else {
      const margins = marginsFromAnchorLayout(layout)
      margins[metric] = value
      next = layoutWithMargins(layout, margins)
    }
    commitLayout(next, { position: true, size: true })
  }

  const convertBoundsToAnchors = () => {
    const rect = rectFromAnchorLayout(layout)
    const anchors: UnityAnchors = [
      clamp01(rect.left / layout.parentWidth),
      clamp01(rect.bottom / layout.parentHeight),
      clamp01((rect.left + rect.width) / layout.parentWidth),
      clamp01((rect.bottom + rect.height) / layout.parentHeight),
    ]
    const next = preserveRectWithAnchors(layout, anchors)
    commitLayout(next, { anchors: true, position: true, size: true })
  }

  const anchorLabels = ['Min X', 'Min Y', 'Max X', 'Max Y']
  const metrics = metricDefinitions(layout)

  return (
    <div className="unity-anchor-editor">
      <div className="unity-anchor-preset-grid" aria-label="锚点预设">
        {verticalPresets.flatMap((vertical) => horizontalPresets.map((horizontal) => {
          const selected = almostEqual(layout.anchors[0], horizontal.min) &&
            almostEqual(layout.anchors[1], vertical.min) &&
            almostEqual(layout.anchors[2], horizontal.max) &&
            almostEqual(layout.anchors[3], vertical.max)
          return (
            <button
              className={selected ? 'is-selected' : ''}
              key={`${horizontal.key}-${vertical.key}`}
              type="button"
              title={`${horizontal.label} / ${vertical.label}（保持当前矩形）`}
              aria-label={`${horizontal.label} / ${vertical.label}锚点`}
              onClick={() => selectPreset(horizontal, vertical)}
            >
              <span className="unity-anchor-preset-glyph">
                <i style={{
                  left: `${horizontal.min * 100}%`,
                  right: `${(1 - horizontal.max) * 100}%`,
                  top: `${(1 - vertical.max) * 100}%`,
                  bottom: `${vertical.min * 100}%`,
                }} />
              </span>
              <small>{horizontal.label}·{vertical.label}</small>
            </button>
          )
        }))}
      </div>

      <label className="unity-anchor-option">
        <input type="checkbox" checked={matchPivot} onChange={(event) => setMatchPivot(event.target.checked)} />
        <span>选择预设时同时匹配轴心</span>
      </label>

      <div className="unity-anchor-number-grid">
        {layout.anchors.map((value, index) => (
          <NumericField
            key={`anchor-${index}`}
            label={anchorLabels[index]}
            value={value}
            nodeKey={nodeKey}
            onCommit={(nextValue) => changeAnchor(index, nextValue)}
          />
        ))}
        {layout.pivot.map((value, index) => (
          <NumericField
            key={`pivot-${index}`}
            label={index === 0 ? 'Pivot X' : 'Pivot Y'}
            value={value}
            nodeKey={nodeKey}
            onCommit={(nextValue) => changePivot(index, nextValue)}
          />
        ))}
      </div>

      <div className="unity-anchor-divider" />
      <div className="unity-anchor-number-grid">
        {metrics.map((metric) => (
          <NumericField
            key={metric.key}
            label={metric.label}
            value={metric.value}
            nodeKey={nodeKey}
            onCommit={(value) => changeMetric(metric.key, value)}
          />
        ))}
      </div>

      <button className="unity-anchor-convert" type="button" onClick={convertBoundsToAnchors}>
        将当前边界转为比例锚点
      </button>
      <p className="unity-anchor-note">锚点和轴心修改默认保持当前矩形；拉伸轴使用边距语义。</p>
    </div>
  )
}
