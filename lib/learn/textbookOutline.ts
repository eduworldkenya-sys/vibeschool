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
