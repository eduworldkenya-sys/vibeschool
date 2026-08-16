export const ROLE_HOME: Record<string, string> = {
  teacher: '/teacher',
  parent: '/parent',
  student: '/student',
  admin: '/admin',
  global_user: '/global',
}

const PUBLIC_CONTINUATION_PREFIXES = ['/pathways'] as const

export function normalizeContinuation(value: string | null | undefined): string | null {
  if (!value || !value.startsWith('/') || value.startsWith('//')) return null
  try {
    const parsed = new URL(value, 'https://www.vibeschool.co.ke')
    if (parsed.origin !== 'https://www.vibeschool.co.ke') return null
    return `${parsed.pathname}${parsed.search}${parsed.hash}`
  } catch {
    return null
  }
}

function pathWithin(path: string, prefix: string) {
  return path === prefix || path.startsWith(`${prefix}/`) || path.startsWith(`${prefix}?`) || path.startsWith(`${prefix}#`)
}

export function continuationForRole(value: string | null | undefined, role: string | null | undefined): string | null {
  const next = normalizeContinuation(value)
  if (!next || !role) return null

  if (PUBLIC_CONTINUATION_PREFIXES.some(prefix => pathWithin(next, prefix))) return next

  const home = ROLE_HOME[role]
  return home && pathWithin(next, home) ? next : null
}

export function continuationQuery(value: string | null | undefined): string {
  const normalized = normalizeContinuation(value)
  return normalized ? `?next=${encodeURIComponent(normalized)}` : ''
}
