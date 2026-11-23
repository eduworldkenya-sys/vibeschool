import { createElement, type ReactNode } from 'react'

/**
 * Render a small, explicit allowlist of textbook formatting marks without
 * ever assigning author-supplied HTML to innerHTML.
 * URLs, attributes, scripts, styles and unknown elements are never rendered.
 */
const ALLOWED = new Set(['p', 'strong', 'em', 'u', 's', 'code', 'sub', 'sup'])
const ALIASES: Record<string, string> = { b: 'strong', i: 'em', del: 's', strike: 's' }
type Frame = { tag: string; children: ReactNode[] }
const decodeText = (text: string) => text.replace(/&(#x[0-9a-f]+|#\d+|amp|lt|gt|quot|apos|nbsp);/gi, (match, entity: string) => {
  const names: Record<string, string> = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: '\u00a0' }
  const key = entity.toLowerCase()
  if (key in names) return names[key]
  const value = key.startsWith('#x') ? parseInt(key.slice(2), 16) : key.startsWith('#') ? parseInt(key.slice(1), 10) : NaN
  return Number.isInteger(value) && value > 0 && value <= 0x10ffff && !(value >= 0xd800 && value <= 0xdfff)
    ? String.fromCodePoint(value) : match
})

export function TextbookSafeInlineHtml({ content }: { content: string }) {
  const stack: Frame[] = [{ tag: 'root', children: [] }]
  let key = 0
  const append = (node: ReactNode) => stack[stack.length - 1].children.push(node)
  const close = () => {
    if (stack.length <= 1) return
    const frame = stack.pop()!
    append(createElement(frame.tag, { key: key++ }, ...frame.children))
  }
  for (const token of content.split(/(<[^>]*>)/g)) {
    if (!token) continue
    if (!token.startsWith('<')) { append(decodeText(token)); continue }
    const parsed = /^<\s*(\/?)\s*([a-z][a-z0-9]*)(?:\s[^>]*)?\s*\/?>$/i.exec(token)
    if (!parsed) continue
    const originalTag = parsed[2].toLowerCase()
    if (originalTag === 'br' && !parsed[1]) { append(createElement('br', { key: key++ })); continue }
    const tag = ALIASES[originalTag] ?? originalTag
    if (!ALLOWED.has(tag)) continue
    if (parsed[1]) {
      if (stack[stack.length - 1].tag === tag) close()
    } else {
      stack.push({ tag, children: [] })
    }
  }
  while (stack.length > 1) close()
  return <div style={{ lineHeight: 1.75 }}>{stack[0].children}</div>
}
