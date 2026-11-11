/**
 * Read-only, deterministic annual scheme preview for KICD-referenced Grade 1 learning areas.
 * Curriculum data supplies ordering/outcomes; the school calendar supplies weeks.
 * This does not write teacher-owned scheme records or claim official KICD pacing.
 */
export function buildGrade1AnnualSchemeDraft({units, terms, termWeeks, weeklyAllocation = null, expectedUnitCount = null, gradeLabel = 'Grade 1'}) {
  if (!Array.isArray(units) || units.length === 0 || (expectedUnitCount !== null && units.length !== expectedUnitCount) || !Array.isArray(terms) || !Array.isArray(termWeeks)) {
    return {items: [], weeks: [], error: 'The complete ${gradeLabel} curriculum and school calendar are needed.'}
  }
  const sortedTerms = [...terms].filter(term => [1, 2, 3].includes(Number(term.term)))
    .sort((a, b) => Number(a.term) - Number(b.term))
  if (sortedTerms.length !== 3 || new Set(sortedTerms.map(term => Number(term.term))).size !== 3) {
    return {items: [], weeks: [], error: 'All three school terms are required for annual curriculum pacing.'}
  }
  const weeks = []
  for (const term of sortedTerms) {
    const byNumber = new Map()
    for (const week of termWeeks) {
      if (week.term_id !== term.id) continue
      if (week.week_type && week.week_type !== 'normal' && week.week_type !== 'instructional') continue
      const num = Number(week.week_number)
      if (!Number.isInteger(num) || num < 1) continue
      const old = byNumber.get(num)
      if (!old || (week.school_id && !old.school_id)) byNumber.set(num, week)
    }
    if (!byNumber.size) {
      return {items: [], weeks: [], error: `No instructional weeks found for Term ${term.term}.`}
    }
    for (const num of [...byNumber.keys()].sort((a, b) => a - b)) {
      weeks.push({termId: term.id, termNumber: Number(term.term), week: num})
    }
  }
  const totalLessons = units.reduce((sum, unit) => sum + Number(unit.lessons || 0), 0)
  if (!totalLessons || units.some(unit => !Array.isArray(unit.outcomes) || !unit.outcomes.length || !Number.isInteger(unit.lessons) || unit.lessons < 1)) {
    return {items: [], weeks, error: 'Curriculum lesson counts or outcomes are incomplete.'}
  }
  const maxPerWeek = weeklyAllocation && Number.isInteger(Number(weeklyAllocation)) && Number(weeklyAllocation) > 0 ? Number(weeklyAllocation) : null
  if (maxPerWeek && totalLessons > weeks.length * maxPerWeek) {
    return {items: [], weeks, error: `The annual curriculum suggests ${totalLessons} lessons, but this school's allocation fits only ${weeks.length * maxPerWeek}. School pacing must be reconciled.`}
  }
  const items = []
  let annualIndex = 0
  for (const unit of units) {
    for (let withinUnit = 0; withinUnit < unit.lessons; withinUnit++) {
      const position = Math.floor(annualIndex * weeks.length / totalLessons)
      const calendarWeek = weeks[position]
      const outcomeIndex = Math.min(unit.outcomes.length - 1, Math.floor(withinUnit * unit.outcomes.length / unit.lessons))
      // An English skill can specify more outcomes than lessons. In that case
      // attach multiple outcome identities to the same draft lesson instead of
      // silently dropping the extra curriculum outcomes.
      const assigned = unit.outcomes.map((_, index) => index)
        .filter(index => Math.floor(index * unit.lessons / unit.outcomes.length) === withinUnit)
      const outcomeIndexes = [...new Set([outcomeIndex, ...assigned])].sort((a,b)=>a-b)
      items.push({
        key: `${unit.id}:${withinUnit + 1}`,
        unitId: unit.id,
        title: unit.title,
        strand: unit.strand,
        termId: calendarWeek.termId,
        termNumber: calendarWeek.termNumber,
        week: calendarWeek.week,
        outcomeIndex,
        outcomeIndexes,
        outcome: unit.outcomes[outcomeIndex],
        outcomes: outcomeIndexes.map(index => unit.outcomes[index]),
        sequence: annualIndex + 1,
        suggestedLesson: withinUnit + 1,
      })
      annualIndex++
    }
  }
  return {items, weeks, totalLessons, unitCount: units.length, pacingSource: maxPerWeek ? 'calendar-and-weekly-allocation' : 'provisional-calendar-only', error: null}
}

export function termCreativeSchemeRows(draft, termId) {
  return (draft?.items || []).filter(item => item.termId === termId)
}

/** Preserve the Creative Activities contract and full sixteen-unit coverage gate. */
export function buildCreativeAnnualSchemeDraft(options) {
  return buildGrade1AnnualSchemeDraft({...options,expectedUnitCount:16})
}
