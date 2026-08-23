import { NextResponse } from "next/server"
import { VVScriptResponse, VVTranslateResponse, VVQuestionResponse } from "@/lib/types"
import { invokeCyborgBoundary } from "@/lib/cyborg/http-client"

export async function POST(req: Request) {
  try {
    const { action, payload } = await req.json()

    let systemPrompt = ""
    let userContent = ""

    if (action === "generate_script") {
      const dialect = payload?.dialect || "Sheng Nairobi"
      systemPrompt = "You are a voice content creator for VibeVoice, an educational audio platform for East African learners. Generate narration scripts that are culturally authentic, CBC curriculum aligned, natural oral tone not written tone. Write in the exact dialect specified. Output ONLY the script — 3 paragraphs, 2-3 sentences each. No labels. No markdown. No paragraph numbers."
      userContent = `Please write a script in this dialect: ${dialect}`
    } else if (action === "translate") {
      const targetLang = payload?.targetLang || "English"
      systemPrompt = `Translate the given text to ${targetLang}. Preserve natural oral tone. Output ONLY the translation. No explanations.`
      userContent = payload?.text || ""
    } else if (action === "generate_question") {
      systemPrompt = "Generate exactly 1 comprehension question from this narration. Return ONLY valid JSON, no markdown, no explanation: {\"question\":\"...\",\"options\":[\"a\",\"b\",\"c\",\"d\"],\"correct\":0}"
      userContent = payload?.script || ""
    } else {
      return NextResponse.json({ error: "Invalid action specified." }, { status: 400 })
    }

    const requestedMissionId = req.headers.get('x-cyborg-mission-id')?.trim() || undefined
    const result = await invokeCyborgBoundary({
      actorKey: 'service:app.vibevoice',
      externalChatId: requestedMissionId || `vibevoice:${crypto.randomUUID()}`,
      objective: `Execute governed VibeVoice action: ${action}`,
      missionId: requestedMissionId,
      callerServiceId: 'app.vibevoice',
      provider: 'groq',
      model: 'llama-3.3-70b-versatile',
      maxTokens: 600,
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userContent },
      ],
      metadata: { feature: 'vibevoice', action },
      dataClassification: 'internal',
    })
    const data = result.output as { choices?: Array<{ message?: { content?: string } }> }
    const content = data?.choices?.[0]?.message?.content || ""

    if (action === "generate_script") {
      const paragraphs = content.split(/\n+/).map((p: string) => p.trim()).filter((p: string) => p.length > 0)
      const responseBody: VVScriptResponse = { script: content, paragraphs: paragraphs.length > 0 ? paragraphs : [content] }
      return NextResponse.json({ ...responseBody, missionId: result.missionId, lineage: result.lineage })
    }

    if (action === "translate") {
      const responseBody: VVTranslateResponse = { translation: content.trim() }
      return NextResponse.json({ ...responseBody, missionId: result.missionId, lineage: result.lineage })
    }

    if (action === "generate_question") {
      let cleaned = content.trim()
      if (cleaned.startsWith("```json")) cleaned = cleaned.substring(7)
      if (cleaned.endsWith("```")) cleaned = cleaned.substring(0, cleaned.length - 3)
      cleaned = cleaned.trim()
      try {
        const parsed = JSON.parse(cleaned)
        const responseBody: VVQuestionResponse = {
          question: parsed.question || "What is the key takeaway of this voice lesson?",
          options: Array.isArray(parsed.options) ? parsed.options : ["A", "B", "C", "D"],
          correct: typeof parsed.correct === "number" ? parsed.correct : 0
        }
        return NextResponse.json({ ...responseBody, missionId: result.missionId, lineage: result.lineage })
      } catch {
        const fallback: VVQuestionResponse = {
          question: "Which option best reflects the core lesson of this educational recording?",
          options: ["Active listening and community engagement", "Individual study only", "Ignoring local dialects", "Avoiding peer review"],
          correct: 0
        }
        return NextResponse.json({ ...fallback, missionId: result.missionId, lineage: result.lineage })
      }
    }

    return NextResponse.json({ error: "No action match" }, { status: 400 })
  } catch (error: any) {
    return NextResponse.json({ error: error?.message || "Internal server error" }, { status: 500 })
  }
}
