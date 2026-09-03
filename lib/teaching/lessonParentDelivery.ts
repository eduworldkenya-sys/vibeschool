import { supabase } from '@/lib/supabase'

export type LessonParentDeliveryPurpose = 'lesson_summary'

export interface DeliverLessonPlanToParentsInput {
  lessonPlanId: string
  deliveryPurpose: LessonParentDeliveryPurpose
  subject: string
  body: string
}

export interface LessonParentDeliveryResult {
  lessonPlanId: string
  deliveryPurpose: LessonParentDeliveryPurpose
  recipientCount: number
  insertedCount: number
  updatedCount: number
  shared: boolean
}

interface RawLessonParentDeliveryResult {
  lesson_plan_id?: unknown
  delivery_purpose?: unknown
  recipient_count?: unknown
  inserted_count?: unknown
  updated_count?: unknown
  shared?: unknown
}

export class LessonParentDeliveryError extends Error {
  readonly cause?: unknown

  constructor(message: string, cause?: unknown) {
    super(message)
    this.name = 'LessonParentDeliveryError'
    this.cause = cause
  }
}

function requireNonEmpty(value: string, field: string): string {
  const normalized = value.trim()

  if (!normalized) {
    throw new LessonParentDeliveryError(
      `deliverLessonPlanToParents: ${field} is required.`,
    )
  }

  return normalized
}

function requireCount(value: unknown, field: string): number {
  if (
    typeof value !== 'number' ||
    !Number.isInteger(value) ||
    value < 0
  ) {
    throw new LessonParentDeliveryError(
      `deliverLessonPlanToParents: invalid ${field} returned by database.`,
    )
  }

  return value
}

export async function deliverLessonPlanToParents(
  input: DeliverLessonPlanToParentsInput,
): Promise<LessonParentDeliveryResult> {
  const lessonPlanId = requireNonEmpty(
    input.lessonPlanId,
    'lessonPlanId',
  )
  const subject = requireNonEmpty(input.subject, 'subject')
  const body = requireNonEmpty(input.body, 'body')

  const { data, error } = await supabase.rpc(
    'deliver_lesson_plan_to_parents',
    {
      p_lesson_plan_id: lessonPlanId,
      p_delivery_purpose: input.deliveryPurpose,
      p_subject: subject,
      p_body: body,
    },
  )

  if (error) {
    throw new LessonParentDeliveryError(
      error.message || 'Parent lesson delivery failed.',
      error,
    )
  }

  if (
    data == null ||
    typeof data !== 'object' ||
    Array.isArray(data)
  ) {
    throw new LessonParentDeliveryError(
      'Parent lesson delivery returned an invalid result.',
    )
  }

  const raw = data as RawLessonParentDeliveryResult

  if (raw.lesson_plan_id !== lessonPlanId) {
    throw new LessonParentDeliveryError(
      'Parent lesson delivery returned the wrong lesson identity.',
    )
  }

  if (raw.delivery_purpose !== input.deliveryPurpose) {
    throw new LessonParentDeliveryError(
      'Parent lesson delivery returned the wrong delivery purpose.',
    )
  }

  if (typeof raw.shared !== 'boolean') {
    throw new LessonParentDeliveryError(
      'Parent lesson delivery returned an invalid shared outcome.',
    )
  }

  const recipientCount = requireCount(
    raw.recipient_count,
    'recipient_count',
  )

  if (raw.shared !== (recipientCount > 0)) {
    throw new LessonParentDeliveryError(
      'Parent lesson delivery returned an inconsistent recipient outcome.',
    )
  }

  return {
    lessonPlanId,
    deliveryPurpose: input.deliveryPurpose,
    recipientCount,
    insertedCount: requireCount(
      raw.inserted_count,
      'inserted_count',
    ),
    updatedCount: requireCount(
      raw.updated_count,
      'updated_count',
    ),
    shared: raw.shared,
  }
}
