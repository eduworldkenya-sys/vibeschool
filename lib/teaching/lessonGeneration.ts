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
  curriculumObjectives?: string | null
  keyInquiryQuestion?: string | null
  learningResources?: string | null
  learningExperiences?: string | null
  assessmentMethods?: string | null
  reference?: string | null
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
 * Calls the contextual lesson-plan Edge Function and validates its response.
 *
 * When a Scheme source exists but is not yet eligible for canonical reusable
 * asset generation, its authoritative pedagogy is still sent as grounding.
 * This service never writes lesson_plans and never changes occurrence state.
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
  curriculumObjectives,
  keyInquiryQuestion,
  learningResources,
  learningExperiences,
  assessmentMethods,
  reference,
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
        curriculumObjectives,
        keyInquiryQuestion,
        learningResources,
        learningExperiences,
        assessmentMethods,
        reference,
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
