import { serve } from "https://deno.land/std@0.168.0/http/server.ts"

const GEMINI_KEY = Deno.env.get("GEMINI_API_KEY") ?? ""
const TAVILY_KEY = Deno.env.get("TAVILY_API_KEY") ?? ""

const CORS = {
  "Access-Control-Allow-Origin":  "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS })

  try {
    const { teacher, school, subject, className, studentCount, duration, topic, focus, previousTopics } = await req.json()

    let tavilyContext = ""
    if (TAVILY_KEY) {
      const tavilyRes = await fetch("https://api.tavily.com/search", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          api_key: TAVILY_KEY,
          query: `${subject} ${topic} Kenya CBC curriculum lesson resources`,
          max_results: 4,
          include_answer: true,
        }),
      })
      const tavilyData = await tavilyRes.json()
      tavilyContext = tavilyData.results?.map((r: any) => `- ${r.title}: ${r.content}`).join("\n") ?? ""
    }

    const prevList = previousTopics?.length
      ? "Previously covered: " + previousTopics.join(", ") + "."
      : "This is the first recorded lesson for this class."

    const prompt = [
      "You are an expert Kenyan CBC curriculum lesson planner. Generate a complete practical classroom-ready lesson plan.",
      "Teacher: " + teacher,
      "School: " + school,
      "Subject: " + subject,
      "Class: " + className,
      "Number of learners: " + studentCount,
      "Duration: " + duration,
      "Topic: " + topic,
      focus ? "Teacher focus: " + focus : "",
      prevList,
      tavilyContext ? "\nWeb resources:\n" + tavilyContext : "",
      "",
      "Return ONLY this exact XML with no other text:",
      "<objectives>3 clear measurable CBC learning objectives.</objectives>",
      "<resources>Specific materials needed.</resources>",
      "<introduction>Exact 5-7 minute hook with actual teacher words.</introduction>",
      "<development>Detailed 20-25 minute teaching script with teacher talk, board work, questions and answers, exercises, common mistakes.</development>",
      "<consolidation>8-10 minute wrap-up with cold-call questions.</consolidation>",
      "<assessmentHook>One formative assessment moment.</assessmentHook>",
      "<homework>Specific homework with exact questions.</homework>",
      "<differentiation>Higher: extension task. On track: core task. Support: scaffolding strategy.</differentiation>",
      "<student_notes>3-5 plain English bullet points for parents and students. Include CBC strand.</student_notes>",
      "<parent_message>Complete parent message ready to send. Greeting, what was learned, homework numbered, home tip, sign-off with " + teacher + " and " + school + ".</parent_message>",
    ].join("\n")

    const geminiRes = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${GEMINI_KEY}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: { maxOutputTokens: 4000, temperature: 0.3 },
        }),
      }
    )

    const geminiData = await geminiRes.json()
    const text = geminiData.candidates?.[0]?.content?.parts?.[0]?.text ?? ""

    if (!text) return new Response(JSON.stringify({ error: "Empty response from Gemini", debug: geminiData }), {
      status: 500, headers: { ...CORS, "Content-Type": "application/json" }
    })

    return new Response(JSON.stringify({ plan: text }), {
      headers: { ...CORS, "Content-Type": "application/json" }
    })

  } catch (err) {
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500, headers: { ...CORS, "Content-Type": "application/json" }
    })
  }
})
