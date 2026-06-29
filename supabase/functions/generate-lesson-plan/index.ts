import { serve } from "https://deno.land/std@0.208.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"

const GROQ_KEY = Deno.env.get("GROQ_API_KEY") ?? ""
const TAVILY_KEY = Deno.env.get("TAVILY_API_KEY") ?? ""
const SUPABASE_URL     = Deno.env.get("SUPABASE_URL") ?? ""
const SUPABASE_SERVICE  = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""

const CORS = {
  "Access-Control-Allow-Origin":  Deno.env.get("ALLOWED_ORIGIN") ?? "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
}

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...CORS, "Content-Type": "application/json" },
  })
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS })

  // G1: verify JWT before anything else
  const authHeader = req.headers.get("authorization") ?? ""
  const token = authHeader.replace("Bearer ", "").trim()
  if (!token) return json({ error: "Missing auth token" }, 401)

  const adminClient = createClient(SUPABASE_URL, SUPABASE_SERVICE)
  const { data: { user }, error: authError } = await adminClient.auth.getUser(token)
  if (authError || !user) return json({ error: "Unauthorized" }, 401)

  try {
    const body = await req.json()
    const { teacher, school, subject, className, studentCount, duration, topic, focus, previousTopics, curriculumStrand, curriculumSubStrand } = body

    // G7: input validation — reject early if required fields missing
    if (!topic || !subject || !className) {
      return json({ error: "Missing required fields: topic, subject, className" }, 400)
    }

    // Tavily — G4: wrapped in own try/catch, failure is non-fatal
    let tavilyContext = ""
    if (TAVILY_KEY) {
      try {
        const tavilyRes = await fetch("https://api.tavily.com/search", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            api_key: TAVILY_KEY,
            query: subject + " " + topic + " Kenya CBC curriculum lesson resources grade",
            max_results: 4,
            include_answer: true,
          }),
        })
        const tavilyData = await tavilyRes.json()
        tavilyContext = (tavilyData.results ?? [])
          .map((r: any) => "- " + r.title + ": " + r.content)
          .join("\n")
      } catch (tavilyErr) {
        // non-fatal — continue without enrichment
        console.warn("[generate-lesson-plan] Tavily failed:", tavilyErr)
      }
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
      curriculumStrand
        ? "KICD Curriculum strand: " + curriculumStrand + (curriculumSubStrand ? " → " + curriculumSubStrand : "") + ". Align objectives and content explicitly to this strand."
        : "",
      focus ? "Teacher focus: " + focus : "",
      prevList,
      tavilyContext ? "\nWeb resources for context:\n" + tavilyContext : "",
      "",
      "Return ONLY the XML below. No text before or after. No markdown. No code fences.",
      "",
      "<objectives>",
      "3 clear measurable CBC competency-based learning objectives for this specific topic.",
      "</objectives>",
      "",
      "<resources>",
      "Specific materials needed: textbook pages, manipulatives, chalk, diagrams, locally available items.",
      "</resources>",
      "",
      "<introduction>",
      "Exact 5-7 minute hook. Write the actual words the teacher says. Connect to learners daily Kenyan life.",
      "</introduction>",
      "",
      "<development>",
      "Detailed 20-25 minute main teaching sequence written as a script:",
      "- Exact teacher talk at each stage",
      "- What to write or draw on the board",
      "- Specific questions to ask with expected answers",
      "- Actual exercises with answers provided for the teacher",
      "- Common mistakes to watch for",
      "Build explicitly on: " + prevList,
      "</development>",
      "",
      "<consolidation>",
      "Focused 8-10 minute wrap-up script. Specific cold-call questions. Exact words to use.",
      "</consolidation>",
      "",
      "<assessmentHook>",
      "One specific formative assessment moment during the lesson — what to look for and how to record it quickly.",
      "</assessmentHook>",
      "",
      "<homework>",
      "Specific achievable homework task with exact questions written out. Must reinforce today's topic.",
      "</homework>",
      "",
      "<differentiation>",
      "Higher achievers: specific extension task",
      "On track: core task description",
      "Needs support: exact scaffolding strategy for this topic",
      "</differentiation>",
    ].filter(Boolean).join("\n")

    const groqRes = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": "Bearer " + GROQ_KEY,
      },
      body: JSON.stringify({
        model: "llama-3.3-70b-versatile",
        messages: [{ role: "user", content: prompt }],
        max_tokens: 4000,
        temperature: 0.3,
      }),
    })

    const groqData = await groqRes.json()

    if (!groqRes.ok || !groqData.choices) {
      console.error("[generate-lesson-plan] Groq error:", JSON.stringify(groqData))
      return json({ error: "Groq generation failed", detail: groqData }, 502)
    }

    const text = groqData.choices?.[0]?.message?.content ?? ""
    if (!text) {
      console.error("[generate-lesson-plan] Empty Groq response:", JSON.stringify(groqData))
      return json({ error: "Empty response from Groq" }, 502)
    }

    return json({ plan: text })

  } catch (err) {
    // G7: no silent swallows
    console.error("[generate-lesson-plan] Unhandled error:", err)
    return json({ error: String(err) }, 500)
  }
})
