/** Public discovery hashtags; curriculum subject remains separate internal metadata. */
export const MINI_MAX_TAGS = 5
export const MINI_TAG_RE = /^[a-z][a-z0-9_]{1,29}$/

export function parseMiniHashtags(value: string): string[] {
  const words = value.trim().split(/[\s,]+/).filter(Boolean)
  if (words.length === 0) throw new Error('Add at least one hashtag.')
  if (words.length > MINI_MAX_TAGS) throw new Error('Use up to five hashtags.')
  const tags: string[] = []
  for (const word of words) {
    const tag = word.replace(/^#/, '').toLowerCase()
    if (!MINI_TAG_RE.test(tag)) throw new Error('Hashtags must start with a letter and contain 2–30 letters, numbers or underscores.')
    if (!tags.includes(tag)) tags.push(tag)
  }
  return tags
}

export function miniTagLabel(tag: string): string { return '#' + tag }

const SUBJECT_TAGS: Record<string, string> = {
  history:'History', agriculture:'Agriculture', physics:'Physics', literature:'Literature',
  mathematics:'Mathematics', maths:'Mathematics', english:'English', kiswahili:'Kiswahili',
  science:'Science', creativearts:'Creative Arts',
}
/** An optional internal classifier, never shown as a required publishing field. */
export function miniSubjectFromTags(tags: readonly string[]): string {
  for (const tag of tags) if (SUBJECT_TAGS[tag]) return SUBJECT_TAGS[tag]
  return 'General Knowledge'
}
