const TRACKER_KEY = 'vibe_exam_count'

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
  } catch {
    // safely swallow storage errors
  }
}

// FIX 4 — fires exactly at 3, not on every exam after 3
export function shouldShowRegisterPrompt(): boolean {
  return getExamCount() === 3
}
