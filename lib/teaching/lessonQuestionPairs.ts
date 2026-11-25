/** Preserve question/answer provenance at item level. Never zip independent
 * collections, even when their lengths happen to match. */
export interface LessonQuestionPair {
  question: string
  expectedAnswer: string | null
}

const questionContainers = new Set(['questions','assessmentQuestions','assessment_questions','diagnostics','diagnosticQuestions','diagnostic_questions'])
const answerFields = ['expectedAnswer','expected_answer','answer','correctAnswer','correct_answer']

function record(value: unknown): Record<string, unknown> | null {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown> : null
}
function text(value: unknown): string {
  return typeof value === 'string' ? value.trim() : ''
}

export function collectLessonQuestionPairs(payloads: readonly unknown[]): LessonQuestionPair[] {
  const items: LessonQuestionPair[] = []
  function walk(value: unknown, questionContext = false): void {
    if (typeof value === 'string') {
      if (questionContext && text(value)) items.push({ question: text(value), expectedAnswer: null })
      return
    }
    if (Array.isArray(value)) {
      value.forEach(item => walk(item, questionContext))
      return
    }
    const obj = record(value)
    if (!obj) return
    const question = text(obj.question) || (questionContext ? text(obj.prompt) : '')
    if (question) {
      const answers = [...new Set(answerFields.map(key => text(obj[key])).filter(Boolean))]
      items.push({ question, expectedAnswer: answers.length === 1 ? answers[0] : null })
    }
    for (const [key, child] of Object.entries(obj)) {
      if (questionContainers.has(key)) walk(child, true)
      else if (child !== null && typeof child === 'object' && !answerFields.includes(key)) walk(child, false)
    }
  }
  payloads.forEach(payload => walk(payload))
  // Identical pairs may repeat in multiple assets. Distinct answers for the
  // same wording are ambiguous without the original context: omit the answer.
  const grouped = new Map<string, { question: string; answers: Set<string>; unpaired: boolean }>()
  for (const item of items) {
    const key = item.question.toLowerCase().replace(/\s+/g, ' ')
    const group = grouped.get(key) ?? { question: item.question, answers: new Set<string>(), unpaired: false }
    if (item.expectedAnswer) group.answers.add(item.expectedAnswer)
    else group.unpaired = true
    grouped.set(key, group)
  }
  return [...grouped.values()].map(group => ({
    question: group.question,
    expectedAnswer: group.answers.size === 1 && !group.unpaired ? [...group.answers][0] : null,
  }))
}

export function formatLessonQuestionPairs(pairs: readonly LessonQuestionPair[]): string {
  return pairs.length
    ? pairs.map((item, index) => (index + 1) + '. ' + item.question +
        (item.expectedAnswer ? '\n   Expected answer: ' + item.expectedAnswer : '\n   Expected answer: not supplied in the linked source; confirm before marking.')).join('\n')
    : '1. Use the Scheme assessment method(s) below to check the stated objectives.'
}
