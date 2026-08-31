import { serve } from "https://deno.land/std@0.208.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"

const GROQ_KEY = Deno.env.get("GROQ_API_KEY") ?? ""
const TAVILY_KEY = Deno.env.get("TAVILY_API_KEY") ?? ""
const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? ""
const SUPABASE_SERVICE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""

const CREDIT_COST = 1
const FREE_CREDITS = 3
const EXPLICIT_AI_INTENT = "ai_enhance"

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
  if (req.method !== "POST") return json({ error: "method_not_allowed" }, 405)

  const authHeader = req.headers.get("authorization") ?? ""
  const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7).trim() : ""
  if (!token) return json({ error: "Missing auth token" }, 401)

  let body: Record<string, unknown>
  try {
    body = await req.json()
  } catch {
    return json({ error: "invalid_json" }, 400)
  }

  // Zero-AI is the lesson-plan default. This legacy model endpoint is usable
  // only when the caller explicitly requests an AI enhancement. It must never
  // become an automatic fallback for deterministic lesson construction.
  if (body.intent !== EXPLICIT_AI_INTENT) {
    return json({
      error: "explicit_ai_enhancement_intent_required",
      requiredIntent: EXPLICIT_AI_INTENT,
      message: "Baseline lesson plans are built without AI. Use an explicit AI enhance action to call this endpoint.",
    }, 409)
  }

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
          notes: "Free credits on first explicit AI enhancement",
        })
      }
    }

    if (!wallet || wallet.balance < CREDIT_COST) {
      return json({
        error: "insufficient_credits",
        balance: wallet?.balance ?? 0,
        required: CREDIT_COST,
        message: "You have no Vibe Credits for this optional AI enhancement.",
      }, 402)
    }

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
            query: String(subject) + " " + String(topic) + " Kenya CBC curriculum lesson resources grade",
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

    const prevList = Array.isArray(previousTopics) && previousTopics.length
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
      "You are enhancing an existing Kenyan CBC lesson plan at the teacher's explicit request.",
      "Preserve the authoritative Scheme objectives and curriculum grounding. Do not silently replace them.",
      "",
      "Teacher: " + teacher,
      "School: " + school,
      "Subject: " + subject,
      "Class: " + className,
      "Number of learners: " + studentCount,
      "Duration: " + duration,
      "Topic: " + topic,
      curriculumStrand
        ? "KICD Curriculum strand: " + curriculumStrand + (curriculumSubStrand ? " → " + curriculumSubStrand : "") + "."
        : "",
      ...schemeGrounding,
      schemeGrounding.length
        ? "Treat the Scheme of Work fields above as authoritative. Enhance presentation and pedagogy only; do not introduce unrelated objectives."
        : "",
      focus ? "Teacher focus: " + focus : "",
      prevList,
      tavilyContext ? "\nWeb resources for supplementary context only:\n" + tavilyContext : "",
      "",
      "Return ONLY the XML below. No text before or after. No markdown. No code fences.",
      "",
      "<objectives>",
      curriculumObjectives
        ? "Preserve and operationalise the authoritative Scheme objectives above."
        : "3 clear measurable CBC competency-based learning objectives for this specific topic.",
      "</objectives>",
      "",
      "<resources>",
      learningResources
        ? "Use the authoritative Scheme learning resources above first; add only practical supporting materials where useful."
        : "Specific materials needed for the lesson.",
      "</resources>",
      "",
      "<introduction>",
      "Use the exact total lesson duration supplied by the caller; do not assume a 40-minute period.",
      "</introduction>",
      "",
      "<development>",
      "Enhance the teacher notes, learner activities, expected answers and misconceptions while preserving the authoritative curriculum grounding.",
      "</development>",
      "",
      "<consolidation>",
      "Close by checking the stated objectives and inquiry question.",
      "</consolidation>",
      "",
      "<assessmentHook>",
      assessmentMethods
        ? "Use the authoritative Scheme assessment methods above as the primary formative assessment approach."
        : "Use a formative assessment that checks the stated objectives.",
      "</assessmentHook>",
      "",
      "<homework>",
      "Provide follow-up work that reinforces only today's stated objective(s).",
      "</homework>",
      "",
      "<differentiation>",
      "Provide support, core and extension adaptations without changing the lesson objective.",
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
      return json({ error: "Groq enhancement failed", detail: groqData }, 502)
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
        feature: "lesson_plan_ai_enhance",
        amount: -CREDIT_COST,
        balance_after: newBalance,
        notes: "Explicit AI lesson enhancement",
      })
    }

    return json({
      plan: text,
      provenance: { generationMode: "ai_assisted", intent: EXPLICIT_AI_INTENT },
      credits: { used: CREDIT_COST, balance: newBalance, was: wallet.balance },
    })
  } catch (err) {
    console.error("[generate-lesson-plan] Unhandled error:", err)
    return json({ error: String(err) }, 500)
  }
})