/**
 * Exam Originals is a catalogue layer over canonical assessment assignments.
 * It NEVER creates a second attempt, scoring, or question-bank authority.
 *
 * An existing assignment belongs to a series only when its approved title
 * explicitly carries the series name. Legacy assessments remain unbranded.
 * A future governed catalogue metadata contract may supersede this fallback.
 */
export const EXAM_ORIGINALS = [
  {
    key: 'cat',
    name: 'VibeCAT',
    tagline: 'Know where you stand',
    summary: 'Focused continuous assessment',
    length: '30 questions',
  },
  {
    key: 'try',
    name: 'VibeTry',
    tagline: 'Try it. Feel ready.',
    summary: 'Short trial examinations',
    length: '10–15 questions',
  },
  {
    key: 'term',
    name: 'VibeTerm',
    tagline: 'Own your term',
    summary: 'Term 1, 2 and 3 assessments',
    length: '50 questions',
  },
  {
    key: 'papers',
    name: 'VibePapers',
    tagline: 'Practise. Improve. Excel.',
    summary: 'Comprehensive revision papers',
    length: '50 questions',
  },
  {
    key: 'mock',
    name: 'VibeMock',
    tagline: 'Practise like exam day',
    summary: 'National assessment simulations',
    length: 'Paper-specific',
  },
] as const

export type ExamOriginalKey = (typeof EXAM_ORIGINALS)[number]['key']

/**
 * Explicit naming only: a quiz named "CAT practice" or a generic "mock"
 * is NOT silently marketed as a certified VibeSchool Original.
 */
export function examOriginalKeyFromTitle(title: string): ExamOriginalKey | null {
  const normalized = title.trim()
  const match = EXAM_ORIGINALS.find(({ name }) =>
    new RegExp('^' + name + '(?:\\s|[-–—:]|$)', 'i').test(normalized),
  )
  return match?.key ?? null
}
