import { NextRequest, NextResponse } from 'next/server'

const ALLOWED_ORIGINS = [
  process.env.NEXT_PUBLIC_SITE_URL,
  'http://localhost:3000',
].filter(Boolean) as string[]

export async function POST(req: NextRequest) {
  let body: unknown
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const { prompt } = body as Record<string, unknown>

  if (!prompt || typeof prompt !== 'string') {
    return NextResponse.json({ error: 'Missing prompt' }, { status: 400 })
  }

  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey) {
    return NextResponse.json({ error: 'AI not configured' }, { status: 500 })
  }

  try {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type':         'application/json',
        'x-api-key':            apiKey,
        'anthropic-version':    '2023-06-01',
      },
      body: JSON.stringify({
        model:      'claude-sonnet-4-20250514',
        max_tokens: 8000,
        messages:   [{ role: 'user', content: prompt }],
      }),
    })

    const data = await response.json()

    if (!response.ok) {
      return NextResponse.json(
        { error: data?.error?.message ?? 'Anthropic error' },
        { status: response.status }
      )
    }

    const text = (data.content ?? [])
      .map((b: { type: string; text?: string }) => b.type === 'text' ? b.text : '')
      .join('')

    return NextResponse.json({ text })

  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'Request failed' },
      { status: 500 }
    )
  }
}
