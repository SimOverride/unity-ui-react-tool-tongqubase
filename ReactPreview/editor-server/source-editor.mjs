import { createHash } from 'node:crypto'
import ts from 'typescript'

// 可视化编辑器只允许修改 Unity 生成流程已经支持的静态属性，结构和组件类型继续由源码维护。
const editableAttributes = new Set([
  'data-pos',
  'data-size',
  'data-anchors',
  'data-anchor-min',
  'data-anchor-max',
  'data-pivot',
  'data-rot',
  'data-scale',
  'data-color',
  'data-alpha',
  'data-sprite',
  'data-preserve-aspect',
  'data-text',
  'data-font-size',
  'data-font-style',
  'data-enable-word-wrapping',
  'data-outline-color',
  'data-outline-width',
  'data-text-align',
  'data-vertical-align',
  'data-visible',
  'data-interactable',
  'data-bind',
  'data-bind-type',
  'data-bind-custom-type',
  'data-layout-group',
  'data-layout-spacing',
  'data-layout-padding',
  'data-layout-cell-size',
  'data-layout-constraint',
  'data-layout-constraint-count',
  'data-layout-child-alignment',
  'data-layout-start-corner',
  'data-layout-start-axis',
  'data-scroll-direction',
  'data-min',
  'data-max',
  'data-value',
  'data-is-on',
  'data-placeholder',
  'data-default-value',
])

export class SourceEditError extends Error {
  constructor(code, message) {
    super(message)
    this.name = 'SourceEditError'
    this.code = code
  }
}

export function sourceVersion(source) {
  return createHash('sha256').update(source, 'utf8').digest('hex')
}

function staticAttributeValue(attribute) {
  return attribute.initializer && ts.isStringLiteral(attribute.initializer)
    ? attribute.initializer.text
    : null
}

function findEditableNodes(sourceFile) {
  const nodes = new Map()

  function visit(node) {
    if (ts.isJsxOpeningElement(node) || ts.isJsxSelfClosingElement(node)) {
      const nameAttribute = node.attributes.properties.find((property) =>
        ts.isJsxAttribute(property) && property.name.getText(sourceFile) === 'data-name')
      if (nameAttribute && ts.isJsxAttribute(nameAttribute)) {
        const name = staticAttributeValue(nameAttribute)
        if (name) {
          const entries = nodes.get(name) ?? []
          entries.push(node)
          nodes.set(name, entries)
        }
      }
    }
    ts.forEachChild(node, visit)
  }

  visit(sourceFile)
  return nodes
}

function formatAttribute(name, value) {
  if (value.includes('\r') || value.includes('\n'))
    throw new SourceEditError('INVALID_VALUE', `${name} 暂不支持换行值。`)
  if (value.length > 2000)
    throw new SourceEditError('INVALID_VALUE', `${name} 的值过长。`)
  if (!value.includes('"')) return `${name}="${value}"`
  if (!value.includes("'")) return `${name}='${value}'`
  throw new SourceEditError('INVALID_VALUE', `${name} 不能同时包含单引号和双引号。`)
}

function openingTagInsertion(source, sourceFile, opening, attributes) {
  const closingLength = ts.isJsxSelfClosingElement(opening) ? 2 : 1
  const closeStart = opening.end - closingLength
  const openingText = source.slice(opening.getStart(sourceFile), closeStart)
  const newline = source.includes('\r\n') ? '\r\n' : '\n'

  if (!openingText.includes('\n')) {
    return {
      start: closeStart,
      end: closeStart,
      text: ' ' + attributes.join(' '),
    }
  }

  const closingLineStart = source.lastIndexOf('\n', closeStart - 1) + 1
  const closingPrefix = source.slice(closingLineStart, closeStart)
  if (closingPrefix.trim().length > 0) {
    return {
      start: closeStart,
      end: closeStart,
      text: ' ' + attributes.join(' '),
    }
  }

  const firstAttribute = opening.attributes.properties[0]
  let indent = closingPrefix
  if (firstAttribute) {
    const attributeStart = firstAttribute.getStart(sourceFile)
    const attributeLineStart = source.lastIndexOf('\n', attributeStart - 1) + 1
    indent = source.slice(attributeLineStart, attributeStart)
  }

  return {
    start: closingLineStart,
    end: closingLineStart,
    text: attributes.map((attribute) => indent + attribute).join(newline) + newline,
  }
}

function directTextEdit(source, opening, value) {
  if (!ts.isJsxOpeningElement(opening) || !ts.isJsxElement(opening.parent)) return null
  const textNodes = opening.parent.children.filter((child) => ts.isJsxText(child) && child.getText().trim().length > 0)
  if (textNodes.length !== 1) return null

  const textNode = textNodes[0]
  const rawText = source.slice(textNode.getStart(), textNode.end)
  const firstContent = rawText.search(/\S/)
  if (firstContent < 0) return null
  let lastContent = rawText.length
  while (lastContent > firstContent && /\s/.test(rawText[lastContent - 1])) lastContent--

  // data-text 才是 Unity 数据源；这里同步直接文本只是为了让 React 画面在热更新后保持一致。
  const jsxText = value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
  return {
    start: textNode.getStart() + firstContent,
    end: textNode.getStart() + lastContent,
    text: jsxText,
  }
}

function validatePatches(patches) {
  if (!Array.isArray(patches) || patches.length === 0)
    throw new SourceEditError('EMPTY_PATCH', '没有需要保存的 UI 属性修改。')
  if (patches.length > 256)
    throw new SourceEditError('TOO_MANY_PATCHES', '单次保存的节点修改过多。')

  const keys = new Set()
  for (const patch of patches) {
    if (!patch || typeof patch.nodeName !== 'string' || !patch.nodeName.trim())
      throw new SourceEditError('INVALID_NODE', '保存请求包含无效的 data-name。')
    if (!patch.changes || typeof patch.changes !== 'object' || Array.isArray(patch.changes))
      throw new SourceEditError('INVALID_PATCH', `节点 ${patch.nodeName} 缺少属性修改。`)

    for (const [attribute, value] of Object.entries(patch.changes)) {
      if (!editableAttributes.has(attribute))
        throw new SourceEditError('READ_ONLY_ATTRIBUTE', `属性 ${attribute} 不允许由可视化编辑器修改。`)
      if (value !== null && typeof value !== 'string')
        throw new SourceEditError('INVALID_VALUE', `${attribute} 必须是静态字符串或删除标记。`)
      const key = `${patch.nodeName}\u0000${attribute}`
      if (keys.has(key))
        throw new SourceEditError('DUPLICATE_PATCH', `节点 ${patch.nodeName} 的 ${attribute} 被重复修改。`)
      keys.add(key)
    }
  }
}

export function applySourcePatches(source, patches) {
  validatePatches(patches)
  const sourceFile = ts.createSourceFile('UIReactPage.tsx', source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX)
  if (sourceFile.parseDiagnostics.length > 0)
    throw new SourceEditError('PARSE_ERROR', 'TSX 当前存在语法错误，无法安全写回。')

  const nodes = findEditableNodes(sourceFile)
  const edits = []

  for (const patch of patches) {
    const matches = nodes.get(patch.nodeName) ?? []
    if (matches.length === 0)
      throw new SourceEditError('NODE_NOT_FOUND', `未找到 data-name="${patch.nodeName}" 的静态节点。`)
    if (matches.length > 1)
      throw new SourceEditError('DUPLICATE_NODE', `data-name="${patch.nodeName}" 不是唯一节点，已拒绝写回。`)

    const opening = matches[0]
    const existingAttributes = new Map()
    for (const property of opening.attributes.properties) {
      if (!ts.isJsxAttribute(property)) continue
      const name = property.name.getText(sourceFile)
      const entries = existingAttributes.get(name) ?? []
      entries.push(property)
      existingAttributes.set(name, entries)
    }

    const insertions = []
    for (const [attribute, value] of Object.entries(patch.changes)) {
      const existing = existingAttributes.get(attribute) ?? []
      if (existing.length > 1)
        throw new SourceEditError('DUPLICATE_ATTRIBUTE', `节点 ${patch.nodeName} 重复声明了 ${attribute}。`)

      if (existing.length === 1) {
        const current = existing[0]
        if (value === null) {
          edits.push({ start: current.getStart(sourceFile), end: current.end, text: '' })
        } else {
          if (staticAttributeValue(current) === null)
            throw new SourceEditError('DYNAMIC_ATTRIBUTE', `节点 ${patch.nodeName} 的 ${attribute} 不是静态字符串。`)
          edits.push({
            start: current.getStart(sourceFile),
            end: current.end,
            text: formatAttribute(attribute, value),
          })
        }
      } else if (value !== null) {
        insertions.push(formatAttribute(attribute, value))
      }

      if (attribute === 'data-text' && value !== null) {
        const textEdit = directTextEdit(source, opening, value)
        if (textEdit) edits.push(textEdit)
      }
    }

    if (insertions.length > 0)
      edits.push(openingTagInsertion(source, sourceFile, opening, insertions))
  }

  edits.sort((left, right) => right.start - left.start || right.end - left.end)
  for (let index = 1; index < edits.length; index++) {
    if (edits[index - 1].start < edits[index].end)
      throw new SourceEditError('OVERLAPPING_EDITS', '本次属性修改产生了重叠源码范围。')
  }

  let result = source
  for (const edit of edits)
    result = result.slice(0, edit.start) + edit.text + result.slice(edit.end)
  return result
}

