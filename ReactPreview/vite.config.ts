import { randomUUID } from 'node:crypto'
import { createReadStream, existsSync, readFileSync, readdirSync, renameSync, unlinkSync, writeFileSync } from 'node:fs'
import { extname, relative, resolve, sep } from 'node:path'
import { defineConfig, loadEnv, type Plugin } from 'vite'
import react from '@vitejs/plugin-react'
import { applySourcePatches, SourceEditError, sourceVersion } from './editor-server/source-editor.mjs'

const generatedRoot = resolve(__dirname, 'Generated')
const templateMarkerPath = resolve(__dirname, '.uirect-template.json')
const templateMarkerContent = '{"template":"UIReactTool.ReactPreview","schemaVersion":1}'

// 资源目录必须由目标 Unity 项目显式提供，不能使用模板仓库的回退路径。
function resolveUnityProjectRoot(mode: string): string {
  const fileEnv = loadEnv(mode, process.cwd(), '')
  const configuredPath = process.env.UNITY_PROJECT_PATH?.trim() || fileEnv.UNITY_PROJECT_PATH?.trim()
  if (!configuredPath) {
    throw new Error(
      '[UI React] 未配置 UNITY_PROJECT_PATH。请先使用 Unity 菜单“初始化 ReactPreview 模板”，或在目标 React 工程的 .env.local 中设置当前 Unity 项目根目录。',
    )
  }

  const unityProjectRoot = resolve(configuredPath)
  const unityAssetsRoot = resolve(unityProjectRoot, 'Assets')
  if (!existsSync(unityProjectRoot) || !existsSync(unityAssetsRoot)) {
    throw new Error(
      `[UI React] UNITY_PROJECT_PATH 无效：${unityProjectRoot}。该目录必须是当前 Unity 项目根目录，并且包含 Assets。`,
    )
  }

  return unityProjectRoot
}

function collectTsxFiles(directory: string): string[] {
  if (!existsSync(directory)) return []
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = resolve(directory, entry.name)
    if (entry.isDirectory()) return collectTsxFiles(path)
    return entry.isFile() && entry.name.endsWith('.tsx') ? [path] : []
  })
}

function collectSpritePaths(): string[] {
  const paths = new Set<string>()
  const pattern = /data-sprite\s*=\s*["'](Assets\/[^"']+)["']/g
  collectTsxFiles(generatedRoot).forEach((file) => {
    const source = readFileSync(file, 'utf8')
    for (const match of source.matchAll(pattern)) paths.add(match[1])
  })
  return [...paths]
}

function contentType(path: string): string {
  switch (extname(path).toLowerCase()) {
    case '.png': return 'image/png'
    case '.jpg':
    case '.jpeg': return 'image/jpeg'
    case '.webp': return 'image/webp'
    default: return 'application/octet-stream'
  }
}

function unityAssetsPlugin(unityAssetsRoot: string): Plugin {
  let isBuild = false
  return {
    name: 'unity-assets',
    configResolved(config) {
      isBuild = config.command === 'build'
    },
    configureServer(server) {
      server.middlewares.use('/unity-assets', (request, response, next) => {
        const requestPath = decodeURIComponent((request.url ?? '').split('?')[0]).replace(/^\/+/, '')
        const assetPath = resolve(unityAssetsRoot, requestPath)
        const relativePath = relative(unityAssetsRoot, assetPath)
        if (relativePath.startsWith('..' + sep) || !existsSync(assetPath)) return next()
        response.setHeader('Content-Type', contentType(assetPath))
        createReadStream(assetPath).pipe(response)
      })
    },
    buildStart() {
      if (!isBuild) return
      // 构建产物只复制 TSX 实际引用的 Unity 图片，避免打包整个项目 Assets。
      collectSpritePaths().forEach((spritePath) => {
        const relativePath = spritePath.replace(/^Assets\//, '')
        const assetPath = resolve(unityAssetsRoot, relativePath)
        if (!existsSync(assetPath)) this.error(`未找到 Unity 图片资源：${spritePath}`)
        this.emitFile({
          type: 'asset',
          fileName: `unity-assets/${relativePath.replace(/\\/g, '/')}`,
          source: readFileSync(assetPath),
        })
      })
    },
  }
}

function writeJson(response: import('node:http').ServerResponse, statusCode: number, body: object): void {
  response.statusCode = statusCode
  response.setHeader('Content-Type', 'application/json; charset=utf-8')
  response.end(JSON.stringify(body))
}

function requireInitializedTemplate(): void {
  if (!existsSync(templateMarkerPath) || readFileSync(templateMarkerPath, 'utf8').trim() !== templateMarkerContent) {
    throw new SourceEditError(
      'TEMPLATE_NOT_INITIALIZED',
      '当前 React 工程不是由 UI React 工具初始化的可写模板，检查面板将保持只读。',
    )
  }
}

function resolveEditablePage(pagePath: unknown): string {
  if (typeof pagePath !== 'string' || !pagePath.trim())
    throw new SourceEditError('INVALID_PAGE', '缺少需要编辑的 TSX 页面路径。')

  const normalized = pagePath.replace(/\\/g, '/')
  const generatedIndex = normalized.indexOf('Generated/')
  if (generatedIndex < 0)
    throw new SourceEditError('INVALID_PAGE', '只能编辑 Generated 目录中的 TSX 页面。')

  const relativePagePath = normalized.slice(generatedIndex + 'Generated/'.length)
  const targetPath = resolve(generatedRoot, relativePagePath)
  const relativePath = relative(generatedRoot, targetPath)
  if (!relativePath || relativePath.startsWith('..' + sep) || relativePath === '..' || extname(targetPath).toLowerCase() !== '.tsx')
    throw new SourceEditError('INVALID_PAGE', '页面路径超出 Generated 目录或不是 TSX 文件。')
  if (!existsSync(targetPath))
    throw new SourceEditError('PAGE_NOT_FOUND', `找不到需要编辑的页面：${relativePagePath}`)
  return targetPath
}

async function readJsonBody(request: import('node:http').IncomingMessage): Promise<unknown> {
  const chunks: Buffer[] = []
  let byteLength = 0
  for await (const chunk of request) {
    const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk)
    byteLength += buffer.length
    if (byteLength > 256 * 1024)
      throw new SourceEditError('REQUEST_TOO_LARGE', '保存请求过大。')
    chunks.push(buffer)
  }

  try {
    return JSON.parse(Buffer.concat(chunks).toString('utf8'))
  } catch {
    throw new SourceEditError('INVALID_JSON', '保存请求不是有效 JSON。')
  }
}

function errorStatus(error: unknown): number {
  if (error instanceof SourceEditError && error.code === 'SOURCE_CHANGED') return 409
  if (error instanceof SourceEditError && error.code === 'TEMPLATE_NOT_INITIALIZED') return 403
  if (error instanceof SourceEditError && error.code === 'PAGE_NOT_FOUND') return 404
  return 400
}

function sourceEditorPlugin(): Plugin {
  return {
    name: 'unity-react-source-editor',
    configureServer(server) {
      server.middlewares.use(async (request, response, next) => {
        const requestUrl = new URL(request.url ?? '/', 'http://127.0.0.1')
        if (requestUrl.pathname !== '/__uirect/editor/page' && requestUrl.pathname !== '/__uirect/editor/save') {
          next()
          return
        }

        try {
          requireInitializedTemplate()
          if (requestUrl.pathname === '/__uirect/editor/page') {
            if (request.method !== 'GET')
              throw new SourceEditError('INVALID_METHOD', '页面版本接口只接受 GET 请求。')
            const pagePath = resolveEditablePage(requestUrl.searchParams.get('path'))
            const source = readFileSync(pagePath, 'utf8')
            writeJson(response, 200, { version: sourceVersion(source) })
            return
          }

          if (request.method !== 'POST')
            throw new SourceEditError('INVALID_METHOD', '源码保存接口只接受 POST 请求。')
          const body = await readJsonBody(request) as {
            pagePath?: unknown
            expectedVersion?: unknown
            patches?: unknown
          }
          const pagePath = resolveEditablePage(body.pagePath)
          const source = readFileSync(pagePath, 'utf8')
          if (typeof body.expectedVersion !== 'string' || sourceVersion(source) !== body.expectedVersion) {
            throw new SourceEditError(
              'SOURCE_CHANGED',
              'TSX 已被 IDE、Agent 或其他预览窗口修改。请放弃当前草稿并重新加载页面。',
            )
          }

          const nextSource = applySourcePatches(source, body.patches)
          const changed = nextSource !== source
          if (changed) {
            // 先写入同目录临时文件再替换，避免 Vite 或 Unity 读取到半截源码。
            const temporaryPath = `${pagePath}.uirect-${randomUUID()}.tmp`
            try {
              writeFileSync(temporaryPath, nextSource, 'utf8')
              renameSync(temporaryPath, pagePath)
            } finally {
              if (existsSync(temporaryPath)) unlinkSync(temporaryPath)
            }
          }

          writeJson(response, 200, { changed, version: sourceVersion(nextSource) })
        } catch (error) {
          const message = error instanceof Error ? error.message : '未知的 TSX 写回错误。'
          const code = error instanceof SourceEditError ? error.code : 'SOURCE_EDIT_FAILED'
          writeJson(response, errorStatus(error), { code, message })
        }
      })
    },
  }
}

export default defineConfig(({ mode }) => {
  const unityProjectRoot = resolveUnityProjectRoot(mode)
  return {
    plugins: [react(), unityAssetsPlugin(resolve(unityProjectRoot, 'Assets')), sourceEditorPlugin()],
  }
})
