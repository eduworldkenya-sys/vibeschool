/**
 * Stage 1: a teacher has ONE authenticated profile and multiple authorised
 * teaching contexts. This is a view of canonical server membership, not a
 * new identity, membership, preference, timetable or permission authority.
 *
 * The caller must obtain teacherId from supabase.auth.getUser() and
 * schoolContext from get_my_teacher_school_context() (which filters the
 * schools by authenticated school_members records on the server).
 */
export type TeacherTeachingScope =
  | {
      key: `school:${string}`;
      kind: 'school';
      teacherId: string;
      schoolId: string;
      label: string;
    }
  | {
      key: 'independent';
      kind: 'independent';
      teacherId: string;
      schoolId: null;
      label: 'Independent Teaching';
    };

export interface TeacherTeachingIdentity {
  teacherId: string;
  /** Canonical school memberships plus a personal, non-school context. */
  availableScopes: readonly TeacherTeachingScope[];
  /** A linked teacher opens in their active school; otherwise independent. */
  defaultScope: TeacherTeachingScope;
}

export interface CanonicalTeacherSchoolContext {
  active_school_id?: string | null;
  schools?: Array<{
    id?: string | null;
    name?: string | null;
    status?: string | null;
  }> | null;
}

/** Reject malformed or incomplete RPC responses rather than invent access. */
export function resolveTeacherTeachingIdentity(
  teacherId: string,
  rawContext: unknown,
): TeacherTeachingIdentity {
  if (typeof teacherId !== 'string' || !teacherId.trim()) {
    throw new Error('Authenticated teacher identity is required.');
  }
  if (!rawContext || typeof rawContext !== 'object' || Array.isArray(rawContext)) {
    throw new Error('Teacher school membership could not be verified.');
  }
  const context = rawContext as CanonicalTeacherSchoolContext;
  if (!Array.isArray(context.schools)) {
    throw new Error('Teacher school membership could not be verified.');
  }
  if (context.active_school_id != null && typeof context.active_school_id !== 'string') {
    throw new Error('Invalid active school selection.');
  }

  const schools: TeacherTeachingScope[] = [];
  const seen = new Set<string>();
  for (const school of context.schools) {
    if (!school || typeof school.id !== 'string' || typeof school.name !== 'string') {
      throw new Error('Malformed teacher school membership.');
    }
    const id = school.id.trim();
    const name = school.name.trim();
    if (!id || !name) throw new Error('Malformed teacher school membership.');
    if (seen.has(id)) continue;
    seen.add(id);
    schools.push({ key: `school:${id}`, kind: 'school', teacherId, schoolId: id, label: name });
  }
  const independent: TeacherTeachingScope = {
    key: 'independent', kind: 'independent', teacherId,
    schoolId: null, label: 'Independent Teaching',
  };
  const activeId = context.active_school_id?.trim();
  const active = activeId ? schools.find(scope => scope.schoolId === activeId) : null;
  if (activeId && !active) {
    // Never accept a stale school preference as evidence of membership.
    throw new Error('Active school is not in the authorised school list.');
  }
  return {
    teacherId,
    availableScopes: [...schools, independent],
    defaultScope: active ?? schools[0] ?? independent,
  };
}

/**
 * Selection is a UI choice over verified contexts. It never grants school
 * membership, switches the server-side active school or bypasses RLS.
 * Operational timetable switching is Stage 2.
 */
export function selectTeacherTeachingScope(
  identity: TeacherTeachingIdentity,
  scopeKey: string,
): TeacherTeachingScope {
  const selected = identity.availableScopes.find(scope => scope.key === scopeKey);
  if (!selected || selected.teacherId !== identity.teacherId) {
    throw new Error('Teaching context is not available to this teacher.');
  }
  return selected;
}
