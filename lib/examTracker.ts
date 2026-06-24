import { nairobiDateStr } from '@/lib/time'
import { StudentStreak } from '@/lib/types'

const TRACKER_KEY = 'vibe_exam_count'
const STREAK_KEY  = 'vibe_student_streak'

export function getExamCount(): number {
  if (typeof window === 'undefined') return 0
  try {
    const val = window.localStorage.getItem(TRACKER_KEY)
    return val ? parseInt(val, 10) || 0 : 0
  } catch {
    return 0
  }
}

export function incrementExamCount(): void {
  if (typeof window === 'undefined') return
  try {
    window.localStorage.setItem(TRACKER_KEY, (getExamCount() + 1).toString())
    updateDailyStreak()
  } catch {
    // swallow
  }
}

// FIX: fires exactly at 3, not forever after
export function shouldShowRegisterPrompt(): boolean {
  return getExamCount() === 3
}

export function getStudentStreak(): StudentStreak {
  if (typeof window === 'undefined') return { currentStreak: 0, lastActiveDate: '' }
  try {
    const raw = window.localStorage.getItem(STREAK_KEY)
    if (!raw) return { currentStreak: 0, lastActiveDate: '' }
    return JSON.parse(raw) as StudentStreak
  } catch {
    return { currentStreak: 0, lastActiveDate: '' }
  }
}

function updateDailyStreak(): void {
  if (typeof window === 'undefined') return
  try {
    const todayStr     = nairobiDateStr()
    const streakData   = getStudentStreak()
    if (streakData.lastActiveDate === todayStr) return

    const yesterday    = new Date()
    yesterday.setDate(yesterday.getDate() - 1)
    const yesterdayStr = nairobiDateStr(yesterday)

    const newStreak = streakData.lastActiveDate === yesterdayStr
      ? streakData.currentStreak + 1
      : 1

    window.localStorage.setItem(STREAK_KEY, JSON.stringify({
      currentStreak:  newStreak,
      lastActiveDate: todayStr,
    }))
  } catch {
    // swallow
  }
}

export function getKNECGrade(percentage: number): {
  grade: string; points: number; color: string; feedback: string
} {
  if (percentage >= 80) return { grade: 'A',  points: 12, color: '#34d399', feedback: 'Exceptional! Absolute mastery of this topic area.' }
  if (percentage >= 75) return { grade: 'A-', points: 11, color: '#22c55e', feedback: 'Brilliant work. Strong candidate for top national cohorts.' }
  if (percentage >= 70) return { grade: 'B+', points: 10, color: '#2dd4bf', feedback: 'Very strong. Keep polishing the remaining concept edges.' }
  if (percentage >= 65) return { grade: 'B',  points:  9, color: '#14b8a6', feedback: 'Solid work. A secure competitive position on this topic.' }
  if (percentage >= 60) return { grade: 'B-', points:  8, color: '#fbbf24', feedback: 'Good effort. Minor structural gaps to address.' }
  if (percentage >= 55) return { grade: 'C+', points:  7, color: '#f59e0b', feedback: 'Minimum university entry tier. Push this to a secure B!' }
  if (percentage >= 50) return { grade: 'C',  points:  6, color: '#eab308', feedback: 'You have identified gaps to fix. That is where the work begins.' }
  if (percentage >= 45) return { grade: 'C-', points:  5, color: '#fb923c', feedback: 'Pass metric. Needs more practice on foundational logic.' }
  if (percentage >= 40) return { grade: 'D+', points:  4, color: '#f97316', feedback: 'Reframe this as study data, not judgment. You know what to fix.' }
  if (percentage >= 35) return { grade: 'D',  points:  3, color: '#fb7185', feedback: 'Every mistake is a tutorial. Review the explanations closely.' }
  if (percentage >= 30) return { grade: 'D-', points:  2, color: '#f43f5e', feedback: 'Take a breath. Focus on the Learn This cards below each question.' }
  return                       { grade: 'E',  points:  1, color: '#ef4444', feedback: 'This is your starting map. Use targeted drills to build up step by step.' }
}
