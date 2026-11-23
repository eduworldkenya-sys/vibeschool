import type { NextRequest } from 'next/server'

/** Reject cross-origin cookie-authenticated identity changes. */
export function validSameOriginMutation(request: NextRequest): boolean {
  const origin = request.headers.get('origin')
  if (!origin) return false
  try {
    const parsed = new URL(origin)
    return (parsed.protocol === 'https:' || (process.env.NODE_ENV !== 'production' && parsed.protocol === 'http:'))
      && parsed.origin === request.nextUrl.origin
  } catch {
    return false
  }
}
