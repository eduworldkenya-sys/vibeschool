export interface SelfReviewCriterion {
  id: string
  label: string
  marks: number
}
export interface SelfReviewItem {
  assessmentItemId: string
  prompt: string
  responseText: string | null
  criteria: SelfReviewCriterion[]
  maxScore: number
  selfReviewScore: number | null
  selectedIds: string[]
  unsure: boolean
  reviewedAt: string | null
}
export interface SavedSelfReview {
  assessmentItemId: string
  selfReviewScore: number | null
  selectedIds: string[]
  unsure: boolean
  maxScore: number
  scoreAuthority: 'learner_self_assessed_not_verified'
}

function record(value: unknown): Record<string, unknown> | null {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown>
    : null
}

function positive(value: unknown): number | null {
  const n = typeof value === 'number' ? value : NaN
  return Number.isFinite(n) && n > 0 ? n : null
}

export function parseSelfReviewItems(value: unknown): SelfReviewItem[] {
  const payload = record(value)
  if (!payload || payload.ok !== true || !Array.isArray(payload.items)) {
    throw new Error('Self-review returned an invalid response.')
  }
  return payload.items.flatMap((entry): SelfReviewItem[] => {
    const item = record(entry)
    const list = item?.criteria
    const maxScore = positive(item?.max_score)
    if (!item || typeof item.assessment_item_id !== 'string'
      || !Array.isArray(list) || list.length === 0 || list.length > 20 || maxScore === null) return []

    const criteria: SelfReviewCriterion[] = []
    const unique = new Set<string>()
    let sum = 0
    for (const raw of list) {
      const c = record(raw)
      const points = positive(c?.marks)
      if (!c || typeof c.id !== 'string' || !c.id.trim()
        || typeof c.label !== 'string' || !c.label.trim()
        || points === null || unique.has(c.id)) return []
      unique.add(c.id)
      sum += points
      criteria.push({ id: c.id, label: c.label, marks: points })
    }
    if (sum > maxScore) return []

    const selected = Array.isArray(item.selected_ids)
      ? item.selected_ids.filter((id): id is string => typeof id === 'string' && unique.has(id)) : []
    const score = typeof item.self_review_score === 'number'
      && Number.isFinite(item.self_review_score)
      && item.self_review_score >= 0 && item.self_review_score <= maxScore
      ? item.self_review_score : null
    return [{
      assessmentItemId: item.assessment_item_id,
      prompt: typeof item.prompt === 'string' ? item.prompt : '',
      responseText: typeof item.response_text === 'string' ? item.response_text : null,
      criteria,
      maxScore,
      selfReviewScore: score,
      selectedIds: selected,
      unsure: item.unsure === true,
      reviewedAt: typeof item.reviewed_at === 'string' ? item.reviewed_at : null,
    }]
  })
}

