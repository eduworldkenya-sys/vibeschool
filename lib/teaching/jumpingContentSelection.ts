/**
 * Grade 1 Jumping manuscripts are 14 independent teaching units, not one
 * unfiltered sub-strand blob. Selection is bound to the explicit Scheme lesson
 * number. Sequence number/week/period are not substitutes for lesson number.
 *
 * Keep this narrow until the general canonical lesson-unit addressing contract
 * is available. Other curricula retain their existing resource selection.
 */
export function includeGradeOneJumpingAsset(
  canonicalKey: string | null | undefined,
  lessonNumber: number | null | undefined,
): boolean {
  if (!canonicalKey?.startsWith('vs:g1:jumping:')) return true

  const lesson = /^vs:g1:jumping:(?:teacher|learner):lesson:(\d{2})$/.exec(canonicalKey)
  if (!lesson) return true // Topic guide, assessment, song and introduction.

  return typeof lessonNumber === 'number' &&
    Number.isInteger(lessonNumber) &&
    lessonNumber >= 1 &&
    lessonNumber <= 14 &&
    Number(lesson[1]) === lessonNumber
}
