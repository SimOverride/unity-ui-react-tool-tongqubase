import React, { useLayoutEffect, useMemo, useRef, useState } from 'react'
import ReactDOM from 'react-dom/client'
import { applyUnityLayout } from './unity-layout'
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
  const [previewScale, setPreviewScale] = useState(0.5)
  const hostRef = useRef<HTMLDivElement>(null)
  const SelectedComponent = selectedPath ? componentModules[selectedPath]?.default : null
  const resolution = resolutions[resolutionIndex]

  // UIManager 的主画布按高度匹配 750×1680；不同竖屏只改变逻辑画布宽度。
  const canvasWidthReference = 750
  const canvasHeight = 1680
  const canvasWidth = resolution.width / (resolution.height / canvasHeight)

  useLayoutEffect(() => {
    const host = hostRef.current
    if (!host) return

    const refresh = () => {
      const availableWidth = Math.max(240, host.clientWidth - 48)
      const availableHeight = Math.max(320, host.clientHeight - 48)
      setPreviewScale(Math.min(availableWidth / canvasWidth, availableHeight / canvasHeight))
      const canvas = host.querySelector<HTMLElement>('.preview-canvas')
      if (canvas) applyUnityLayout(canvas, {
        canvasWidth,
        canvasHeight,
        referenceWidth: canvasWidthReference,
        referenceHeight: canvasHeight,
      })
    }

    refresh()
    const observer = new ResizeObserver(refresh)
    observer.observe(host)
    return () => observer.disconnect()
  }, [canvasHeight, canvasWidth, selectedPath])

  return (
    <div className="preview-app">
      <header className="preview-toolbar">
        <strong>Unity UI React 预览</strong>
        <label>
          界面
          <select value={selectedPath} onChange={(event) => setSelectedPath(event.target.value)}>
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
        <span>逻辑画布 {Math.round(canvasWidth)} × {canvasHeight} · {Math.round(previewScale * 100)}%</span>
      </header>
      <main className="preview-host" ref={hostRef}>
        {SelectedComponent ? (
          <div
            className="preview-scale"
            style={{
              width: canvasWidth,
              height: canvasHeight,
              marginLeft: -canvasWidth / 2,
              marginTop: -canvasHeight / 2,
              transform: `scale(${previewScale})`,
            }}
          >
            <div className="preview-canvas" style={{ width: canvasWidth, height: canvasHeight }}>
              <SelectedComponent />
            </div>
          </div>
        ) : (
          <p className="preview-empty">请在 Generated 目录中添加静态 TSX UI。</p>
        )}
      </main>
    </div>
  )
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)
