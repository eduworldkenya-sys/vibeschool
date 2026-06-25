path = '/data/data/com.termux/files/home/vibeschool/app/teacher/assessment/page.tsx'
with open(path, 'r') as f:
    src = f.read()

src = src.replace(
    "interface StrandOption  { id: string; name: string }",
    "interface StrandOption  { id: string; name: string; sub_strand: string; topic: string }"
)

old_q = """    const [strandsRes, scRes] = await Promise.all([
      supabase.from('strands').select('id, name').eq('subject_id', subjectId).order('name'),
      supabase.from('student_classes').select('student_id').eq('class_id', classId).eq('is_current', true),
    ])

    if (loadId !== loadIdRef.current) return
    setStrands(strandsRes.error ? [] : (strandsRes.data ?? []) as StrandOption[])"""

new_q = """    const clsRes = await supabase.from('classes').select('name').eq('id', classId).single()
    const grade  = clsRes.data?.name ?? ''
    const subRes = await supabase.from('subjects').select('name').eq('id', subjectId).single()
    const subjectName = subRes.data?.name ?? ''

    const [strandsRes, scRes] = await Promise.all([
      supabase.from('curriculum').select('id, strand, sub_strand, topic').eq('grade', grade).eq('subject', subjectName).order('strand'),
      supabase.from('student_classes').select('student_id').eq('class_id', classId).eq('is_current', true),
    ])

    if (loadId !== loadIdRef.current) return

    const seen = new Set()
    const uniqueStrands = []
    for (const r of (strandsRes.data ?? [])) {
      if (!seen.has(r.strand)) {
        seen.add(r.strand)
        uniqueStrands.push({ id: r.id, name: r.strand, sub_strand: r.sub_strand ?? '', topic: r.topic ?? '' })
      }
    }
    setStrands(strandsRes.error ? [] : uniqueStrands)"""

src = src.replace(old_q, new_q)

with open(path, 'w') as f:
    f.write(src)
print("assessment: Done")
