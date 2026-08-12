import { createReadStream, existsSync, readFileSync, readdirSync } from 'node:fs'
import { extname, relative, resolve, sep } from 'node:path'
import { defineConfig, type Plugin } from 'vite'
import react from '@vitejs/plugin-react'

const unityProjectRoot = resolve(process.env.UNITY_PROJECT_PATH ?? resolve(__dirname, '../Tools'))
const unityAssetsRoot = resolve(unityProjectRoot, 'Assets')
const generatedRoot = resolve(__dirname, 'Generated')

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

function unityAssetsPlugin(): Plugin {
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

export default defineConfig({
  plugins: [react(), unityAssetsPlugin()],
})
