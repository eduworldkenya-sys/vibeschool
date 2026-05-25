import re

# ─── Bug 37 + 38: dashboard/page.tsx ───────────────────────────────────────
path = 'app/teacher/page.tsx'
with open(path) as f:
    src = f.read()

# Fix 1: capture class_id and subject on each slot
old1 = """      const allSlots: Slot[] = (slotsRes.data ?? []).map((slot) => {
        const cls     = slot.classes as unknown as { name: string; stream: string | null } | null
        const subject = (slot.subjects as unknown as { name: string } | null)?.name ?? 'Unknown'
        return {
          id:               slot.id,
          subject,
          class:            cls ? cls.name + (cls.stream ? ` ${cls.stream}` : '') : '',
          room:             slot.room ?? '',
          start:            slot.start_time,
          end:              slot.end_time,
          day_of_week:      slot.day_of_week as number,
          attendanceMarked: markedSlotIds.has(slot.id),
        }
      })"""

new1 = """      const allSlots: Slot[] = (slotsRes.data ?? []).map((slot) => {
        const cls     = slot.classes as unknown as { name: string; stream: string | null } | null
        const subject = (slot.subjects as unknown as { name: string } | null)?.name ?? 'Unknown'
        return {
          id:               slot.id,
          subject,
          class:            cls ? cls.name + (cls.stream ? ` ${cls.stream}` : '') : '',
          room:             slot.room ?? '',
          start:            slot.start_time,
          end:              slot.end_time,
          day_of_week:      slot.day_of_week as number,
          attendanceMarked: markedSlotIds.has(slot.id),
          classId:          slot.class_id,
          subjectId:        slot.subject_id,
        }
      })"""

assert old1 in src, 'BLOCK NOT FOUND: slot mapping'
src = src.replace(old1, new1, 1)

# Fix 2: add classId and subjectId to Slot interface
old2 = """interface Slot {
  id:               string
  subject:          string
  class:            string
  room:             string
  start:            string
  end:              string
  day_of_week:      number
  attendanceMarked: boolean
}"""

new2 = """interface Slot {
  id:               string
  subject:          string
  class:            string
  room:             string
  start:            string
  end:              string
  day_of_week:      number
  attendanceMarked: boolean
  classId:          string
  subjectId:        string
}"""

assert old2 in src, 'BLOCK NOT FOUND: Slot interface'
src = src.replace(old2, new2, 1)

# Fix 3: Next Up card — Plan and Attend use slot.classId
old3 = """              <button onClick={() => router.push(myClassId ? '/teacher/lessonplan?classId=' + myClassId : '/teacher/lessonplan')} style={{ padding: '6px 12px', borderRadius: 10, border: `1.5px solid ${accent}`, background: 'transparent', color: accent, fontWeight: 700, fontSize: 12, cursor: 'pointer', fontFamily: 'inherit' }}>Plan</button>
              <button onClick={() => router.push(myClassId ? '/teacher/attendance?classId=' + myClassId : '/teacher/attendance')} style={{ padding: '6px 12px', borderRadius: 10, border: 'none', background: accent, color: '#fff', fontWeight: 700, fontSize: 12, cursor: 'pointer', fontFamily: 'inherit' }}>Attend</button>"""

new3 = """              <button onClick={() => router.push('/teacher/lessonplan?classId=' + slot.classId + '&subjectId=' + slot.subjectId)} style={{ padding: '6px 12px', borderRadius: 10, border: `1.5px solid ${accent}`, background: 'transparent', color: accent, fontWeight: 700, fontSize: 12, cursor: 'pointer', fontFamily: 'inherit' }}>Plan</button>
              <button onClick={() => router.push('/teacher/attendance?classId=' + slot.classId)} style={{ padding: '6px 12px', borderRadius: 10, border: 'none', background: accent, color: '#fff', fontWeight: 700, fontSize: 12, cursor: 'pointer', fontFamily: 'inherit' }}>Attend</button>"""

assert old3 in src, 'BLOCK NOT FOUND: Next Up buttons'
src = src.replace(old3, new3, 1)

# Fix 4: Today's timetable slot Attend button uses slot.classId
old4 = """                {!s.attendanceMarked && (
                  <button onClick={() => router.push(myClassId ? '/teacher/attendance?classId=' + myClassId : '/teacher/attendance')} style={{ flexShrink: 0, padding: '5px 10px', borderRadius: 8, border: 'none', background: accent, color: '#fff', fontWeight: 700, fontSize: 11, cursor: 'pointer', fontFamily: 'inherit' }}>Attend</button>
                )}"""

new4 = """                {!s.attendanceMarked && (
                  <button onClick={() => router.push('/teacher/attendance?classId=' + s.classId)} style={{ flexShrink: 0, padding: '5px 10px', borderRadius: 8, border: 'none', background: accent, color: '#fff', fontWeight: 700, fontSize: 11, cursor: 'pointer', fontFamily: 'inherit' }}>Attend</button>
                )}"""

assert old4 in src, 'BLOCK NOT FOUND: timetable Attend button'
src = src.replace(old4, new4, 1)

with open(path, 'w') as f:
    f.write(src)
print('Done: page.tsx (bugs 37+38) patched')

# ─── Bug 39: classhub/page.tsx — load classes via teacher_classes ───────────
path2 = 'app/teacher/classhub/page.tsx'
with open(path2) as f:
    src2 = f.read()

old5 = """    const classQuery = supabase.from('classes').select('*').eq('teacher_id', uid).order('created_at', { ascending: true })

    const [classRes, subjectRes] = await Promise.all([classQuery, subjectQuery])"""

new5 = """    // Load class IDs where this teacher is the class teacher
    const tcClassRes = await supabase
      .from('teacher_classes')
      .select('class_id')
      .eq('teacher_id', uid)
      .eq('is_class_teacher', true)

    const classIds = Array.from(new Set(
      (tcClassRes.data ?? []).map((r: { class_id: string }) => r.class_id).filter(Boolean)
    ))

    const classQuery = classIds.length > 0
      ? supabase.from('classes').select('*').in('id', classIds).order('created_at', { ascending: true })
      : supabase.from('classes').select('*').eq('teacher_id', uid).order('created_at', { ascending: true })

    const [classRes, subjectRes] = await Promise.all([classQuery, subjectQuery])"""

assert old5 in src2, 'BLOCK NOT FOUND: classQuery'
src2 = src2.replace(old5, new5, 1)

with open(path2, 'w') as f:
    f.write(src2)
print('Done: classhub/page.tsx (bug 39) patched')
