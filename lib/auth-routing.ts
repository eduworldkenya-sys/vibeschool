export const AUTH_DASHBOARDS: Record<string, string> = {
  teacher: '/teacher',
  parent: '/parent',
  student: '/student',
  admin: '/admin',
  global_user: '/global',
}

export const PROTECTED_ROLE_PREFIXES: Record<string, string> = {
  '/teacher': 'teacher',
  '/parent': 'parent',
  '/student': 'student',
  '/admin': 'admin',
  '/global': 'global_user',
}

export function safeInternalPath(value: string | null | undefined): string | null {
  if (!value || !value.startsWith('/') || value.startsWith('//')) return null
  try {
    const decoded = decodeURIComponent(value)
    if (
      !decoded.startsWith('/') ||
      decoded.startsWith('//') ||
      decoded.includes('\\') ||
      /[\u0000-\u001f\u007f]/.test(decoded)
    ) return null
    return decoded
  } catch {
    return null
  }
}

export function pathnameOnly(value: string): string {
  const query = value.indexOf('?')
  const hash = value.indexOf('#')
  const cut = [query, hash].filter(index => index >= 0).reduce((min, index) => Math.min(min, index), value.length)
  return value.slice(0, cut) || '/'
}

export function requiredRoleForPath(pathname: string): string | null {
  const normalized = pathnameOnly(pathname)
  for (const [prefix, role] of Object.entries(PROTECTED_ROLE_PREFIXES)) {
    if (normalized === prefix || normalized.startsWith(`${prefix}/`)) return role
  }
  return null
}

export function roleCanVisit(role: string | null | undefined, pathname: string): boolean {
  const required = requiredRoleForPath(pathname)
  return !required || role === required
}
