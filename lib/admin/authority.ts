import { getTwinAuthorityContext, selectTwinRoleBinding } from '@/lib/twin/core'

export interface AdminSchoolAuthority {
  userId: string
  schoolId: string
  relationship: string
  generatedAt: string
}

/**
 * Resolve the authenticated School Admin's operating scope from canonical
 * school membership evidence. This is a client routing/data-scoping aid only;
 * database RLS/RPC authorization remains the final authority boundary.
 *
 * The resolver intentionally fails closed when an identity has zero or multiple
 * Admin school scopes. A future multi-school UX must make scope selection
 * explicit rather than silently choosing the first membership.
 */
export async function getAdminSchoolAuthority(): Promise<AdminSchoolAuthority> {
  const context = await getTwinAuthorityContext()
  const binding = selectTwinRoleBinding(context, 'admin')

  if (!binding.schoolId || binding.scopeType !== 'school') {
    throw new Error('Admin school authority could not be resolved.')
  }

  return {
    userId: context.userId,
    schoolId: binding.schoolId,
    relationship: binding.relationship,
    generatedAt: context.generatedAt,
  }
}
