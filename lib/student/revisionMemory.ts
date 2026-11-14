import { supabase } from '@/lib/supabase'

export interface RevisionMemoryRecord {
  mistakeId: string
  nextReviewAt: string
  lastRemembered: boolean | null
  recallCount: number
}

export async function getMyRevisionMemory(): Promise<RevisionMemoryRecord[]> {
  const { data: auth, error: authError } = await supabase.auth.getUser()
  if (authError) throw new Error(authError.message)
  if (!auth.user) throw new Error('Sign in to view your revision.')
  const { data, error } = await supabase
    .from('student_revision_memory')
    .select('mistake_id,next_review_at,last_remembered,recall_count')
    .order('next_review_at', { ascending: true })
    .limit(250)
  if (error) throw new Error(error.message)
  return (data ?? []).flatMap(row => {
    if (typeof row.mistake_id !== 'string' || typeof row.next_review_at !== 'string') return []
    return [{
      mistakeId: row.mistake_id,
      nextReviewAt: row.next_review_at,
      lastRemembered: typeof row.last_remembered === 'boolean' ? row.last_remembered : null,
      recallCount: typeof row.recall_count === 'number' ? row.recall_count : 0,
    }]
  })
}

export async function recordRevisionRecall(mistakeId: string, remembered: boolean): Promise<{ nextReviewAt: string }> {
  if (!mistakeId) throw new Error('Choose a revision item first.')
  const { data, error } = await supabase.rpc('student_record_revision_recall', {
    p_mistake_id: mistakeId,
    p_remembered: remembered,
  })
  if (error) throw new Error(error.message)
  if (!data || typeof data !== 'object' || Array.isArray(data)) throw new Error('Revision was not confirmed.')
  const row = data as Record<string, unknown>
  if (row.recorded !== true || typeof row.next_review_at !== 'string') throw new Error('Revision was not confirmed.')
  return { nextReviewAt: row.next_review_at }
}
