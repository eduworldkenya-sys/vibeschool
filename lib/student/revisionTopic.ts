import { supabase } from '@/lib/supabase'

export type RevisionTopic = {
  assignmentId: string
  subject: string
  topic: string
  nextReviewAt: string | null
  recallCount: number
}
export type RevisionCard = { id: string; prompt: string; answer: string; explanation: string }

type JsonRow = Record<string, unknown>
function objects(data: unknown): JsonRow[] {
  return Array.isArray(data) ? data.filter((row): row is JsonRow => Boolean(row && typeof row === 'object' && !Array.isArray(row))) : []
}
export function learnerRevisionGrade(className: string): string | null {
  const match = className.trim().match(/^(Grade\s*[1-9]|Form\s*[1-4])(?:\b|\s)/i)
  return match ? match[1].replace(/\s+/g, ' ').replace(/^grade/i, 'Grade').replace(/^form/i, 'Form') : null
}
export async function listRevisionTopics(grade: string): Promise<RevisionTopic[]> {
  const {data,error} = await supabase.rpc('student_list_canonical_topic_practice' as never, {p_grade:grade} as never)
  if(error) throw new Error(error.message)
  const catalog = objects(data).filter(row => typeof row.assignment_id === 'string' &&
    typeof row.topic === 'string' && typeof row.subject === 'string' && row.question_count === 5)
  const {data:memory,error:memoryError} = await supabase.from('student_revision_topic_memory')
    .select('assignment_id,next_review_at,recall_count').limit(200)
  if(memoryError) throw new Error(memoryError.message)
  const byId = new Map(objects(memory).filter(row => typeof row.assignment_id === 'string')
    .map(row => [row.assignment_id, row]))
  return catalog.map(row => {
    const prior = byId.get(row.assignment_id)
    return {
      assignmentId: row.assignment_id as string, subject: row.subject as string, topic: row.topic as string,
      nextReviewAt: typeof prior?.next_review_at === 'string' ? prior.next_review_at : null,
      recallCount: typeof prior?.recall_count === 'number' ? prior.recall_count : 0
    }
  })
}
export async function getRevisionCards(grade: string, assignmentId: string): Promise<RevisionCard[]> {
  const {data,error} = await supabase.rpc('student_revision_studio_cards' as never,
    {p_grade:grade,p_assignment_id:assignmentId} as never)
  if(error) throw new Error(error.message)
  const body = data && typeof data==='object' && !Array.isArray(data) ? data as JsonRow : {}
  return objects(body.cards).filter(row=>typeof row.id==='string' &&
    typeof row.prompt==='string' && typeof row.answer==='string')
    .map(row=>({id:row.id as string,prompt:row.prompt as string,answer:row.answer as string,
      explanation:typeof row.explanation==='string'?row.explanation:''}))
}
export async function saveRevisionTopicRecall(grade: string, assignmentId: string, remembered: boolean): Promise<string> {
  const {data,error} = await supabase.rpc('student_record_revision_topic_recall' as never,
    {p_grade:grade,p_assignment_id:assignmentId,p_remembered:remembered} as never)
  if(error) throw new Error(error.message)
  const value = data && typeof data==='object' && !Array.isArray(data) ? data as JsonRow : {}
  if(value.recorded!==true || typeof value.next_review_at!=='string') throw new Error('Revision was not confirmed.')
  return value.next_review_at
}
