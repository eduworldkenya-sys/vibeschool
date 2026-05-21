import { NextRequest, NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY!,
})

export async function POST(req: NextRequest) {
  try {
    const { reportType, data } = await req.json()

    if (!reportType || !data) {
      return NextResponse.json({ error: 'Missing reportType or data' }, { status: 400 })
    }

    const summary = JSON.stringify(data).slice(0, 3000)

    const message = await anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 150,
      messages: [
        {
          role: 'user',
          content: `You are an AI analyst for a Kenyan school management system (CBC curriculum).
Analyze this ${reportType} report data and return ONE concise insight sentence (max 25 words).
Focus on the most actionable or concerning pattern. No preamble. Just the insight.
Data: ${summary}`,
        },
      ],
    })

    const insight = (message.content[0] as { type: string; text: string }).text.trim()
    return NextResponse.json({ insight })
  } catch (err) {
    console.error('AI insight error:', err)
    return NextResponse.json({ insight: 'Unable to generate insight at this time.' }, { status: 200 })
  }
}