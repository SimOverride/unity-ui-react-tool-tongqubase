import assert from 'node:assert/strict'
import test from 'node:test'

// 发布模板通常不保存 node_modules；验证时可指向已初始化并安装依赖的 UIReact 工程副本。
const modulePath = process.env.UIREACT_SOURCE_EDITOR_MODULE ?? './source-editor.mjs'
const { applySourcePatches, SourceEditError, sourceVersion } = await import(modulePath)

const source = `export default function Dialog() {
  const untouched = "保留业务代码"
  return (
    <main data-name="Root" data-component="UIRootPanel">
      <span data-name="Title" data-component="UITextMesh" data-pos="(0, 10, 0)" data-text="旧标题">旧标题</span>
    </main>
  )
}
`

test('只替换目标静态属性并保留其他源码', () => {
  const result = applySourcePatches(source, [{
    nodeName: 'Title',
    changes: { 'data-pos': '(20, 30, 0)', 'data-color': '(1, 0, 0, 1)' },
  }])

  assert.match(result, /const untouched = "保留业务代码"/)
  assert.match(result, /data-pos="\(20, 30, 0\)"/)
  assert.match(result, /data-color="\(1, 0, 0, 1\)"/)
})

test('修改 data-text 时同步直接 JSX 文本', () => {
  const result = applySourcePatches(source, [{
    nodeName: 'Title',
    changes: { 'data-text': '新标题' },
  }])

  assert.match(result, /data-text="新标题">新标题<\/span>/)
})

test('null 删除现有属性', () => {
  const result = applySourcePatches(source, [{
    nodeName: 'Title',
    changes: { 'data-pos': null },
  }])

  assert.doesNotMatch(result, /data-pos=/)
})

test('重复 data-name 会拒绝写回', () => {
  const duplicate = source.replace('</main>', '<div data-name="Title" data-component="UINode" /></main>')
  assert.throws(
    () => applySourcePatches(duplicate, [{ nodeName: 'Title', changes: { 'data-size': '(10, 10)' } }]),
    (error) => error instanceof SourceEditError && error.code === 'DUPLICATE_NODE',
  )
})

test('源码版本随内容变化', () => {
  assert.notEqual(sourceVersion(source), sourceVersion(source + ' '))
})
