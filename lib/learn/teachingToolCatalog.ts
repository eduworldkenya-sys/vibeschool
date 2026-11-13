/**
 * Presentation-only teaching tools. No learner identity, assessment scores, RPC,
 * publication flags or lesson-authority decisions belong in this module.
 * Activities are optional data attached by an already-authorised content reader.
 */
export const TEACHING_TOOL_CATALOG = [
  { id: 'number-line', title: 'Number line', subject: 'math', description: 'Explore positive and negative numbers by moving a marker.' },
  { id: 'place-value', title: 'Place-value explorer', subject: 'math', description: 'See how each digit contributes to a number.' },
  { id: 'fraction-bars', title: 'Fraction comparator', subject: 'math', description: 'Compare two fractions using equal-width visual bars.' },
  { id: 'multiplication-array', title: 'Multiplication array', subject: 'math', description: 'Build rows and columns to understand multiplication.' },
  { id: 'clock', title: 'Interactive clock', subject: 'math', description: 'Move the hands to explore hours and minutes.' },
  { id: 'unit-converter', title: 'Unit converter', subject: 'math', description: 'Compare time, distance and mass using standard units.' },
  { id: 'word-builder', title: 'Word builder', subject: 'language', description: 'Arrange letters to make a word.' },
  { id: 'sentence-order', title: 'Sentence builder', subject: 'language', description: 'Reorder words to form a complete sentence.' },
  { id: 'vocabulary-match', title: 'Vocabulary match', subject: 'language', description: 'Match words with their meanings.' },
  { id: 'classification', title: 'Classification sorter', subject: 'science', description: 'Classify examples into scientific groups.' },
  { id: 'experiment-variables', title: 'Fair-test planner', subject: 'science', description: 'Distinguish what changes, what is measured and what stays constant.' },
  { id: 'food-chain', title: 'Food-chain builder', subject: 'science', description: 'Put living things in the order of energy transfer.' },
] as const

export type TeachingToolId = (typeof TEACHING_TOOL_CATALOG)[number]['id']
export type TeachingToolSubject = (typeof TEACHING_TOOL_CATALOG)[number]['subject']
export type TeachingToolSpec = {
  id: TeachingToolId
  prompt?: string
  /** Optional instructional example; never a scored exam question. */
  number?: number
  word?: string
  sentence?: string
  sequence?: readonly string[]
  pairs?: readonly { term: string; definition: string }[]
  groups?: readonly string[]
  items?: readonly { label: string; group: string }[]
}
const validToolIds = new Set<string>(TEACHING_TOOL_CATALOG.map(tool => tool.id))

export function isTeachingToolId(id: string): id is TeachingToolId {
  return validToolIds.has(id)
}

/** Recommends exploratory examples, not a claim that any outcome is mastered. */
export function suggestTeachingTools(subject: string, topic = ''): TeachingToolSpec[] {
  const text = (subject + ' ' + topic).toLowerCase()
  if (/math|mathematics/.test(subject.toLowerCase())) {
    if (/time|clock|hour|minute/.test(text)) {
      return [{ id: 'clock' }, { id: 'unit-converter' }, { id: 'number-line' }]
    }
    if (/fraction|ratio|decimal/.test(text)) {
      return [{ id: 'fraction-bars' }, { id: 'number-line' }, { id: 'multiplication-array' }]
    }
    if (/measure|length|mass|weight|capacity|distance/.test(text)) {
      return [{ id: 'unit-converter' }, { id: 'number-line' }, { id: 'multiplication-array' }]
    }
    return [{ id: 'number-line' }, { id: 'place-value' }, { id: 'fraction-bars' }, { id: 'multiplication-array' }]
  }
  if (/english|kiswahili|language|literature|french|arabic/.test(text)) {
    return [{ id: 'word-builder' }, { id: 'sentence-order' }, { id: 'vocabulary-match' }]
  }
  if (/science|biology|chemistry|physics|environment|health|agriculture/.test(text)) {
    return [{ id: 'classification' }, { id: 'experiment-variables' }, { id: 'food-chain' }]
  }
  return []
}

/** Content authors can opt in explicitly; unknown ids never reach the UI. */
export function resolveTeachingTools(
  subject: string,
  topic: string,
  tools?: readonly TeachingToolSpec[],
): TeachingToolSpec[] {
  const selected = tools ?? suggestTeachingTools(subject, topic)
  const seen = new Set<TeachingToolId>()
  return selected.filter((tool): tool is TeachingToolSpec =>
    !!tool && typeof tool.id === 'string' && isTeachingToolId(tool.id)
      && !seen.has(tool.id) && (seen.add(tool.id), true)).slice(0, 12)
}
