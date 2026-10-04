import { supabase } from '@/lib/supabase'
import type { TeacherTwinReply } from '@/lib/teacher/twin'
import { loadProgressAuthority, loadProgressEvidence, loadProgressRoster, loadProgressTerms } from './progress-data'
import { buildOutcomeProgress, progressSummary, unlinkedSupportObservations } from './progress-record'
import { currentProgressTerm, evidenceInProgressPeriod } from './progress-period'

export type ProgressQuery = { filter: 'declining' | 'improving' | 'support' | 'no-evidence'; subjectName: string | null }

/** Deliberately bounded: unsupported commands never become academic writes. */
export function parseProgressQuery(input: string): ProgressQuery | null {
  const text = input.toLowerCase().replace(/\s+/g, ' ').trim().replace(/[?.!]$/, '')
  if (/\b(?:delete|update|insert|send|assign|create|add|enter|set|give|drop|remove)\b/.test(text)) return null
  const match = text.match(/^(?:show|list) (?:me )?(?:learners|students) (declining|improving|needing support|with no recent evidence)(?: in ([a-z &-]+))?$/)
  if (match) return { filter: match[1] === 'needing support' ? 'support' : match[1] === 'with no recent evidence' ? 'no-evidence' : match[1] as 'declining' | 'improving', subjectName: match[2]?.trim() ?? null }
  if (/^which (?:learners|students) have not been assessed recently$/.test(text)) return { filter: 'no-evidence', subjectName: null }
  return null
}

function record(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('Progress context could not be read.')
  return value as Record<string, unknown>
}
function subjectKey(value: string): string {
  const clean = value.toLowerCase().replace(/\s+/g,' ').trim()
  return ['math', 'maths', 'mathematics'].includes(clean) ? 'mathematics' : clean
}

export async function resolveTeacherProgressQuery(input: string, requestedClassId?: string): Promise<TeacherTwinReply | null> {
  const command = parseProgressQuery(input)
  if (!command) return null
  const response = await supabase.rpc('teacher_get_operating_context')
  if (response.error) throw new Error(response.error.message)
  const context = record(response.data)
  const assignments = (Array.isArray(context.classes) ? context.classes : []).map(record)
    .filter(item => typeof item.class_id === 'string' && (!command.subjectName || typeof item.subject_name === 'string' && subjectKey(item.subject_name) === subjectKey(command.subjectName)))
  const classIds = Array.from(new Set(assignments.map(item => String(item.class_id))))
  if (!classIds.length) return { text: 'No assigned class and subject match that progress request in your active school. Choose your class and subject first.', actionUrl: '/teacher/progress', actionLabel: 'Choose progress context' }
  if (requestedClassId && !classIds.includes(requestedClassId)) return { text: 'That subject is not assigned to you in the open class. Choose an authorized class before viewing progress.', actionUrl: '/teacher/progress', actionLabel: 'Choose class' }
  const classId = requestedClassId ?? (classIds.length === 1 ? classIds[0] : null)
  if (!classId) return { text: 'You have more than one matching class. Choose a class to see its learner evidence; I have not combined different classes.', actionUrl: `/teacher/progress?filter=${command.filter}&period=${command.filter === 'no-evidence' ? '30' : 'term'}${command.subjectName ? `&subjectName=${encodeURIComponent(command.subjectName)}` : ''}`, actionLabel: 'Choose class' }
  const authority = await loadProgressAuthority(classId)
  const subjects = authority.subjects.filter(subject => !command.subjectName || subjectKey(subject.name) === subjectKey(command.subjectName))
  if (command.subjectName && subjects.length !== 1) return { text: 'The subject identity is ambiguous. Select the exact assigned subject in Progress Record.', actionUrl: `/teacher/classhub/${encodeURIComponent(classId)}/progress`, actionLabel: 'Choose subject' }
  const [learners, evidence, terms] = await Promise.all([loadProgressRoster(authority, false), loadProgressEvidence(authority), loadProgressTerms(authority.schoolId)])
  const term = currentProgressTerm(terms)
  const url = `/teacher/classhub/${encodeURIComponent(classId)}/progress?filter=${command.filter}&period=${command.filter === 'no-evidence' ? '30' : 'term'}${command.subjectName ? `&subjectId=${encodeURIComponent(subjects[0].id)}` : ''}`
  if (!term && command.filter !== 'no-evidence') return { text: 'No single school term contains today. Choose a period before interpreting learner progress.', actionUrl: url, actionLabel: 'Choose period' }
  const subjectIds = new Set(subjects.map(subject => subject.id))
  const rowsByLearner = new Map<string, typeof evidence>()
  for (const row of evidence) {
    if (!row.subjectId || !subjectIds.has(row.subjectId) || !evidenceInProgressPeriod(row, command.filter === 'no-evidence' ? '30' : 'term', term)) continue
    const rows = rowsByLearner.get(row.studentId) ?? []; rows.push(row); rowsByLearner.set(row.studentId, rows)
  }
  const matching = learners.filter(learner => {
    const rows = rowsByLearner.get(learner.id) ?? [], outcomes = buildOutcomeProgress(rows)
    if (command.filter === 'no-evidence') return rows.length === 0
    if (command.filter === 'support') return progressSummary(outcomes).needsSupport > 0 || unlinkedSupportObservations(rows).length > 0
    return outcomes.some(outcome => outcome.trend === command.filter)
  })
  const state = command.filter === 'no-evidence' ? 'have no readable learning result or outcome evidence' : command.filter === 'support' ? 'have recorded evidence indicating support; unmapped CBC observations still need an outcome link' : `have an outcome ${command.filter}`
  const names = matching.slice(0,10).map(learner => `${learner.name}${learner.admission_number ? ` (Adm ${learner.admission_number})` : ''}`).join(', ')
  return { text: `${authority.className} · ${command.subjectName ? subjects[0].name : 'assigned subjects'} · ${command.filter === 'no-evidence' ? 'last 30 days' : term!.name}: ${matching.length} of ${learners.length} learners ${state}.${names ? `\n${names}${matching.length > 10 ? ` and ${matching.length - 10} more` : ''}.` : ''}\nBased on your readable evidence. Trends require four comparable observations on separate dates; missing evidence is not a low score. Legacy dates can be record-entry dates; no recent record does not prove no assessment took place.`, actionUrl: url, actionLabel: 'Open matching progress' }
}
