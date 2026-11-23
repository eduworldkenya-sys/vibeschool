import type { TwinRoleBinding } from './core'

type Access = { role?: unknown; account_status?: unknown; is_anonymized?: unknown }

export function deriveSelfServiceBindings(
  userId: string,
  access: unknown,
  alreadyBoundRoles: ReadonlySet<string>,
  managedLearnerCount = 0,
): TwinRoleBinding[] {
  if (!userId || !access || typeof access !== 'object' || Array.isArray(access)) return []
  const a = access as Access
  if (a.account_status !== 'active' || a.is_anonymized !== false) return []

  const result: TwinRoleBinding[] = []
  if (a.role === 'parent' && !alreadyBoundRoles.has('parent')) {
    result.push({
      role: 'parent', scopeType: 'family', scopeId: userId, schoolId: null,
      relationship: 'canonical_parent_self_service', resourceIds: [],
      evidence: { canonical_role: 'parent', linked_learner_count: 0 },
    })
  }
  if (a.role === 'teacher' && !alreadyBoundRoles.has('teacher')) {
    result.push({
      role: 'teacher', scopeType: 'school', scopeId: userId, schoolId: null,
      relationship: 'canonical_teacher_independent', resourceIds: [],
      evidence: { canonical_role: 'teacher', school_membership_count: 0 },
    })
  }
  // This grants only a personal workspace, never access to a school student.
  if (a.role === 'teacher' && !alreadyBoundRoles.has('parent') &&
      Number.isInteger(managedLearnerCount) && managedLearnerCount > 0) {
    result.push({
      role: 'parent', scopeType: 'family', scopeId: userId, schoolId: null,
      relationship: 'guardian_managed_learner_profiles', resourceIds: [],
      evidence: { managed_profile_count: managedLearnerCount },
    })
  }
  return result
}
