import { SUPABASE_URL } from '@/lib/supabase'
import {
  parseLessonPlanBody,
} from '@/lib/teaching/lessonPlanCodec'
import type {
  LessonPlanSections,
} from '@/lib/teaching/lessonPlanCodec'

export interface GenerateLessonPlanInput {
  accessToken: string
  teacherName: string
  schoolName: string
  subject: string
  className: string
  studentCount: number
  duration: string
  topic: string
  focus?: string
  previousTopics: string[]
  curriculumStrand?: string
  curriculumSubStrand?: string
}

export type GenerateLessonPlanResult =
  | {
      ok: true
      sections: LessonPlanSections
    }
  | {
      ok: false
      message: string
    }

/**
 * Calls the canonical lesson-plan Edge Function and validates its response.
 *
 * This service never writes lesson_plans and never changes the teaching
 * occurrence lifecycle.
 */
export async function generateLessonPlan({
  accessToken,
  teacherName,
  schoolName,
  subject,
  className,
  studentCount,
  duration,
  topic,
  focus,
  previousTopics,
  curriculumStrand,
  curriculumSubStrand,
}: GenerateLessonPlanInput): Promise<GenerateLessonPlanResult> {
  const response = await fetch(
    SUPABASE_URL + '/functions/v1/generate-lesson-plan',
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: 'Bearer ' + accessToken,
      },
      body: JSON.stringify({
        teacher: teacherName,
        school: schoolName,
        subject,
        className,
        studentCount,
        duration,
        topic,
        focus,
        previousTopics,
        curriculumStrand,
        curriculumSubStrand,
      }),
    },
  )

  const json = await response.json()

  if (!response.ok || !json.plan) {
    const message =
      json.error === 'insufficient_credits'
        ? (
            json.message ??
            'You have no Vibe Credits. Buy credits to generate lesson plans.'
          )
        : (
            json.error ??
            'Generation failed. Try again.'
          )

    return {
      ok: false,
      message,
    }
  }

  const sections = parseLessonPlanBody(json.plan)

  if (!sections) {
    return {
      ok: false,
      message:
        'The AI returned an unreadable plan. Try again.',
    }
  }

  return {
    ok: true,
    sections,
  }
}
