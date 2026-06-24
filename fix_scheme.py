import re

path = '/data/data/com.termux/files/home/vibeschool/app/teacher/scheme/page.tsx'
with open(path, 'r') as f:
    src = f.read()

# 1. Expand Strand interface
src = src.replace(
    "interface Strand        { id: string; name: string }",
    "interface Strand        { id: string; name: string; sub_strand: string; topic: string }"
)

# 2. Expand CurriculumRow interface
src = src.replace(
    "interface CurriculumRow { grade: string; subject: string; strand: string; week: number; term: number }",
    "interface CurriculumRow { id: string; grade: string; subject: string; strand: string; sub_strand: string; topic: string; week: number; term: number }"
)

# 3. Fix loadStrands — replace strands+progress parallel query
old_load = """    const [strandsRes, progressRes] = await Promise.all([
      supabase
        .from('strands')
        .select('id,name')
        .eq('subject_id', selectedSubject)
        .eq('school_id', schoolId),
      supabase
        .from('strand_progress')
        .select('strand_id,term,week,status,notes')
        .eq('teacher_id', uid)
        .eq('class_id', selectedClass)
        .eq('subject_id', selectedSubject)
        .eq('term', selectedTerm),
    ])

    if (strandsRes.error)  { setFetchError(strandsRes.error.message);  setFetching(false); return }
    if (progressRes.error) { setFetchError(progressRes.error.message); setFetching(false); return }

    setStrands(strandsRes.data  ?? [])
    setProgress(progressRes.data ?? [])"""

new_load = """    const cls  = classes.find(c => c.id === selectedClass)
    const subj = subjects.find(s => s.id === selectedSubject)
    if (!cls || !subj) { setFetching(false); return }

    const [strandsRes, progressRes] = await Promise.all([
      supabase
        .from('curriculum')
        .select('id,strand,sub_strand,topic,week,term,grade,subject')
        .eq('grade', cls.grade)
        .eq('subject', subj.label)
        .eq('term', selectedTerm)
        .eq('week', selectedWeek)
        .order('strand'),
      supabase
        .from('strand_progress')
        .select('curriculum_id,term,week,status,notes')
        .eq('teacher_id', uid)
        .eq('class_id', selectedClass)
        .eq('subject_id', selectedSubject)
        .eq('term', selectedTerm),
    ])

    if (strandsRes.error)  { setFetchError(strandsRes.error.message);  setFetching(false); return }
    if (progressRes.error) { setFetchError(progressRes.error.message); setFetching(false); return }

    const mappedStrands: Strand[] = (strandsRes.data ?? []).map((r: CurriculumRow) => ({
      id:         r.id,
      name:       r.strand,
      sub_strand: r.sub_strand,
      topic:      r.topic,
    }))
    setStrands(mappedStrands)
    setProgress((progressRes.data ?? []).map((p: { curriculum_id: string; term: number; week: number; status: string; notes: string | null }) => ({
      strand_id: p.curriculum_id,
      term:      p.term,
      week:      p.week,
      status:    p.status,
      notes:     p.notes,
    })))"""

src = src.replace(old_load, new_load)

# 4. Fix updateStatus — use curriculum_id instead of strand_id
src = src.replace(
    "    const { error } = await supabase.from('strand_progress').upsert({\n      teacher_id: uid,\n      class_id:   selectedClass,\n      subject_id: selectedSubject,\n      school_id:  schoolId,\n      strand_id:  strandId,",
    "    const { error } = await supabase.from('strand_progress').upsert({\n      teacher_id:    uid,\n      class_id:      selectedClass,\n      subject_id:    selectedSubject,\n      school_id:     schoolId,\n      curriculum_id: strandId,\n      strand_id:     strandId,"
)

src = src.replace(
    "    }, { onConflict: 'teacher_id,class_id,strand_id,term,week' })",
    "    }, { onConflict: 'teacher_id,class_id,curriculum_id,term,week' })"
)

# 5. Fix coverage dot calc — the broken .some() that never references c
old_coverage = """      const delivered = weekStrands.filter(c =>
        progress.some(p =>
          p.week   === w &&
          p.status === 'done'
        )
      ).length"""

new_coverage = """      const delivered = weekStrands.filter(c =>
        progress.some(p =>
          p.strand_id === c.id &&
          p.week      === w    &&
          p.status    === 'done'
        )
      ).length"""

src = src.replace(old_coverage, new_coverage)

# 6. StrandCard — show sub_strand and topic below the name
old_strand_name = "          }}>{strand.name}</div>"
new_strand_name = """          }}>{strand.name}</div>
          {strand.sub_strand && (
            <div style={{ fontSize: 11, color: C.text3, marginTop: 2, marginRight: 10 }}>
              {strand.sub_strand}{strand.topic ? ` · ${strand.topic}` : ''}
            </div>
          )}"""

src = src.replace(old_strand_name, new_strand_name)

with open(path, 'w') as f:
    f.write(src)

print("Done")
