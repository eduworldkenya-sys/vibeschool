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

    // 1. Tavily search for curriculum resources
    let tavilyContext = ""
    if (TAVILY_KEY) {
      const tavilyRes = await fetch("https://api.tavily.com/search", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          api_key: TAVILY_KEY,
          query: `${subject} ${topic} Kenya CBC curriculum lesson resources grade`,
          max_results: 4,
          include_answer: true,
        }),
      })
      const tavilyData = await tavilyRes.json()
      tavilyContext = tavilyData.results
        ?.map((r: any) => `- ${r.title}: ${r.content}`)
        .join("\n") ?? ""
    }

    const prevList = previousTopics?.length
      ? "Previously covered: " + previousTopics.join(", ") + "."
      : "This is the first recorded lesson for this class."

    const prompt = [
      "You are an expert Kenyan CBC curriculum lesson planner. Generate a complete practical classroom-ready lesson plan that reads like a teaching script — specific enough that any teacher can pick it up and deliver it confidently.",
      "",
      "Teacher: " + teacher,
      "School: " + school,
      "Subject: " + subject,
      "Class: " + className,
      "Number of learners: " + studentCount,
      "Duration: " + duration,
      "Topic: " + topic,
      focus ? "Teacher focus: " + focus : "",
      prevList,
      tavilyContext ? "\nWeb resources for context:\n" + tavilyContext : "",
      "",
      "Return ONLY this exact XML with no other text before or after:",
      "",
      "<objectives>",
      "3 clear measurable CBC competency-based learning objectives for this specific topic.",
      "</objectives>",
      "",
      "<resources>",
      "Specific materials needed: textbook pages manipulatives chalk diagrams locally available items.",
      "</resources>",
      "",
      "<introduction>",
      "Exact 5-7 minute hook. Write the actual words the teacher says. Connect to learners daily Kenyan life. Reference the " + studentCount + " learners specifically in grouping instructions.",
      "</introduction>",
      "",
      "<development>",
      "Detailed 20-25 minute main teaching sequence written as a script:",
      "- Exact teacher talk at each stage",
      "- What to write or draw on the board",
      "- Specific questions to ask the class with expected answers",
      "- Actual exercises or examples with answers provided for the teacher",
      "- Common mistakes to watch for",
      "- How to group the " + studentCount + " learners for activities",
      "Build explicitly on: " + prevList,
      "</development>",
      "",
      "<consolidation>",
      "Focused 8-10 minute wrap-up script. Specific cold-call questions to check understanding. Exact words to use.",
      "</consolidation>",
      "",
      "<assessmentHook>",
      "One specific formative assessment moment during the lesson what to look for and how to record it quickly.",
      "</assessmentHook>",
      "",
      "<homework>",
      "Specific achievable homework task with exact questions or instructions written out. Must directly reinforce todays topic.",
      "</homework>",
      "",
      "<differentiation>",
      "Higher achievers: specific extension task with exact instructions",
      "On track: core task description",
      "Needs support: exact scaffolding strategy with accommodations for this topic",
      "</differentiation>",
      "",
      "<student_notes>",
      "3-5 bullet points in plain English for parents and students. What was learned today written as if explaining to a parent. No teaching jargon. Include CBC strand reference at the end.",
      "</student_notes>",
      "",
      "<parent_message>",
      "A complete warm professional parent message. Structure: greeting, Today in [subject] your child learned... paragraph, homework section with exact tasks numbered, one practical tip for helping at home, sign-off with " + teacher + " and " + school + ". Ready to send with zero editing needed.",
      "</parent_message>",
    ].join("\n")

    // 2. Gemini generation
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

    if (!text) return new Response(JSON.stringify({ error: "Empty response from Gemini" }), {
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
