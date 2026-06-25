path = '/data/data/com.termux/files/home/vibeschool/app/admin/academics/gradebook/page.tsx'
with open(path, 'r') as f:
    src = f.read()

src = src.replace(
    'const CBC_GRADES = ["PP1","PP2","Grade 1","Grade 2","Grade 3"]',
    'const CBC_GRADES = ["PP1","PP2","Grade 1","Grade 2","Grade 3","Grade 4","Grade 5","Grade 6","Grade 7","Grade 8","Grade 9"]'
)

old_strand_q = """    if (cls && isCBC(cls.name)) {
      const { data: strandData } = await supabase
        .from("strands")
        .select("id,name")
        .eq("school_id", sid)
      setStrands((strandData ?? []) as StrandRow[])
    }"""

new_strand_q = """    if (cls && isCBC(cls.name)) {
      const firstSubjectId = (subjectRes.data ?? [])[0]?.id
      const subNameRes = firstSubjectId ? await supabase.from("subjects").select("name").eq("id", firstSubjectId).single() : { data: null }
      const subjectName = subNameRes.data?.name ?? ''
      if (subjectName) {
        const { data: strandData } = await supabase.from("curriculum").select("id,strand").eq("grade", cls.name).eq("subject", subjectName)
        const seen = new Set()
        const unique = []
        for (const r of (strandData ?? [])) {
          if (!seen.has(r.strand)) { seen.add(r.strand); unique.push({ id: r.id, name: r.strand }) }
        }
        setStrands(unique)
      }
    }"""

src = src.replace(old_strand_q, new_strand_q)

with open(path, 'w') as f:
    f.write(src)
print("gradebook: Done")
