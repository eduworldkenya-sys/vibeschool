/**
 * Mini Lesson discovery V1. Explicit educational relevance and fair exposure
 * are rewarded; raw watch time, minors' activity and inferred sensitive traits
 * are never used. Pure and deterministic for reproducible tests.
 */
export type RankedMini = {
  id: string
  creator_id: string
  subject: string
  quality_score: number
  like_count: number
  save_count: number
  learned_count: number
  published_at: string | null
}

export type RankingContext = {
  interests?: ReadonlySet<string>
  following?: ReadonlySet<string>
  dismissed?: ReadonlySet<string>
  dateKey?: string
}

const clamp = (value: number, low = 0, high = 1) =>
  Number.isFinite(value) ? Math.min(high, Math.max(low, value)) : low

function deterministicRotation(id: string, dateKey: string) {
  let hash = 2166136261
  for (const character of id + ':' + dateKey) {
    hash ^= character.charCodeAt(0)
    hash = Math.imul(hash, 16777619)
  }
  return (hash >>> 0) / 4294967295
}

export function miniRecommendationScore(
  post: RankedMini,
  context: RankingContext = {},
  now = new Date(),
): number {
  // Relevance 35, reviewer quality 25, useful response 20,
  // new-creator fairness 15, freshness 5.
  const knownInterests = context.interests?.size ?? 0
  const subjectMatch = context.interests?.has(post.subject) ?? false
  const relevance = knownInterests === 0 ? 20 : subjectMatch ? 35 : 9
  const quality = 25 * clamp(post.quality_score / 100)
  const usefulness = 20 * clamp(
    (Math.sqrt(Math.max(0, post.save_count)) * 2 +
     Math.sqrt(Math.max(0, post.learned_count)) * 2.5 +
     Math.sqrt(Math.max(0, post.like_count))) / 15
  )
  const totalFeedback = Math.max(0, post.like_count) + Math.max(0, post.save_count)
  const fairness = 15 / (1 + totalFeedback / 6)
  const ageDays = post.published_at
    ? Math.max(0, (now.getTime() - new Date(post.published_at).getTime()) / 86400000)
    : 1000
  const freshness = 5 * Math.exp(-ageDays / 21)
  const followingBonus = context.following?.has(post.creator_id) ? 3 : 0
  const dismissedPenalty = context.dismissed?.has(post.id) ? 1000 : 0
  // Tie-breaks rotate daily without user profiling.
  const rotation = deterministicRotation(post.id, context.dateKey ?? now.toISOString().slice(0, 10))
  return relevance + quality + usefulness + fairness + freshness +
    followingBonus + rotation * 0.75 - dismissedPenalty
}

export function rankMiniLessons<T extends RankedMini>(
  posts: readonly T[],
  context: RankingContext = {},
  now = new Date(),
): T[] {
  const sorted = [...posts].sort((a, b) =>
    miniRecommendationScore(b, context, now) - miniRecommendationScore(a, context, now)
  )
  const diversified: T[] = []
  const deferred: T[] = []
  const creatorCounts = new Map<string, number>()
  for (const item of sorted) {
    const count = creatorCounts.get(item.creator_id) ?? 0
    if (count < 2) {
      diversified.push(item)
      creatorCounts.set(item.creator_id, count + 1)
    } else deferred.push(item)
  }
  return [...diversified, ...deferred]
}
