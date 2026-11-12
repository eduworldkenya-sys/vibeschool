/**
 * Presentation-only cleanup for the existing certified Grade 4 Mathematics Time
 * manuscripts. Never mutates the certified payload, outcome IDs or item IDs.
 * Scope is deliberately narrow: authoring identifiers occur only as prefixes on
 * their own question lines in the historic Time manuscripts.
 */
const LEGACY_TIME_QUESTION_PREFIX = /(^|\r?\n)([ \t]*)VS-G04-MA-TIME-L(?:0[1-9]|10)-(?:G|E|Q)\d+:[ \t]*/g

export function formatGrade4TimeLessonBody(body) {
  return typeof body === 'string'
    ? body.replace(LEGACY_TIME_QUESTION_PREFIX, '$1$2')
    : ''
}
