/** Canonical, read-only lesson blocks supplied by an already-authorised reader. */
import type { TeachingToolSpec, TeachingToolId } from './teachingToolCatalog'
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
  tools?: readonly TeachingToolSpec[]
}

const id = /^[a-z][a-z0-9_-]{0,60}$/i
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
const text = (value: unknown): value is string => typeof value === 'string' && value.trim().length > 0
const strings = (value: unknown): value is string[] =>
  Array.isArray(value) && value.length > 0 && value.every(text)


/** Admit only declarative teaching inputs; never carry URLs, code, grades,
 * answer keys or arbitrary payloads from an untrusted content block. The
 * central catalog still performs the final tool-ID allowlist at render time.
 */
function authorTools(raw: unknown): TeachingToolSpec[] {
  if (!Array.isArray(raw)) return []
  const short = (v: unknown, n = 1000) => typeof v === 'string' && v.trim() && v.length <= n ? v : undefined
  const strings = (v: unknown, limit = 15): string[] | undefined =>
    Array.isArray(v) && v.length <= limit && v.every(x => short(x, 250))
      ? v as string[] : undefined
  const pairs = (v: unknown) => Array.isArray(v) && v.length <= 12
    ? v.filter(p => p && short(p.term, 100) && short(p.definition, 250)).map(p => ({term:p.term,definition:p.definition})) : undefined
  const items = (v: unknown) => Array.isArray(v) && v.length <= 12
    ? v.filter(p => p && short(p.label, 100) && short(p.group, 100)).map(p => ({label:p.label,group:p.group})) : undefined
  const notes = (v: unknown) => Array.isArray(v) && v.length <= 12
    ? v.filter(p => p && short(p.label, 80) && short(p.detail, 500)).map(p => ({label:p.label,detail:p.detail})) : undefined
  const places = (v: unknown) => Array.isArray(v) && v.length <= 12
    ? v.filter(p => p && short(p.label, 100) && short(p.description, 500)).map(p => ({
        label:p.label,description:p.description,
        ...(typeof p.x==='number' && Number.isFinite(p.x) && p.x>=0 && p.x<=100 ? {x:p.x}:{}),
        ...(typeof p.y==='number' && Number.isFinite(p.y) && p.y>=0 && p.y<=100 ? {y:p.y}:{}),
      })) : undefined
  const events = (v: unknown) => Array.isArray(v) && v.length <= 15
    ? v.filter(p => p && short(p.date, 70) && short(p.label, 150)).map(p => ({
        date:p.date,label:p.label,...(short(p.description, 700)?{description:p.description}:{})
      })) : undefined
  return raw.slice(0, 21).flatMap((v: unknown) => {
    if (!v || typeof v !== 'object' || Array.isArray(v)) return []
    const t = v as Record<string, unknown>
    if (typeof t.id !== 'string' || !/^[a-z][a-z0-9-]{1,45}$/.test(t.id) ||
      (t.version !== undefined && t.version !== 1)) return []
    return [{
      id: t.id as TeachingToolId, version: t.version as 1 | undefined, prompt: short(t.prompt, 240),
      word: short(t.word, 100), sentence: short(t.sentence, 250),
      spokenText: short(t.spokenText, 1500), language: short(t.language, 10),
      visualId: typeof t.visualId === 'string' && uuid.test(t.visualId) ? t.visualId : undefined,
      resourceVersionId: typeof t.resourceVersionId === 'string' && uuid.test(t.resourceVersionId) ? t.resourceVersionId : undefined,
      number: typeof t.number === 'number' && Number.isFinite(t.number) && Math.abs(t.number) < 1e7 ? t.number : undefined,
      sequence: strings(t.sequence), groups: strings(t.groups), materials: strings(t.materials, 20),
      steps: strings(t.steps), observationQuestions: strings(t.observationQuestions, 8),
      pairs: pairs(t.pairs), items: items(t.items), visualNotes: notes(t.visualNotes),
      places: places(t.places), events: events(t.events),
    }]
  })
}

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
      else if (b.kind === 'visual') {
        // Normalize the exact UUIDs before passing them to the certified resolver.
        const visualId = typeof b.id === 'string' ? b.id.trim() : ''
        const versionId = typeof b.resourceVersionId === 'string' ? b.resourceVersionId.trim() : undefined
        if (uuid.test(visualId) && (b.resourceVersionId === undefined || (versionId !== undefined && uuid.test(versionId))))
          blocks.push({kind:'visual',id:visualId,resourceVersionId:versionId})
      }
    }
    const body = text(row.body) ? row.body : ''
    if (!body && blocks.length === 0) continue
    const tools = authorTools(row.tools)
    sections.push({ id:row.id, title:row.title, body,
      hint:text(row.hint)?row.hint:undefined, tone:text(row.tone)?row.tone:undefined,
      ...(blocks.length?{blocks}:{}),
      ...(tools.length?{tools}:{}),
    })
  }
  return sections
}
