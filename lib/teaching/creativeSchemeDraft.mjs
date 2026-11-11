/**
 * Shared, read-only Grade 1 annual Scheme preview.
 * Curriculum supplies suggested lesson totals; teacher school's actual
 * instructional calendar and canonical subject allocation control pacing.
 * No draft creates Scheme records or claims official KICD weekly sequencing.
 */
export function buildGrade1AnnualSchemeDraft({
  units, terms, termWeeks, weeklyAllocation = null, expectedUnitCount = null, requireWeeklyAllocation = false,
  themes = null,
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
      // Resolve school-specific overrides BEFORE filtering non-instructional
      // weeks, or a school holiday would incorrectly inherit a global lesson.
      const num = Number(week.week_number)
      if (!Number.isInteger(num) || num < 1) continue
      const old = byNumber.get(num)
      if (!old || (week.school_id && !old.school_id)) byNumber.set(num, week)
    }
    const instructional = [...byNumber.entries()]
      .filter(([, row])=>!row.week_type || row.week_type==='normal' || row.week_type==='instructional')
      .sort(([a],[b])=>a-b)
    if (!instructional.length) {
      return {items: [], weeks: [], error: `No instructional weeks found for Term ${term.term}.`}
    }
    for (const [num] of instructional) {
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
  // Create one immutable suggested lesson for each source allocation.
  // Unit sequence is appropriate for Maths and Creative Activities.
  const strandPools = new Map()
  const sequential = []
  for (const unit of units) {
    const pool = strandPools.get(unit.strand) || []
    for (let withinUnit = 0; withinUnit < unit.lessons; withinUnit++) {
      const outcomeIndex = Math.min(unit.outcomes.length-1,
        Math.floor(withinUnit*unit.outcomes.length/unit.lessons))
      const row = {
        key: `${unit.id}:${withinUnit+1}`,
        unitId: unit.id, title: unit.title, strand: unit.strand,
        outcomeIndex, outcome: unit.outcomes[outcomeIndex],
        suggestedLesson: withinUnit+1,
      }
      pool.push(row)
      sequential.push(row)
    }
    strandPools.set(unit.strand,pool)
  }

  let sequence = sequential
  if (themes !== null) {
    // English: interleave all four literacy strands inside EACH of the
    // 15 themes, instead of teaching 60 oral lessons before any reading.
    // Strands retain the exact 60/30/30/30 source allocations.
    if (!Array.isArray(themes) || !themes.length ||
      totalLessons%themes.length!==0 ||
      new Set(themes.map(theme=>theme.id)).size!==themes.length) {
      return {items:[],weeks,totalLessons,error:'English themes or lesson allocation cannot be reconciled.'}
    }
    const orderedStrands = [...strandPools.keys()].sort((a,b)=>Number(a)-Number(b))
    const byStrand = new Map()
    for (const strand of orderedStrands) {
      const pool = strandPools.get(strand)
      if (pool.length%themes.length!==0) {
        return {items:[],weeks,totalLessons,error:'English strand lessons cannot be distributed across all teaching themes.'}
      }
      byStrand.set(strand,{pool,perTheme:pool.length/themes.length,offset:0})
    }
    // Layered round-robin: 60 Listening/Speaking, then 30 each of
    // Reading, Language Use and Writing across the whole year.
    sequence=[]
    for (const theme of themes) {
      const rounds=Math.max(...[...byStrand.values()].map(x=>x.perTheme))
      for (let round=0;round<rounds;round++) {
        for(const strand of orderedStrands) {
          const entry=byStrand.get(strand)
          if(round>=entry.perTheme)continue
          const lesson=entry.pool[entry.offset++]
          if(!lesson)return {items:[],weeks,totalLessons,error:'English strand sequence is incomplete.'}
          sequence.push({...lesson,themeId:theme.id,themeTitle:theme.title})
        }
      }
    }
    if(sequence.length!==totalLessons)return {items:[],weeks,totalLessons,error:'English thematic lesson coverage is incomplete.'}
  }

  const items=sequence.map((item,index)=>{
    const position=Math.floor(index*weeks.length/totalLessons)
    const calendarWeek=weeks[position]
    return {
      ...item,termId:calendarWeek.termId,termNumber:calendarWeek.termNumber,
      week:calendarWeek.week,sequence:index+1,
    }
  })
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
