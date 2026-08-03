import type { ContentEngineClient } from './client'
import {
  assertRequiredId,
  toContentEngineError,
} from './errors'
import type {
  CompetencyEvidence,
  StudentOutcomeMastery,
} from './types'

export async function listStudentOutcomeMastery(
  client: ContentEngineClient,
  studentId: string,
): Promise<StudentOutcomeMastery[]> {
  const operation = 'listStudentOutcomeMastery'
  const id = assertRequiredId(studentId, 'studentId', operation)

  const { data, error } = await client
    .from('student_outcome_mastery')
    .select('*')
    .eq('student_id', id)
    .order('updated_at', { ascending: false })

  if (error) {
    throw toContentEngineError(operation, error)
  }

  return data
}

export async function getStudentOutcomeMastery(
  client: ContentEngineClient,
  studentId: string,
  outcomeId: string,
): Promise<StudentOutcomeMastery | null> {
  const operation = 'getStudentOutcomeMastery'
  const learnerId = assertRequiredId(
    studentId,
    'studentId',
    operation,
  )
  const learningOutcomeId = assertRequiredId(
    outcomeId,
    'outcomeId',
    operation,
  )

  const { data, error } = await client
    .from('student_outcome_mastery')
    .select('*')
    .eq('student_id', learnerId)
    .eq('outcome_id', learningOutcomeId)
    .maybeSingle()

  if (error) {
    throw toContentEngineError(operation, error)
  }

  return data
}

export async function listStudentCompetencyEvidence(
  client: ContentEngineClient,
  studentId: string,
  outcomeId?: string,
): Promise<CompetencyEvidence[]> {
  const operation = 'listStudentCompetencyEvidence'
  const learnerId = assertRequiredId(
    studentId,
    'studentId',
    operation,
  )

  let query = client
    .from('competency_evidence_ledger')
    .select('*')
    .eq('student_id', learnerId)
    .order('observed_at', { ascending: false })

  if (outcomeId?.trim()) {
    query = query.eq('outcome_id', outcomeId.trim())
  }

  const { data, error } = await query

  if (error) {
    throw toContentEngineError(operation, error)
  }

  return data
}
