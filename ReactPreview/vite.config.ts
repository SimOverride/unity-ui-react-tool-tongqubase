import { createReadStream, existsSync, readFileSync, readdirSync } from 'node:fs'
import { extname, relative, resolve, sep } from 'node:path'
import { defineConfig, loadEnv, type Plugin } from 'vite'
import react from '@vitejs/plugin-react'

const generatedRoot = resolve(__dirname, 'Generated')

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

export default defineConfig(({ mode }) => {
  const unityProjectRoot = resolveUnityProjectRoot(mode)
  return {
    plugins: [react(), unityAssetsPlugin(resolve(unityProjectRoot, 'Assets'))],
  }
})
