import { supabase } from '@/lib/supabase'

export async function getSchoolId(uid: string): Promise<string | null> {
  const [memberRes, teacherRes, profileRes] = await Promise.all([
    supabase.from('school_members').select('school_id').eq('profile_id', uid).maybeSingle(),
    supabase.from('teacher_profiles').select('school_id').eq('profile_id', uid).maybeSingle(),
    supabase.from('profiles').select('school_id').eq('id', uid).single(),
  ])
  return (
    memberRes.data?.school_id ??
    teacherRes.data?.school_id ??
    profileRes.data?.school_id ??
    null
  )
}
