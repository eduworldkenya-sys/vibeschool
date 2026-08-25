import { pathnameOnly } from '@/lib/auth-routing'

/**
 * The Global account/community surface is temporarily paused while the
 * independent Reader remains available. Set GLOBAL_ACCOUNT_PAUSED=false to
 * reopen the account surface without changing Reader routing.
 */
export function isGlobalAccountPaused(): boolean {
  return process.env.GLOBAL_ACCOUNT_PAUSED !== 'false'
}

export function isGlobalReaderPath(pathname: string): boolean {
  const normalized = pathnameOnly(pathname)
  return normalized === '/global/read' || normalized.startsWith('/global/read/')
}

export function isPausedGlobalAccountPath(pathname: string): boolean {
  const normalized = pathnameOnly(pathname)
  if (normalized === '/global/paused' || isGlobalReaderPath(normalized)) return false
  return normalized === '/global' || normalized.startsWith('/global/') || normalized === '/login/global'
}
