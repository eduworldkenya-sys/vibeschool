import { supabase } from '@/lib/supabase'

export interface EnsureLessonExerciseDraftInput {
  lessonPlanId: string
  classId: string
  teacherId: string
  schoolId: string
  title: string
  instructions: string
}

export type EnsureLessonExerciseDraftResult =
  | {
      outcome: 'created'
      exerciseId: string
    }
  | {
      outcome: 'preserved_existing'
      exerciseId: string
    }

interface ExerciseIdRow {
  id: string
}

function requireText(value: string, field: string): string {
  const normalized = value.trim()

  if (!normalized) {
    throw new Error(`ensureLessonExerciseDraft: ${field} is required.`)
  }

  return normalized
}

/**
 * Creates the first exercise draft linked to a lesson plan.
 *
 * Authority rule:
 * - if an exercise already exists, preserve it unchanged;
 * - never update its title or instructions;
 * - never touch submissions or marking state;
 * - the dedicated Exercise workspace owns all edits after creation.
 *
 * The unique index on exercises(lesson_plan_id) is the database race arbiter.
 */
export async function ensureLessonExerciseDraft(
  input: EnsureLessonExerciseDraftInput,
): Promise<EnsureLessonExerciseDraftResult> {
  const lessonPlanId = requireText(input.lessonPlanId, 'lessonPlanId')
  const classId = requireText(input.classId, 'classId')
  const teacherId = requireText(input.teacherId, 'teacherId')
  const schoolId = requireText(input.schoolId, 'schoolId')
  const title = requireText(input.title, 'title')
  const instructions = requireText(input.instructions, 'instructions')

  const existingResult = await supabase
    .from('exercises')
    .select('id')
    .eq('lesson_plan_id', lessonPlanId)
    .maybeSingle()

  if (existingResult.error) {
    throw existingResult.error
  }

  const existing = existingResult.data as ExerciseIdRow | null

  if (existing?.id) {
    return {
      outcome: 'preserved_existing',
      exerciseId: existing.id,
    }
  }

  const insertResult = await supabase
    .from('exercises')
    .insert({
      class_id: classId,
      teacher_id: teacherId,
      school_id: schoolId,
      lesson_plan_id: lessonPlanId,
      title,
      instructions,
    })
    .select('id')
    .single()

  if (insertResult.error) {
    if (insertResult.error.code === '23505') {
      const racedResult = await supabase
        .from('exercises')
        .select('id')
        .eq('lesson_plan_id', lessonPlanId)
        .single()

      if (racedResult.error) throw racedResult.error

      const raced = racedResult.data as ExerciseIdRow

      return {
        outcome: 'preserved_existing',
        exerciseId: raced.id,
      }
    }

    throw insertResult.error
  }

  const created = insertResult.data as ExerciseIdRow

  return {
    outcome: 'created',
    exerciseId: created.id,
  }
}
