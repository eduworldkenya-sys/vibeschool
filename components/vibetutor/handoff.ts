// Sign-in handoff for the VibeTutor preview. /login/[role] reads `redirect`
// (not `next`), so every VibeTutor sign-in link goes through this helper.
export type LoginRole = 'parent' | 'teacher'

export function loginHref(role: LoginRole, returnTo: string) {
  return `/login/${role}?redirect=${encodeURIComponent(returnTo)}`
}

// Drafts live in localStorage so they survive a sign-in that completes in
// another tab (email link) or after a Google round trip. A draft is removed as
// soon as it is restored. Every access is wrapped: storage can be blocked.
export function saveDraft(key: string, value: unknown) {
  try { window.localStorage.setItem(key, JSON.stringify(value)) } catch { /* storage unavailable */ }
}

export function takeDraft(key: string): Record<string, unknown> | null {
  try {
    const raw = window.localStorage.getItem(key)
    if (!raw) return null
    window.localStorage.removeItem(key)
    const parsed: unknown = JSON.parse(raw)
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed as Record<string, unknown> : null
  } catch {
    return null
  }
}

export const asString = (value: unknown) => typeof value === 'string' ? value : ''
export const asStrings = (value: unknown) => Array.isArray(value) ? value.filter((x): x is string => typeof x === 'string') : []
