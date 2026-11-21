/** Pure, non-authoritative formatting for already-presented Live text.
 * The authorized Live room still owns which prompt is learner-visible.
 * No HTML interpretation, resource queries or access shortcuts.
 */
export function parseLiveReadingPage(body: string) {
  const normalized = body.replace(/\r\n?/g, '\n').trim()
  const header = normalized.match(/^([^\n]{1,120}) · Page (\d+) \/ (\d+)\n\n/)
  const content = header ? normalized.slice(header[0].length) : normalized
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