/** Presentation-only book outline. Never a publication or curriculum authority. */
export type CurriculumOutlineRow = { id: string; name: string | null; sub_strand: string | null; source_ref?: string | null; strand_order?: number | null; sub_strand_order?: number | null }
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

/** The mapped Grade 4 Maths curriculum is the learner's chapter index.
 * Public shell metadata intentionally includes older, unlocated Maths headings;
 * the authenticated canonical 19-row binding selects the real sub-strands.
 * Do not rewrite IDs or turn these headings into released lessons.
 */
export type Grade4MathBinding = { source_ref: string; sub_strand_id: string }
export function projectGrade4MathOutline(rows: readonly CurriculumOutlineRow[], bindings: readonly Grade4MathBinding[]): CurriculumOutlineRow[] | null {
  const expected = [8, 7, 3, 1]
  const strandNames = ['Numbers', 'Measurement', 'Geometry', 'Data Handling']
  if (bindings.length !== 19) return null
  const byId = new Map(rows.map(row => [row.id, row]))
  const seenIds = new Set<string>()
  const seenCodes = new Set<string>()
  const projected: CurriculumOutlineRow[] = []
  for (const binding of bindings) {
    const match = /^VS-CUR-G04-MA-2026#([1-4])\.([1-9])$/.exec(binding.source_ref)
    if (!match || !binding.sub_strand_id || seenIds.has(binding.sub_strand_id) || seenCodes.has(binding.source_ref)) return null
    const strand = Number(match[1]), subStrand = Number(match[2])
    if (subStrand > expected[strand - 1]) return null
    const row = byId.get(binding.sub_strand_id)
    if (!row?.name || !row.sub_strand) return null
    seenIds.add(row.id)
    seenCodes.add(binding.source_ref)
    projected.push({ ...row, strand_order: strand, sub_strand_order: subStrand })
  }
  if (expected.some((count, index) => projected.filter(row => row.strand_order === index + 1).length !== count)) return null
  return projected.sort((a, b) =>
    (a.strand_order ?? 99) - (b.strand_order ?? 99) ||
    (a.sub_strand_order ?? 99) - (b.sub_strand_order ?? 99))
}

export type BookReadingEntry = { id: string; title: string; href: string; subStrandId?: string | null; legacy?: boolean }
export type BookReadingGroup = { id: string; title: string; topics: { id: string; title: string; strand?: string; entries: BookReadingEntry[] }[] }
const normalTitle = (s: string) => s.trim().replace(/\s+/g, ' ').toLowerCase()


/** Presentation contract: docs/curriculum/UNIVERSAL_TEXTBOOK_PRESENTATION.md.
 * A structured, repeated source-locator group may represent a theme.
 * Never infer themes from punctuation alone, and retain stable row IDs.
 */
export function buildPresentationOutline(rows: readonly CurriculumOutlineRow[]) {
  const ordered = [...rows].sort((a,b) =>
    (a.strand_order ?? Infinity)-(b.strand_order ?? Infinity) ||
    (a.sub_strand_order ?? Infinity)-(b.sub_strand_order ?? Infinity))
  const mapped = ordered.filter(row=>!!row.source_ref)
  const indexed = mapped.map(row=>({row,match:/^(.+)#(\d+)-([A-Z]+)$/.exec(row.source_ref || '')}))
  const fallback = () => ({themed:false, chapters:buildTextbookOutline(ordered) as {id:string;title:string;topics:{id:string;title:string;strand?:string}[]}[]})
  if (!indexed.length || indexed.some(({row,match})=>!match || !row.name || !row.sub_strand || row.strand_order==null || row.sub_strand_order!==Number(match[2]))) return fallback()
  if (new Set(indexed.map(item=>item.match![1])).size!==1) return fallback()
  const byTheme = new Map<number,CurriculumOutlineRow[]>()
  for (const {row,match} of indexed) {
    const position=Number(match![2])
    byTheme.set(position,[...(byTheme.get(position) || []),row])
  }
  const strandSet = new Set(mapped.map(row=>normalTitle(row.name!)))
  if (strandSet.size<2) return fallback()
  const chapters: {id:string;title:string;topics:{id:string;title:string;strand?:string}[]}[]=[]
  const themeNames=new Set<string>()
  for (const [position,items] of [...byTheme].sort((a,b)=>a[0]-b[0])) {
    if (items.length!==strandSet.size || new Set(items.map(row=>normalTitle(row.name!))).size!==strandSet.size) return fallback()
    // Find the complete shared prefix, including embedded colons (e.g. a safety theme).
    const parts=items[0].sub_strand!.split(': ')
    let title=''
    for(let n=parts.length-1;n>0;n--) {
      const candidate=parts.slice(0,n).join(': ')
      if(items.every(row=>row.sub_strand!.startsWith(candidate+': '))) {title=candidate;break}
    }
    if (!title || themeNames.has(normalTitle(title))) return fallback()
    themeNames.add(normalTitle(title))
    chapters.push({id:indexed[0].match![1]+'#'+position,title,topics:items.map(row=>({id:row.id,strand:row.name!,title:row.sub_strand!.slice(title.length+2)}))})
  }
  return {themed:true, chapters}
}

/** Attach release routes without inventing a mapping. Multiple editions stay accessible.
 * A legacy route with no stable ID is matched only to one exact, unambiguous topic.
 */
export function connectReadingEntries(rows: readonly CurriculumOutlineRow[], entries: readonly BookReadingEntry[]) {
  const presentation = buildPresentationOutline(rows)
  const groups: BookReadingGroup[] = presentation.chapters.map(ch => ({
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
        ? presentation.themed ? topic.id === origin.id : normalTitle(group.title) === normalTitle(origin.name) && normalTitle(topic.title) === normalTitle(origin.sub_strand)
        : entry.legacy && !entry.subStrandId && normalTitle(topic.title) === normalTitle(entry.title)))
    if (candidates.length === 1) candidates[0].entries.push(entry)
    else unmatched.push(entry)
  }
  return { groups, unmatched }
}
