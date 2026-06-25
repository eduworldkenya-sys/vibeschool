path = '/data/data/com.termux/files/home/vibeschool/app/teacher/subjecthub/page.tsx'
with open(path, 'r') as f:
    src = f.read()

old_block = """    const [lpRes, assRes, attRes, slotRes, resRes, strandPerfRes, strandNameRes, allStrandsRes, progressRes] = await Promise.all([
      supabase.from('lesson_plans').select('id, status, created_at').eq('subject_id', subjectId).eq('teacher_id', currentId).gte('created_at', termStart),
      supabase.from('cbc_assessments').select('id, created_at').eq('subject_id', subjectId).eq('teacher_id', currentId).gte('created_at', termStart),
      supabase.from('cbc_assessments').select('strand_id, performance').eq('subject_id', subjectId).eq('teacher_id', currentId).gte('created_at', termStart),
      supabase.from('strands').select('id, name').eq('subject_id', subjectId),
      schoolId ? supabase.from('strands').select('id').eq('subject_id', subjectId).eq('school_id', schoolId) : Promise.resolve({ data: [] }),
      schoolId ? supabase.from('strand_progress').select('strand_id, status').eq('teacher_id', currentId).eq('subject_id', subjectId).eq('school_id', schoolId).eq('term', activeTerm) : Promise.resolve({ data: [] }),
      supabase.from('attendance').select('id, date').eq('teacher_id', currentId).eq('subject_id', subjectId).gte('date', weekAgo),
      supabase.from('timetable_slots').select('id, start_time, end_time, day_of_week, subject_id, class_id, subjects(name), classes(name, stream)').eq('subject_id', subjectId).eq('teacher_id', currentId),
      Promise.resolve({ data: [] }), // resources table not yet created
    ])"""

new_block = """    const [subNameRes2, tcRes2] = await Promise.all([
      supabase.from('subjects').select('name').eq('id', subjectId).single(),
      supabase.from('teacher_classes').select('class_id').eq('teacher_id', currentId).eq('subject_id', subjectId).limit(1),
    ])
    const subjectName2 = subNameRes2.data?.name ?? ''
    const firstClassId = tcRes2.data?.[0]?.class_id ?? null
    const gradeRes = firstClassId ? await supabase.from('classes').select('name').eq('id', firstClassId).single() : { data: null }
    const gradeForCurriculum = gradeRes.data?.name ?? ''

    const [lpRes, assRes, attRes, slotRes, resRes, strandPerfRes, strandNameRes, allStrandsRes, progressRes] = await Promise.all([
      supabase.from('lesson_plans').select('id, status, created_at').eq('subject_id', subjectId).eq('teacher_id', currentId).gte('created_at', termStart),
      supabase.from('cbc_assessments').select('id, created_at').eq('subject_id', subjectId).eq('teacher_id', currentId).gte('created_at', termStart),
      supabase.from('cbc_assessments').select('strand_id, performance').eq('subject_id', subjectId).eq('teacher_id', currentId).gte('created_at', termStart),
      gradeForCurriculum && subjectName2 ? supabase.from('curriculum').select('id, strand').eq('grade', gradeForCurriculum).eq('subject', subjectName2) : Promise.resolve({ data: [] }),
      gradeForCurriculum && subjectName2 ? supabase.from('curriculum').select('strand').eq('grade', gradeForCurriculum).eq('subject', subjectName2) : Promise.resolve({ data: [] }),
      schoolId ? supabase.from('strand_progress').select('curriculum_id, status').eq('teacher_id', currentId).eq('subject_id', subjectId).eq('school_id', schoolId).eq('term', activeTerm) : Promise.resolve({ data: [] }),
      supabase.from('attendance').select('id, date').eq('teacher_id', currentId).eq('subject_id', subjectId).gte('date', weekAgo),
      supabase.from('timetable_slots').select('id, start_time, end_time, day_of_week, subject_id, class_id, subjects(name), classes(name, stream)').eq('subject_id', subjectId).eq('teacher_id', currentId),
      Promise.resolve({ data: [] }),
    ])"""

src = src.replace(old_block, new_block)

src = src.replace(
    "      (strandNameRes.data ?? []).map((s: { id: string; name: string }) => [s.id, s.name])",
    "      (strandNameRes.data ?? []).map((s: { id: string; strand: string }) => [s.id, s.strand])"
)

old_total = """    const totalStrands = (allStrandsRes.data ?? []).length
    if (totalStrands > 0) {
      const doneStrandIds = new Set(
        ((progressRes.data ?? []) as { strand_id: string; status: string }[])
          .filter(p => p.status === 'done')
          .map(p => p.strand_id)
      )
      setCurriculumPct(Math.round((doneStrandIds.size / totalStrands) * 100))
    } else {
      setCurriculumPct(null)
    }"""

new_total = """    const distinctStrands = new Set(((allStrandsRes.data ?? []) as { strand: string }[]).map(r => r.strand))
    const totalStrands = distinctStrands.size
    if (totalStrands > 0) {
      const doneCurriculumIds = new Set(
        ((progressRes.data ?? []) as { curriculum_id: string; status: string }[])
          .filter(p => p.status === 'done')
          .map(p => p.curriculum_id)
      )
      setCurriculumPct(Math.round((doneCurriculumIds.size / totalStrands) * 100))
    } else {
      setCurriculumPct(null)
    }"""

src = src.replace(old_total, new_total)

with open(path, 'w') as f:
    f.write(src)
print("subjecthub: Done")
