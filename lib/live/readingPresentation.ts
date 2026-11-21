/** Pure, non-authoritative formatting for already-presented Live text.
 * The authorized Live room still owns which prompt is learner-visible.
 * No HTML interpretation, resource queries or access shortcuts.
 */
export function parseLiveReadingPage(body: string) {
  const normalized = body.replace(/\r\n?/g, '\n').trim()
  // Live may present a page with one or two separator newlines.
  // Detect the header on its own line, never by guessing at the first paragraph.
  const lineEnd = normalized.indexOf('\n')
  const firstLine = lineEnd < 0 ? normalized : normalized.slice(0,lineEnd)
  const header = firstLine.match(/^(.{1,120})\s*·\s*Page\s+(\d+)\s*\/\s*(\d+)$/)
  const content = header && lineEnd >= 0 ? normalized.slice(lineEnd+1).trimStart() : normalized
  const paragraphs = content.split(/\n\s*\n/).map(value => value.trim()).filter(Boolean)
  return {
    title: header?.[1] ?? null,
    number: header ? Number(header[2]) : null,
    total: header ? Number(header[3]) : null,
    paragraphs,
  }
}

export type ReadingBlockKind = 'outcome' | 'section' | 'heading' | 'prose'

export function liveReadingBlockType(text: string): ReadingBlockKind {
  const first = text.split('\n')[0].trim()
  if (/^(I CAN\s*[:.]|LEARNING OUTCOME\s*[:.]|OBJECTIVE\s*[:.])/i.test(first)) return 'outcome'
  if (/^(LET['’]S LEARN|KEY IDEA|REMEMBER|EXAMPLE|WORKED EXAMPLE|ACTIVITY|TRY THIS|EXERCISE|REFLECTION|SUMMARY|DISCUSS|PRACTICE)(\s*[:.\-]|$)/i.test(first)) return 'section'
  if (text.indexOf('\n') === -1 && first.length < 65 && /^[A-Z][A-Z\d\s,.:;()'’&!?\-]+$/.test(first)) return 'heading'
  return 'prose'
}