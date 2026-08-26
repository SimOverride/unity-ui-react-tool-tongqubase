import React, {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
  type WheelEvent as ReactWheelEvent,
} from 'react'
import ReactDOM from 'react-dom/client'
import { applyUnityLayout } from './unity-layout'
import { UnityInspectorPanel } from './unity-inspector'
import './preview.css'

const componentModules = import.meta.glob<{ default: React.ComponentType }>(
  '../Generated/**/*.tsx',
  { eager: true },
)
import.meta.glob('../Generated/**/*.css', { eager: true })

const resolutions = [
  { name: '设计基准', width: 750, height: 1680 },
  { name: '窄屏测试', width: 720, height: 1600 },
  { name: '宽屏测试', width: 828, height: 1792 },
  { name: '手机逻辑像素', width: 390, height: 844 },
]

function displayName(path: string): string {
  return path.split('/').pop()?.replace(/\.tsx$/, '') ?? path
}

// 当前验收范围只展示主菜单；通过环境变量可以为其他项目显式指定预览页面。
const configuredPreviewNames = (import.meta.env.VITE_UIREACT_PREVIEW_PAGES ?? '')
  .split(',')
  .map((name: string) => name.trim())
  .filter(Boolean)
const defaultPreviewNames = ['GameMenu']

function App() {
  const entries = useMemo(() => {
    const allEntries = Object.entries(componentModules)
    const previewNames = configuredPreviewNames.length > 0
      ? configuredPreviewNames
      : defaultPreviewNames
    const filteredEntries = allEntries.filter(([path]) => previewNames.includes(displayName(path)))

    // 配置页面名不存在时保留全部模板，避免迁移到新项目后预览区域为空。
    return filteredEntries.length > 0 ? filteredEntries : allEntries
  }, [])
  const [selectedPath, setSelectedPath] = useState(entries[0]?.[0] ?? '')
  const [resolutionIndex, setResolutionIndex] = useState(0)
  const [fitScale, setFitScale] = useState(0.5)
  const [zoom, setZoom] = useState(1)
  const [pan, setPan] = useState({ x: 0, y: 0 })
  const [spacePressed, setSpacePressed] = useState(false)
  const [panning, setPanning] = useState(false)
  const [hasUnsavedEdits, setHasUnsavedEdits] = useState(false)
  // 布局完成后递增版本号，让检查面板重新读取转换后的 DOM 尺寸。
  const [layoutVersion, setLayoutVersion] = useState(0)
  const hostRef = useRef<HTMLDivElement>(null)
  const spacePressedRef = useRef(false)
  const panInteractionRef = useRef<{
    pointerId: number
    clientX: number
    clientY: number
    panX: number
    panY: number
  } | null>(null)
  const [canvasElement, setCanvasElement] = useState<HTMLDivElement | null>(null)
  const SelectedComponent = selectedPath ? componentModules[selectedPath]?.default : null
  const resolution = resolutions[resolutionIndex]
  const setCanvasRef = useCallback((element: HTMLDivElement | null) => {
    setCanvasElement(element)
  }, [])

  // UIManager 的主画布按高度匹配 750×1680；不同竖屏只改变逻辑画布宽度。
  const canvasWidthReference = 750
  const canvasHeight = 1680
  const canvasWidth = resolution.width / (resolution.height / canvasHeight)
  const previewScale = fitScale * zoom

  const applyLayout = useCallback((refreshInspector = true) => {
    const canvas = canvasElement
    if (!canvas) return
    applyUnityLayout(canvas, {
      canvasWidth,
      canvasHeight,
      referenceWidth: canvasWidthReference,
      referenceHeight: canvasHeight,
    })
    if (refreshInspector) setLayoutVersion((version) => version + 1)
  }, [canvasElement, canvasHeight, canvasWidth])

  const fitPreview = useCallback(() => {
    const host = hostRef.current
    if (!host || !canvasElement) return
    const availableWidth = Math.max(240, host.clientWidth - 48)
    const availableHeight = Math.max(320, host.clientHeight - 48)
    setFitScale(Math.min(availableWidth / canvasWidth, availableHeight / canvasHeight))
    applyLayout(true)
  }, [applyLayout, canvasElement, canvasHeight, canvasWidth])

  const changePage = useCallback((nextPath: string) => {
    if (hasUnsavedEdits && !window.confirm('当前页面存在未保存的 TSX 修改，确定要放弃并切换页面吗？'))
      return
    setSelectedPath(nextPath)
    setHasUnsavedEdits(false)
  }, [hasUnsavedEdits])

  const updateDirtyState = useCallback((dirty: boolean) => {
    setHasUnsavedEdits(dirty)
  }, [])

  const zoomAt = useCallback((clientX: number, clientY: number, nextZoom: number) => {
    const host = hostRef.current
    if (!host) return
    const clampedZoom = Math.min(4, Math.max(0.25, nextZoom))
    if (Math.abs(clampedZoom - zoom) < 0.0001) return

    const hostRect = host.getBoundingClientRect()
    const pointerX = clientX - (hostRect.left + hostRect.width / 2)
    const pointerY = clientY - (hostRect.top + hostRect.height / 2)
    const currentScale = fitScale * zoom
    const nextScale = fitScale * clampedZoom
    setPan((current) => {
      const localX = (pointerX - current.x) / currentScale
      const localY = (pointerY - current.y) / currentScale
      return {
        x: pointerX - localX * nextScale,
        y: pointerY - localY * nextScale,
      }
    })
    setZoom(clampedZoom)
  }, [fitScale, zoom])

  const changeZoomFromCenter = useCallback((factor: number) => {
    const host = hostRef.current
    if (!host) return
    const rect = host.getBoundingClientRect()
    zoomAt(rect.left + rect.width / 2, rect.top + rect.height / 2, zoom * factor)
  }, [zoom, zoomAt])

  const beginPan = useCallback((event: ReactPointerEvent<HTMLElement>) => {
    if (event.button !== 1 && !spacePressedRef.current) return
    panInteractionRef.current = {
      pointerId: event.pointerId,
      clientX: event.clientX,
      clientY: event.clientY,
      panX: pan.x,
      panY: pan.y,
    }
    event.currentTarget.setPointerCapture(event.pointerId)
    setPanning(true)
    event.preventDefault()
    event.stopPropagation()
  }, [pan])

  const updatePan = useCallback((event: ReactPointerEvent<HTMLElement>) => {
    const interaction = panInteractionRef.current
    if (!interaction || interaction.pointerId !== event.pointerId) return
    setPan({
      x: interaction.panX + event.clientX - interaction.clientX,
      y: interaction.panY + event.clientY - interaction.clientY,
    })
    event.preventDefault()
  }, [])

  const endPan = useCallback((event: ReactPointerEvent<HTMLElement>) => {
    const interaction = panInteractionRef.current
    if (!interaction || interaction.pointerId !== event.pointerId) return
    panInteractionRef.current = null
    setPanning(false)
    if (event.currentTarget.hasPointerCapture(event.pointerId))
      event.currentTarget.releasePointerCapture(event.pointerId)
    event.preventDefault()
  }, [])

  const handleWheel = useCallback((event: ReactWheelEvent<HTMLElement>) => {
    event.preventDefault()
    const factor = event.deltaY < 0 ? 1.12 : 1 / 1.12
    zoomAt(event.clientX, event.clientY, zoom * factor)
  }, [zoom, zoomAt])

  useEffect(() => {
    const keyDown = (event: KeyboardEvent) => {
      if (event.code !== 'Space') return
      const target = event.target
      if (target instanceof HTMLInputElement || target instanceof HTMLSelectElement || target instanceof HTMLTextAreaElement)
        return
      if (target instanceof HTMLElement && target.isContentEditable) return
      spacePressedRef.current = true
      setSpacePressed(true)
      event.preventDefault()
    }
    const keyUp = (event: KeyboardEvent) => {
      if (event.code !== 'Space') return
      spacePressedRef.current = false
      setSpacePressed(false)
    }
    const resetSpace = () => {
      spacePressedRef.current = false
      setSpacePressed(false)
    }
    window.addEventListener('keydown', keyDown)
    window.addEventListener('keyup', keyUp)
    window.addEventListener('blur', resetSpace)
    return () => {
      window.removeEventListener('keydown', keyDown)
      window.removeEventListener('keyup', keyUp)
      window.removeEventListener('blur', resetSpace)
    }
  }, [])

  useEffect(() => {
    setZoom(1)
    setPan({ x: 0, y: 0 })
  }, [resolutionIndex, selectedPath])

  useLayoutEffect(() => {
    const host = hostRef.current
    if (!host || !canvasElement) return

    fitPreview()
    const observer = new ResizeObserver(fitPreview)
    observer.observe(host)
    return () => observer.disconnect()
  }, [canvasElement, fitPreview, selectedPath])

  return (
    <div className="preview-app">
      <header className="preview-toolbar">
        <strong>Unity UI React 预览</strong>
        <label>
          界面
          <select value={selectedPath} onChange={(event) => changePage(event.target.value)}>
            {entries.map(([path]) => (
              <option key={path} value={path}>{displayName(path)}</option>
            ))}
          </select>
        </label>
        <label>
          分辨率
          <select value={resolutionIndex} onChange={(event) => setResolutionIndex(Number(event.target.value))}>
            {resolutions.map((item, index) => (
              <option key={item.name} value={index}>{item.name} · {item.width} × {item.height}</option>
            ))}
          </select>
        </label>
        <div className="preview-zoom-toolbar" aria-label="画布缩放">
          <button type="button" onClick={() => changeZoomFromCenter(1 / 1.2)} aria-label="缩小画布">−</button>
          <button
            type="button"
            onClick={() => {
              setZoom(1)
              setPan({ x: 0, y: 0 })
            }}
          >
            适应
          </button>
          <button type="button" onClick={() => changeZoomFromCenter(1.2)} aria-label="放大画布">＋</button>
        </div>
        <span>逻辑画布 {Math.round(canvasWidth)} × {canvasHeight} · {Math.round(previewScale * 100)}%</span>
      </header>
      <main className="preview-main">
        <section
          className={'preview-host ' + (panning ? 'is-panning' : spacePressed ? 'is-pan-ready' : '')}
          ref={hostRef}
          onPointerDownCapture={beginPan}
          onPointerMove={updatePan}
          onPointerUp={endPan}
          onPointerCancel={endPan}
          onWheel={handleWheel}
        >
        {SelectedComponent ? (
          <div
            className="preview-scale"
            style={{
              width: canvasWidth,
              height: canvasHeight,
              marginLeft: -canvasWidth / 2,
              marginTop: -canvasHeight / 2,
              transform: `translate(${pan.x}px, ${pan.y}px) scale(${previewScale})`,
              '--preview-scale': previewScale,
              '--preview-inverse-scale': 1 / previewScale,
            } as React.CSSProperties}
          >
            <div ref={setCanvasRef} className="preview-canvas" style={{ width: canvasWidth, height: canvasHeight }}>
              <SelectedComponent />
            </div>
          </div>
        ) : (
          <p className="preview-empty">请在 Generated 目录中添加静态 TSX UI。</p>
        )}
        </section>
        <UnityInspectorPanel
          canvas={canvasElement}
          pageName={selectedPath ? displayName(selectedPath) : '无页面'}
          pagePath={selectedPath}
          refreshKey={layoutVersion}
          interactionDisabled={panning || spacePressed}
          onRequestLayout={applyLayout}
          onDirtyChange={updateDirtyState}
        />
      </main>
    </div>
  )
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)
