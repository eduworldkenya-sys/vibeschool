// components/student/VibeTwin/lib/search.ts
import type { SearchResponse } from '../types'

const SEARCH_TIMEOUT_MS = 8000

export async function vibeSearch(query: string): Promise<SearchResponse> {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), SEARCH_TIMEOUT_MS)

  try {
    const res = await fetch(
      `/api/vibe-search?q=${encodeURIComponent(query)}`,
      { signal: controller.signal }
    )

    if (!res.ok) {
      throw new Error(`Search API returned ${res.status}`)
    }

    const data: SearchResponse = await res.json()
    return data

  } catch (err) {
    if (err instanceof Error && err.name === 'AbortError') {
      throw new Error('Search timed out. Check your connection.')
    }
    throw err
  } finally {
    clearTimeout(timer)
  }
}
