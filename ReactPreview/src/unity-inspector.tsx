import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import {
  loadSourceVersion,
  saveSourcePatches,
  SourceEditorError,
  type SourceNodePatch,
} from './unity-source-editor'
import {
  UnityCanvasEditor,
  type CanvasAttributeChange,
  type CanvasAttributeValue,
} from './unity-canvas-editor'
import { AnchorLayoutEditor } from './unity-anchor-editor'

type Vector = number[]
type AttributeValue = CanvasAttributeValue

interface UnityNodeInfo {
  key: string
  depth: number
  name: string
  component: string
  tagName: string
  element: HTMLElement
  anchors: Vector
  anchorMin: Vector
  anchorMax: Vector
  pivot: Vector
  position: Vector
  size: Vector
  previewSize: Vector
  text: string
  unityComponents: string[]
  children: UnityNodeInfo[]
  editable: boolean
}

interface UnityHierarchy {
  roots: UnityNodeInfo[]
  flat: UnityNodeInfo[]
}

interface EditOperation {
  changes: EditAttributeChange[]
}

interface EditAttributeChange {
  nodeName: string
  attribute: string
  before: AttributeValue
  after: AttributeValue
}

interface EditorFieldDefinition {
  attribute: string
  label: string
  placeholder?: string
  options?: Array<{ label: string; value: string }>
}

interface UnityInspectorPanelProps {
  canvas: HTMLElement | null
  pageName: string
  pagePath: string
  refreshKey: number
  interactionDisabled: boolean
  onRequestLayout: (refreshInspector?: boolean) => void
  onDirtyChange: (dirty: boolean) => void
}

const emptyHierarchy: UnityHierarchy = { roots: [], flat: [] }
const nodeSelector = '[data-component], [data-prefab-child-path]'

const booleanOptions = [
  { label: '未声明', value: '' },
  { label: 'true', value: 'true' },
  { label: 'false', value: 'false' },
]

const layoutFields: EditorFieldDefinition[] = [
  { attribute: 'data-rot', label: '旋转', placeholder: '(0, 0, 0)' },
  { attribute: 'data-scale', label: '缩放', placeholder: '(1, 1, 1)' },
]

const visualFields: EditorFieldDefinition[] = [
  { attribute: 'data-text', label: '文本' },
  { attribute: 'data-sprite', label: 'Sprite', placeholder: 'Assets/...' },
  { attribute: 'data-color', label: '颜色', placeholder: '(1, 1, 1, 1)' },
  { attribute: 'data-alpha', label: '透明度', placeholder: '1' },
  { attribute: 'data-font-size', label: '字号', placeholder: '32' },
  { attribute: 'data-font-style', label: '字形', placeholder: 'Normal / Bold' },
  { attribute: 'data-text-align', label: '水平对齐', options: [
    { label: '未声明', value: '' },
    { label: 'Left', value: 'Left' },
    { label: 'Center', value: 'Center' },
    { label: 'Right', value: 'Right' },
  ] },
  { attribute: 'data-vertical-align', label: '垂直对齐', options: [
    { label: '未声明', value: '' },
    { label: 'Top', value: 'Top' },
    { label: 'Middle', value: 'Middle' },
    { label: 'Bottom', value: 'Bottom' },
  ] },
  { attribute: 'data-outline-color', label: '描边颜色', placeholder: '(0, 0, 0, 1)' },
  { attribute: 'data-outline-width', label: '描边宽度', placeholder: '0' },
  { attribute: 'data-preserve-aspect', label: '保持宽高比', options: booleanOptions },
  { attribute: 'data-visible', label: '可见', options: booleanOptions },
  { attribute: 'data-interactable', label: '可交互', options: booleanOptions },
]

const bindingFields: EditorFieldDefinition[] = [
  { attribute: 'data-bind', label: '绑定键' },
  { attribute: 'data-bind-type', label: '绑定类型', placeholder: 'Button / TMPText / 完整类型名' },
  { attribute: 'data-bind-custom-type', label: '自定义绑定类型', placeholder: 'Game.UI.InventoryCell' },
]

const groupFields: EditorFieldDefinition[] = [
  { attribute: 'data-layout-group', label: '布局组', options: [
    { label: '未声明', value: '' },
    { label: 'Horizontal', value: 'Horizontal' },
    { label: 'Vertical', value: 'Vertical' },
    { label: 'Grid', value: 'Grid' },
  ] },
  { attribute: 'data-layout-spacing', label: '间距', placeholder: '10 或 (10, 10)' },
  { attribute: 'data-layout-padding', label: 'Padding', placeholder: '(0, 0, 0, 0)' },
  { attribute: 'data-layout-cell-size', label: '单元尺寸', placeholder: '(100, 100)' },
  { attribute: 'data-layout-constraint', label: '约束', options: [
    { label: '未声明', value: '' },
    { label: 'Flexible', value: 'Flexible' },
    { label: 'FixedColumnCount', value: 'FixedColumnCount' },
    { label: 'FixedRowCount', value: 'FixedRowCount' },
  ] },
  { attribute: 'data-layout-constraint-count', label: '约束数量', placeholder: '1' },
  { attribute: 'data-scroll-direction', label: '滚动方向', placeholder: 'Vertical / Horizontal' },
]

const unityComponentMap: Record<string, string[]> = {
  UINode: ['RectTransform'],
  UIImage: ['RectTransform', 'Image'],
  UITextMesh: ['RectTransform', 'TextMeshProUGUI'],
  UIButton: ['RectTransform', 'Image', 'Button', 'TextMeshProUGUI'],
  UIInputField: ['RectTransform', 'Image', 'TMP_InputField', 'TextMeshProUGUI'],
  UIInputFieldTextMesh: ['RectTransform', 'Image', 'TMP_InputField', 'TextMeshProUGUI'],
  UIToggle: ['RectTransform', 'Toggle', 'Image', 'TextMeshProUGUI'],
  UISlider: ['RectTransform', 'Slider', 'Image'],
  UIEventArea: ['RectTransform', 'Image'],
  UIListView: ['RectTransform', 'Image', 'ScrollRect', 'RectMask2D'],
  UISimpleListView: ['RectTransform', 'Image', 'ScrollRect', 'RectMask2D', 'VerticalLayoutGroup'],
  UIGridView: ['RectTransform', 'Image', 'ScrollRect', 'RectMask2D', 'GridLayoutGroup'],
  UISimpleGridView: ['RectTransform', 'Image', 'ScrollRect', 'RectMask2D', 'GridLayoutGroup'],
  UIPrefabLoader: ['RectTransform', 'UIPrefabLoader'],
  UIInputSwitcher: ['RectTransform', 'UIInputSwitcher'],
}

function parseVector(raw: string | undefined, count: number, fallback: Vector): Vector {
  if (!raw) return fallback
  const values = raw
    .replace(/[()]/g, '')
    .split(',')
    .map((item) => Number(item.trim()))
  return values.length === count && values.every(Number.isFinite) ? values : fallback
}

function numberValue(raw: string | undefined, fallback: number): number {
  const value = Number(raw)
  return Number.isFinite(value) ? value : fallback
}

function formatNumber(value: number): string {
  if (Number.isInteger(value)) return String(value)
  return value.toFixed(3).replace(/0+$/, '').replace(/\.$/, '')
}

function formatVector(values: Vector): string {
  return '(' + values.map(formatNumber).join(', ') + ')'
}

function directText(element: HTMLElement): string {
  return Array.from(element.childNodes)
    .filter((node) => node.nodeType === Node.TEXT_NODE)
    .map((node) => node.textContent ?? '')
    .join('')
    .trim()
}

function componentNames(component: string, data: DOMStringMap): string[] {
  if (component === 'UIRootPanel') {
    const viewComponent = data.viewMode
      ? (data.viewMode.toLowerCase() === 'mvvm' ? 'BaseUIView (MVVM)' : 'UIView')
      : 'UIView / BaseUIView（工具配置）'
    return ['RectTransform', viewComponent, 'UIBindCollector']
  }
  const builtin = unityComponentMap[component]
  if (builtin) return builtin
  if (data.prefabChildPath) return ['RectTransform', 'Prefab 子节点覆盖']
  return ['RectTransform', '项目组件 Prefab']
}

function createNode(
  element: HTMLElement,
  key: string,
  depth: number,
  childElements: Map<HTMLElement, HTMLElement[]>,
  flat: UnityNodeInfo[],
): UnityNodeInfo {
  const data = element.dataset
  const component = data.component ?? (data.prefabChildPath ? 'PrefabChild' : 'Unknown')
  const anchors = parseVector(data.anchors, 4, [0.5, 0.5, 0.5, 0.5])
  const anchorMin = parseVector(data.anchorMin, 2, [anchors[0], anchors[1]])
  const anchorMax = parseVector(data.anchorMax, 2, [anchors[2], anchors[3]])
  const declaredSize = parseVector(data.size, 2, [0, 0])
  const previewSize = [
    numberValue(data.previewWidth, declaredSize[0]),
    numberValue(data.previewHeight, declaredSize[1]),
  ]
  const node: UnityNodeInfo = {
    key,
    depth,
    name: data.name ?? component,
    component,
    tagName: element.tagName.toLowerCase(),
    element,
    anchors,
    anchorMin,
    anchorMax,
    pivot: parseVector(data.pivot, 2, [0.5, 0.5]),
    position: parseVector(data.pos, 3, [0, 0, 0]),
    size: declaredSize,
    previewSize,
    text: data.text ?? directText(element),
    unityComponents: componentNames(component, data),
    children: [],
    editable: false,
  }
  flat.push(node)
  node.children = (childElements.get(element) ?? []).map((child, index) =>
    createNode(child, key + '.' + index, depth + 1, childElements, flat),
  )
  return node
}

function readHierarchy(canvas: HTMLElement): UnityHierarchy {
  // 读取已经完成 Unity 布局计算的 DOM，确保检查和编辑使用同一份静态 data-* 数据。
  const elements = Array.from(canvas.querySelectorAll<HTMLElement>(nodeSelector))
  const elementSet = new Set(elements)
  const childElements = new Map<HTMLElement, HTMLElement[]>()
  const roots: HTMLElement[] = []

  elements.forEach((element) => {
    const parent = element.parentElement?.closest<HTMLElement>(nodeSelector) ?? null
    if (!parent || !elementSet.has(parent)) {
      roots.push(element)
      return
    }

    const children = childElements.get(parent) ?? []
    children.push(element)
    childElements.set(parent, children)
  })

  const flat: UnityNodeInfo[] = []
  const hierarchy = {
    roots: roots.map((root, index) => createNode(root, String(index), 0, childElements, flat)),
    flat,
  }
  const nameCounts = new Map<string, number>()
  flat.forEach((node) => {
    const sourceName = node.element.getAttribute('data-name')
    if (sourceName) nameCounts.set(sourceName, (nameCounts.get(sourceName) ?? 0) + 1)
  })
  flat.forEach((node) => {
    const sourceName = node.element.getAttribute('data-name')
    node.editable = Boolean(sourceName && nameCounts.get(sourceName) === 1)
  })
  return hierarchy
}

function KeyValue({ label, value }: { label: string; value: string }): ReactNode {
  return (
    <div className="unity-inspector-kv">
      <span>{label}</span>
      <code>{value || '—'}</code>
    </div>
  )
}

function InspectorSection({ title, children }: { title: string; children: ReactNode }): ReactNode {
  return (
    <section className="unity-inspector-section">
      <h3>{title}</h3>
      {children}
    </section>
  )
}

function HierarchyNode({
  node,
  selectedKey,
  collapsedKeys,
  onSelect,
  onToggle,
}: {
  node: UnityNodeInfo
  selectedKey: string
  collapsedKeys: Set<string>
  onSelect: (key: string) => void
  onToggle: (key: string) => void
}): ReactNode {
  const hasChildren = node.children.length > 0
  const collapsed = collapsedKeys.has(node.key)

  return (
    <div className="unity-tree-item">
      <div className={'unity-tree-row ' + (selectedKey === node.key ? 'is-selected' : '')}>
        <button
          className="unity-tree-toggle"
          type="button"
          aria-label={hasChildren ? (collapsed ? '展开子节点' : '折叠子节点') : '无子节点'}
          disabled={!hasChildren}
          onClick={() => onToggle(node.key)}
        >
          {hasChildren ? (collapsed ? '▸' : '▾') : '·'}
        </button>
        <button
          className="unity-tree-select"
          type="button"
          aria-pressed={selectedKey === node.key}
          style={{ paddingLeft: (8 + node.depth * 16) + 'px' }}
          onClick={() => onSelect(node.key)}
        >
          <span className="unity-tree-name">{node.name}</span>
          <code>{node.component}</code>
        </button>
      </div>
      {hasChildren && !collapsed && (
        <div className="unity-tree-children">
          {node.children.map((child) => (
            <HierarchyNode
              key={child.key}
              node={child}
              selectedKey={selectedKey}
              collapsedKeys={collapsedKeys}
              onSelect={onSelect}
              onToggle={onToggle}
            />
          ))}
        </div>
      )}
    </div>
  )
}

function normalizedValue(value: string): AttributeValue {
  return value.trim().length === 0 ? null : value
}

function validVector(value: string, count: number): boolean {
  const values = value.replace(/[()]/g, '').split(',').map((item) => Number(item.trim()))
  return values.length === count && values.every(Number.isFinite)
}

function validateEditorValue(attribute: string, value: string): string {
  if (!value.trim()) return ''
  if (value.includes('"') && value.includes("'")) return '不能同时包含单引号和双引号。'

  const vectorCounts: Record<string, number> = {
    'data-pos': 3,
    'data-size': 2,
    'data-anchors': 4,
    'data-pivot': 2,
    'data-rot': 3,
    'data-scale': 3,
    'data-color': 4,
    'data-outline-color': 4,
    'data-layout-padding': 4,
    'data-layout-cell-size': 2,
  }
  const vectorCount = vectorCounts[attribute]
  if (vectorCount && !validVector(value, vectorCount))
    return `请输入 ${vectorCount} 个有限数字，例如 (${Array(vectorCount).fill('0').join(', ')})。`

  if (attribute === 'data-layout-spacing' && !Number.isFinite(Number(value)) && !validVector(value, 2))
    return '请输入一个数字或二维向量。'

  const numericAttributes = new Set([
    'data-alpha',
    'data-font-size',
    'data-outline-width',
    'data-layout-constraint-count',
  ])
  if (numericAttributes.has(attribute) && !Number.isFinite(Number(value)))
    return '请输入有效数字。'
  if (attribute === 'data-sprite' && !value.startsWith('Assets/'))
    return 'Sprite 必须使用 Assets/... 项目相对路径。'
  return ''
}

function applyElementAttribute(element: HTMLElement, attribute: string, value: AttributeValue): void {
  if (value === null) element.removeAttribute(attribute)
  else element.setAttribute(attribute, value)

  if (attribute === 'data-text' && value !== null) {
    const textNodes = Array.from(element.childNodes).filter((node) => node.nodeType === Node.TEXT_NODE)
    if (textNodes.length > 0) {
      textNodes[0].textContent = value
      for (let index = 1; index < textNodes.length; index++) textNodes[index].textContent = ''
    }
  }
}

function EditableField({
  node,
  definition,
  onPreview,
  onCommit,
}: {
  node: UnityNodeInfo
  definition: EditorFieldDefinition
  onPreview: (node: UnityNodeInfo, attribute: string, value: AttributeValue) => void
  onCommit: (
    node: UnityNodeInfo,
    attribute: string,
    before: AttributeValue,
    after: AttributeValue,
  ) => void
}): ReactNode {
  const currentValue = node.element.getAttribute(definition.attribute) ?? ''
  const [draft, setDraft] = useState(currentValue)
  const [error, setError] = useState('')
  const beforeRef = useRef<AttributeValue>(normalizedValue(currentValue))
  const draftRef = useRef(currentValue)
  const skipCommitRef = useRef(false)

  useEffect(() => {
    setDraft(currentValue)
    draftRef.current = currentValue
    setError('')
  }, [currentValue, node.key])

  if (definition.options) {
    return (
      <label className="unity-editor-field">
        <span>{definition.label}</span>
        <select
          value={currentValue}
          onChange={(event) => {
            const before = normalizedValue(currentValue)
            const after = normalizedValue(event.target.value)
            onPreview(node, definition.attribute, after)
            onCommit(node, definition.attribute, before, after)
          }}
        >
          {definition.options.map((option) => (
            <option key={option.value} value={option.value}>{option.label}</option>
          ))}
        </select>
      </label>
    )
  }

  return (
    <label className={'unity-editor-field ' + (error ? 'has-error' : '')}>
      <span>{definition.label}</span>
      <input
        value={draft}
        placeholder={definition.placeholder}
        onFocus={() => {
          beforeRef.current = normalizedValue(currentValue)
          skipCommitRef.current = false
        }}
        onChange={(event) => {
          const next = event.target.value
          setDraft(next)
          draftRef.current = next
          setError('')
          if (!validateEditorValue(definition.attribute, next))
            onPreview(node, definition.attribute, normalizedValue(next))
        }}
        onKeyDown={(event) => {
          if (event.key === 'Enter') event.currentTarget.blur()
          if (event.key === 'Escape') {
            skipCommitRef.current = true
            const before = beforeRef.current
            setDraft(before ?? '')
            draftRef.current = before ?? ''
            setError('')
            onPreview(node, definition.attribute, before)
            event.currentTarget.blur()
          }
        }}
        onBlur={() => {
          if (skipCommitRef.current) {
            skipCommitRef.current = false
            return
          }
          const latestDraft = draftRef.current
          const validationError = validateEditorValue(definition.attribute, latestDraft)
          if (validationError) {
            setError(validationError)
            setDraft(beforeRef.current ?? '')
            draftRef.current = beforeRef.current ?? ''
            onPreview(node, definition.attribute, beforeRef.current)
            return
          }
          onCommit(node, definition.attribute, beforeRef.current, normalizedValue(latestDraft))
        }}
      />
      {error && <small>{error}</small>}
    </label>
  )
}

function EditorFields({
  node,
  definitions,
  onPreview,
  onCommit,
}: {
  node: UnityNodeInfo
  definitions: EditorFieldDefinition[]
  onPreview: (node: UnityNodeInfo, attribute: string, value: AttributeValue) => void
  onCommit: (node: UnityNodeInfo, attribute: string, before: AttributeValue, after: AttributeValue) => void
}): ReactNode {
  return (
    <div className="unity-editor-field-grid">
      {definitions.map((definition) => (
        <EditableField
          key={definition.attribute}
          node={node}
          definition={definition}
          onPreview={onPreview}
          onCommit={onCommit}
        />
      ))}
    </div>
  )
}

function InspectorDetail({
  node,
  editMode,
  onPreview,
  onCommit,
  onPreviewChanges,
  onCommitChanges,
}: {
  node: UnityNodeInfo | undefined
  editMode: boolean
  onPreview: (node: UnityNodeInfo, attribute: string, value: AttributeValue) => void
  onCommit: (node: UnityNodeInfo, attribute: string, before: AttributeValue, after: AttributeValue) => void
  onPreviewChanges: (element: HTMLElement, changes: CanvasAttributeChange[]) => void
  onCommitChanges: (element: HTMLElement, changes: CanvasAttributeChange[]) => void
}): ReactNode {
  if (!node) {
    return (
      <div className="unity-inspector-empty">
        <strong>请选择一个节点</strong>
        <p>从左侧层级或预览画布中选择节点。</p>
      </div>
    )
  }

  const data = node.element.dataset
  const declaredText = data.text || node.text
  const componentRows = node.unityComponents.map((name) => (
    <span className="unity-inspector-chip" key={name}>{name}</span>
  ))

  return (
    <div className="unity-inspector-detail">
      <div className="unity-inspector-node-title">
        <strong>{node.name}</strong>
        <code>{node.component}</code>
      </div>

      <InspectorSection title="Unity 组件">
        <div className="unity-inspector-chip-list">{componentRows}</div>
        <div className="unity-inspector-kv-grid">
          <KeyValue label="data-name" value={node.element.getAttribute('data-name') ?? ''} />
          <KeyValue label="节点标签" value={node.tagName} />
          <KeyValue label="子节点数" value={String(node.children.length)} />
          <KeyValue label="界面模式" value={data.viewMode ?? (node.component === 'UIRootPanel' ? '未声明（使用工具配置）' : '')} />
        </div>
      </InspectorSection>

      {editMode ? (
        node.editable ? (
          <>
            <InspectorSection title="锚点与精确布局">
              <AnchorLayoutEditor
                nodeKey={node.key}
                element={node.element}
                onPreviewChanges={(changes) => onPreviewChanges(node.element, changes)}
                onCommitChanges={(changes) => onCommitChanges(node.element, changes)}
              />
            </InspectorSection>
            <InspectorSection title="旋转与缩放">
              <EditorFields node={node} definitions={layoutFields} onPreview={onPreview} onCommit={onCommit} />
            </InspectorSection>
            <InspectorSection title="视觉与状态">
              <EditorFields node={node} definitions={visualFields} onPreview={onPreview} onCommit={onCommit} />
            </InspectorSection>
            <InspectorSection title="绑定">
              <EditorFields node={node} definitions={bindingFields} onPreview={onPreview} onCommit={onCommit} />
            </InspectorSection>
            <InspectorSection title="布局组">
              <EditorFields node={node} definitions={groupFields} onPreview={onPreview} onCommit={onCommit} />
            </InspectorSection>
          </>
        ) : (
          <div className="unity-inspector-warning">
            当前节点缺少唯一的静态 data-name，因此只能检查，不能安全写回 TSX。
          </div>
        )
      ) : (
        <>
          <InspectorSection title="RectTransform">
            <div className="unity-inspector-kv-grid">
              <KeyValue label="Anchors" value={formatVector(node.anchors)} />
              <KeyValue label="Anchor Min" value={formatVector(node.anchorMin)} />
              <KeyValue label="Anchor Max" value={formatVector(node.anchorMax)} />
              <KeyValue label="Pivot" value={formatVector(node.pivot)} />
              <KeyValue label="Anchored Position" value={formatVector(node.position)} />
              <KeyValue label="Size Delta" value={formatVector(node.size)} />
              <KeyValue label="转换后尺寸" value={formatVector(node.previewSize)} />
              <KeyValue label="布局模式" value={data.layoutMode ?? 'Responsive（默认）'} />
              <KeyValue label="可见性" value={data.visible ?? 'true（默认）'} />
              <KeyValue label="透明度" value={data.alpha ?? '1（默认）'} />
            </div>
          </InspectorSection>

          <InspectorSection title="视觉与绑定">
            <div className="unity-inspector-kv-grid">
              <KeyValue label="Sprite" value={data.sprite ?? ''} />
              <KeyValue label="文本" value={declaredText} />
              <KeyValue label="字号" value={data.fontSize ?? ''} />
              <KeyValue label="颜色" value={data.color ?? ''} />
              <KeyValue label="绑定键" value={data.bind ?? ''} />
              <KeyValue label="绑定类型" value={data.bindType ?? (data.bind ? '自动识别' : '')} />
              <KeyValue label="自定义绑定类型" value={data.bindCustomType ?? ''} />
            </div>
          </InspectorSection>

          <InspectorSection title="布局与 Prefab">
            <div className="unity-inspector-kv-grid">
              <KeyValue label="布局组" value={data.layoutGroup ?? ''} />
              <KeyValue label="布局间距" value={data.layoutSpacing ?? ''} />
              <KeyValue label="单元尺寸" value={data.layoutCellSize ?? ''} />
              <KeyValue label="约束" value={data.layoutConstraint ?? ''} />
              <KeyValue label="约束数量" value={data.layoutConstraintCount ?? ''} />
              <KeyValue label="滚动方向" value={data.scrollDirection ?? ''} />
              <KeyValue label="Prefab 子路径" value={data.prefabChildPath ?? ''} />
            </div>
          </InspectorSection>
        </>
      )}
    </div>
  )
}

function buildSourcePatches(history: EditOperation[], cursor: number): SourceNodePatch[] {
  const attributes = new Map<string, { nodeName: string; attribute: string; before: AttributeValue; after: AttributeValue }>()
  for (let index = 0; index < cursor; index++) {
    const operation = history[index]
    operation.changes.forEach((change) => {
      const key = `${change.nodeName}\u0000${change.attribute}`
      const current = attributes.get(key)
      if (current) current.after = change.after
      else attributes.set(key, { ...change })
    })
  }

  const nodes = new Map<string, Record<string, AttributeValue>>()
  attributes.forEach((entry) => {
    if (entry.before === entry.after) return
    const changes = nodes.get(entry.nodeName) ?? {}
    changes[entry.attribute] = entry.after
    nodes.set(entry.nodeName, changes)
  })
  return Array.from(nodes, ([nodeName, changes]) => ({ nodeName, changes }))
}

export function UnityInspectorPanel({
  canvas,
  pageName,
  pagePath,
  refreshKey,
  interactionDisabled,
  onRequestLayout,
  onDirtyChange,
}: UnityInspectorPanelProps): ReactNode {
  const hierarchy = useMemo(
    () => (canvas ? readHierarchy(canvas) : emptyHierarchy),
    [canvas, refreshKey],
  )
  const [selectedKey, setSelectedKey] = useState('')
  const [collapsedKeys, setCollapsedKeys] = useState<Set<string>>(new Set())
  const [editMode, setEditMode] = useState(false)
  const [version, setVersion] = useState('')
  const [serviceState, setServiceState] = useState<'loading' | 'ready' | 'saving' | 'unavailable'>('loading')
  const [message, setMessage] = useState('正在连接本地编辑服务…')
  const [history, setHistory] = useState<EditOperation[]>([])
  const [historyCursor, setHistoryCursor] = useState(0)
  const selectedNode = hierarchy.flat.find((node) => node.key === selectedKey)
  const patches = useMemo(() => buildSourcePatches(history, historyCursor), [history, historyCursor])
  const dirty = patches.length > 0

  useEffect(() => {
    setSelectedKey((current) => (
      hierarchy.flat.some((node) => node.key === current)
        ? current
        : hierarchy.flat[0]?.key ?? ''
    ))
  }, [hierarchy])

  useEffect(() => {
    setCollapsedKeys(new Set())
    setHistory([])
    setHistoryCursor(0)
    setEditMode(false)
    setServiceState('loading')
    setMessage('正在连接本地编辑服务…')
    let active = true
    if (!pagePath) {
      setServiceState('unavailable')
      setMessage('当前没有可编辑页面。')
      return () => { active = false }
    }

    loadSourceVersion(pagePath)
      .then((nextVersion) => {
        if (!active) return
        setVersion(nextVersion)
        setServiceState('ready')
        setMessage('源码已连接；修改只会在点击保存后写入 TSX。')
      })
      .catch((error: unknown) => {
        if (!active) return
        setServiceState('unavailable')
        setMessage(error instanceof Error ? error.message : '本地编辑服务不可用。')
      })
    return () => { active = false }
  }, [pagePath])

  useEffect(() => {
    onDirtyChange(dirty)
    return () => onDirtyChange(false)
  }, [dirty, onDirtyChange])

  useEffect(() => {
    if (!dirty) return
    const warnBeforeUnload = (event: BeforeUnloadEvent) => {
      event.preventDefault()
      event.returnValue = ''
    }
    window.addEventListener('beforeunload', warnBeforeUnload)
    return () => window.removeEventListener('beforeunload', warnBeforeUnload)
  }, [dirty])

  useEffect(() => {
    if (!canvas) return
    canvas.querySelectorAll<HTMLElement>('[data-inspector-selected="true"]').forEach((element) => {
      delete element.dataset.inspectorSelected
    })
    if (selectedNode) selectedNode.element.dataset.inspectorSelected = 'true'

    return () => {
      canvas.querySelectorAll<HTMLElement>('[data-inspector-selected="true"]').forEach((element) => {
        delete element.dataset.inspectorSelected
      })
    }
  }, [canvas, selectedNode])

  function toggleCollapse(key: string): void {
    setCollapsedKeys((current) => {
      const next = new Set(current)
      if (next.has(key)) next.delete(key)
      else next.add(key)
      return next
    })
  }

  function previewAttribute(node: UnityNodeInfo, attribute: string, value: AttributeValue): void {
    applyElementAttribute(node.element, attribute, value)
    onRequestLayout(false)
  }

  function previewCanvasChanges(element: HTMLElement, changes: CanvasAttributeChange[]): void {
    changes.forEach((change) => applyElementAttribute(element, change.attribute, change.after))
    onRequestLayout(false)
  }

  function commitCanvasChanges(element: HTMLElement, changes: CanvasAttributeChange[]): void {
    const effectiveChanges = changes.filter((change) => change.before !== change.after)
    if (effectiveChanges.length === 0) {
      onRequestLayout(true)
      return
    }

    const nodeName = element.getAttribute('data-name')
    const node = hierarchy.flat.find((item) => item.element === element)
    if (!nodeName || !node?.editable) {
      effectiveChanges.forEach((change) => applyElementAttribute(element, change.attribute, change.before))
      onRequestLayout(true)
      setMessage('节点缺少唯一 data-name，已取消本次修改。')
      return
    }

    const operation: EditOperation = {
      changes: effectiveChanges.map((change) => ({ nodeName, ...change })),
    }
    setHistory((current) => [...current.slice(0, historyCursor), operation])
    setHistoryCursor((current) => current + 1)
    onRequestLayout(true)
    setMessage('存在未保存修改。')
  }

  function commitAttribute(
    node: UnityNodeInfo,
    attribute: string,
    before: AttributeValue,
    after: AttributeValue,
  ): void {
    commitCanvasChanges(node.element, [{ attribute, before, after }])
  }

  function applyHistoryOperation(operation: EditOperation, useAfter: boolean): boolean {
    for (const change of operation.changes) {
      const node = hierarchy.flat.find((item) => item.element.getAttribute('data-name') === change.nodeName)
      if (!node) {
        setMessage(`找不到节点 ${change.nodeName}，无法继续撤销或重做。`)
        return false
      }
      applyElementAttribute(node.element, change.attribute, useAfter ? change.after : change.before)
    }
    onRequestLayout(true)
    return true
  }

  function undo(): void {
    if (historyCursor <= 0) return
    const operation = history[historyCursor - 1]
    if (applyHistoryOperation(operation, false)) setHistoryCursor(historyCursor - 1)
  }

  function redo(): void {
    if (historyCursor >= history.length) return
    const operation = history[historyCursor]
    if (applyHistoryOperation(operation, true)) setHistoryCursor(historyCursor + 1)
  }

  function discard(): void {
    for (let index = historyCursor - 1; index >= 0; index--) {
      if (!applyHistoryOperation(history[index], false)) return
    }
    setHistory([])
    setHistoryCursor(0)
    setMessage('已放弃当前页面的未保存修改。')
  }

  async function save(): Promise<void> {
    if (!dirty || serviceState !== 'ready') return
    setServiceState('saving')
    setMessage('正在写回 TSX…')
    try {
      const result = await saveSourcePatches(pagePath, version, patches)
      setVersion(result.version)
      setHistory([])
      setHistoryCursor(0)
      setServiceState('ready')
      setMessage(result.changed ? 'TSX 已保存；请回到 Unity 重新生成 Prefab。' : '源码内容没有变化。')
    } catch (error) {
      setServiceState(error instanceof SourceEditorError && error.code === 'SOURCE_CHANGED' ? 'unavailable' : 'ready')
      setMessage(error instanceof Error ? error.message : '保存 TSX 失败。')
    }
  }

  useEffect(() => {
    const handleEditorShortcut = (event: KeyboardEvent) => {
      if (!editMode || !(event.ctrlKey || event.metaKey)) return
      const target = event.target
      if (target instanceof HTMLInputElement || target instanceof HTMLSelectElement || target instanceof HTMLTextAreaElement)
        return
      if (target instanceof HTMLElement && target.isContentEditable) return

      if (event.key.toLowerCase() === 'z') {
        if (event.shiftKey) redo()
        else undo()
        event.preventDefault()
      } else if (event.key.toLowerCase() === 'y') {
        redo()
        event.preventDefault()
      } else if (event.key.toLowerCase() === 's') {
        void save()
        event.preventDefault()
      }
    }

    window.addEventListener('keydown', handleEditorShortcut)
    return () => window.removeEventListener('keydown', handleEditorShortcut)
  })

  return (
    <>
      <UnityCanvasEditor
        canvas={canvas}
        selectedElement={selectedNode?.element ?? null}
        editMode={editMode}
        interactionDisabled={interactionDisabled}
        refreshKey={refreshKey}
        onSelectElement={(element) => {
          const node = hierarchy.flat.find((item) => item.element === element)
          if (node) setSelectedKey(node.key)
        }}
        onPreviewChanges={previewCanvasChanges}
        onCommitChanges={commitCanvasChanges}
        onMessage={setMessage}
      />
      <aside className="unity-inspector" aria-label="Unity UI 设计、层级与源码编辑">
        <header className="unity-inspector-header">
          <div>
            <strong>UI 设计与检查</strong>
            <span>{pageName}</span>
          </div>
          <code>{hierarchy.flat.length} 节点</code>
        </header>
        <div className="unity-editor-toolbar">
          <button
            type="button"
            className={editMode ? 'is-active' : ''}
            disabled={serviceState === 'loading' || serviceState === 'unavailable'}
            onClick={() => setEditMode((current) => !current)}
          >
            {editMode ? '退出画布编辑' : '开启画布编辑'}
          </button>
          <button type="button" disabled={!editMode || historyCursor <= 0} onClick={undo}>撤销</button>
          <button type="button" disabled={!editMode || historyCursor >= history.length} onClick={redo}>重做</button>
          <button type="button" disabled={!editMode || !dirty || serviceState === 'saving'} onClick={discard}>放弃</button>
          <button
            type="button"
            className="is-primary"
            disabled={!editMode || !dirty || serviceState !== 'ready'}
            onClick={() => void save()}
          >
            {serviceState === 'saving' ? '保存中…' : '保存 TSX'}
          </button>
        </div>
        {editMode && (
          <div className="unity-canvas-help">
            拖动节点、尺寸、黄色锚点或粉色 Pivot · 方向键微调 · Shift ×10 · Alt 暂停吸附 · Ctrl+S 保存
          </div>
        )}
        <div className={'unity-editor-status ' + (dirty ? 'is-dirty' : '')}>{message}</div>
        {hierarchy.flat.length === 0 ? (
          <div className="unity-inspector-empty">
            <strong>暂无可检查的 UI</strong>
            <p>请在 UIReact/Generated 下添加带 data-component 的静态 TSX 页面。</p>
          </div>
        ) : (
          <div className="unity-inspector-content">
            <section className="unity-inspector-hierarchy" aria-label="Unity UI 层级">
              <div className="unity-inspector-subtitle">层级</div>
              <div className="unity-tree">
                {hierarchy.roots.map((root) => (
                  <HierarchyNode
                    key={root.key}
                    node={root}
                    selectedKey={selectedKey}
                    collapsedKeys={collapsedKeys}
                    onSelect={setSelectedKey}
                    onToggle={toggleCollapse}
                  />
                ))}
              </div>
            </section>
            <section className="unity-inspector-properties" aria-label="Unity UI 节点信息">
              <div className="unity-inspector-subtitle">{editMode ? '精确调整' : '节点信息'}</div>
              <InspectorDetail
                node={selectedNode}
                editMode={editMode}
                onPreview={previewAttribute}
                onCommit={commitAttribute}
                onPreviewChanges={previewCanvasChanges}
                onCommitChanges={commitCanvasChanges}
              />
            </section>
          </div>
        )}
      </aside>
    </>
  )
}
