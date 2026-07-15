import sys

path = "/data/data/com.termux/files/home/vibeschool/app/teacher/scheme/page.tsx"

with open(path, "r") as f:
    content = f.read()

def apply(content, old, new, label):
    count = content.count(old)
    if count != 1:
        print(f"ERROR [{label}]: expected 1 match, found {count}. Aborting.")
        sys.exit(1)
    return content.replace(old, new)

old_block = """        if (strandIds.length > 0) {
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
        }"""

new_block = """        if (strandIds.length > 0) {
          const { data: chapterRows, error: chapterErr } = await supabase
            .from('vibe_chapters')
            .select('id,title,cbc_strand,learning_outcomes,sub_strand_id,vibe_publications(id,title,cbc_aligned,status)')
            .in('sub_strand_id', strandIds)
            .eq('status', 'published')

          if (chapterErr) {
            console.error('ebook suggestion query failed:', chapterErr)
            setFetchError(`Ebook suggestion query failed: ${chapterErr.message}`)
          }

          // vibe_publications may come back as a single object or a
          // one-item array depending on how Supabase resolves the FK —
          // normalize both shapes.
          const normalizePub = (pub: any) => Array.isArray(pub) ? pub[0] : pub

          const validChapters = (chapterRows ?? []).filter((c: any) => {
            const pub = normalizePub(c.vibe_publications)
            return pub?.cbc_aligned === true && pub?.status === 'published'
          })

          if (requestId === schemeRequestIdRef.current) {
            setEbookSuggestions(validChapters.map((c: any) => {
              const pub = normalizePub(c.vibe_publications)
              return {
                chapterId: c.id,
                chapterTitle: c.title,
                publicationTitle: pub?.title ?? '',
                strandName: c.cbc_strand,
                learningOutcomes: c.learning_outcomes ?? [],
              }
            }))
          }
        } else {
          setEbookSuggestions([])
        }"""

content = apply(content, old_block, new_block, "debug-fix")

with open(path, "w") as f:
    f.write(content)

print("Debug fix applied successfully.")
