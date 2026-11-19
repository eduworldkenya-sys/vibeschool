import type { Mode } from './data'

export type DiscoveryProfile = { subjects: readonly string[]; levels: readonly string[]; days: readonly string[]; area: string; mode: Mode; amount: number }
const normal = (v: string) => v.trim().toLocaleLowerCase()
const overlap = (a: readonly string[], b: readonly string[]) => {
  const requested = [...new Set(a.map(normal).filter(Boolean))]
  const offered = new Set(b.map(normal))
  return requested.length ? requested.filter(s => offered.has(s)).length / requested.length : 0
}
const online = (mode: Mode) => mode !== 'physical'
const physical = (mode: Mode) => mode !== 'online'

/** Only declared facts affect ranking; absent facts earn no points. Score is not a probability. */
export function compatibility(need: DiscoveryProfile, tutor: DiscoveryProfile): number {
  const subject = overlap(need.subjects, tutor.subjects)
  const level = overlap(need.levels, tutor.levels)
  const day = overlap(need.days, tutor.days)
  const sameArea = !!need.area && !!tutor.area && normal(need.area) === normal(tutor.area) && !normal(need.area).includes('online')
  const modeFit = (online(need.mode) && online(tutor.mode)) || (physical(need.mode) && physical(tutor.mode) && sameArea)
  // An online tutor is not penalized for working outside the learner's county.
  const budgetFit = need.amount > 0 && tutor.amount > 0 && tutor.amount <= need.amount
  return 25 * subject + 15 * level + 20 * day + 15 * Number(modeFit) + 15 * Number(budgetFit)
}

/** Higher relevance first; rotate equally relevant rows rather than reward popularity. */
export function rankDiscovery<T extends { id: string }>(rows: readonly T[], seed: number, score: (row: T) => number): T[] {
  const sorted = [...rows].sort((a, b) => a.id.localeCompare(b.id))
  if (!sorted.length) return sorted
  const start = ((seed % sorted.length) + sorted.length) % sorted.length
  return [...sorted.slice(start), ...sorted.slice(0, start)]
    .map(row => ({ row, score: score(row) }))
    .sort((a, b) => b.score - a.score)
    .map(item => item.row)
}
export function matchesDiscoveryText(values: readonly string[], query: string) {
  const words = normal(query).split(/\s+/).filter(Boolean)
  const haystack = values.map(normal)
  return words.every(word => haystack.some(value => value.includes(word)))
}
