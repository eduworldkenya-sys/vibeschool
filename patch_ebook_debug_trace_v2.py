import sys

path = "/data/data/com.termux/files/home/vibeschool/app/teacher/scheme/page.tsx"

with open(path, "r") as f:
    content = f.read()

def apply(content, old, new, label):
    count = content.count(old)
    if count != 1:
        print(f"ERROR [{label}]: expected 1 match, found {count}. Aborting — no changes written.")
        sys.exit(1)
    return content.replace(old, new)

old_block = """      if (requestId !== schemeRequestIdRef.current) return

      if (currErr) {
        setFetchError(`Failed to load curriculum: ${currErr.message}`)
        setLoadingCurric(false)
        setFetching(false)
        return
      }

      if (currData) {
        const activeCurriculumIds = new Set(items.map(i => i.curriculum_id).filter(Boolean))
        const unseededRows = (currData as CurriculumRow[]).filter(row => !activeCurriculumIds.has(row.id))
        setCurriculumRows(unseededRows)
      }
      setLoadingCurric(false)

      // Published, CBC-aligned ebook chapters linked to a real KICD
      // sub-strand for this grade/subject. Not week-matched yet \u2014
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
          const { data: chapterRows, error: chapterErr } = await supabase
            .from('vibe_chapters')
            .select('id,title,cbc_strand,learning_outcomes,sub_strand_id,vibe_publications(id,title,cbc_aligned,status)')
            .in('sub_strand_id', strandIds)
            .eq('status', 'published')

          if (chapterErr) {
            console.error('ebook suggestion query failed:', chapterErr)
            setFetchError(`Ebook suggestion query failed: ${chapterErr.message}`)
          }"""

new_block = """      if (requestId !== schemeRequestIdRef.current) {
        setDebugTrace(t => [...t.slice(-9), `req#${requestId} ABORTED at curriculum-fetch (superseded)`])
        return
      }

      if (currErr) {
        setFetchError(`Failed to load curriculum: ${currErr.message}`)
        setLoadingCurric(false)
        setFetching(false)
        return
      }

      if (currData) {
        const activeCurriculumIds = new Set(items.map(i => i.curriculum_id).filter(Boolean))
        const unseededRows = (currData as CurriculumRow[]).filter(row => !activeCurriculumIds.has(row.id))
        setCurriculumRows(unseededRows)
      }
      setLoadingCurric(false)

      // Published, CBC-aligned ebook chapters linked to a real KICD
      // sub-strand for this grade/subject. Not week-matched yet \u2014
      // cbc_strands.term/week aren't populated. Teacher picks the week.
      const globalSubjectId = await resolveGlobalSubjectId(selectedSubjectObj.label)
      setDebugTrace(t => [...t.slice(-9), `req#${requestId} globalSubjectId=${globalSubjectId ?? 'NULL'}`])
      if (globalSubjectId) {
        const { data: strandRows } = await supabase
          .from('cbc_strands')
          .select('id')
          .eq('subject_id', globalSubjectId)
          .ilike('grade', selectedClassObj.grade)

        const strandIds = (strandRows ?? []).map(r => r.id)
        setDebugTrace(t => [...t.slice(-9), `req#${requestId} strandIds.length=${strandIds.length}`])

        if (strandIds.length > 0) {
          const { data: chapterRows, error: chapterErr } = await supabase
            .from('vibe_chapters')
            .select('id,title,cbc_strand,learning_outcomes,sub_strand_id,vibe_publications(id,title,cbc_aligned,status)')
            .in('sub_strand_id', strandIds)
            .eq('status', 'published')

          setDebugTrace(t => [...t.slice(-9), `req#${requestId} chapterRows=${chapterRows?.length ?? 'null'} err=${chapterErr?.message ?? 'none'}`])

          if (chapterErr) {
            console.error('ebook suggestion query failed:', chapterErr)
            setFetchError(`Ebook suggestion query failed: ${chapterErr.message}`)
          }"""

content = apply(content, old_block, new_block, "trace-part-1")

old_tail = """          if (requestId === schemeRequestIdRef.current) {
            setEbookSuggestions(validChapters.map((c: any) => {
              const pub = normalizePub(c.vibe_publications)
              return {
                chapterId: c.id,
                chapterTitle: c.title,
                publicationTitle: pub?.title ?? '',
                strandName: c.cbc_strand,"""

new_tail = """          setDebugTrace(t => [...t.slice(-9), `req#${requestId} validChapters.length=${validChapters.length} isCurrent=${requestId === schemeRequestIdRef.current}`])

          if (requestId === schemeRequestIdRef.current) {
            setEbookSuggestions(validChapters.map((c: any) => {
              const pub = normalizePub(c.vibe_publications)
              return {
                chapterId: c.id,
                chapterTitle: c.title,
                publicationTitle: pub?.title ?? '',
                strandName: c.cbc_strand,"""

content = apply(content, old_tail, new_tail, "trace-part-2")

with open(path, "w") as f:
    f.write(content)

print("Trace patch v2 applied successfully.")
