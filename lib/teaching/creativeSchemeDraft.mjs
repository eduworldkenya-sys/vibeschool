/**
 * Read-only, deterministic annual scheme preview for Grade 1 Creative Activities.
 * Curriculum data supplies ordering/outcomes; the school calendar supplies weeks.
 * This does not write teacher-owned scheme records or claim official KICD pacing.
 */
export function buildGrade1AnnualSchemeDraft({
  units, terms, termWeeks, weeklyAllocation = null, expectedUnitCount = null, requireWeeklyAllocation = false,
}) {
  if (!Array.isArray(units) || !units.length ||
      (expectedUnitCount !== null && units.length !== expectedUnitCount) ||
      !Array.isArray(terms) || !Array.isArray(termWeeks)) {
    return {items: [], weeks: [], error: 'The complete Grade 1 curriculum and school calendar are needed.'}
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
  const maxPerWeek = weeklyAllocation !== null && Number.isInteger(Number(weeklyAllocation)) && Number(weeklyAllocation) > 0
    ? Number(weeklyAllocation) : null
  if (requireWeeklyAllocation && maxPerWeek === null) {
    return {items: [], weeks, totalLessons, unitCount: units.length,
      error: 'The school has no confirmed weekly lesson allocation for this subject. Set the canonical allocation before generating a Scheme.'}
  }
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
      items.push({
        key: `${unit.id}:${withinUnit + 1}`,
        unitId: unit.id,
        title: unit.title,
        strand: unit.strand,
        termId: calendarWeek.termId,
        termNumber: calendarWeek.termNumber,
        week: calendarWeek.week,
        outcomeIndex,
        outcome: unit.outcomes[outcomeIndex],
        sequence: annualIndex + 1,
        suggestedLesson: withinUnit + 1,
      })
      annualIndex++
    }
  }
  return {items, weeks, totalLessons, unitCount: units.length,
    weeklyAllocation: maxPerWeek,
    annualCapacity: maxPerWeek === null ? null : weeks.length * maxPerWeek,
    pacingSource: maxPerWeek ? 'calendar-and-weekly-allocation' : 'provisional-calendar-only', error: null}
}

/** Backward compatible Creative Activities entry point; no duplicate planner. */
export function buildCreativeAnnualSchemeDraft(options) {
  return buildGrade1AnnualSchemeDraft({...options, expectedUnitCount: 16})
}

export function termCreativeSchemeRows(draft, termId) {
  return (draft?.items || []).filter(item => item.termId === termId)
}
