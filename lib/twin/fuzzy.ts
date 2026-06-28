// lib/twin/fuzzy.ts
// Plain-JS fuzzy matcher — no dependencies, runs fully offline.
// Tier 3/4 of the resolution ladder: only reached after exact regex
// (tier 1) and exact keyword match (tier 2) have both failed.

import { TwinRegistryEntry } from "@/lib/types";

function levenshtein(a: string, b: string): number {
  const m = a.length, n = b.length;
  if (m === 0) return n;
  if (n === 0) return m;
  const dp: number[] = Array.from({ length: n + 1 }, (_, j) => j);
  for (let i = 1; i <= m; i++) {
    let prev = dp[0];
    dp[0] = i;
    for (let j = 1; j <= n; j++) {
      const tmp = dp[j];
      dp[j] = a[i - 1] === b[j - 1] ? prev : 1 + Math.min(prev, dp[j], dp[j - 1]);
      prev = tmp;
    }
  }
  return dp[n];
}

function similarity(a: string, b: string): number {
  if (!a || !b) return 0;
  const dist = levenshtein(a, b);
  const longest = Math.max(a.length, b.length);
  let score = 1 - dist / longest;
  if (a.includes(b) || b.includes(a)) score = Math.max(score, 0.85);
  return score;
}

function bestKeywordScore(query: string, keywords: string[]): number {
  let best = 0;
  for (const kw of keywords) {
    const s = similarity(query, kw.toLowerCase());
    if (s > best) best = s;
  }
  return best;
}

export interface FuzzyCandidate {
  entry: TwinRegistryEntry
  score: number
}

export type FuzzyResult =
  | { kind: "confident"; entry: TwinRegistryEntry }
  | { kind: "ambiguous"; candidates: FuzzyCandidate[] }
  | { kind: "none" };

const CONFIDENT_THRESHOLD = 0.75;
const AMBIGUOUS_THRESHOLD = 0.5;
const CONFIDENCE_GAP      = 0.12;

export function fuzzyMatch(query: string, registry: TwinRegistryEntry[]): FuzzyResult {
  const q = query.toLowerCase().trim();
  if (!q) return { kind: "none" };

  const scored: FuzzyCandidate[] = registry
    .map(entry => ({ entry, score: bestKeywordScore(q, entry.keywords) }))
    .sort((a, b) => b.score - a.score);

  const top    = scored[0];
  const second = scored[1];
  if (!top || top.score < AMBIGUOUS_THRESHOLD) return { kind: "none" };

  const gap = top.score - (second?.score ?? 0);
  if (top.score >= CONFIDENT_THRESHOLD && gap >= CONFIDENCE_GAP) {
    return { kind: "confident", entry: top.entry };
  }

  const candidates = scored
    .filter(c => c.score >= AMBIGUOUS_THRESHOLD)
    .filter((c, i, arr) => arr.findIndex(x => x.entry.id === c.entry.id) === i)
    .slice(0, 3);

  return candidates.length > 0 ? { kind: "ambiguous", candidates } : { kind: "none" };
}
