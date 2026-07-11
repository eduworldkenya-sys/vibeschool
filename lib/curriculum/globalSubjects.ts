import { supabase } from "@/lib/supabase"

// cbc_strands is anchored to the national CBC subject taxonomy — 12
// `subjects` rows with school_id IS NULL, seeded once (2026-06-26) as
// the master reference. Each school also has its own local `subjects`
// copy used for teacher_classes/scheduling. Any cbc_strands query must
// resolve through the global row by name first — using a school's own
// local subject_id directly will only ever hit sparse per-school rows.
export async function resolveGlobalSubjectId(subjectName: string): Promise<string | null> {
  const { data, error } = await supabase
    .from("subjects")
    .select("id")
    .is("school_id", null)
    .ilike("name", subjectName)
    .maybeSingle()

  if (error || !data) return null
  return data.id
}

export interface ResolvedContent {
  id: string
  source_type: "kicd" | "publisher" | "school_authored"
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
