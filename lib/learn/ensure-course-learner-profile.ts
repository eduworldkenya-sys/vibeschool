import { supabase } from '@/lib/supabase'

/**
 * This legacy course subsystem has an account-linked learner_profiles table.
 * Keep its id equal to auth.users.id; do not create a second auth identity,
 * a school/student enrollment, or an independent CPA identity.
 *
 * The existing owner-only RLS policy protects inserts and retries.
 */
export async function ensureCourseLearnerProfile(userId: string): Promise<void> {
  const { data: { user }, error: sessionError } = await supabase.auth.getUser()
  if (sessionError || !user || user.id !== userId) {
    throw new Error('Sign in again to save your course progress.')
  }

  const { error } = await supabase
    .from('learner_profiles')
    .upsert({ id: user.id }, { onConflict: 'id', ignoreDuplicates: true })

  if (error) {
    throw new Error('Your learning progress could not be prepared. Please retry.')
  }
}
