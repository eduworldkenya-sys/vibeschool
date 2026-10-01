import { supabase } from '@/lib/supabase'

export interface CanonicalRosterStudent {
  id: string
  name: string
  admission_number: string | null
  profile_id: string | null
}

export interface CanonicalEnrollmentRow {
  student_id: string
  is_current: boolean
  joined_at: string | null
  left_at: string | null
}

export interface CanonicalEnrollmentStudent extends CanonicalRosterStudent {
  isCurrent: boolean
  joinedAt: string | null
  leftAt: string | null
}

function uniqueStudentIds(rows: Array<{ student_id: string | null }>): string[] {
  return Array.from(new Set(rows.map(row => row.student_id).filter((id): id is string => Boolean(id))))
}

async function loadStudentsByIds(studentIds: string[]): Promise<Map<string, CanonicalRosterStudent>> {
  if (studentIds.length === 0) return new Map()

  const { data, error } = await supabase
    .from('students')
    .select('id,name,admission_number,profile_id,deleted_at')
    .in('id', studentIds)
    .is('deleted_at', null)

  if (error) throw error

  return new Map(
    (data ?? []).map(student => [
      student.id,
      {
        id: student.id,
        name: student.name,
        admission_number: student.admission_number ?? null,
        profile_id: student.profile_id ?? null,
      },
    ]),
  )
}

/**
 * Canonical current roster reader.
 *
 * student_classes is the school/class authority. Learner identity is resolved
 * in a second students query so RLS on students can never erase a valid
 * enrollment row through a nested PostgREST join.
 */
export async function loadCurrentClassRoster(input: {
  schoolId: string
  classId: string
}): Promise<CanonicalRosterStudent[]> {
  const { data: enrollmentRows, error: enrollmentError } = await supabase
    .from('student_classes')
    .select('student_id')
    .eq('school_id', input.schoolId)
    .eq('class_id', input.classId)
    .eq('is_current', true)

  if (enrollmentError) throw enrollmentError

  const studentIds = uniqueStudentIds(enrollmentRows ?? [])
  const studentsById = await loadStudentsByIds(studentIds)

  return studentIds
    .map(studentId => studentsById.get(studentId))
    .filter((student): student is CanonicalRosterStudent => Boolean(student))
}

export async function loadCurrentClassStudentIds(input: {
  schoolId: string
  classId: string
}): Promise<string[]> {
  const { data: enrollmentRows, error } = await supabase
    .from('student_classes')
    .select('student_id')
    .eq('school_id', input.schoolId)
    .eq('class_id', input.classId)
    .eq('is_current', true)

  if (error) throw error
  return uniqueStudentIds(enrollmentRows ?? [])
}

/**
 * Historical class membership reader. Enrollment history stays authoritative
 * in student_classes while learner identity is resolved independently.
 */
export async function loadClassEnrollmentHistory(input: {
  schoolId: string
  classId: string
}): Promise<CanonicalEnrollmentStudent[]> {
  const { data: enrollmentRows, error: enrollmentError } = await supabase
    .from('student_classes')
    .select('student_id,is_current,joined_at,left_at')
    .eq('school_id', input.schoolId)
    .eq('class_id', input.classId)
    .order('joined_at', { ascending: false })

  if (enrollmentError) throw enrollmentError

  const typedRows = (enrollmentRows ?? []) as CanonicalEnrollmentRow[]
  const studentsById = await loadStudentsByIds(uniqueStudentIds(typedRows))
  const deduped = new Map<string, CanonicalEnrollmentStudent>()

  for (const row of typedRows) {
    const student = studentsById.get(row.student_id)
    if (!student) continue
    const candidate: CanonicalEnrollmentStudent = {
      ...student,
      isCurrent: Boolean(row.is_current),
      joinedAt: row.joined_at ?? null,
      leftAt: row.left_at ?? null,
    }
    const existing = deduped.get(student.id)
    if (!existing || candidate.isCurrent) deduped.set(student.id, candidate)
  }

  return Array.from(deduped.values())
}

export async function loadClassEnrollmentForStudent(input: {
  schoolId: string
  classId: string
  studentId: string
}): Promise<CanonicalEnrollmentStudent | null> {
  const { data: enrollmentRow, error: enrollmentError } = await supabase
    .from('student_classes')
    .select('student_id,is_current,joined_at,left_at')
    .eq('school_id', input.schoolId)
    .eq('class_id', input.classId)
    .eq('student_id', input.studentId)
    .order('is_current', { ascending: false })
    .order('joined_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (enrollmentError) throw enrollmentError
  if (!enrollmentRow) return null

  const studentsById = await loadStudentsByIds([input.studentId])
  const student = studentsById.get(input.studentId)
  if (!student) return null

  return {
    ...student,
    isCurrent: Boolean(enrollmentRow.is_current),
    joinedAt: enrollmentRow.joined_at ?? null,
    leftAt: enrollmentRow.left_at ?? null,
  }
}
