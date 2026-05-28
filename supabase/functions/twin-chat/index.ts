import { serve } from "https://deno.land/std@0.168.0/http/server.ts"

const GROQ_KEY = Deno.env.get("GROQ_TWIN_KEY") ?? ""

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS })

  try {
    const { messages, context, firstName } = await req.json()

    const systemPrompt = `You are the Twin — an intelligent AI assistant embedded in VibeSchool, a Kenyan school management platform following the CBC curriculum.

You know this teacher's context:
${context}

Your personality:
- Warm, professional, and always on the teacher's side
- Concise but thorough — no waffle
- You speak like a trusted colleague who knows the school deeply
- You never say you are Groq, Claude, or any AI model
- You are simply "Your Twin"

You help with:
- Lesson plan suggestions aligned to CBC strands
- Student performance insights and patterns
- Attendance analysis
- Parent communication drafts
- CBC curriculum guidance
- Homework and assessment ideas
- Scheme of work advice
- Classroom management tips
- Differentiation strategies

Always address the teacher as ${firstName}.`

    const res = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": "Bearer " + GROQ_KEY,
      },
      body: JSON.stringify({
        model: "llama-3.3-70b-versatile",
        messages: [
          { role: "system", content: systemPrompt },
          ...messages,
        ],
        max_tokens: 1000,
        temperature: 0.7,
      }),
    })

    const data = await res.json()
    const reply = data.choices?.[0]?.message?.content ?? "I could not process that. Please try again."

    return new Response(JSON.stringify({ reply }), {
      headers: { ...CORS, "Content-Type": "application/json" }
    })

  } catch (err) {
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500, headers: { ...CORS, "Content-Type": "application/json" }
    })
  }
})
