/**
 * Exam Originals is a catalogue layer over canonical assessment assignments.
 * It NEVER creates a second attempt, scoring, or question-bank authority.
 *
 * A paper belongs to an Originals series only when the server's learner
 * discovery contract explicitly returns its trusted product code.
 * Legacy and teacher-authored assessments remain unbranded.
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
 * Accept only a structured classification supplied by the authoritative
 * learner-assignment discovery RPC. A title alone is NEVER evidence of
 * VibeSchool authorship or a certified Original paper.
 */
export function parseExamOriginalKey(value: unknown): ExamOriginalKey | null {
  return EXAM_ORIGINALS.find(series => series.key === value)?.key ?? null
}
