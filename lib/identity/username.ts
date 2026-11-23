export const USERNAME_PATTERN = /^[a-z][a-z0-9_]{2,23}$/
export function normalizeUsername(value: string) {
  return value.trim().replace(/^@/, '').toLowerCase()
}
export function validateUsername(value: string): string | null {
  const name = normalizeUsername(value)
  return USERNAME_PATTERN.test(name) ? name : null
}
export function safeReturnPath(raw: string | null | undefined) {
  if (!raw || raw.length > 1024 || !raw.startsWith('/') || raw.startsWith('//')) return null
  if (/[\\\u0000-\u001f\u007f]/.test(raw)) return null
  try {
    const decoded = decodeURIComponent(raw)
    if (!decoded.startsWith('/') || decoded.startsWith('//') || /[\\\u0000-\u001f\u007f]/.test(decoded)) return null
    return decoded
  } catch { return null }
}
