// app/api/vibe-search/route.ts
import { NextRequest, NextResponse } from 'next/server'

const SERPER_KEY = '89c2d1151d3203ce2683c3583913121f8fcc693e'

interface SearchResult {
  title:   string
  snippet: string
  url:     string
}

// ── 1. Wikipedia API — unlimited, no key ─────────────────────────────────────
async function searchWikipedia(query: string): Promise<SearchResult[]> {
  try {
    const url = `https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(query)}`
    const res  = await fetch(url, { next: { revalidate: 3600 } })
    if (!res.ok) return []
    const data = await res.json()
    if (data.type === 'disambiguation' || !data.extract) return []
    return [{
      title:   data.title,
      snippet: data.extract.slice(0, 300),
      url:     data.content_urls?.desktop?.page ?? '',
    }]
  } catch {
    return []
  }
}

// ── 2. DuckDuckGo Instant Answer — unlimited, no key ─────────────────────────
async function searchDuckDuckGo(query: string): Promise<SearchResult[]> {
  try {
    const url  = `https://api.duckduckgo.com/?q=${encodeURIComponent(query)}&format=json&no_html=1&skip_disambig=1`
    const res  = await fetch(url, { next: { revalidate: 60 } })
    if (!res.ok) return []
    const data = await res.json()
    const results: SearchResult[] = []

    if (data.Abstract) {
      results.push({
        title:   data.Heading || query,
        snippet: data.Abstract.slice(0, 300),
        url:     data.AbstractURL ?? '',
      })
    }

    if (data.RelatedTopics) {
      for (const t of data.RelatedTopics) {
        if (t.Text && t.FirstURL && results.length < 3) {
          results.push({
            title:   t.Text.split(' - ')[0] ?? t.Text,
            snippet: t.Text.slice(0, 200),
            url:     t.FirstURL,
          })
        }
      }
    }

    return results
  } catch {
    return []
  }
}

// ── 3. Serper — 2,500 free Google results ────────────────────────────────────
async function searchSerper(query: string): Promise<SearchResult[]> {
  try {
    const res = await fetch('https://google.serper.dev/search', {
      method:  'POST',
      headers: {
        'X-API-KEY':    SERPER_KEY,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ q: query, num: 5, gl: 'ke', hl: 'en' }),
    })
    if (!res.ok) return []
    const data = await res.json()

    return (data.organic ?? []).slice(0, 5).map((r: {
      title:   string
      snippet: string
      link:    string
    }) => ({
      title:   r.title   ?? '',
      snippet: r.snippet ?? '',
      url:     r.link    ?? '',
    }))
  } catch {
    return []
  }
}

// ── Chain: Wikipedia → DuckDuckGo → Serper ───────────────────────────────────
export async function GET(req: NextRequest) {
  const query = req.nextUrl.searchParams.get('q')
  if (!query?.trim()) {
    return NextResponse.json({ results: [] })
  }

  // Try Wikipedia first — best for factual/educational queries
  const wiki = await searchWikipedia(query)
  if (wiki.length > 0) {
    // Augment with Serper for additional context
    const serper = await searchSerper(query)
    return NextResponse.json({ results: [...wiki, ...serper].slice(0, 6) })
  }

  // Try DuckDuckGo second
  const ddg = await searchDuckDuckGo(query)
  if (ddg.length > 0) {
    const serper = await searchSerper(query)
    return NextResponse.json({ results: [...ddg, ...serper].slice(0, 6) })
  }

  // Fall through to Serper alone
  const serper = await searchSerper(query)
  if (serper.length > 0) {
    return NextResponse.json({ results: serper })
  }

  return NextResponse.json({ results: [] })
}
