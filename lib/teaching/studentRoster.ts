import { supabase } from '@/lib/supabase'

export interface CanonicalRosterStudent {
  id: string
  name: string
  admission_number: string | null
  profile_id: string | null
}

export interface CanonicalEnrollmentStudent extends CanonicalRosterStudent {
  isCurrent: boolean
  joinedAt: string | null
  leftAt: string | null
}

interface RosterRpcRow {
  student_id: string
  name: string
  admission_number: string | null
  profile_id: string | null
  is_current: boolean
  joined_at: string | null
  left_at: string | null
}

async function loadRosterRows(input: {
  schoolId: string
  classId: string
  includeHistory: boolean
  studentId?: string | null
}): Promise<RosterRpcRow[]> {
  const { data, error } = await supabase.rpc('teacher_get_class_roster', {
    p_school_id: input.schoolId,
    p_class_id: input.classId,
    p_include_history: input.includeHistory,
    p_student_id: input.studentId ?? null,
  })

  if (error) throw error
  return (data ?? []) as RosterRpcRow[]
}

/**
 * Canonical Teacher OS roster reader.
 *
 * The database RPC verifies live teacher membership + class assignment before
 * projecting learner identity from student_classes. That avoids nested
 * PostgREST/RLS collapse for current learners and preserves narrow historical
 * access without weakening public.students RLS.
 */
export async function loadCurrentClassRoster(input: {
  schoolId: string
  classId: string
}): Promise<CanonicalRosterStudent[]> {
  const rows = await loadRosterRows({ ...input, includeHistory: false })
  const seen = new Set<string>()

  return rows
    .filter(row => row.is_current && !seen.has(row.student_id) && seen.add(row.student_id))
    .map(row => ({
      id: row.student_id,
      name: row.name,
      admission_number: row.admission_number ?? null,
      profile_id: row.profile_id ?? null,
    }))
}

export async function loadCurrentClassStudentIds(input: {
  schoolId: string
  classId: string
}): Promise<string[]> {
  const rows = await loadRosterRows({ ...input, includeHistory: false })
  return Array.from(new Set(rows.filter(row => row.is_current).map(row => row.student_id)))
}

export async function loadClassEnrollmentHistory(input: {
  schoolId: string
  classId: string
}): Promise<CanonicalEnrollmentStudent[]> {
  const rows = await loadRosterRows({ ...input, includeHistory: true })
  const deduped = new Map<string, CanonicalEnrollmentStudent>()

  for (const row of rows) {
    const candidate: CanonicalEnrollmentStudent = {
      id: row.student_id,
      name: row.name,
      admission_number: row.admission_number ?? null,
      profile_id: row.profile_id ?? null,
      isCurrent: Boolean(row.is_current),
      joinedAt: row.joined_at ?? null,
      leftAt: row.left_at ?? null,
    }
    const existing = deduped.get(candidate.id)
    if (!existing || candidate.isCurrent) deduped.set(candidate.id, candidate)
  }

  return Array.from(deduped.values())
}

export async function loadClassEnrollmentForStudent(input: {
  schoolId: string
  classId: string
  studentId: string
}): Promise<CanonicalEnrollmentStudent | null> {
  const rows = await loadRosterRows({
    schoolId: input.schoolId,
    classId: input.classId,
    includeHistory: true,
    studentId: input.studentId,
  })
  const row = rows[0]
  if (!row) return null

  return {
    id: row.student_id,
    name: row.name,
    admission_number: row.admission_number ?? null,
    profile_id: row.profile_id ?? null,
    isCurrent: Boolean(row.is_current),
    joinedAt: row.joined_at ?? null,
    leftAt: row.left_at ?? null,
  }
}
