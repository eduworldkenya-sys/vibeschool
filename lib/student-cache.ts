// lib/student-cache.ts
// Student app cache layer — localStorage with TTL, per-student keys
// Silent fail on all ops — never crash the app over cache

export const STUDENT_CACHE_TTL = {
  dashboard:     5  * 60 * 1000,
  homework:      2  * 60 * 1000,
  timetable:     30 * 60 * 1000,
  marks:         60 * 60 * 1000,
  fees:          60 * 60 * 1000,
  health:        60 * 60 * 1000,
  lessons:       10 * 60 * 1000,
  notifications: 1  * 60 * 1000,
} as const

export type CacheKey = keyof typeof STUDENT_CACHE_TTL

export function studentCacheKey(page: CacheKey, studentId: string): string {
  return `vs_student_${page}_${studentId}_v1`
}

export function readCache<T>(page: CacheKey, studentId: string): T | null {
  try {
    const raw = localStorage.getItem(studentCacheKey(page, studentId))
    if (!raw) return null
    const parsed: { data: T; ts: number } = JSON.parse(raw)
    if (Date.now() - parsed.ts > STUDENT_CACHE_TTL[page]) return null
    return parsed.data
  } catch {
    return null
  }
}

export function writeCache<T>(page: CacheKey, studentId: string, data: T): void {
  try {
    localStorage.setItem(
      studentCacheKey(page, studentId),
      JSON.stringify({ data, ts: Date.now() })
    )
  } catch {
    // storage full or SSR — silent fail
  }
}

export function clearCache(page: CacheKey, studentId: string): void {
  try {
    localStorage.removeItem(studentCacheKey(page, studentId))
  } catch {}
}

export function clearAllStudentCache(studentId: string): void {
  try {
    const keys = Object.keys(STUDENT_CACHE_TTL) as CacheKey[]
    keys.forEach(page => {
      localStorage.removeItem(studentCacheKey(page, studentId))
    })
  } catch {}
}
