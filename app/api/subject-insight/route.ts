import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export async function POST(req: NextRequest) {
  try {
    const authHeader = req.headers.get('cookie') ?? ''
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      { global: { headers: { cookie: authHeader } } }
    )
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { subjectName, lCount, aCount, atCount, rCount } = await req.json()
    if (!subjectName) return NextResponse.json({ error: 'Missing subjectName' }, { status: 400 })

    const apiKey = process.env.ANTHROPIC_API_KEY
    if (!apiKey) return NextResponse.json({ fact: null, suggestion: null })

    const [factRes, suggRes] = await Promise.all([
      fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-api-key': apiKey, 'anthropic-version': '2023-06-01' },
        body: JSON.stringify({ model: 'claude-sonnet-4-6', max_tokens: 200, messages: [{ role: 'user', content: `Give me one powerful, surprising, globally relevant fact about ${subjectName} that would make a teacher feel proud and inspired to teach it. Maximum 2 sentences. No preamble. Just the fact.` }] })
      }),
      fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-api-key': apiKey, 'anthropic-version': '2023-06-01' },
        body: JSON.stringify({ model: 'claude-sonnet-4-6', max_tokens: 200, messages: [{ role: 'user', content: `You are a professional teaching coach. A teacher teaches ${subjectName}. They have created ${lCount} lesson plans, assessed ${aCount} students, marked attendance ${atCount} times, and published ${rCount} resources this term. Give them ONE specific, actionable, encouraging suggestion to grow professionally. Maximum 2 sentences. No preamble.` }] })
      })
    ])

    const factData = await factRes.json()
    const suggData = await suggRes.json()
    return NextResponse.json({ fact: factData.content?.[0]?.text ?? null, suggestion: suggData.content?.[0]?.text ?? null })
  } catch (err) {
    console.error('subject-insight error:', err)
    return NextResponse.json({ fact: null, suggestion: null })
  }
}
