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
  // Preserve every source character but prefer natural reading boundaries.
  // A resource page must not cut a word or an activity instruction in half
  // merely because it reached a fixed character count.
  for (let cursor = 0; cursor < content.length;) {
    let end = Math.min(content.length, cursor + size)
    if (end < content.length) {
      const window = content.slice(cursor, end)
      const blankLine = window.lastIndexOf('\n\n')
      const sentence = window.lastIndexOf('. ')
      const word = Math.max(window.lastIndexOf(' '), window.lastIndexOf('\n'))
      const breakAt = blankLine >= size * 0.58 ? blankLine + 2
        : sentence >= size * 0.72 ? sentence + 2
        : word >= size * 0.72 ? word + 1 : size
      end = cursor + breakAt
    }
    chunks.push(content.slice(cursor, end))
    cursor = end
    if (chunks.length > maxPages) return []
  }
  return chunks.map((part, i) => name + ' · Page ' + (i + 1) + ' / ' + chunks.length + '\n\n' + part)
}
