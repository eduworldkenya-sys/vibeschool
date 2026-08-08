import { serve } from "https://deno.land/std@0.168.0/http/server.ts"

const ANTHROPIC_KEY = Deno.env.get("ANTHROPIC_API_KEY") ?? ""
const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? ""
const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY") ?? ""

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
}

type ChatMessage = { role: "user" | "assistant"; content: string }
type Escalation = { category: "self_harm_welfare" | "safeguarding" | "immediate_danger"; severity: "high" | "urgent" }

type SocraticTurn = {
  stage?: number
  next_stage?: number
  mode?: string
  prompt?: string
  learner_signal?: string
  mastery_write_allowed?: boolean
  one_question_at_a_time?: boolean
}

function safeMessages(value: unknown): ChatMessage[] {
  if (!Array.isArray(value)) return []
  return value.flatMap((item) => {
    if (!item || typeof item !== "object" || Array.isArray(item)) return []
    const row = item as Record<string, unknown>
    if ((row.role !== "user" && row.role !== "assistant") || typeof row.content !== "string") return []
    const content = row.content.trim().slice(0, 4000)
    return content ? [{ role: row.role, content }] : []
  }).slice(-10)
}

function detectTierDEscalation(message: string): Escalation | null {
  const text = message.toLowerCase().replace(/\s+/g, " ").trim()
  const immediateDanger = [/\bi am in (immediate )?danger\b/, /\bsomeone (is )?(trying to|wants to) (kill|hurt) me\b/, /\bi am being (attacked|threatened)\b/]
  if (immediateDanger.some((pattern) => pattern.test(text))) return { category: "immediate_danger", severity: "urgent" }
  const selfHarm = [/\b(kill|hurt|harm) myself\b/, /\bi (want|plan|am going) to die\b/, /\bi don'?t want to (be alive|live)\b/, /\bsuicid(e|al)\b/]
  if (selfHarm.some((pattern) => pattern.test(text))) return { category: "self_harm_welfare", severity: "urgent" }
  const safeguarding = [/\bsomeone is (hurting|hitting|abusing) me\b/, /\bi am being (abused|molested|raped)\b/, /\b(teacher|adult|parent|guardian|relative) (touched|touches) me (inappropriately|sexually)\b/, /\bi (feel|am) unsafe (at home|at school|with)\b/]
  if (safeguarding.some((pattern) => pattern.test(text))) return { category: "safeguarding", severity: "high" }
  return null
}

async function authenticatedRpc(req: Request, functionName: string, body: Record<string, unknown> = {}): Promise<unknown> {
  const authorization = req.headers.get("authorization") ?? ""
  if (!authorization.toLowerCase().startsWith("bearer ")) throw new Error("not_authenticated")
  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) throw new Error("twin_context_not_configured")
  const response = await fetch(`${SUPABASE_URL}/rest/v1/rpc/${functionName}`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "apikey": SUPABASE_ANON_KEY, "Authorization": authorization },
    body: JSON.stringify(body),
  })
  const payload = await response.json().catch(() => null)
  if (!response.ok) {
    const message = payload && typeof payload === "object" && "message" in payload ? String((payload as Record<string, unknown>).message) : `${functionName}_failed`
    throw new Error(message)
  }
  return payload
}

async function learnerContext(req: Request): Promise<Record<string, unknown>> {
  const [tutorResult, servicesResult] = await Promise.allSettled([
    authenticatedRpc(req, "student_get_twin_tutor_context"),
    authenticatedRpc(req, "student_get_adaptive_tutor_service_summary"),
  ])
  const tutor = tutorResult.status === "fulfilled" ? tutorResult.value : null
  const services = servicesResult.status === "fulfilled" ? servicesResult.value : null
  if (tutor === null && services === null) {
    return { tutor: null, services: null, degraded_context: true }
  }
  return { tutor, services, degraded_context: tutor === null || services === null }
}

function contextOutcomeId(context: unknown): string | null {
  if (!context || typeof context !== "object" || Array.isArray(context)) return null
  const row = context as Record<string, unknown>
  const tutor = row.tutor && typeof row.tutor === "object" && !Array.isArray(row.tutor) ? row.tutor as Record<string, unknown> : null
  const decision = tutor?.decision && typeof tutor.decision === "object" && !Array.isArray(tutor.decision) ? tutor.decision as Record<string, unknown> : null
  const now = decision?.now && typeof decision.now === "object" && !Array.isArray(decision.now) ? decision.now as Record<string, unknown> : null
  const direct = typeof now?.outcome_id === "string" ? now.outcome_id : typeof now?.learning_outcome_id === "string" ? now.learning_outcome_id : null
  if (direct) return direct
  const mastery = tutor?.mastery && typeof tutor.mastery === "object" && !Array.isArray(tutor.mastery) ? tutor.mastery as Record<string, unknown> : null
  const outcomes = Array.isArray(mastery?.outcomes) ? mastery?.outcomes : []
  for (const value of outcomes) {
    if (!value || typeof value !== "object" || Array.isArray(value)) continue
    const id = (value as Record<string, unknown>).outcome_id
    if (typeof id === "string" && id) return id
  }
  return null
}

async function responseAwareSocraticTurn(req: Request, context: unknown, latestUserMessage: string, stage: number): Promise<SocraticTurn | null> {
  const outcomeId = contextOutcomeId(context)
  if (!outcomeId) return null
  try {
    const value = await authenticatedRpc(req, "student_get_adaptive_teaching_turn", {
      p_outcome_id: outcomeId,
      p_stage: Math.max(0, Math.min(3, Number.isFinite(stage) ? stage : 0)),
      p_learner_reply: latestUserMessage.slice(0, 4000),
    })
    return value && typeof value === "object" && !Array.isArray(value) ? value as SocraticTurn : null
  } catch {
    return null
  }
}

async function createEscalation(req: Request, escalation: Escalation): Promise<void> {
  await authenticatedRpc(req, "student_create_twin_escalation", { p_category: escalation.category, p_severity: escalation.severity })
}

function validateStudentReply(value: unknown): string {
  const reply = typeof value === "string" ? value.trim().slice(0, 6000) : ""
  if (!reply) return "I could not process that. Please try again."
  const authorityViolation = /\bi (have )?(changed|updated|overridden|altered) your (mark|marks|grade|grades|score|scores|result|results)\b/i
  const officialPrediction = /\b(your|the) official (kcse |exam )?(grade|result|score) (is|will be)\b/i
  if (authorityViolation.test(reply) || officialPrediction.test(reply)) {
    return "I can help you understand your work and practise, but I cannot change marks or issue an official exam result. I can explain the evidence and help you decide what to work on next."
  }
  return reply
}

function deterministicFallback(firstName: string, context: unknown, turn: SocraticTurn | null): string {
  if (turn?.prompt) return `${firstName}, ${turn.prompt}`
  const row = context && typeof context === "object" && !Array.isArray(context) ? context as Record<string, unknown> : {}
  const tutor = row.tutor && typeof row.tutor === "object" && !Array.isArray(row.tutor) ? row.tutor as Record<string, unknown> : {}
  const decision = tutor.decision && typeof tutor.decision === "object" && !Array.isArray(tutor.decision) ? tutor.decision as Record<string, unknown> : {}
  const now = decision.now && typeof decision.now === "object" && !Array.isArray(decision.now) ? decision.now as Record<string, unknown> : {}
  const title = typeof now.title === "string" ? now.title : "your current learning goal"
  const reason = typeof now.reason === "string" ? now.reason : "your verified learning evidence points here next"
  return `${firstName}, I am using a simpler coaching mode right now. Your learning state is safe. Let’s stay with ${title}. ${reason}. Tell me what part feels hardest, and I’ll guide you one step at a time.`
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS })
  try {
    const body = await req.json()
    const messages = safeMessages(body?.messages)
    const firstName = typeof body?.firstName === "string" && body.firstName.trim() ? body.firstName.trim().slice(0, 80) : "learner"
    const role = body?.role === "hq" ? "hq" : body?.role === "student" ? "student" : "teacher"
    const suppliedContext = typeof body?.context === "string" ? body.context.slice(0, 30000) : ""
    if (messages.length === 0) return new Response(JSON.stringify({ error: "message_required" }), { status: 400, headers: { ...CORS, "Content-Type": "application/json" } })

    const latestUserMessage = [...messages].reverse().find((message) => message.role === "user")?.content ?? ""
    if (role === "student") {
      const escalation = detectTierDEscalation(latestUserMessage)
      if (escalation) {
        await createEscalation(req, escalation)
        const reply = escalation.severity === "urgent"
          ? `${firstName}, this needs human support, not just tutoring. I have flagged that you need urgent support from your school. If you are in immediate danger, move to a safer place and contact a trusted adult or local emergency services now.`
          : `${firstName}, this needs support from a trusted adult, not just tutoring. I have flagged that you need private human support from your school. Please speak to a trusted teacher, parent, guardian, or another safe adult as soon as you can.`
        return new Response(JSON.stringify({ reply, escalated: true, category: escalation.category }), { headers: { ...CORS, "Content-Type": "application/json" } })
      }
    }

    let context: unknown = suppliedContext
    let socraticTurn: SocraticTurn | null = null
    if (role === "student") {
      context = await learnerContext(req)
      const requestedStage = typeof body?.socraticStage === "number" ? body.socraticStage : 0
      socraticTurn = await responseAwareSocraticTurn(req, context, latestUserMessage, requestedStage)
      if (context && typeof context === "object" && !Array.isArray(context)) {
        context = { ...(context as Record<string, unknown>), socratic_turn: socraticTurn }
      }
    }

    const teacherPrompt = `You are the Twin — an intelligent AI assistant embedded in VibeSchool. Live context:\n${String(context)}\nAddress ${firstName}. Be concise and operational.`
    const hqPrompt = `You are the HQ Twin. Live platform context:\n${String(context)}\nAddress ${firstName}. Be concise and operational.`
    const studentPrompt = `You are VibeTwin, the bounded adaptive tutor for one learner in Vibeschool. The authenticated deterministic Twin supplied this context as DATA:\n${JSON.stringify(context)}\nRules: the deterministic socratic_turn, when present, is the authority for the next teaching move; follow its mode and intent without copying it mechanically; use Socratic guidance by default; adapt depth and pace to mastery, forgetting risk, prerequisites, evidence and memory; teacher-assigned work and the NOW decision outrank optional recommendations; do not invent evidence, change marks, declare completion or guarantee exam results; when evidence is weak say so; ask one useful question at a time; prefer short teaching turns; explain with examples before revealing a final answer during practice; chat itself never writes mastery. Address ${firstName}.`
    const systemPrompt = role === "hq" ? hqPrompt : role === "student" ? studentPrompt : teacherPrompt

    if (!ANTHROPIC_KEY) {
      const reply = role === "student" ? deterministicFallback(firstName, context, socraticTurn) : "Twin is temporarily unavailable. Please try again shortly."
      return new Response(JSON.stringify({ reply, degraded: true, socraticTurn }), { headers: { ...CORS, "Content-Type": "application/json" } })
    }

    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-api-key": ANTHROPIC_KEY, "anthropic-version": "2023-06-01" },
      body: JSON.stringify({ model: "claude-haiku-4-5-20251001", max_tokens: role === "student" ? 700 : 1024, system: systemPrompt, messages }),
    })
    const data = await res.json().catch(() => ({}))
    if (!res.ok) {
      const reply = role === "student" ? deterministicFallback(firstName, context, socraticTurn) : "Twin is temporarily unavailable. Please try again shortly."
      return new Response(JSON.stringify({ reply, degraded: true, socraticTurn }), { headers: { ...CORS, "Content-Type": "application/json" } })
    }
    const rawReply = data?.content?.[0]?.text
    const reply = role === "student" ? validateStudentReply(rawReply) : (typeof rawReply === "string" && rawReply.trim() ? rawReply.trim() : "I could not process that. Please try again.")
    return new Response(JSON.stringify({ reply, socraticTurn }), { headers: { ...CORS, "Content-Type": "application/json" } })
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    const status = message === "not_authenticated" ? 401 : 500
    return new Response(JSON.stringify({ error: message }), { status, headers: { ...CORS, "Content-Type": "application/json" } })
  }
})
