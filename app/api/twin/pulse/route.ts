import { createAnthropicMessagesAdapter, invokeCyborgModel } from '@/lib/cyborg/gateway';

export const runtime = "edge";

export async function POST(req: Request) {
  try {
    const { snapshot, signals } = await req.json();

    const termPct = Math.round(snapshot.termProgressPct ?? 50);
    const behind = (snapshot.currStats ?? [])
      .filter((s: any) => s.total > 0 && (s.covered / s.total) < 0.4)
      .map((s: any) => `${s.subject} (${Math.round((s.covered/s.total)*100)}%)`).join(", ");

    const prompt = `You are a sharp, human teacher assistant in a Kenyan school app called VibeSchool.
Context:
- Attendance pending: ${snapshot.attPending?.map((c: any) => c.class_name).join(", ") || "none"}
- At-risk students: ${snapshot.atRisk?.map((s: any) => `${s.name} (${s.reason})`).join(", ") || "none"}
- Curriculum behind: ${behind || "none"}
- Term is ${termPct}% complete
- TPAD days left: ${snapshot.tpadDays ?? "not set"}
- Credits: ${snapshot.credits ?? "unknown"}
- Attendance streak: ${snapshot.streak ?? 0} days
- Signals: ${signals.join(", ")}

Rules:
- ONE sentence only. Maximum 20 words.
- Be specific — use actual student names, subject names, numbers from the data.
- Sound like a thoughtful colleague, not a system alert.
- No greeting. No punctuation flourishes. No emojis.
- If streak >= 5, acknowledge it warmly in the message.`;

    const adapter = createAnthropicMessagesAdapter(process.env.ANTHROPIC_API_KEY ?? '');
    const missionId = req.headers.get('x-cyborg-mission-id')?.trim() || `twin-pulse:${crypto.randomUUID()}`;
    const response = await invokeCyborgModel(adapter, {
      provider: 'anthropic',
      model: 'claude-haiku-4-5-20251001',
      missionId,
      metadata: { maxTokens: 60, feature: 'twin-pulse' },
      messages: [{ role: 'user', content: prompt }],
    });
    const data = response.output as { content?: Array<{ text?: string }> };
    const message = data.content?.[0]?.text?.trim() ?? "";
    return Response.json({ message, missionId });
  } catch {
    return Response.json({ message: "" }, { status: 500 });
  }
}
