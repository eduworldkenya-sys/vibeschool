import { NextRequest, NextResponse } from 'next/server'

export async function POST(req: NextRequest) {
  try {
    const { prompt } = await req.json()
    if (!prompt) return NextResponse.json({ error: 'Missing prompt' }, { status: 400 })

    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type':      'application/json',
        'x-api-key':         process.env.ANTHROPIC_API_KEY ?? '',
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model:      'claude-sonnet-4-6',
        max_tokens: 2000,
        messages:   [{ role: 'user', content: prompt }],
      }),
    })

    const data = await res.json()
    if (!res.ok) return NextResponse.json({ error: data.error?.message ?? 'API error' }, { status: 500 })

    const text = data.content?.map((b: { type: string; text?: string }) => b.text ?? '').join('') ?? ''
    const clean = text.replace(/```json|```/g, '').trim()
    const plan = JSON.parse(clean)

    return NextResponse.json({ plan })
  } catch (e: unknown) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Unknown error' }, { status: 500 })
  }
}
