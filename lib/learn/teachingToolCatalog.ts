/**
 * The interactive teaching tools are local, optional and presentation-only.
 * Only a previously authorised published lesson/teacher source may supply tool
 * configuration. This catalogue does NOT admit resources or decide curriculum.
 */
import { learnSubjectMode } from './toolSubject.mjs'

export const TEACHING_TOOL_CATALOG = [
  { id: 'number-line', title: 'Number line', subject: 'math', description: 'Explore the position of numbers using an adjustable number line.' },
  { id: 'place-value', title: 'Place-value explorer', subject: 'math', description: 'See how each digit contributes to a whole number.' },
  { id: 'fraction-bars', title: 'Fraction comparator', subject: 'math', description: 'Compare proper and improper fractions visually.' },
  { id: 'multiplication-array', title: 'Multiplication array', subject: 'math', description: 'Build rows and columns to understand multiplication.' },
  { id: 'clock', title: 'Interactive clock', subject: 'math', description: 'Move the hands to explore hours and minutes.' },
  { id: 'unit-converter', title: 'Unit converter', subject: 'math', description: 'Compare time, distance, mass and capacity.' },
  { id: 'data-chart', title: 'Data bar chart', subject: 'math', description: 'Read and compare values in an authored dataset.' },
  { id: 'word-builder', title: 'Word builder', subject: 'language', description: 'Arrange letter tiles to spell a word.' },
  { id: 'sentence-order', title: 'Sentence builder', subject: 'language', description: 'Reorder words to form a sentence.' },
  { id: 'vocabulary-match', title: 'Vocabulary match', subject: 'language', description: 'Match words with meanings.' },
  { id: 'reading-comprehension', title: 'Read and reflect', subject: 'language', description: 'Read a short passage and compare your response with an example.' },
  { id: 'writing-planner', title: 'Writing planner', subject: 'language', description: 'Plan a beginning, middle and ending before writing.' },
  { id: 'classification', title: 'Classification sorter', subject: 'science', description: 'Classify authored examples into groups.' },
  { id: 'experiment-variables', title: 'Fair-test planner', subject: 'science', description: 'Recognise independent, dependent and controlled variables.' },
  { id: 'food-chain', title: 'Food-chain builder', subject: 'science', description: 'Put living things in the order of energy transfer.' },
] as const

export type TeachingToolId = (typeof TEACHING_TOOL_CATALOG)[number]['id']
export type TeachingToolSubject = (typeof TEACHING_TOOL_CATALOG)[number]['subject']
export type TeachingToolSpec = {
  id: TeachingToolId
  version?: 1
  /** Instructional text supplied by an already-authorised lesson. Never a scored exam item. */
  prompt?: string
  number?: number
  min?: number
  max?: number
  step?: number
  word?: string
  sentence?: string
  sequence?: readonly string[]
  pairs?: readonly { term: string; definition: string }[]
  groups?: readonly string[]
  items?: readonly { label: string; group: string }[]
  points?: readonly { label: string; value: number }[]
  passage?: string
  question?: string
  sampleAnswer?: string
}

const toolMap = new Map<string, (typeof TEACHING_TOOL_CATALOG)[number]>(TEACHING_TOOL_CATALOG.map(tool => [tool.id, tool]))
export function isTeachingToolId(id: string): id is TeachingToolId {
  return toolMap.has(id)
}
export function isTeachingToolSubject(subject: string, id: TeachingToolId): boolean {
  const mode = learnSubjectMode(subject)
  const meta = toolMap.get(id)
  // The same data representation serves Mathematics and Science outcomes.
  return !!meta && (meta.subject === mode || (id === 'data-chart' && mode === 'science'))
}
const goodText = (v: unknown, min = 1, max = 200) =>
  typeof v === 'string' && v.trim().length >= min && v.trim().length <= max
const goodLabels = (xs: unknown, min = 2, max = 12): xs is string[] =>
  Array.isArray(xs) && xs.length >= min && xs.length <= max &&
  xs.every(x => goodText(x, 1, 80))
const goodPairs = (value: unknown): boolean =>
  Array.isArray(value) && value.length >= 2 && value.length <= 8 &&
  value.every(item => item && goodText(item.term,1,80) && goodText(item.definition,1,190)) &&
  new Set(value.map(item => item.term.toLocaleLowerCase())).size === value.length
const fairTestGroups = ['Changed (independent)', 'Measured (dependent)', 'Kept the same (controlled)']
function goodItems(items: unknown, groups: readonly string[]): boolean {
  return Array.isArray(items) && items.length >= 2 && items.length <= 12 &&
    items.every(item => item && goodText(item.label,1,80) && groups.includes(item.group))
}
const finiteInteger = (x: unknown) => typeof x === 'number' && Number.isSafeInteger(x)

/** Reject malformed lesson-authored configuration instead of inventing generic material. */
export function isUsableTeachingToolSpec(value: unknown, subject: string): value is TeachingToolSpec {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false
  const tool = value as Record<string, unknown>
  if (typeof tool.id !== 'string' || !isTeachingToolId(tool.id) ||
      !isTeachingToolSubject(subject,tool.id) || (tool.version !== undefined && tool.version !== 1) ||
      (tool.prompt !== undefined && !goodText(tool.prompt,1,240))) return false
  switch (tool.id) {
    case 'number-line':
      return (tool.min === undefined || tool.max === undefined || (tool.min as number) < (tool.max as number)) &&
        (tool.number === undefined || (finiteInteger(tool.number) && Math.abs(tool.number as number) <= 1000)) &&
        (tool.min === undefined || (finiteInteger(tool.min) && (tool.min as number) >= -1000)) &&
        (tool.max === undefined || (finiteInteger(tool.max) && (tool.max as number) <= 1000)) &&
        (tool.step === undefined || (finiteInteger(tool.step) && (tool.step as number) >= 1 && (tool.step as number) <= 100))
    case 'place-value':
      return tool.number === undefined || (finiteInteger(tool.number) && (tool.number as number) >= 0 && (tool.number as number) <= 999999999999)
    case 'word-builder':
      return goodText(tool.prompt, 5, 240) && goodText(tool.word, 2, 32) && Array.from(tool.word as string).length <= 16 && Array.from(tool.word as string).every(char => new RegExp('\\p{L}', 'u').test(char))
    case 'sentence-order':
      return goodText(tool.sentence, 5, 200) && goodLabels((tool.sentence as string).split(/\s+/),2,12)
    case 'vocabulary-match': return goodPairs(tool.pairs)
    case 'classification':
      return goodLabels(tool.groups,2,8) && goodItems(tool.items,tool.groups as string[])
    case 'experiment-variables':
      return goodItems(tool.items,fairTestGroups)
    case 'food-chain':
      return goodLabels(tool.sequence,3,12) &&
        new Set((tool.sequence as string[]).map(x => x.toLocaleLowerCase())).size === (tool.sequence as string[]).length
    case 'data-chart':
      return Array.isArray(tool.points) && tool.points.length >= 2 && tool.points.length <= 8 &&
        tool.points.every(point => point && goodText(point.label,1,40) &&
          typeof point.value === 'number' && Number.isFinite(point.value) && point.value >= 0 && point.value <= 10000) &&
        new Set(tool.points.map(point => point.label.toLocaleLowerCase())).size === tool.points.length
    case 'reading-comprehension':
      return goodText(tool.passage,30,1800) && goodText(tool.question,5,220) && goodText(tool.sampleAnswer,2,500)
    case 'writing-planner': return goodText(tool.prompt,5,240)
    default: return true
  }
}

/** Compatibility API: generic subject/topic suggestions are not learner-ready
 * curriculum evidence, so never display them automatically. */
export function suggestTeachingTools(_subject: string, _topic = ''): TeachingToolSpec[] {
  return []
}

/** Only explicit author-supplied, validated, subject-appropriate tool data is rendered.
 * Unknown and wrong-subject IDs, duplicate tools, and unbounded payloads are ignored. */
export function resolveTeachingTools(subject: string, _topic: string, tools?: readonly TeachingToolSpec[]): TeachingToolSpec[] {
  if (!Array.isArray(tools)) return []
  const seen = new Set<TeachingToolId>()
  return tools.filter((tool): tool is TeachingToolSpec =>
    isUsableTeachingToolSpec(tool,subject) && !seen.has(tool.id) && (seen.add(tool.id),true)).slice(0,5)
}
