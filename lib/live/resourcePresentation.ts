/**
 * The source libraries remain authoritative. Live only presents read-authorized,
 * explicitly learner-facing text as bounded snapshots in its existing prompt
 * history. This does not grant resource access, publish a draft, or invent a
 * second textbook / assessment authority.
 */
export const LIVE_LEARNER_ASSET_KINDS = [
  'learner_notes', 'worked_example', 'revision', 'remedial', 'enrichment',
] as const

// The existing Live admission boundary is PP1/PP2, Grades 1–12 and Forms 1–4.
// Never let muted post-secondary resources enter the presentation picker.
export const LIVE_SCHOOL_GRADE_LABELS = [
  'PP1', 'PP2',
  ...Array.from({ length: 12 }, (_, i) => 'Grade ' + (i + 1)),
  ...Array.from({ length: 4 }, (_, i) => 'Form ' + (i + 1)),
]

export function readableLiveResourceText(payload: unknown): string {
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) return ''
  const row = payload as Record<string, unknown>
  const body = typeof row.content_text === 'string' && row.content_text.trim()
    ? row.content_text : typeof row.body === 'string' ? row.body : ''
  return body.trim()
}

/** Return all text or refuse presentation; never silently truncate a lesson. */
export function liveResourcePages(title: string, body: string): string[] {
  const name = title.trim().slice(0, 120)
  const content = body.trim().replace(/\r\n?/g, '\n')
  if (!name || !content) return []
  const size = 3600
  const maxPages = 30
  if (content.length > size * maxPages) return []
  const chunks: string[] = []
  for (let cursor = 0; cursor < content.length; cursor += size) {
    chunks.push(content.slice(cursor, cursor + size))
  }
  return chunks.map((part, i) => name + ' · Page ' + (i + 1) + ' / ' + chunks.length + '\n\n' + part)
}
