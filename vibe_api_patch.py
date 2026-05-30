# Route 1 — vibe-search
search_route = """import { NextRequest, NextResponse } from 'next/server'

export async function GET(req: NextRequest) {
  const query = req.nextUrl.searchParams.get('q')
  if (!query?.trim()) {
    return NextResponse.json({ results: [] })
  }
  try {
    const url = `https://api.duckduckgo.com/?q=${encodeURIComponent(query)}&format=json&no_html=1&skip_disambig=1`
    const res  = await fetch(url, { next: { revalidate: 60 } })
    const data = await res.json()

    const results: { title: string; snippet: string; url: string }[] = []

    // Abstract (top result)
    if (data.Abstract && data.AbstractURL) {
      results.push({
        title:   data.Heading || query,
        snippet: data.Abstract,
        url:     data.AbstractURL,
      })
    }

    // Related topics
    if (data.RelatedTopics) {
      for (const t of data.RelatedTopics) {
        if (t.Text && t.FirstURL && results.length < 6) {
          results.push({
            title:   t.Text.split(' - ')[0] ?? t.Text,
            snippet: t.Text,
            url:     t.FirstURL,
          })
        }
        // Nested topics
        if (t.Topics) {
          for (const sub of t.Topics) {
            if (sub.Text && sub.FirstURL && results.length < 6) {
              results.push({
                title:   sub.Text.split(' - ')[0] ?? sub.Text,
                snippet: sub.Text,
                url:     sub.FirstURL,
              })
            }
          }
        }
      }
    }

    return NextResponse.json({ results })
  } catch (e) {
    return NextResponse.json({ results: [], error: 'Search failed' }, { status: 500 })
  }
}
"""

# Route 2 — vibe-fetch
fetch_route = """import { NextRequest, NextResponse } from 'next/server'

export async function POST(req: NextRequest) {
  try {
    const { url } = await req.json()
    if (!url) return NextResponse.json({ error: 'No URL provided' }, { status: 400 })

    const res = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; VibeLearn/1.0)',
      },
      next: { revalidate: 300 },
    })

    if (!res.ok) throw new Error(`Fetch failed: ${res.status}`)

    const html = await res.text()

    // Simple text extraction — no external lib needed
    // Strip scripts, styles, nav, footer
    const clean = html
      .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
      .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
      .replace(/<nav[^>]*>[\s\S]*?<\/nav>/gi, '')
      .replace(/<footer[^>]*>[\s\S]*?<\/footer>/gi, '')
      .replace(/<header[^>]*>[\s\S]*?<\/header>/gi, '')
      .replace(/<[^>]+>/g, ' ')
      .replace(/&nbsp;/g, ' ')
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&quot;/g, '"')
      .replace(/\\s+/g, ' ')
      .trim()

    // Extract title
    const titleMatch = html.match(/<title[^>]*>([^<]+)<\\/title>/i)
    const title = titleMatch ? titleMatch[1].trim() : url

    // Take first 3000 chars of clean text — enough for TTS summary
    const text = clean.slice(0, 3000)

    return NextResponse.json({ title, text, url })
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'Fetch failed' },
      { status: 500 }
    )
  }
}
"""

with open('app/api/vibe-search/route.ts', 'w') as f:
    f.write(search_route)
print("vibe-search: done")

with open('app/api/vibe-fetch/route.ts', 'w') as f:
    f.write(fetch_route)
print("vibe-fetch: done")
