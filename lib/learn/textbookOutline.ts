/** Presentation-only book outline. Never a publication or curriculum authority. */
export type CurriculumOutlineRow = { id: string; name: string | null; sub_strand: string | null }
export function buildTextbookOutline(rows: readonly CurriculumOutlineRow[]) {
  const chapters = new Map<string, { id: string; title: string; topics: { id: string; title: string }[] }>()
  const key = (s: string) => s.trim().replace(/\s+/g, ' ').toLowerCase()
  for (const row of rows) {
    const title = row.name?.trim()
    if (!title) continue
    const chapterKey = key(title)
    let chapter = chapters.get(chapterKey)
    if (!chapter) {
      chapter = { id: row.id, title, topics: [] }
      chapters.set(chapterKey, chapter)
    }
    const topic = row.sub_strand?.trim()
    if (topic && !chapter.topics.some(item => key(item.title) === key(topic))) {
      chapter.topics.push({ id: row.id, title: topic })
    }
  }
  return [...chapters.values()]
}

export type BookReadingEntry = { id: string; title: string; href: string; subStrandId?: string | null; legacy?: boolean }
export type BookReadingGroup = { id: string; title: string; topics: { id: string; title: string; entries: BookReadingEntry[] }[] }
const normalTitle = (s: string) => s.trim().replace(/\s+/g, ' ').toLowerCase()

/** Attach release routes without inventing a mapping. Multiple editions stay accessible.
 * A legacy route with no stable ID is matched only to one exact, unambiguous topic.
 */
export function connectReadingEntries(rows: readonly CurriculumOutlineRow[], entries: readonly BookReadingEntry[]) {
  const groups: BookReadingGroup[] = buildTextbookOutline(rows).map(ch => ({
    ...ch, topics: ch.topics.map(topic => ({ ...topic, entries: [] })),
  }))
  const unmatched: BookReadingEntry[] = []
  const seen = new Set<string>()
  for (const entry of entries) {
    if (seen.has(entry.href)) continue
    seen.add(entry.href)
    const origin = entry.subStrandId ? rows.find(row => row.id === entry.subStrandId) : null
    const candidates = groups.flatMap(group => group.topics.filter(topic =>
      origin?.name && origin.sub_strand
        ? normalTitle(group.title) === normalTitle(origin.name) && normalTitle(topic.title) === normalTitle(origin.sub_strand)
        : entry.legacy && !entry.subStrandId && normalTitle(topic.title) === normalTitle(entry.title)))
    if (candidates.length === 1) candidates[0].entries.push(entry)
    else unmatched.push(entry)
  }
  return { groups, unmatched }
}
