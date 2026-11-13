/** Canonical, read-only lesson blocks supplied by an already-authorised reader. */
export type LearningBlock =
  | { kind: 'paragraph'; text: string }
  | { kind: 'passage'; text: string; attribution?: string }
  | { kind: 'formula'; expression: string; explanation?: string }
  | { kind: 'list'; items: readonly string[]; ordered?: boolean }
  | { kind: 'table'; columns: readonly string[]; rows: readonly (readonly string[])[]; caption?: string }
  | { kind: 'activity'; instructions: string; materials?: readonly string[] }
  | { kind: 'visual'; id: string; resourceVersionId?: string }

export type CanonicalLearnSection = {
  id: string
  title: string
  body: string
  hint?: string
  tone?: string
  blocks?: readonly LearningBlock[]
}

const id = /^[a-z][a-z0-9_-]{0,60}$/i
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{12}$/i
const text = (value: unknown): value is string => typeof value === 'string' && value.trim().length > 0
const strings = (value: unknown): value is string[] =>
  Array.isArray(value) && value.length > 0 && value.every(text)

/**
 * Normalize explicit, published section blocks without generating or rewriting
 * educational content. Legacy manuscripts continue through their own parser.
 * Unknown block shapes cannot gain HTML, URLs, or private visual access.
 */
export function adaptCanonicalLearnSections(input: unknown): CanonicalLearnSection[] {
  if (!Array.isArray(input)) return []
  const sections: CanonicalLearnSection[] = []
  for (const candidate of input) {
    if (!candidate || typeof candidate !== 'object' || Array.isArray(candidate)) continue
    const row = candidate as Record<string, unknown>
    if (!text(row.id) || !id.test(row.id) || !text(row.title)) continue
    const blocks: LearningBlock[] = []
    if (Array.isArray(row.blocks)) for (const value of row.blocks) {
      if (!value || typeof value !== 'object' || Array.isArray(value)) continue
      const b = value as Record<string, unknown>
      if (b.kind === 'paragraph' && text(b.text)) blocks.push({kind:'paragraph',text:b.text})
      else if (b.kind === 'passage' && text(b.text))
        blocks.push({kind:'passage',text:b.text,attribution:text(b.attribution)?b.attribution:undefined})
      else if (b.kind === 'formula' && text(b.expression))
        blocks.push({kind:'formula',expression:b.expression,explanation:text(b.explanation)?b.explanation:undefined})
      else if (b.kind === 'list' && strings(b.items))
        blocks.push({kind:'list',items:b.items,ordered:b.ordered===true})
      else if (b.kind === 'table' && strings(b.columns) && Array.isArray(b.rows)
        && b.rows.length > 0 && b.rows.every((r:unknown) =>
          Array.isArray(r) && r.length=== (b.columns as string[]).length && r.every(text)))
        blocks.push({kind:'table',columns:b.columns,rows:b.rows as string[][],caption:text(b.caption)?b.caption:undefined})
      else if (b.kind === 'activity' && text(b.instructions))
        blocks.push({kind:'activity',instructions:b.instructions,materials:strings(b.materials)?b.materials:undefined})
      else if (b.kind === 'visual' && text(b.id) && uuid.test(b.id)
        && (b.resourceVersionId === undefined || (text(b.resourceVersionId) && uuid.test(b.resourceVersionId))))
        blocks.push({kind:'visual',id:b.id,resourceVersionId:b.resourceVersionId as string|undefined})
    }
    const body = text(row.body) ? row.body : ''
    if (!body && blocks.length === 0) continue
    sections.push({ id:row.id, title:row.title, body,
      hint:text(row.hint)?row.hint:undefined, tone:text(row.tone)?row.tone:undefined,
      ...(blocks.length?{blocks}:{}),
    })
  }
  return sections
}
