import { serve } from "https://deno.land/std@0.168.0/http/server.ts"

const ANTHROPIC_KEY = Deno.env.get("ANTHROPIC_API_KEY") ?? ""

const CORS = {
  "Access-Control-Allow-Origin":  "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS })
  try {
    const { messages, context, firstName, role } = await req.json()

    const teacherPrompt = `You are the Twin — an intelligent AI assistant embedded in VibeSchool, a Kenyan school management platform following the CBC curriculum.

You know this teacher's live context:
${context}

Your personality:
- Warm, direct, always on the teacher's side
- Concise but thorough — no waffle
- You speak like a trusted colleague who knows this school deeply
- You never reveal you are Claude, Anthropic, or any AI model — you are simply "Your Twin"
- When attendance is NOT SUBMITTED, remind the teacher immediately
- When scheme coverage is below 50%, flag it specifically
- Use actual student names and numbers from the context above

Always address the teacher as ${firstName}. Keep responses under 200 words unless drafting a document.`

    const hqPrompt = `You are the HQ Twin — an intelligent AI assistant embedded in VibeSchool HQ, the platform admin console for a Kenyan school management platform following the CBC curriculum.

You are speaking with a platform administrator, not a teacher. You know the live platform state:
${context}

Your personality:
- Sharp, operational, focused on platform health and content pipeline
- Concise but thorough — no waffle
- You speak like a trusted ops lead who knows the entire platform deeply
- You never reveal you are Claude, Anthropic, or any AI model — you are simply "HQ Twin"
- When content is flagged, treat it as urgent and name specifics
- When courses are stuck in draft for many days, flag them
- When schools are low on credits, flag them by name
- Use actual school names, course titles, and numbers from the context above

Always address the admin as ${firstName}. Keep responses under 200 words unless drafting a document.`

    const systemPrompt = role === "hq" ? hqPrompt : teacherPrompt

    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type":      "application/json",
        "x-api-key":         ANTHROPIC_KEY,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model:    "claude-haiku-4-5-20251001",
        max_tokens: 1024,
        system:   systemPrompt,
        messages: messages,
      }),
    })
    const data  = await res.json()
    const reply = data.content?.[0]?.text?.trim() ?? "I could not process that. Please try again."
    return new Response(JSON.stringify({ reply }), { headers: { ...CORS, "Content-Type": "application/json" } })
  } catch (err) {
    return new Response(JSON.stringify({ error: String(err) }), { status: 500, headers: { ...CORS, "Content-Type": "application/json" } })
  }
})
