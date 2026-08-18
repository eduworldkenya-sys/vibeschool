import { supabase } from '@/lib/supabase'

const POINT_VALUES: Record<string, number> = {
  complete_ebook:   20,
  complete_epage:   10,
  submit_content:   15,
  content_viewed:    2,
  daily_streak:     25,
}

export async function awardPoints(
  _studentId: string,
  action: keyof typeof POINT_VALUES,
  contentId?: string
): Promise<void> {
  if (!POINT_VALUES[action]) return
  const { error } = await supabase.rpc('student_award_vibelearn_points', {
    p_action: action,
    p_content_id: contentId ?? null,
  })
  if (error) throw error
}

export async function updateStreak(_studentId: string): Promise<void> {
  const { error } = await supabase.rpc('student_touch_vibelearn_streak')
  if (error) throw error
}