import { NextRequest, NextResponse } from 'next/server'

export async function POST(req: NextRequest) {
  const apiKey = process.env.GROQ_API_KEY
  if (!apiKey) {
    return NextResponse.json({ error: 'AI not configured' }, { status: 500 })
  }

  try {
    const { subject, form, topic, difficulty, count } = await req.json()

    if (!subject || !form || !topic || !difficulty || !count) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
    }

    // FIX 3 — clamp count, never trust client input on a public endpoint
    const safeCount = Math.min(Math.max(parseInt(count, 10) || 10, 5), 30)

    const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: 'llama-3.3-70b-versatile',
        messages: [
          {
            role: 'system',
            content: 'You are an expert KCSE examiner. You output ONLY raw valid JSON arrays with no markdown, no backticks, no preamble.',
          },
          {
            role: 'user',
            content: `Generate exactly ${safeCount} KCSE ${subject} multiple choice questions for ${form}, topic: "${topic}", difficulty: "${difficulty}". Return a JSON array where each item matches: { "id": "q1", "question": "...", "options": ["A","B","C","D"], "correctIndex": 0, "explanation": "...", "teachingNote": "...", "topic": "${topic}" }. correctIndex is 0-3. Return ONLY the raw JSON array.`,
          },
        ],
        max_tokens: 3000,
        temperature: 0.3,
      }),
    })

    if (!res.ok) {
      const err = await res.json()
      return NextResponse.json({ error: err.error?.message ?? 'Groq error' }, { status: 500 })
    }

    const data = await res.json()
    const text = (data.choices?.[0]?.message?.content ?? '').trim()

    try {
      const cleaned = text
        .replace(/^```json/i, '')
        .replace(/^```/, '')
        .replace(/```$/, '')
        .trim()
      const questions = JSON.parse(cleaned)
      if (!Array.isArray(questions)) {
        return NextResponse.json({ error: 'Invalid AI response' }, { status: 500 })
      }
      return NextResponse.json({ questions })
    } catch {
      return NextResponse.json({ error: 'Invalid AI response' }, { status: 500 })
    }
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : 'Unknown error'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
