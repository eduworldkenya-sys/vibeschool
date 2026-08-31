import { serve } from "https://deno.land/std@0.208.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"

const GROQ_KEY = Deno.env.get("GROQ_API_KEY") ?? ""
const TAVILY_KEY = Deno.env.get("TAVILY_API_KEY") ?? ""
const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? ""
const SUPABASE_SERVICE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""

const CREDIT_COST = 1
const FREE_CREDITS = 3

const CORS = {
  "Access-Control-Allow-Origin": Deno.env.get("ALLOWED_ORIGIN") ?? "*",
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

  const authHeader = req.headers.get("authorization") ?? ""
  const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7).trim() : ""
  if (!token) return json({ error: "Missing auth token" }, 401)

  const adminClient = createClient(SUPABASE_URL, SUPABASE_SERVICE)
  const { data: { user }, error: authError } = await adminClient.auth.getUser(token)
  if (authError || !user) return json({ error: "Unauthorized" }, 401)

  try {
    const [{ data: profile }, { data: teacherAssignment }] = await Promise.all([
      adminClient
        .from("profiles")
        .select("role")
        .eq("id", user.id)
        .maybeSingle(),
      adminClient
        .from("teacher_classes")
        .select("id")
        .eq("teacher_id", user.id)
        .limit(1)
        .maybeSingle(),
    ])

    if (profile?.role !== "teacher" || !teacherAssignment) {
      return json({ error: "Forbidden" }, 403)
    }

    let { data: wallet } = await adminClient
      .from("vibe_credits")
      .select("balance, total_spent")
      .eq("teacher_id", user.id)
      .maybeSingle()

    if (!wallet) {
      const { data: newWallet, error: walletErr } = await adminClient
        .from("vibe_credits")
        .insert({
          teacher_id: user.id,
          balance: FREE_CREDITS,
          total_earned: FREE_CREDITS,
          total_spent: 0,
        })
        .select("balance, total_spent")
        .single()

      if (walletErr) {
        const { data: existing } = await adminClient
          .from("vibe_credits")
          .select("balance, total_spent")
          .eq("teacher_id", user.id)
          .maybeSingle()
        wallet = existing
      } else {
        wallet = newWallet
        await adminClient.from("vibe_credit_transactions").insert({
          teacher_id: user.id,
          type: "gift",
          feature: "signup_bonus",
          amount: FREE_CREDITS,
          balance_after: FREE_CREDITS,
          notes: "Free credits on first AI use",
        })
      }
    }

    if (!wallet || wallet.balance < CREDIT_COST) {
      return json({
        error: "insufficient_credits",
        balance: wallet?.balance ?? 0,
        required: CREDIT_COST,
        message: "You have no Vibe Credits. Buy credits to generate lesson plans.",
      }, 402)
    }

    const body = await req.json()
    const {
      teacher,
      school,
      subject,
      className,
      studentCount,
      duration,
      topic,
      focus,
      previousTopics,
      curriculumStrand,
      curriculumSubStrand,
      curriculumObjectives,
      keyInquiryQuestion,
      learningResources,
      learningExperiences,
      assessmentMethods,
      reference,
    } = body

    if (!topic || !subject || !className) {
      return json({ error: "Missing required fields: topic, subject, className" }, 400)
    }

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
        console.warn("[generate-lesson-plan] Tavily failed:", tavilyErr)
      }
    }

    const prevList = previousTopics?.length
      ? "Previously covered: " + previousTopics.join(", ") + "."
      : "This is the first recorded lesson for this class."

    const schemeGrounding = [
      curriculumObjectives ? "Authoritative Scheme objectives: " + curriculumObjectives : "",
      keyInquiryQuestion ? "Authoritative key inquiry question: " + keyInquiryQuestion : "",
      learningExperiences ? "Authoritative learning experiences: " + learningExperiences : "",
      learningResources ? "Authoritative learning resources: " + learningResources : "",
      assessmentMethods ? "Authoritative assessment methods: " + assessmentMethods : "",
      reference ? "Authoritative reference: " + reference : "",
    ].filter(Boolean)

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
      ...schemeGrounding,
      schemeGrounding.length
        ? "Treat the Scheme of Work fields above as authoritative. Expand them into a teachable plan; do not replace them with unrelated objectives or activities."
        : "",
      focus ? "Teacher focus: " + focus : "",
      prevList,
      tavilyContext ? "\nWeb resources for supplementary context only:\n" + tavilyContext : "",
      "",
      "Return ONLY the XML below. No text before or after. No markdown. No code fences.",
      "",
      "<objectives>",
      curriculumObjectives
        ? "Preserve and operationalise the authoritative Scheme objectives above as measurable CBC lesson objectives."
        : "3 clear measurable CBC competency-based learning objectives for this specific topic.",
      "</objectives>",
      "",
      "<resources>",
      learningResources
        ? "Use the authoritative Scheme learning resources above first; add only practical supporting materials where useful."
        : "Specific materials needed: textbook pages, manipulatives, chalk, diagrams, locally available items.",
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
      keyInquiryQuestion ? "- Explicitly address the authoritative key inquiry question" : "",
      learningExperiences ? "- Realise the authoritative learning experiences in classroom-ready steps" : "",
      "Build explicitly on: " + prevList,
      "</development>",
      "",
      "<consolidation>",
      "Focused 8-10 minute wrap-up script. Specific cold-call questions. Exact words to use.",
      "</consolidation>",
      "",
      "<assessmentHook>",
      assessmentMethods
        ? "Use the authoritative Scheme assessment methods above as the primary formative assessment approach; state what to look for and how to record it quickly."
        : "One specific formative assessment moment during the lesson — what to look for and how to record it quickly.",
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

    const newBalance = wallet.balance - CREDIT_COST
    const newTotalSpent = (wallet.total_spent ?? 0) + CREDIT_COST

    const { error: deductErr } = await adminClient
      .from("vibe_credits")
      .update({
        balance: newBalance,
        total_spent: newTotalSpent,
        updated_at: new Date().toISOString(),
      })
      .eq("teacher_id", user.id)

    if (deductErr) {
      console.error("[generate-lesson-plan] credit deduction failed:", deductErr)
    } else {
      await adminClient.from("vibe_credit_transactions").insert({
        teacher_id: user.id,
        type: "spend",
        feature: "lesson_plan",
        amount: -CREDIT_COST,
        balance_after: newBalance,
        notes: "Generated lesson plan",
      })
    }

    return json({
      plan: text,
      credits: { used: CREDIT_COST, balance: newBalance, was: wallet.balance },
    })
  } catch (err) {
    console.error("[generate-lesson-plan] Unhandled error:", err)
    return json({ error: String(err) }, 500)
  }
})
