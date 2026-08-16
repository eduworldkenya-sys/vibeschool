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
    if (!decoded.startsWith('/') || decoded.startsWith('//') || decoded.includes('\\')) return null
    return decoded
  } catch {
    return null
  }
}

export function requiredRoleForPath(pathname: string): string | null {
  for (const [prefix, role] of Object.entries(PROTECTED_ROLE_PREFIXES)) {
    if (pathname === prefix || pathname.startsWith(`${prefix}/`)) return role
  }
  return null
}

export function roleCanVisit(role: string | null | undefined, pathname: string): boolean {
  const required = requiredRoleForPath(pathname)
  return !required || role === required
}
