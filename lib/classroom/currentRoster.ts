import type { supabase } from "../supabase";

export type RosterLearner = {
  id: string;
  name: string;
  admission_number: string | null;
  profile_id: string | null;
  created_at: string | null;
};
export type CurrentRoster = { classId: string; learner: RosterLearner }[];
const PAGE = 500;

/** Canonical enrollment first, identity second. RLS remains the authorization boundary. */
export async function readCurrentRoster(
  client: typeof supabase,
  schoolId: string,
  requestedClassIds: string[],
): Promise<CurrentRoster> {
  const classIds = [...new Set(requestedClassIds)];
  if (!schoolId || !classIds.length) return [];
  const enrollments: { class_id: string; student_id: string }[] = [];
  for (let offset = 0; ; offset += PAGE) {
    const result = await client.from("student_classes").select("class_id,student_id")
      .eq("school_id", schoolId).eq("is_current", true).in("class_id", classIds)
      .order("class_id").order("student_id").range(offset, offset + PAGE - 1);
    if (result.error) throw result.error;
    enrollments.push(...(result.data ?? []));
    if ((result.data?.length ?? 0) < PAGE) break;
  }
  const ids = [...new Set(enrollments.map(row => row.student_id))];
  const learners = new Map<string, RosterLearner>();
  for (let offset = 0; offset < ids.length; offset += PAGE) {
    const result = await client.from("students")
      .select("id,name,admission_number,profile_id,created_at,deleted_at")
      .in("id", ids.slice(offset, offset + PAGE)).is("deleted_at", null);
    if (result.error) throw result.error;
    for (const learner of result.data ?? []) learners.set(learner.id, learner);
  }
  if (ids.some(id => !learners.has(id))) {
    throw new Error("Some enrolled learner identities could not be confirmed. Refresh the roster; do not add duplicate learners.");
  }
  const seen = new Set<string>();
  return enrollments.flatMap(row => {
    const learner = learners.get(row.student_id);
    const key = `${row.class_id}:${row.student_id}`;
    if (!learner || seen.has(key)) return [];
    seen.add(key);
    return [{ classId: row.class_id, learner }];
  });
}
