const DRAFT_MAX_AGE_MS = 24 * 60 * 60 * 1000

type StoredDraft<T> = { savedAt: number; value: T }

export function saveDraft<T>(key: string, value: T) {
  if (typeof window === 'undefined') return
  try {
    const draft: StoredDraft<T> = { savedAt: Date.now(), value }
    window.localStorage.setItem(key, JSON.stringify(draft))
  } catch {
    // Storage can be unavailable or full; the form remains usable.
  }
}

export function readDraft<T>(key: string): T | null {
  if (typeof window === 'undefined') return null
  try {
    const raw = window.localStorage.getItem(key)
    if (!raw) return null
    const parsed = JSON.parse(raw) as Partial<StoredDraft<T>>
    if (
      typeof parsed.savedAt !== 'number' ||
      !Number.isFinite(parsed.savedAt) ||
      parsed.savedAt > Date.now() ||
      Date.now() - parsed.savedAt >= DRAFT_MAX_AGE_MS ||
      !('value' in parsed)
    ) {
      window.localStorage.removeItem(key)
      return null
    }
    return parsed.value as T
  } catch {
    window.localStorage.removeItem(key)
    return null
  }
}

export function clearDraft(key: string) {
  if (typeof window === 'undefined') return
  try {
    window.localStorage.removeItem(key)
  } catch {
    // Ignore storage restrictions; clearing the in-memory form still works.
  }
}
