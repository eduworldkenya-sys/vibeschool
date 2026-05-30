import { NextRequest, NextResponse } from 'next/server'

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
