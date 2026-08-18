import { nairobiDateStr } from '@/lib/time'
import { supabase } from '@/lib/supabase'

const POINT_VALUES: Record<string, number> = {
  complete_ebook:   20,
  complete_epage:   10,
  submit_content:   15,
  content_viewed:    2,
  daily_streak:     25,
}

async function resolveCanonicalStudentId(): Promise<string> {
  const { data, error } = await supabase.rpc('current_student_id')
  if (error) throw error
  if (typeof data !== 'string' || !data) throw new Error('Canonical learner identity is unavailable.')
  return data
}

export async function awardPoints(
  _studentId: string,
  action: keyof typeof POINT_VALUES,
  contentId?: string
): Promise<void> {
  const points = POINT_VALUES[action]
  if (!points) return
  const studentId = await resolveCanonicalStudentId()
  await supabase.from('vibelearn_points').insert({
    student_id: studentId,
    action,
    points,
    content_id: contentId ?? null,
  })
}

export async function updateStreak(_studentId: string): Promise<void> {
  const studentId = await resolveCanonicalStudentId()
  const today = nairobiDateStr()

  const { data } = await supabase
    .from('vibelearn_streaks')
    .select('current_streak, longest_streak, last_active_date')
    .eq('student_id', studentId)
    .maybeSingle()

  if (!data) {
    await supabase.from('vibelearn_streaks').insert({
      student_id:     studentId,
      current_streak: 1,
      longest_streak: 1,
      last_active_date: today,
    })
    await awardPoints(studentId, 'daily_streak')
    return
  }

  const last    = data.last_active_date
  const current = data.current_streak ?? 0
  const longest = data.longest_streak ?? 0

  if (last === today) return

  const yesterday = new Date()
  yesterday.setDate(yesterday.getDate() - 1)
  const yesterdayStr = nairobiDateStr(yesterday)

  const newStreak  = last === yesterdayStr ? current + 1 : 1
  const newLongest = Math.max(longest, newStreak)
  const isNewDay   = last !== today

  await supabase.from('vibelearn_streaks').upsert({
    student_id:       studentId,
    current_streak:   newStreak,
    longest_streak:   newLongest,
    last_active_date: today,
    updated_at:       new Date().toISOString(),
  })

  if (isNewDay) await awardPoints(studentId, 'daily_streak')
}