import { supabase } from '@/lib/supabase'

export type LearnerProfileViewer = 'student' | 'parent' | 'teacher' | 'school_admin'

export interface LearnerCoreIdentity {
  studentId: string
  profileId: string | null
  name: string
  admissionNumber: string | null
  dateOfBirth: string | null
  gender: string | null
  classId: string | null
  className: string
  schoolId: string | null
  schoolName: string
  avatarUrl: string
}

/**
 * Canonical learner identity loader.
 * `students` owns school identity; profiles only supplies account presentation.
 * Role pages may enrich this result with authorized domain data, but must not
 * rebuild or override these identity fields from competing tables.
 */
export async function getLearnerCoreIdentity(studentId: string): Promise<LearnerCoreIdentity> {
  const { data: student, error } = await supabase
    .from('students')
    .select('id,profile_id,name,admission_number,date_of_birth,gender,class_id')
    .eq('id', studentId)
    .single()

  if (error || !student) throw new Error('Learner identity could not be loaded.')

  let className = ''
  let schoolId: string | null = null
  let schoolName = ''
  if (student.class_id) {
    const { data: cls } = await supabase
      .from('classes')
      .select('name,stream,school_id')
      .eq('id', student.class_id)
      .maybeSingle()
    if (cls) {
      className = `${cls.name ?? ''}${cls.stream ? ` ${cls.stream}` : ''}`.trim()
      schoolId = cls.school_id ?? null
      if (schoolId) {
        const { data: school } = await supabase.from('schools').select('name').eq('id', schoolId).maybeSingle()
        schoolName = school?.name ?? ''
      }
    }
  }

  let avatarUrl = ''
  if (student.profile_id) {
    const { data: account } = await supabase.from('profiles').select('avatar_url').eq('id', student.profile_id).maybeSingle()
    avatarUrl = account?.avatar_url ?? ''
  }

  return {
    studentId: student.id,
    profileId: student.profile_id ?? null,
    name: student.name,
    admissionNumber: student.admission_number ?? null,
    dateOfBirth: student.date_of_birth ?? null,
    gender: student.gender ?? null,
    classId: student.class_id ?? null,
    className,
    schoolId,
    schoolName,
    avatarUrl,
  }
}
