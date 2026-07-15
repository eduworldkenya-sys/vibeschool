import sys

path = "/data/data/com.termux/files/home/vibeschool/app/teacher/scheme/page.tsx"

with open(path, "r") as f:
    content = f.read()

def apply(content, old, new, label):
    count = content.count(old)
    if count != 1:
        print(f"ERROR [{label}]: expected 1 match, found {count}. Aborting — file may have changed.")
        sys.exit(1)
    return content.replace(old, new)

# 1. New interface, after SchemeItem
content = apply(content,
    'interface SchemeItem     { id: string; curriculum_id: string | null; curriculum_content_id: string | null; week: number; strand: string | null; sub_strand: string | null; topic: string; status: string; source: string; lesson_number: number | null; reflection: string | null; key_inquiry_question: string | null; learning_resources: string | null; assessment_methods: string | null; learning_experiences: string | null }',
    'interface SchemeItem     { id: string; curriculum_id: string | null; curriculum_content_id: string | null; week: number; strand: string | null; sub_strand: string | null; topic: string; status: string; source: string; lesson_number: number | null; reflection: string | null; key_inquiry_question: string | null; learning_resources: string | null; assessment_methods: string | null; learning_experiences: string | null }\ninterface EbookSuggestion { chapterId: string; chapterTitle: string; publicationTitle: string; strandName: string; learningOutcomes: string[] }',
    "interface"
)

# 2. New state
content = apply(content,
    "  const [curriculumRows,   setCurriculumRows]   = useState<CurriculumRow[]>([])",
    "  const [curriculumRows,   setCurriculumRows]   = useState<CurriculumRow[]>([])\n  const [ebookSuggestions, setEbookSuggestions] = useState<EbookSuggestion[]>([])",
    "state"
)

# 3. Reset in loadScheme
content = apply(content,
    "    setSchemeItems([])\n    setCurriculumRows([])",
    "    setSchemeItems([])\n    setCurriculumRows([])\n    setEbookSuggestions([])",
    "reset"
)

# 4. Fetch ebook suggestions after curriculum delta block
old_block = """      if (currData) {
        const activeCurriculumIds = new Set(items.map(i => i.curriculum_id).filter(Boolean))
        const unseededRows = (currData as CurriculumRow[]).filter(row => !activeCurriculumIds.has(row.id))
        setCurriculumRows(unseededRows)
      }
      setLoadingCurric(false)
    }
    setFetching(false)"""

new_block = """      if (currData) {
        const activeCurriculumIds = new Set(items.map(i => i.curriculum_id).filter(Boolean))
        const unseededRows = (currData as CurriculumRow[]).filter(row => !activeCurriculumIds.has(row.id))
        setCurriculumRows(unseededRows)
      }
      setLoadingCurric(false)

      // Published, CBC-aligned ebook chapters linked to a real KICD
      // sub-strand for this grade/subject. Not week-matched yet —
      // cbc_strands.term/week aren't populated. Teacher picks the week.
      const globalSubjectId = await resolveGlobalSubjectId(selectedSubjectObj.label)
      if (globalSubjectId) {
        const { data: strandRows } = await supabase
          .from('cbc_strands')
          .select('id')
          .eq('subject_id', globalSubjectId)
          .ilike('grade', selectedClassObj.grade)

        const strandIds = (strandRows ?? []).map(r => r.id)

        if (strandIds.length > 0) {
          const { data: chapterRows } = await supabase
            .from('vibe_chapters')
            .select('id,title,cbc_strand,learning_outcomes,sub_strand_id,vibe_publications(id,title,cbc_aligned,status)')
            .in('sub_strand_id', strandIds)
            .eq('status', 'published')

          const validChapters = (chapterRows ?? []).filter((c: any) =>
            c.vibe_publications?.cbc_aligned === true &&
            c.vibe_publications?.status === 'published'
          )

          if (requestId === schemeRequestIdRef.current) {
            setEbookSuggestions(validChapters.map((c: any) => ({
              chapterId: c.id,
              chapterTitle: c.title,
              publicationTitle: c.vibe_publications?.title ?? '',
              strandName: c.cbc_strand,
              learningOutcomes: c.learning_outcomes ?? [],
            })))
          }
        } else {
          setEbookSuggestions([])
        }
      }
    }
    setFetching(false)"""

content = apply(content, old_block, new_block, "fetch-logic")

# 5. UI: suggestion cards in the empty-state action
old_ui = """            action={
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8, maxWidth: 260, margin: '0 auto' }}>
                <input value={newTopicName} onChange={e => setNewTopicName(e.target.value)} placeholder="Topic name, e.g. Whole Numbers" style={{ padding: '9px 12px', borderRadius: 10, border: `1.5px solid ${C.border2}`, fontSize: 13, fontFamily: 'inherit', outline: 'none', color: C.text, background: '#ffffff' }} />
                <input value={newStrandName} onChange={e => setNewStrandName(e.target.value)} placeholder="Strand name (optional), e.g. Numbers" style={{ padding: '9px 12px', borderRadius: 10, border: `1.5px solid ${C.border2}`, fontSize: 13, fontFamily: 'inherit', outline: 'none', color: C.text, background: '#ffffff' }} />
                {addCustomError && <div style={{ fontSize: 11, color: C.red, fontWeight: 600 }}>{addCustomError}</div>}
                <button type="button" onClick={addCustomItem} disabled={addCustomBusy || !newTopicName.trim()} style={{ padding: '10px 16px', background: C.indigo, color: '#fff', border: 'none', borderRadius: 10, fontSize: 13, fontWeight: 700, cursor: addCustomBusy ? 'not-allowed' : 'pointer', opacity: addCustomBusy || !newTopicName.trim() ? 0.6 : 1, fontFamily: 'inherit' }}>
                  {addCustomBusy ? "Adding..." : "Add Topic"}
                </button>
              </div>
            }"""

new_ui = """            action={
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12, maxWidth: 280, margin: '0 auto' }}>
                {ebookSuggestions.length > 0 && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8, textAlign: 'left' }}>
                    <div style={{ fontSize: 11, fontWeight: 700, color: C.text3, letterSpacing: 1, textTransform: 'uppercase' }}>
                      From published ebooks
                    </div>
                    {ebookSuggestions.map(s => (
                      <div key={s.chapterId} style={{ padding: 10, borderRadius: 10, border: `1.5px solid #c7d2fe`, background: C.indigoLight }}>
                        <div style={{ fontSize: 12, fontWeight: 700, color: C.text }}>{s.chapterTitle}</div>
                        <div style={{ fontSize: 11, color: C.text2, marginTop: 2 }}>{s.publicationTitle} · {s.strandName}</div>
                        <button
                          type="button"
                          onClick={() => { setNewTopicName(s.chapterTitle); setNewStrandName(s.strandName) }}
                          style={{ marginTop: 6, padding: '5px 10px', borderRadius: 8, border: 'none', background: C.indigo, color: '#fff', fontSize: 11, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }}
                        >
                          Use this
                        </button>
                      </div>
                    ))}
                  </div>
                )}
                <input value={newTopicName} onChange={e => setNewTopicName(e.target.value)} placeholder="Topic name, e.g. Whole Numbers" style={{ padding: '9px 12px', borderRadius: 10, border: `1.5px solid ${C.border2}`, fontSize: 13, fontFamily: 'inherit', outline: 'none', color: C.text, background: '#ffffff' }} />
                <input value={newStrandName} onChange={e => setNewStrandName(e.target.value)} placeholder="Strand name (optional), e.g. Numbers" style={{ padding: '9px 12px', borderRadius: 10, border: `1.5px solid ${C.border2}`, fontSize: 13, fontFamily: 'inherit', outline: 'none', color: C.text, background: '#ffffff' }} />
                {addCustomError && <div style={{ fontSize: 11, color: C.red, fontWeight: 600 }}>{addCustomError}</div>}
                <button type="button" onClick={addCustomItem} disabled={addCustomBusy || !newTopicName.trim()} style={{ padding: '10px 16px', background: C.indigo, color: '#fff', border: 'none', borderRadius: 10, fontSize: 13, fontWeight: 700, cursor: addCustomBusy ? 'not-allowed' : 'pointer', opacity: addCustomBusy || !newTopicName.trim() ? 0.6 : 1, fontFamily: 'inherit' }}>
                  {addCustomBusy ? "Adding..." : "Add Topic"}
                </button>
              </div>
            }"""

content = apply(content, old_ui, new_ui, "ui")

with open(path, "w") as f:
    f.write(content)

print("All 5 patches applied successfully.")
