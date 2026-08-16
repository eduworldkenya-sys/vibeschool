export type OAuthIntent = 'signin' | 'signup'

export type OAuthRole = 'teacher' | 'parent' | 'student' | 'admin' | 'global_user'

const OAUTH_ROLES = new Set<OAuthRole>([
  'teacher',
  'parent',
  'student',
  'admin',
  'global_user',
])

export function normalizeOAuthRole(value: string | null): OAuthRole | null {
  return value && OAUTH_ROLES.has(value as OAuthRole) ? (value as OAuthRole) : null
}

export function normalizeOAuthIntent(value: string | null): OAuthIntent | null {
  return value === 'signin' || value === 'signup' ? value : null
}

export function safeRelativePath(value: string | null): string | null {
  if (!value || !value.startsWith('/') || value.startsWith('//')) return null
  return value
}

/**
 * OAuth must return to the same browser origin that initiated PKCE. The
 * production canonical-host redirect is an infrastructure concern; changing
 * origins in the middle of PKCE can strand the verifier cookie.
 */
export function buildOAuthCallbackUrl(
  origin: string,
  intent: OAuthIntent,
  role: OAuthRole,
  next?: string | null,
): string {
  const callback = new URL('/auth/callback', origin)
  callback.searchParams.set('intent', intent)
  callback.searchParams.set('role', role)
  const safeNext = safeRelativePath(next ?? null)
  if (safeNext) callback.searchParams.set('next', safeNext)
  return callback.toString()
}
