/**
 * Read-only presentation tool registry for the Universal Learn Reader.
 * Content authority, certifications, admissions and answer permissions remain
 * with the existing upstream reader/RPC, NOT with this selection layer.
 */
export type LearnSubjectMode = 'math' | 'language' | 'science' | 'creative' | 'general'
export type TeachingToolId = 'rich-text' | 'math-worked-steps' | 'language-reading' | 'science-observation'

export type TeachingToolRequest = TeachingToolId | { id: string; version: number }
export type TeachingToolSection = {
  id: string
  body: string
  tone?: string
  teachingTool?: TeachingToolRequest | null
}

type ToolDefinition = {
  id: TeachingToolId
  version: 1
  modes: readonly LearnSubjectMode[]
  label: string
}

/** Tools are reusable by subject, not owned by a grade or curriculum outcome. */
export const TEACHING_TOOL_REGISTRY: Readonly<Record<TeachingToolId, ToolDefinition>> = {
  'rich-text': { id: 'rich-text', version: 1, modes: ['math','language','science','creative','general'], label: 'Readable lesson content' },
  'math-worked-steps': { id: 'math-worked-steps', version: 1, modes: ['math'], label: 'Worked steps' },
  'language-reading': { id: 'language-reading', version: 1, modes: ['language'], label: 'Reading passage' },
  'science-observation': { id: 'science-observation', version: 1, modes: ['science'], label: 'Observation' },
}

export function learnSubjectMode(subject: string): LearnSubjectMode {
  if (/math|mathematics/i.test(subject)) return 'math'
  if (/english|kiswahili|language|literature|french|arabic|german|spanish|sign language|mother tongue|indigenous/i.test(subject)) return 'language'
  if (/science|agriculture|health|biology|chemistry|physics|environment/i.test(subject)) return 'science'
  if (/creative|art|music|performing|design/i.test(subject)) return 'creative'
  return 'general'
}

export type ToolSelection = {
  id: TeachingToolId
  subjectMode: LearnSubjectMode
  source: 'requested' | 'automatic' | 'default' | 'fallback'
}

/**
 * Explicit, versioned tool metadata takes priority. Unknown, unsupported or
 * future-version requests fail visibly to rich text without losing content.
 * Legacy Grade 4 Time worked examples retain their progressive maths display.
 * Language and science never guess a specialised activity from raw prose.
 */
export function selectTeachingTool(subject: string, section: TeachingToolSection): ToolSelection {
  const subjectMode = learnSubjectMode(subject)
  const request = section.teachingTool
  if (request !== null && request !== undefined) {
    const id = typeof request === 'string' ? request : request?.id
    const version = typeof request === 'string' ? 1 : request?.version
    if (id && Object.prototype.hasOwnProperty.call(TEACHING_TOOL_REGISTRY, id)) {
      const tool = TEACHING_TOOL_REGISTRY[id as TeachingToolId]
      if (version === tool.version && tool.modes.includes(subjectMode)) {
        return { id: tool.id, subjectMode, source: 'requested' }
      }
    }
    return { id: 'rich-text', subjectMode, source: 'fallback' }
  }

  if (subjectMode === 'math' && section.id === 'example'
      && typeof section.body === 'string'
      && (section.body.match(/^\s*\d+[.)]\s+\S/gm) ?? []).length >= 2) {
    return { id: 'math-worked-steps', subjectMode, source: 'automatic' }
  }
  return { id: 'rich-text', subjectMode, source: 'default' }
}
