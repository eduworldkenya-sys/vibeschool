/**
 * Stage 3: presentation-only teaching-tool bindings over VibeSchool's existing
 * published/certified lesson resources. No database, cache, question bank,
 * curriculum IDs, certification authority or visual inventory is created here.
 *
 * IMPORTANT: sourceKind is descriptive, NOT authorization. Callers must first
 * use their existing released/certified read RPC or teacher RLS-gated loader.
 * Never use this adapter to turn draft content into learner-visible content.
 */
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const KINDS = new Set(['published_lesson', 'published_outcome', 'certified_scheme', 'certified_curriculum'])
const AUDIENCES = new Set(['learner', 'teacher'])
const SAFE_SLOTS = Object.freeze({
  example: 'worked_example',
  explore: 'exploration',
  guided: 'guided_practice',
  exercise: 'independent_practice',
  check: 'formative_check',
  support: 'learning_support',
  challenge: 'enrichment',
  reflect: 'reflection',
  understand: 'explanation',
  opening: 'explanation',
})
const HIDDEN_SECTIONS = new Set(['feedback', 'answer', 'answers', 'solution', 'solutions', 'teacher_guidance', 'marking_scheme'])
const VISUAL_TOKEN = /\[visual:([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})\]/gi

/**
 * @typedef {{id:string,title:string,body:string,tone?:string,hint?:string}} ReadableSection
 * @typedef {{
 *   key:string, sectionId:string, sectionTitle:string, sectionIndex:number,
 *   slot:string, body:string, visualPlaceholders:readonly string[],
 *   resourceVersionId:string, resourceId:string|null,
 *   outcomeId:string|null, schemeLessonId:string|null
 * }} LearningToolSectionBinding
 */

/** A visual placeholder is not an approved visual. The existing VisualRichText
 * + VisualLearningAsset pipeline must still resolve and authorize each ID. */
function visualPlaceholders(body) {
  const ids = new Set()
  for (const match of body.matchAll(VISUAL_TOKEN)) ids.add(match[1].toLowerCase())
  return Object.freeze([...ids])
}
function requiredId(id, label) {
  if (typeof id !== 'string' || !UUID.test(id)) {
    throw new Error('teachingToolContentBridge: invalid ' + label)
  }
  return id.toLowerCase()
}
function optionalId(id, label) {
  return id == null ? null : requiredId(id, label)
}
function slotFor(section) {
  const id = section.id.toLowerCase()
  if (HIDDEN_SECTIONS.has(id) || section.tone === 'feedback') return null
  return SAFE_SLOTS[id] || (
    section.tone === 'example' ? 'worked_example' :
    section.tone === 'explore' ? 'exploration' :
    section.tone === 'practice' ? 'guided_practice' :
    section.tone === 'learn' ? 'explanation' : 'reading'
  )
}

/**
 * Adapt ONLY an already-admitted read response into reusable input for tools.
 * Missing content yields no tool bindings rather than invented examples.
 * Sections are carried verbatim and remain tied to their immutable version.
 *
 * @param {{
 *   sourceKind:'published_lesson'|'published_outcome'|'certified_scheme'|'certified_curriculum',
 *   audience?:'learner'|'teacher', subject:string, grade:string,
 *   resourceVersionId:string, resourceId?:string|null,
 *   outcomeId?:string|null, schemeLessonId?:string|null,
 *   sections:readonly ReadableSection[]
 * }} input
 */
export function buildLearningToolContext(input) {
  if (!input || !KINDS.has(input.sourceKind)) {
    throw new Error('teachingToolContentBridge: unsupported source kind')
  }
  const audience = input.audience ?? 'learner'
  if (!AUDIENCES.has(audience) || (input.sourceKind.startsWith('certified_') && audience !== 'teacher')) {
    throw new Error('teachingToolContentBridge: source/audience boundary violated')
  }
  const subject = typeof input.subject === 'string' ? input.subject.trim() : ''
  const grade = typeof input.grade === 'string' ? input.grade.trim() : ''
  if (!subject || !grade) throw new Error('teachingToolContentBridge: subject and grade required')
  const resourceVersionId = requiredId(input.resourceVersionId, 'resource version ID')
  const resourceId = optionalId(input.resourceId, 'resource ID')
  const outcomeId = optionalId(input.outcomeId, 'outcome ID')
  const schemeLessonId = optionalId(input.schemeLessonId, 'scheme lesson ID')
  if (input.sourceKind === 'published_outcome' && (!outcomeId || !resourceId)) {
    throw new Error('teachingToolContentBridge: outcome resources need pinned identities')
  }
  if (input.sourceKind === 'certified_scheme' && !schemeLessonId) {
    throw new Error('teachingToolContentBridge: scheme lesson identity required')
  }
  if (!Array.isArray(input.sections)) {
    throw new Error('teachingToolContentBridge: sections must come from a read result')
  }
  /** @type {LearningToolSectionBinding[]} */
  const bindings = []
  let displayIndex = 0
  for (const section of input.sections) {
    if (!section || typeof section.body !== 'string' || !section.body.trim()) continue
    const index = displayIndex++
    if (typeof section.id !== 'string' || !section.id.trim() || typeof section.title !== 'string') {
      throw new Error('teachingToolContentBridge: malformed section')
    }
    const slot = slotFor(section)
    if (!slot) continue
    bindings.push(Object.freeze({
      key: resourceVersionId + ':' + index + ':' + section.id,
      sectionId: section.id,
      sectionTitle: section.title,
      sectionIndex: index,
      slot,
      body: section.body,
      visualPlaceholders: visualPlaceholders(section.body),
      resourceVersionId, resourceId, outcomeId, schemeLessonId,
    }))
  }
  return Object.freeze({
    sourceKind: input.sourceKind, audience, subject, grade,
    resourceVersionId, resourceId, outcomeId, schemeLessonId,
    bindings: Object.freeze(bindings),
  })
}

/** A stale or mismatched section must not receive tools from another lesson. */
export function getLearningToolSectionBinding(context, section, index) {
  if (!context || !section || !Number.isInteger(index)) return null
  return context.bindings.find(binding =>
    binding.sectionIndex === index &&
    binding.sectionId === section.id &&
    binding.body === section.body
  ) ?? null
}

/**
 * Teacher-side adapter for the *existing* RLS-gated
 * loadCertifiedContentForSource / CanonicalLessonSourceBundle API.
 * It consumes only already certified versions; no direct reads, writes,
 * broad curriculum matching, or generated fallback examples.
 *
 * A missing timetable is fine: schemeLessonId is optional. When omitted, the
 * existing curriculum-linked lookup still determines eligible resources.
 * This function is not a certification or authorization check.
 */
export function buildCertifiedTeacherToolContexts({ subject, grade, schemeLessonId = null, assets }) {
  if (!Array.isArray(assets)) throw new Error('teachingToolContentBridge: certified assets must be an array')
  if (typeof grade !== 'string' || !grade.trim()) return []
  const result = []
  for (const asset of assets) {
    if (!asset || typeof asset.resourceId !== 'string' ||
      typeof asset.resourceVersionId !== 'string' ||
      !asset.certifiedAt || !asset.certificationPolicyVersion ||
      !asset.contentSha256 ||
      ['marking_scheme', 'assessment', 'quiz'].includes(asset.assetKind)) continue
    const payload = asset.payload
    if (!payload || typeof payload !== 'object' || Array.isArray(payload)) continue
    const sections = []
    if (Array.isArray(payload.sections)) {
      for (const item of payload.sections) {
        if (!item || typeof item !== 'object' || Array.isArray(item)) continue
        const body = typeof item.body === 'string' ? item.body : null
        if (!body?.trim()) continue
        sections.push({
          id: typeof item.id === 'string' && item.id.trim() ? item.id : 'reading',
          title: typeof item.title === 'string' ? item.title :
            typeof item.heading === 'string' ? item.heading : 'Learning content',
          body, tone: typeof item.tone === 'string' ? item.tone : 'learn',
        })
      }
    } else {
      const body = typeof payload.content_text === 'string' ? payload.content_text :
        typeof payload.body === 'string' ? payload.body : ''
      if (body.trim()) sections.push({ id: 'reading', title: 'Learning content', body, tone: 'learn' })
    }
    if (!sections.length) continue
    result.push(buildLearningToolContext({
      sourceKind: schemeLessonId ? 'certified_scheme' : 'certified_curriculum',
      audience: 'teacher', subject, grade,
      schemeLessonId, resourceId: asset.resourceId,
      resourceVersionId: asset.resourceVersionId, sections,
    }))
  }
  return Object.freeze(result)
}
