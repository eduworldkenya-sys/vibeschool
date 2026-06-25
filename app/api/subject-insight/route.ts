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

    const { subjectName, lCount, aCount, atCount, rCount, strands, weakStrand, avgPerfPct } = await req.json()
    if (!subjectName) return NextResponse.json({ error: 'Missing subjectName' }, { status: 400 })

    const apiKey = process.env.ANTHROPIC_API_KEY
    if (!apiKey) return NextResponse.json({ fact: null, suggestion: null })

    const strandContext = strands && strands.length > 0
      ? `The subject has these curriculum strands: ${strands.join(', ')}.`
      : ''
    const weakContext = weakStrand
      ? `The weakest strand is ${weakStrand.name} at ${weakStrand.pct}% performance.`
      : ''
    const perfContext = avgPerfPct !== null && avgPerfPct !== undefined
      ? `Overall learner performance average is ${avgPerfPct}%.`
      : ''

    const coachingContext = `A teacher teaches ${subjectName} in a Kenyan CBC school. They have created ${lCount} lesson plans, assessed ${aCount} students, marked attendance ${atCount} times, and published ${rCount} resources this term. ${strandContext} ${weakContext} ${perfContext}`

    const [factRes, suggRes] = await Promise.all([
      fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-api-key': apiKey, 'anthropic-version': '2023-06-01' },
        body: JSON.stringify({
          model: 'claude-sonnet-4-6',
          max_tokens: 200,
          messages: [{ role: 'user', content: `Give me one powerful, surprising, globally relevant fact about ${subjectName} that would make a Kenyan CBC teacher feel proud and inspired to teach it. Maximum 2 sentences. No preamble. Just the fact.` }],
        }),
      }),
      fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-api-key': apiKey, 'anthropic-version': '2023-06-01' },
        body: JSON.stringify({
          model: 'claude-sonnet-4-6',
          max_tokens: 200,
          messages: [{ role: 'user', content: `You are a professional CBC teaching coach in Kenya. ${coachingContext} Give ONE specific, actionable, encouraging intervention suggestion based on the curriculum data above. If there is a weak strand, address it directly. Maximum 2 sentences. No preamble.` }],
        }),
      }),
    ])

    const factData = await factRes.json()
    const suggData = await suggRes.json()

    return NextResponse.json({
      fact:       factData.content?.[0]?.text ?? null,
      suggestion: suggData.content?.[0]?.text ?? null,
    })
  } catch (err) {
    console.error('subject-insight error:', err)
    return NextResponse.json({ fact: null, suggestion: null })
  }
}
