// lib/cache.ts
// In-memory TTL cache for VibeLearn API routes
// Prevents hammering Open Trivia DB, Wikipedia, Gutenberg
// Works across requests in same serverless instance

interface CacheEntry<T> {
  data: T
  expiresAt: number
}

const store = new Map<string, CacheEntry<unknown>>()

export function cacheGet<T>(key: string): T | null {
  const entry = store.get(key)
  if (!entry) return null
  if (Date.now() > entry.expiresAt) {
    store.delete(key)
    return null
  }
  return entry.data as T
}

export function cacheSet<T>(key: string, data: T, ttlSeconds: number): void {
  store.set(key, {
    data,
    expiresAt: Date.now() + ttlSeconds * 1000,
  })
}

export function cacheDelete(key: string): void {
  store.delete(key)
}

// TTL constants — use these everywhere
export const TTL = {
  TRIVIA:    60 * 60,       // 1 hour
  WIKIPEDIA: 60 * 60,       // 1 hour
  GUTENBERG: 60 * 60 * 24,  // 24 hours
  FEED:      60 * 5,        // 5 minutes
  POINTS:    60 * 2,        // 2 minutes
  STREAK:    60 * 2,        // 2 minutes
} as const
