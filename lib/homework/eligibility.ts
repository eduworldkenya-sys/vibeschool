/**
 * The learner's current enrolment and assignment publication define responsibility.
 * Being added to a class (or a group) later never backdates missing work.
 * To give a new learner catch-up work, publish a fresh assignment with a new due date.
 *
 * Missing/unknown timestamps fail closed instead of making unsupported overdue claims.
 */
export type HomeworkScope = {
  created_at: string | null;
  target_group_id?: string | null;
};

export function isLearnerAssignedHomework(
  homework: HomeworkScope,
  enrolledAt: string | null | undefined,
  groupMembershipCreatedAt?: string | null,
): boolean {
  const published = Date.parse(homework.created_at ?? "");
  const enrolled = Date.parse(enrolledAt ?? "");
  if (!Number.isFinite(published) || !Number.isFinite(enrolled) || published < enrolled) return false;
  if (!homework.target_group_id) return true;
  const memberSince = Date.parse(groupMembershipCreatedAt ?? "");
  return Number.isFinite(memberSince) && memberSince <= published;
}

export function isAssignedHomeworkOverdue(
  homework: HomeworkScope & { due_date: string | null },
  enrolledAt: string | null | undefined,
  today: string,
  groupMembershipCreatedAt?: string | null,
): boolean {
  return isLearnerAssignedHomework(homework, enrolledAt, groupMembershipCreatedAt) &&
    Boolean(homework.due_date && homework.due_date.slice(0, 10) < today);
}
