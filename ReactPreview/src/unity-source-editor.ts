export interface SourceNodePatch {
  nodeName: string
  changes: Record<string, string | null>
}

interface SourceVersionResponse {
  version: string
}

interface SourceSaveResponse extends SourceVersionResponse {
  changed: boolean
}

interface SourceErrorResponse {
  code?: string
  message?: string
}

export class SourceEditorError extends Error {
  readonly code: string

  constructor(code: string, message: string) {
    super(message)
    this.name = 'SourceEditorError'
    this.code = code
  }
}

async function readResponse<T>(response: Response): Promise<T> {
  const body = await response.json().catch(() => ({})) as SourceErrorResponse
  if (!response.ok) {
    throw new SourceEditorError(
      body.code ?? 'REQUEST_FAILED',
      body.message ?? `本地编辑服务请求失败：HTTP ${response.status}`,
    )
  }
  return body as T
}

// 页面版本用于阻止浏览器覆盖 IDE 或 Agent 刚刚写入的源码。
export async function loadSourceVersion(pagePath: string): Promise<string> {
  const response = await fetch(`/__uirect/editor/page?path=${encodeURIComponent(pagePath)}`)
  return (await readResponse<SourceVersionResponse>(response)).version
}

export async function saveSourcePatches(
  pagePath: string,
  expectedVersion: string,
  patches: SourceNodePatch[],
): Promise<SourceSaveResponse> {
  const response = await fetch('/__uirect/editor/save', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ pagePath, expectedVersion, patches }),
  })
  return readResponse<SourceSaveResponse>(response)
}

