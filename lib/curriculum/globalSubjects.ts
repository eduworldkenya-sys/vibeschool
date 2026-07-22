import { supabase } from "@/lib/supabase"

// TBL-010B: subjects.global_subject_id is now a real FK linking every
// school subject to its global (national CBC taxonomy) parent — see
// migration tbl010b_subject_identity_bridge. cbc_strands and curriculum
// content are anchored to the 15 global rows (school_id IS NULL); the 6
// school rows are what teacher_classes/timetable_slots/lesson_plans/
// scheme_of_work actually reference. Global subjects have
// global_subject_id = NULL (they ARE the root); school subjects have it
// set to their global parent, enforced by a trigger so it can never point
// at another school subject.

export interface SubjectContext {
  /** The id operational tables (timetable_slots, lesson_plans, ...)
   *  reference. Null when the input was already a global subject. */
  schoolSubjectId: string | null
  /** The id cbc_strands / curriculum content are keyed on. */
  globalSubjectId: string | null
  name: string
}

/**
 * Resolves ANY subjects.id (school-scoped or global) to its GLOBAL
 * subject id — the id cbc_strands and curriculum content are anchored
 * to. Replaces the old name-based crossing: no ilike, no ambiguity, a
 * single FK hop. Returns null if the subject doesn't exist, or is a
 * school subject with no linked global parent (should not happen after
 * the TBL-010B backfill + trigger, but callers must not assume it can't).
 */
export async function resolveGlobalSubjectId(subjectId: string): Promise<string | null> {
  const { data, error } = await supabase
    .from("subjects")
    .select("id, school_id, global_subject_id")
    .eq("id", subjectId)
    .maybeSingle()

  if (error || !data) return null
  return data.school_id === null ? data.id : data.global_subject_id
}

/** Display name for any subjects.id, school-scoped or global. */
export async function getSubjectName(subjectId: string): Promise<string | null> {
  const { data, error } = await supabase
    .from("subjects")
    .select("name")
    .eq("id", subjectId)
    .maybeSingle()

  if (error || !data) return null
  return data.name
}

/**
 * One read that gives a caller everything subject-identity related for
 * a given subjects.id: which id operational tables use, which id the
 * taxonomy uses, and the display name. Prefer this over calling
 * resolveGlobalSubjectId + getSubjectName separately when a caller needs
 * both — one round trip instead of two.
 */
export async function getSubjectContext(subjectId: string): Promise<SubjectContext | null> {
  const { data, error } = await supabase
    .from("subjects")
    .select("id, name, school_id, global_subject_id")
    .eq("id", subjectId)
    .maybeSingle()

  if (error || !data) return null

  const isGlobal = data.school_id === null
  return {
    schoolSubjectId: isGlobal ? null : data.id,
    globalSubjectId: isGlobal ? data.id : data.global_subject_id,
    name: data.name,
  }
}

// TBL-010D: the deprecated name-based compatibility adapter and its
// debug-trace export have been removed. TBL-010C repointed its last
// callers (app/teacher/assessment, app/teacher/scheme, LessonPlanModal,
// LessonPanel) to the id-first resolveGlobalSubjectId above; a repo-wide
// audit confirmed zero remaining imports or calls before this deletion.
// No runtime path may cross school subject -> global subject through a
// name/.ilike match again — a name match may exist only in historical
// migration SQL.

export interface ResolvedContent {
  id: string
  source_type: "vibeschool" | "publisher" | "school_authored"
  lesson_context: unknown
  parent_brief: unknown
}

// Resolves which curriculum_content row to use for a given curriculum unit:
// teacher override > school default > kicd canonical row. subjectId here
// must already be the GLOBAL subject id (see resolveGlobalSubjectId above),
// not a school's local copy. A miss returns null rather than guessing —
// callers should show "no content yet", never a different topic's material.
export async function getContentForSubject(
  schoolId: string,
  globalSubjectId: string,
  teacherId: string,
  curriculumId: string
): Promise<ResolvedContent | null> {
  // Only 'confirmed' rows are eligible — a pending community submission
  // must stay invisible until an admin approves it, same guarantee the
  // ghost profile contribution model gives elsewhere in the app.
  const { data: pref } = await supabase
    .from("content_preferences")
    .select("curriculum_content_id, teacher_id")
    .eq("school_id", schoolId)
    .eq("subject_id", globalSubjectId)
    .or(`teacher_id.eq.${teacherId},teacher_id.is.null`)
    .order("teacher_id", { ascending: false, nullsFirst: false })
    .limit(1)
    .maybeSingle()

  const preferredContentId = pref?.curriculum_content_id ?? null

  if (preferredContentId) {
    const { data: row } = await supabase
      .from("curriculum_content")
      .select("id, source_type, lesson_context, parent_brief")
      .eq("id", preferredContentId)
      .eq("curriculum_id", curriculumId)
      .eq("status", "confirmed")
      .maybeSingle()
    if (row) return row as ResolvedContent
    // Preference points at a content row belonging to a different
    // curriculum unit, or one that isn't confirmed yet — fall through
    // to the vibeschool default instead of showing mismatched content.
  }

  const { data: defaultRow } = await supabase
    .from("curriculum_content")
    .select("id, source_type, lesson_context, parent_brief")
    .eq("curriculum_id", curriculumId)
    .eq("source_type", "vibeschool")
    .eq("status", "confirmed")
    .maybeSingle()

  return (defaultRow as ResolvedContent) ?? null
}
