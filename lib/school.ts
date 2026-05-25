import { supabase } from './supabase'

export async function resolveSchoolId(userId: string): Promise<string | null> {
  const [memberRes, teacherRes, profileRes] = await Promise.all([
    supabase.from('school_members').select('school_id').eq('profile_id', userId).maybeSingle(),
    supabase.from('teacher_profiles').select('school_id').eq('profile_id', userId).maybeSingle(),
    supabase.from('profiles').select('school_id').eq('id', userId).maybeSingle(),
  ])

  const schoolId =
    memberRes.data?.school_id ??
    teacherRes.data?.school_id ??
    profileRes.data?.school_id ??
    null

  // Self-heal — ensure teacher is in school_members
  if (schoolId && !memberRes.data?.school_id) {
    await supabase
      .from('school_members')
      .upsert(
        { school_id: schoolId, profile_id: userId, role: 'teacher' },
        { onConflict: 'school_id,profile_id', ignoreDuplicates: true }
      )
  }

  return schoolId
}
