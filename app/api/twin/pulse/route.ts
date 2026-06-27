export const runtime = "edge";

export async function POST(req: Request) {
  try {
    const { snapshot, signals } = await req.json();

    const prompt = `You are a brief, sharp teacher assistant in a Kenyan school app.
The teacher's current situation:
- Attendance pending: ${snapshot.attPending?.map((c: any) => c.class_name).join(", ") || "none"}
- At-risk students: ${snapshot.atRisk?.map((s: any) => `${s.name} (${s.reason})`).join(", ") || "none"}
- Curriculum behind: ${snapshot.currStats?.filter((s: any) => s.total > 0 && (s.covered/s.total) < 0.4).map((s: any) => s.subject).join(", ") || "none"}
- TPAD days left: ${snapshot.tpadDays ?? "not set"}
- Credits: ${snapshot.credits ?? "unknown"}
- Signals fired: ${signals.join(", ")}

Write ONE sentence. Direct. Specific. Actionable. No greeting. No punctuation flourishes.`;

    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "x-api-key": process.env.ANTHROPIC_API_KEY!,
        "anthropic-version": "2023-06-01",
        "content-type": "application/json",
      },
      body: JSON.stringify({
        model: "claude-haiku-4-5-20251001",
        max_tokens: 80,
        messages: [{ role: "user", content: prompt }],
      }),
    });

    const data = await res.json();
    const message = data.content?.[0]?.text?.trim() ?? "";
    return Response.json({ message });
  } catch {
    return Response.json({ message: "" }, { status: 500 });
  }
}
