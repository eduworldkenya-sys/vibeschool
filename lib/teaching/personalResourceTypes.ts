import { TEACHING_LIBRARY_SLOTS } from '@/lib/teaching/libraryStructure'

export type PersonalResourceComponent = (typeof TEACHING_LIBRARY_SLOTS)[number]['id']
export type ResourceLegacyType = 'notes' | 'assignment' | 'video' | 'link' | 'quiz'
export type ResourceSharingStatus = 'draft' | 'shared'

export function isResourceComponent(value: unknown): value is PersonalResourceComponent {
  return typeof value === 'string' && TEACHING_LIBRARY_SLOTS.some(slot => slot.id === value)
}

/**
 * Preserve the existing resources.type constraint. component_type is the
 * human/learning taxonomy; legacy type is transport compatibility only.
 * An authored "quiz" is a resource, NOT an auto-marked assessment attempt.
 */
export function legacyTypeForComponent(component: PersonalResourceComponent, hasVideoLink = false): ResourceLegacyType {
  if (component === 'lesson-notes') return 'notes'
  if (component === 'quizzes') return 'quiz'
  if (component === 'projects' || component === 'assignments' || component === 'homework') return 'assignment'
  if (component === 'demonstrations' && hasVideoLink) return 'video'
  return 'link'
}

export function componentForPersonalResource(resource: { component_type?: string | null; type: string }): string | null {
  if (isResourceComponent(resource.component_type)) return resource.component_type
  switch (resource.type) {
    case 'notes': return 'lesson-notes'
    case 'quiz': return 'quizzes'
    case 'assignment': return 'assignments'
    case 'video': return 'demonstrations'
    default: return null
  }
}

export function mayShareResource(value: { title: string; content?: string | null; external_url?: string | null }): boolean {
  const contentReady = !!value.content?.trim()
  const url = value.external_url?.trim()
  let urlReady = false
  if (url) {
    try { urlReady = ['http:', 'https:'].includes(new URL(url).protocol) } catch { urlReady = false }
  }
  return !!value.title.trim() && (contentReady || urlReady)
}
