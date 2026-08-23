import { randomUUID } from 'node:crypto'
import { NextRequest, NextResponse } from 'next/server'

import { invokeCyborgBoundary } from '@/lib/cyborg/http-client'

export async function POST(req: NextRequest) {
  try {
    const { reportType, data } = await req.json()

    if (!reportType || !data) {
      return NextResponse.json({ error: 'Missing reportType or data' }, { status: 400 })
    }

    const summary = JSON.stringify(data).slice(0, 3000)
    const requestedMissionId = req.headers.get('x-cyborg-mission-id')?.trim() || undefined
    const response = await invokeCyborgBoundary({
      actorKey: 'service:app.report-insight',
      externalChatId: requestedMissionId || `report-insight:${randomUUID()}`,
      objective: `Generate one governed ${String(reportType).slice(0, 120)} report insight`,
      missionId: requestedMissionId,
      callerServiceId: 'app.report-insight',
      provider: 'anthropic',
      model: 'claude-sonnet-4-20250514',
      maxTokens: 150,
      messages: [
        {
          role: 'user',
          content: `You are an AI analyst for a Kenyan school management system (CBC curriculum).
Analyze this ${reportType} report data and return ONE concise insight sentence (max 25 words).
Focus on the most actionable or concerning pattern. No preamble. Just the insight.
Data: ${summary}`,
        },
      ],
      metadata: { feature: 'report-insight' },
      dataClassification: 'confidential',
    })

    const payload = response.output as { content?: Array<{ type?: string; text?: string }> }
    const insight = payload.content?.find((item) => item.type === 'text')?.text?.trim()
    if (!insight) throw new Error('CYBORG_PROVIDER_EMPTY_OUTPUT')

    return NextResponse.json({ insight, missionId: response.missionId, lineage: response.lineage })
  } catch (err) {
    console.error('AI insight error:', err)
    return NextResponse.json({ insight: 'Unable to generate insight at this time.' }, { status: 200 })
  }
}
