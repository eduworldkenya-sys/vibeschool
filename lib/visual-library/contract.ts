/** One visual identity, many learning-context references. No parallel asset catalogue. */
export const VISUAL_DRAFT_BUCKET = 'vibe-publication-drafts' as const
export const VISUAL_DRAFT_PREFIX = 'visual-library/' as const
export const VISUAL_MAX_BYTES = 5 * 1024 * 1024
export const VISUAL_TYPES = ['diagram', 'illustration', 'photograph', 'chart', 'graph', 'map', 'timeline', 'clock_face', 'number_line', 'fraction_model', 'process', 'other'] as const
export const VISUAL_PLACEMENTS = ['explanation', 'worked_example', 'activity', 'exercise', 'assessment', 'teacher_guide'] as const
export type VisualType = typeof VISUAL_TYPES[number]
export type VisualPlacement = typeof VISUAL_PLACEMENTS[number]

export type VisualPayload = {
  schema: 'vibeschool.visual.v1'
  visual_type: VisualType
  alt_text: string
  caption: string
  labels: string[]
  placements: VisualPlacement[]
  storage: { bucket: typeof VISUAL_DRAFT_BUCKET; path: string; mime: string; bytes: number; sha256?: string }
  source_strand_id: string
  topic_key: string
}

export const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

export function limitedText(value: unknown, max: number): string {
  return typeof value === 'string' ? value.trim().slice(0, max + 1) : ''
}
export function isVisualType(value: string): value is VisualType {
  return VISUAL_TYPES.includes(value as VisualType)
}
export function isVisualPlacement(value: string): value is VisualPlacement {
  return VISUAL_PLACEMENTS.includes(value as VisualPlacement)
}
export function isVisualPayload(value: unknown): value is VisualPayload {
  if (!value || typeof value !== 'object') return false
  const p = value as Partial<VisualPayload>
  return p.schema === 'vibeschool.visual.v1'
    && typeof p.alt_text === 'string' && p.alt_text.length >= 8
    && typeof p.caption === 'string' && p.caption.trim().length >= 3
    && typeof p.visual_type === 'string' && isVisualType(p.visual_type)
    && Array.isArray(p.labels) && p.labels.length <= 12 && p.labels.every(v => typeof v === 'string' && v.trim().length > 0 && v.length <= 80)
    && Array.isArray(p.placements) && p.placements.every(v => typeof v === 'string' && isVisualPlacement(v))
    && typeof p.storage?.path === 'string' && p.storage.path.startsWith(VISUAL_DRAFT_PREFIX)
    && p.storage.bucket === VISUAL_DRAFT_BUCKET
    && ['image/jpeg','image/png','image/webp','image/gif'].includes(p.storage.mime)
    && typeof p.storage.bytes === 'number' && p.storage.bytes > 0 && p.storage.bytes <= VISUAL_MAX_BYTES
    && (p.storage.sha256 === undefined || (typeof p.storage.sha256 === 'string' && /^[0-9a-f]{64}$/.test(p.storage.sha256)))
    && typeof p.source_strand_id === 'string' && UUID_RE.test(p.source_strand_id)
    && typeof p.topic_key === 'string' && p.topic_key.length > 0
}
export function imageTypeFromBytes(bytes: Uint8Array): { mime: string; ext: string } | null {
  if (bytes.length >= 8 && [137,80,78,71,13,10,26,10].every((n,i)=>bytes[i]===n)) return {mime:'image/png',ext:'png'}
  if (bytes.length >= 3 && bytes[0]===255 && bytes[1]===216 && bytes[2]===255) return {mime:'image/jpeg',ext:'jpg'}
  if (bytes.length >= 12 && String.fromCharCode(...bytes.slice(0,4))==='RIFF' && String.fromCharCode(...bytes.slice(8,12))==='WEBP') return {mime:'image/webp',ext:'webp'}
  if (bytes.length >= 6 && ['GIF87a','GIF89a'].includes(String.fromCharCode(...bytes.slice(0,6)))) return {mime:'image/gif',ext:'gif'}
  return null
}
export function isSafeVisualStoragePath(path: string): boolean {
  return /^visual-library\/[0-9a-f-]{36}\.(png|jpg|webp|gif)$/i.test(path)
}
/** Legacy root references still work. New published text can pin the exact certified version. */
export const VISUAL_TOKEN_RE = /\\[visual:([0-9a-f]{8}-[0-9a-f-]{27,}(?:@[0-9a-f]{8}-[0-9a-f-]{27,})?)\\]/gi
