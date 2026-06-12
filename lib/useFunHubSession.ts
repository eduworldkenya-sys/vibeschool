import { supabase } from '@/lib/supabase'

export interface FunHubSessionParams {
  game_slug: string
  subject: string
  grade: number
  score: number
  xp_earned: number
  correct: number
  total: number
  duration_secs?: number
  streak_max?: number
}

export interface FunHubSessionResult {
  session_id: string
  xp_earned: number
  total_xp: number
  level: number
  weekly_xp: number
  monthly_xp: number
  current_streak: number
  longest_streak: number
}

export async function saveFunHubSession(
  params: FunHubSessionParams
): Promise<FunHubSessionResult | null> {
  try {
    const { data, error } = await supabase.rpc('funhub_save_session', {
      p_game_slug:     params.game_slug,
      p_subject:       params.subject,
      p_grade:         params.grade,
      p_score:         params.score,
      p_xp_earned:     params.xp_earned,
      p_correct:       params.correct,
      p_total:         params.total,
      p_duration_secs: params.duration_secs ?? 0,
      p_streak_max:    params.streak_max ?? 0,
    })
    if (error) { console.error('[FunHub] save_session error:', error); return null }
    return data as FunHubSessionResult
  } catch (e) {
    console.error('[FunHub] save_session exception:', e)
    return null
  }
}
