import { randomUUID } from 'node:crypto'
import { NextRequest, NextResponse } from 'next/server'

import { createAnthropicMessagesAdapter, invokeCyborgModel } from '@/lib/cyborg/gateway'

export async function POST(req: NextRequest) {
  try {
    const { reportType, data } = await req.json()

    if (!reportType || !data) {
      return NextResponse.json({ error: 'Missing reportType or data' }, { status: 400 })
    }

    const summary = JSON.stringify(data).slice(0, 3000)
    const apiKey = process.env.ANTHROPIC_API_KEY ?? ''
    const adapter = createAnthropicMessagesAdapter(apiKey)
    const missionId = req.headers.get('x-cyborg-mission-id')?.trim() || `report-insight:${randomUUID()}`

    const response = await invokeCyborgModel(adapter, {
      provider: 'anthropic',
      model: 'claude-sonnet-4-20250514',
      missionId,
      metadata: { maxTokens: 150, feature: 'report-insight' },
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

    const payload = response.output as { content?: Array<{ type?: string; text?: string }> }
    const insight = payload.content?.find((item) => item.type === 'text')?.text?.trim()
    if (!insight) throw new Error('CYBORG_PROVIDER_EMPTY_OUTPUT')

    return NextResponse.json({ insight, missionId })
  } catch (err) {
    console.error('AI insight error:', err)
    return NextResponse.json({ insight: 'Unable to generate insight at this time.' }, { status: 200 })
  }
}
