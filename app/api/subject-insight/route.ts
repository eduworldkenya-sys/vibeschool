import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { invokeCyborgBoundary } from '@/lib/cyborg/http-client'

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

    const { subjectName, lCount, aCount, atCount, rCount, strands, weakStrand, avgPerfPct, coveragePct, masteredPct } = await req.json()
    if (!subjectName) return NextResponse.json({ error: 'Missing subjectName' }, { status: 400 })

    const strandContext = strands?.length > 0 ? `Curriculum strands: ${strands.join(', ')}.` : ''
    const weakContext = weakStrand ? `Weakest strand: ${weakStrand.name} at ${weakStrand.pct}%.` : ''
    const perfContext = avgPerfPct != null ? `Assessment average: ${avgPerfPct}%.` : ''
    const masteryGap = coveragePct != null && masteredPct != null && coveragePct - masteredPct > 30
      ? `ALERT: Coverage is ${coveragePct}% but mastery is only ${masteredPct}% — learners are being taught content they are not understanding.`
      : ''

    const prompt = `You are a professional CBC teaching coach in Kenya. A teacher teaches ${subjectName}.
Stats this term: ${lCount} lesson plans, ${aCount} assessments, ${atCount} attendance records, ${rCount} resources.
${strandContext} ${weakContext} ${perfContext} ${masteryGap}

Respond ONLY with valid JSON in this exact format, no preamble, no markdown:
{"fact":"one surprising fact about ${subjectName} that makes a teacher proud to teach it. Max 2 sentences.","suggestion":"one specific actionable intervention for this teacher based on the data above. If there is a mastery gap or weak strand, address it directly. Max 2 sentences.","interventionType":"reteach|enrich|assess"}`

    const requestedMissionId = req.headers.get('x-cyborg-mission-id')?.trim() || undefined
    const result = await invokeCyborgBoundary({
      actorKey: `user:${user.id}`,
      externalChatId: requestedMissionId || `subject-insight:${user.id}:${crypto.randomUUID()}`,
      objective: `Generate governed ${String(subjectName).slice(0, 120)} teaching insight`,
      missionId: requestedMissionId,
      callerServiceId: 'app.subject-insight',
      provider: 'groq',
      model: 'llama-3.3-70b-versatile',
      maxTokens: 400,
      messages: [{ role: 'user', content: prompt }],
      metadata: { feature: 'subject-insight' },
      dataClassification: 'confidential',
    })
    const data = result.output as { choices?: Array<{ message?: { content?: string } }> }
    const text = data.choices?.[0]?.message?.content ?? ''

    try {
      const parsed = JSON.parse(text.replace(/```json|```/g, '').trim())
      return NextResponse.json({ fact: parsed.fact ?? null, suggestion: parsed.suggestion ?? null, interventionType: parsed.interventionType ?? null, missionId: result.missionId, lineage: result.lineage })
    } catch {
      return NextResponse.json({ fact: null, suggestion: text || null, interventionType: null, missionId: result.missionId, lineage: result.lineage })
    }
  } catch (err) {
    console.error('subject-insight error:', err)
    return NextResponse.json({ fact: null, suggestion: null, interventionType: null })
  }
}
