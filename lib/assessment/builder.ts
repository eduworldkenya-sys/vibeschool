import { supabase } from '@/lib/supabase'
import type { Json } from '@/lib/database.types'

export interface BuilderItemSummary {
  id: string
  questionType: string
  prompt: string
  marks: number
  difficulty: string | null
  bloomLevel: string | null
  orderNum: number
  status: string
  outcomeCount: number
}

export interface BuilderSection {
  id: string
  title: string
  instructions: string | null
  displayOrder: number
  marks: number
  estimatedMinutes: number | null
  items: BuilderItemSummary[]
}

export interface BuilderAssessment {
  id: string
  title: string
  description: string | null
  instructions: string | null
  assessmentType: string
  status: string
  totalMarks: number
  estimatedMinutes: number | null
  subjectId: string | null
  generationSource: string
  generationStatus: string
  sections: BuilderSection[]
  unsectionedItems: BuilderItemSummary[]
}

type RpcResult<T> = { data: T | null; error: { message?: string } | null }
type Rpc = <T>(name: string, args?: Record<string, unknown>) => PromiseLike<RpcResult<T>>
const rpc = supabase.rpc.bind(supabase) as unknown as Rpc

function record(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error('Assessment Builder returned an invalid payload.')
  }
  return value as Record<string, unknown>
}

function text(value: unknown): string | null {
  return typeof value === 'string' ? value : null
}

function numberOrNull(value: unknown): number | null {
  if (value === null || value === undefined) return null
  const resolved = typeof value === 'number' ? value : Number(value)
  return Number.isFinite(resolved) ? resolved : null
}

function mapItem(value: unknown): BuilderItemSummary {
  const item = record(value)
  return {
    id: text(item.id) ?? '',
    questionType: text(item.question_type) ?? 'question',
    prompt: text(item.prompt) ?? '',
    marks: numberOrNull(item.marks) ?? 0,
    difficulty: text(item.difficulty),
    bloomLevel: text(item.bloom_level),
    orderNum: numberOrNull(item.order_num) ?? 0,
    status: text(item.status) ?? 'draft',
    outcomeCount: numberOrNull(item.outcome_count) ?? 0,
  }
}

export async function loadBuilderAssessment(assessmentId: string): Promise<BuilderAssessment> {
  const { data, error } = await rpc<Json>('exq_list_builder_assessment', {
    p_assessment_id: assessmentId,
  })
  if (error) throw new Error(error.message || 'Could not load Assessment Builder.')

  const payload = record(data)
  const assessment = record(payload.assessment)
  const sections = Array.isArray(payload.sections) ? payload.sections : []
  const unsectioned = Array.isArray(payload.unsectioned_items) ? payload.unsectioned_items : []

  return {
    id: text(assessment.id) ?? assessmentId,
    title: text(assessment.title) ?? 'Assessment',
    description: text(assessment.description),
    instructions: text(assessment.instructions),
    assessmentType: text(assessment.assessment_type) ?? 'assessment',
    status: text(assessment.status) ?? 'draft',
    totalMarks: numberOrNull(assessment.total_marks) ?? 0,
    estimatedMinutes: numberOrNull(assessment.estimated_minutes),
    subjectId: text(assessment.subject_id),
    generationSource: text(assessment.generation_source) ?? 'teacher_authored',
    generationStatus: text(assessment.generation_status) ?? 'not_requested',
    sections: sections.map(value => {
      const section = record(value)
      const items = Array.isArray(section.items) ? section.items : []
      return {
        id: text(section.id) ?? '',
        title: text(section.title) ?? 'Section',
        instructions: text(section.instructions),
        displayOrder: numberOrNull(section.display_order) ?? 0,
        marks: numberOrNull(section.marks) ?? 0,
        estimatedMinutes: numberOrNull(section.estimated_minutes),
        items: items.map(mapItem),
      }
    }),
    unsectionedItems: unsectioned.map(mapItem),
  }
}

export async function createBuilderSection(input: {
  assessmentId: string
  title: string
  instructions?: string | null
  estimatedMinutes?: number | null
}): Promise<string> {
  const { data, error } = await rpc<string>('exq_create_section', {
    p_assessment_id: input.assessmentId,
    p_title: input.title,
    p_instructions: input.instructions ?? null,
    p_estimated_minutes: input.estimatedMinutes ?? null,
  })
  if (error) throw new Error(error.message || 'Section could not be created.')
  if (typeof data !== 'string') throw new Error('Assessment Builder did not return a section ID.')
  return data
}

export async function updateBuilderSection(input: {
  sectionId: string
  title: string
  instructions?: string | null
  estimatedMinutes?: number | null
}): Promise<void> {
  const { error } = await rpc<Json>('exq_update_section', {
    p_section_id: input.sectionId,
    p_title: input.title,
    p_instructions: input.instructions ?? null,
    p_estimated_minutes: input.estimatedMinutes ?? null,
  })
  if (error) throw new Error(error.message || 'Section could not be updated.')
}

export async function moveBuilderItem(input: {
  assessmentItemId: string
  sectionId?: string | null
  orderNum?: number | null
}): Promise<void> {
  const { error } = await rpc<Json>('exq_move_item_to_section', {
    p_assessment_item_id: input.assessmentItemId,
    p_section_id: input.sectionId ?? null,
    p_order_num: input.orderNum ?? null,
  })
  if (error) throw new Error(error.message || 'Question could not be moved.')
}

export async function reorderBuilderSections(
  assessmentId: string,
  sectionIds: string[],
): Promise<void> {
  const { error } = await rpc<Json>('exq_reorder_sections', {
    p_assessment_id: assessmentId,
    p_section_ids: sectionIds,
  })
  if (error) throw new Error(error.message || 'Sections could not be reordered.')
}

export async function deleteBuilderSection(sectionId: string): Promise<void> {
  const { error } = await rpc<Json>('exq_delete_section', {
    p_section_id: sectionId,
  })
  if (error) throw new Error(error.message || 'Section could not be deleted.')
}
