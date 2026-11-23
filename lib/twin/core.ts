import { supabase } from '@/lib/supabase'
import { deriveSelfServiceBindings } from '@/lib/twin/self-service-bindings'
import { unifiedIdentityEnabled } from '@/lib/identity/features'

export type TwinRole = 'student' | 'teacher' | 'parent' | 'admin' | 'hq'

export interface TwinRoleBinding {
  role: TwinRole
  scopeType: 'learner' | 'school' | 'family' | 'platform'
  scopeId: string
  schoolId: string | null
  relationship: string
  resourceIds: string[]
  evidence: Record<string, unknown>
}

export interface TwinAuthorityContext {
  userId: string
  bindings: TwinRoleBinding[]
  generatedAt: string
}

export const TWIN_CAPABILITIES: Record<TwinRole, string[]> = {
  student: ['priority', 'timetable', 'tasks', 'revision', 'mastery', 'memory', 'practice', 'search'],
  teacher: ['current_lesson', 'next_lesson', 'attendance', 'marking', 'learner_attention', 'curriculum', 'reflection', 'tpad', 'search', 'prediction', 'confirmed_actions'],
  parent: ['children', 'attendance', 'class_school', 'learning_evidence', 'family_attention'],
  admin: ['school_health', 'attendance', 'enrollment', 'staffing', 'teaching_completion', 'lesson_evidence', 'family_links'],
  hq: ['platform_health', 'schools', 'content', 'moderation', 'operations', 'governed_priorities'],
}

function unique(values: Array<string | null | undefined>): string[] {
  return Array.from(new Set(values.filter((value): value is string => Boolean(value))))
}

function teacherSchoolIds(value: unknown): string[] {
  if (!value || typeof value !== 'object') return []
  const schools = Reflect.get(value, 'schools')
  if (!Array.isArray(schools)) return []
  return schools.flatMap(school => {
    if (!school || typeof school !== 'object') return []
    const id = Reflect.get(school, 'id')
    return typeof id === 'string' && id.length > 0 ? [id] : []
  })
}

function bindingKey(binding: TwinRoleBinding): string {
  return `${binding.role}:${binding.scopeType}:${binding.scopeId}:${binding.schoolId ?? ''}`
}

/**
 * Resolve every Twin role the authenticated person actually holds from
 * authoritative relationships. `profiles.role` is intentionally not consulted
 * for authority here: it remains a UX/onboarding hint, not the Twin permission root.
 *
 * This client-side context is only a routing aid. Every data RPC/action must still
 * enforce its own RLS / server authorization boundary.
 */
export async function getTwinAuthorityContext(): Promise<TwinAuthorityContext> {
  const { data: auth, error: authError } = await supabase.auth.getUser()
  if (authError || !auth.user) throw new Error('Twin requires an authenticated identity.')
  const userId = auth.user.id

  const [studentRes, membershipsRes, parentLinksRes, teacherAssignmentsRes, ownerRes, selfAccessRes] = await Promise.all([
    supabase.from('students').select('id').eq('profile_id', userId).is('deleted_at', null).limit(1).maybeSingle(),
    supabase.from('school_members').select('school_id, role').eq('profile_id', userId),
    supabase.from('parent_student_links').select('student_id, school_id, access_level, relationship').eq('parent_id', userId),
    supabase.from('teacher_classes').select('school_id, class_id, subject_id, is_class_teacher').eq('teacher_id', userId),
    supabase.rpc('is_platform_owner'),
    supabase.rpc('get_my_auth_access_state'),
  ])

  const authorityReadError = studentRes.error || membershipsRes.error || parentLinksRes.error || teacherAssignmentsRes.error || ownerRes.error || selfAccessRes.error
  if (authorityReadError) {
    throw new Error(authorityReadError.message || 'Twin authority relationships could not be resolved.')
  }

  const bindings: TwinRoleBinding[] = []

  const studentId = studentRes.data?.id ?? null
  if (studentId) {
    const { data: enrollments, error: enrollmentError } = await supabase
      .from('student_classes')
      .select('school_id, class_id')
      .eq('student_id', studentId)
      .eq('is_current', true)

    if (enrollmentError) throw new Error(enrollmentError.message || 'Twin learner enrollment could not be resolved.')
    const rows = enrollments ?? []
    if (rows.length === 0) {
      bindings.push({
        role: 'student', scopeType: 'learner', scopeId: studentId, schoolId: null,
        relationship: 'learner_identity', resourceIds: [studentId],
        evidence: { student_id: studentId, current_enrollment_count: 0 },
      })
    } else {
      const bySchool = new Map<string, typeof rows>()
      for (const enrollment of rows) {
        const key = enrollment.school_id ?? 'unscoped'
        bySchool.set(key, [...(bySchool.get(key) ?? []), enrollment])
      }

      for (const [schoolKey, schoolEnrollments] of Array.from(bySchool.entries())) {
        const classIds = unique(schoolEnrollments.map(enrollment => enrollment.class_id))
        const schoolId = schoolKey === 'unscoped' ? null : schoolKey
        bindings.push({
          role: 'student', scopeType: 'learner', scopeId: studentId, schoolId,
          relationship: 'current_student_enrollment',
          resourceIds: unique([studentId, ...classIds]),
          evidence: {
            student_id: studentId,
            class_ids: classIds,
            school_id: schoolId,
            current_enrollment_count: schoolEnrollments.length,
          },
        })
      }
    }
  }

  const memberships = membershipsRes.data ?? []
  const teacherAssignments = teacherAssignmentsRes.data ?? []
  const { data: teacherSchoolContext, error: teacherSchoolContextError } = await supabase.rpc('get_my_teacher_school_context')
  if (teacherSchoolContextError) {
    throw new Error(teacherSchoolContextError.message || 'Twin teacher school context could not be resolved.')
  }
  const authorizedTeacherSchoolIds = new Set(teacherSchoolIds(teacherSchoolContext))
  for (const membership of memberships) {
    if (membership.role === 'teacher' && authorizedTeacherSchoolIds.has(membership.school_id)) {
      const assignments = teacherAssignments.filter(assignment => assignment.school_id === membership.school_id)
      bindings.push({
        role: 'teacher', scopeType: 'school', scopeId: membership.school_id, schoolId: membership.school_id,
        relationship: 'teacher_school_membership',
        resourceIds: unique(assignments.flatMap(assignment => [assignment.class_id, assignment.subject_id])),
        evidence: {
          school_id: membership.school_id,
          assignment_count: assignments.length,
          class_teacher_count: assignments.filter(assignment => assignment.is_class_teacher === true).length,
        },
      })
    }

    if (membership.role === 'admin' || membership.role === 'owner') {
      bindings.push({
        role: 'admin', scopeType: 'school', scopeId: membership.school_id, schoolId: membership.school_id,
        relationship: membership.role === 'owner' ? 'school_owner_membership' : 'school_admin_membership',
        resourceIds: [membership.school_id],
        evidence: { school_id: membership.school_id, membership_role: membership.role },
      })
    }
  }

  const activeParentLinks = (parentLinksRes.data ?? []).filter(link => (link.access_level ?? 'full') !== 'none')
  if (activeParentLinks.length > 0) {
    const bySchool = new Map<string, typeof activeParentLinks>()
    for (const link of activeParentLinks) {
      const key = link.school_id ?? 'family'
      bySchool.set(key, [...(bySchool.get(key) ?? []), link])
    }
    for (const [schoolKey, links] of Array.from(bySchool.entries())) {
      const learnerIds = unique(links.map(link => link.student_id))
      bindings.push({
        role: 'parent', scopeType: 'family', scopeId: schoolKey === 'family' ? userId : schoolKey,
        schoolId: schoolKey === 'family' ? null : schoolKey,
        relationship: 'active_parent_student_links',
        resourceIds: learnerIds,
        evidence: {
          linked_learner_count: learnerIds.length,
          relationships: unique(links.map(link => link.relationship)),
          school_id: schoolKey === 'family' ? null : schoolKey,
        },
      })
    }
  }

  // Canonical role claims can open only a self-owned workspace; authoritative
  // school and child access is still derived from existing RLS-backed relations.
  if (unifiedIdentityEnabled) {
  const access = selfAccessRes.data
  const knownRoles = new Set(bindings.map(binding => binding.role))
  let managedLearnerCount = 0
  if (access && typeof access === 'object' && !Array.isArray(access) &&
      (access as { role?: unknown }).role === 'teacher' && !knownRoles.has('parent')) {
    const { data: managed, error: managedError } = await supabase.rpc('vs_list_my_identities')
    // The additive migration may not yet be installed. Do not break existing sign-in.
    if (managedError && managedError.code !== 'PGRST202') {
      throw new Error(managedError.message || 'Managed learner authority could not be resolved.')
    }
    const learners = managed && typeof managed === 'object' && !Array.isArray(managed)
      ? (managed as { managed_learners?: unknown }).managed_learners : null
    if (Array.isArray(learners)) managedLearnerCount = learners.length
  }
  bindings.push(...deriveSelfServiceBindings(userId, access, knownRoles, managedLearnerCount))
  }

  if (ownerRes.data === true) {
    bindings.push({
      role: 'hq', scopeType: 'platform', scopeId: 'vibeschool', schoolId: null,
      relationship: 'platform_owner', resourceIds: ['vibeschool'], evidence: { platform_owner: true },
    })
  }

  const deduped = Array.from(new Map(bindings.map(binding => [bindingKey(binding), binding])).values())
  return { userId, bindings: deduped, generatedAt: new Date().toISOString() }
}

export function getTwinRoleBindings(context: TwinAuthorityContext, role: TwinRole): TwinRoleBinding[] {
  return context.bindings.filter(binding => binding.role === role)
}

export function requireTwinRole(context: TwinAuthorityContext, role: TwinRole): TwinRoleBinding[] {
  const bindings = getTwinRoleBindings(context, role)
  if (bindings.length === 0) throw new Error(`Twin role ${role} is not authorized for this identity.`)
  return bindings
}

export function selectTwinRoleBinding(
  context: TwinAuthorityContext,
  requestedRole: TwinRole,
  requestedScopeId?: string | null,
): TwinRoleBinding {
  const candidates = requireTwinRole(context, requestedRole)

  if (requestedScopeId) {
    const exact = candidates.find(binding => binding.scopeId === requestedScopeId || binding.schoolId === requestedScopeId)
    if (!exact) throw new Error(`Twin scope ${requestedScopeId} is not authorized for role ${requestedRole}.`)
    return exact
  }

  if (candidates.length > 1) {
    throw new Error(`Twin role ${requestedRole} has multiple scopes. Choose a school/family scope explicitly.`)
  }
  return candidates[0]
}

export function listTwinRoles(context: TwinAuthorityContext): TwinRole[] {
  return Array.from(new Set(context.bindings.map(binding => binding.role)))
}

export function twinCapabilityHelp(role: TwinRole): string {
  return TWIN_CAPABILITIES[role].map(capability => capability.replaceAll('_', ' ')).join(', ')
}
