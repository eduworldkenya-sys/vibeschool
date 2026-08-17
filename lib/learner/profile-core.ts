import { supabase } from '@/lib/supabase'

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
  autonomyLevel: number | null
  parentLinkedAt: string | null
  createdAt: string
}

interface LearnerCoreOptions {
  expectedClassId?: string
}

interface StudentIdentityRow {
  id: string
  profile_id: string | null
  name: string
  admission_number: string | null
  date_of_birth: string | null
  gender: string | null
  class_id: string | null
  autonomy_level: number | null
  parent_linked_at: string | null
  created_at: string | null
}

async function hydrateIdentity(student: StudentIdentityRow): Promise<LearnerCoreIdentity> {
  let className = ''
  let schoolId: string | null = null
  let schoolName = ''

  if (student.class_id) {
    const { data: cls, error: classError } = await supabase
      .from('classes')
      .select('name,stream,school_id')
      .eq('id', student.class_id)
      .maybeSingle()
    if (classError) throw new Error('Learner class could not be loaded.')
    if (cls) {
      className = `${cls.name ?? ''}${cls.stream ? ` ${cls.stream}` : ''}`.trim()
      schoolId = cls.school_id ?? null
      if (schoolId) {
        const { data: school, error: schoolError } = await supabase.from('schools').select('name').eq('id', schoolId).maybeSingle()
        if (schoolError) throw new Error('Learner school could not be loaded.')
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
    autonomyLevel: student.autonomy_level ?? null,
    parentLinkedAt: student.parent_linked_at ?? null,
    createdAt: student.created_at ?? '',
  }
}

async function fetchCoreStudent(column: 'id' | 'profile_id', value: string, options: LearnerCoreOptions = {}) {
  let query = supabase
    .from('students')
    .select('id,profile_id,name,admission_number,date_of_birth,gender,class_id,autonomy_level,parent_linked_at,created_at')
    .eq(column, value)

  if (options.expectedClassId) query = query.eq('class_id', options.expectedClassId)

  const { data: student, error } = await query.single()
  if (error || !student) throw new Error('Learner identity could not be loaded.')
  return hydrateIdentity(student as StudentIdentityRow)
}

/** Canonical lookup when the school learner id is already known. */
export function getLearnerCoreIdentity(studentId: string, options?: LearnerCoreOptions): Promise<LearnerCoreIdentity> {
  return fetchCoreStudent('id', studentId, options)
}

/** Canonical lookup for the authenticated learner account. */
export function getLearnerCoreIdentityForProfile(profileId: string): Promise<LearnerCoreIdentity> {
  return fetchCoreStudent('profile_id', profileId)
}
