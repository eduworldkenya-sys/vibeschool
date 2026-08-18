import "jsr:@supabase/functions-js/edge-runtime.d.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"

const JSON_HEADERS = { "Content-Type": "application/json" }
const reply = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: JSON_HEADERS })

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? ""
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
const GROQ_API_KEY = Deno.env.get("GROQ_API_KEY") ?? ""
const MODEL_KEY = Deno.env.get("CONTENT_SEMANTIC_VERIFIER_MODEL") ?? "llama-3.3-70b-versatile"

const db = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
})

type Claim = {
  decision: "allow"
  task_id: string
  source_id: string
  proposal_id: string
  worker_key: string
  model_invocation_id: string
  model_key: string
  token_budget: number
  claim: string
  claim_sha256: string
  source_url: string
  source_title: string | null
  source_type: string
  source_content_hash: string
  evidence_excerpt: string
}

type ModelVerdict = {
  verdict: "supported" | "refuted" | "insufficient"
  confidence: number
  evidence_excerpt: string
  rationale: string
}

function compactWhitespace(value: string) {
  return value.replace(/\s+/g, " ").trim()
}

function exactEvidenceSubstring(candidate: string, source: string) {
  if (!candidate.trim()) return false
  const haystack = compactWhitespace(source).toLocaleLowerCase()
  const needle = compactWhitespace(candidate).toLocaleLowerCase()
  return needle.length >= 8 && haystack.includes(needle)
}

function parseVerdict(raw: string, sourceExcerpt: string): ModelVerdict {
  let parsed: unknown
  try {
    parsed = JSON.parse(raw)
  } catch {
    throw new Error("semantic_verifier_non_json_model_output")
  }
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    throw new Error("semantic_verifier_invalid_output_shape")
  }
  const obj = parsed as Record<string, unknown>
  const verdict = obj.verdict
  const confidence = Number(obj.confidence)
  const evidenceExcerpt = typeof obj.evidence_excerpt === "string" ? obj.evidence_excerpt.trim() : ""
  const rationale = typeof obj.rationale === "string" ? obj.rationale.trim() : ""

  if (verdict !== "supported" && verdict !== "refuted" && verdict !== "insufficient") {
    throw new Error("semantic_verifier_invalid_verdict")
  }
  if (!Number.isFinite(confidence) || confidence < 0 || confidence > 1) {
    throw new Error("semantic_verifier_invalid_confidence")
  }
  if (rationale.length < 3 || rationale.length > 4000) {
    throw new Error("semantic_verifier_invalid_rationale")
  }
  if ((verdict === "supported" || verdict === "refuted") && confidence < 0.85) {
    throw new Error("semantic_verifier_decisive_confidence_below_threshold")
  }
  if (verdict === "supported" || verdict === "refuted") {
    if (!exactEvidenceSubstring(evidenceExcerpt, sourceExcerpt)) {
      throw new Error("semantic_verifier_excerpt_not_grounded_in_source")
    }
  }
  return {
    verdict,
    confidence,
    evidence_excerpt: evidenceExcerpt,
    rationale,
  }
}

async function verifySemantics(claim: Claim): Promise<{ verdict: ModelVerdict; raw: Record<string, unknown> }> {
  const system = [
    "You are VibeSchool's evidence-classification verifier.",
    "Judge ONLY whether the supplied SOURCE EXCERPT supports or refutes the supplied CLAIM.",
    "Do not use outside knowledge. Do not repair, extend, or infer beyond the excerpt.",
    "Return exactly one JSON object with keys verdict, confidence, evidence_excerpt, rationale.",
    "verdict must be supported, refuted, or insufficient.",
    "For supported/refuted, confidence must be at least 0.85 and evidence_excerpt must be copied verbatim from SOURCE EXCERPT.",
    "If evidence is ambiguous, partial, missing context, or confidence would be below 0.85, use insufficient.",
    "For insufficient, evidence_excerpt may be empty.",
  ].join(" ")

  const user = [
    `CLAIM:\n${claim.claim}`,
    `SOURCE TYPE: ${claim.source_type}`,
    `SOURCE TITLE: ${claim.source_title ?? "unknown"}`,
    `SOURCE URL: ${claim.source_url}`,
    `SOURCE EXCERPT:\n${claim.evidence_excerpt}`,
  ].join("\n\n")

  const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${GROQ_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: claim.model_key,
      temperature: 0,
      max_tokens: Math.max(200, Math.min(2000, Number(claim.token_budget || 1200))),
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: system },
        { role: "user", content: user },
      ],
    }),
  })

  const payload = await response.json().catch(() => ({})) as Record<string, unknown>
  if (!response.ok) throw new Error(`semantic_verifier_model_failed:${response.status}`)

  const choices = Array.isArray(payload.choices) ? payload.choices : []
  const first = choices[0] as { message?: { content?: unknown } } | undefined
  const content = typeof first?.message?.content === "string" ? first.message.content : ""
  if (!content) throw new Error("semantic_verifier_empty_model_output")
  const verdict = parseVerdict(content, claim.evidence_excerpt)

  return {
    verdict,
    raw: {
      verifier_version: "certified_semantic_verifier_v1",
      provider: "groq",
      model: claim.model_key,
      verdict: verdict.verdict,
      confidence: verdict.confidence,
      evidence_excerpt: verdict.evidence_excerpt,
      rationale: verdict.rationale,
    },
  }
}

Deno.serve(async (req: Request) => {
  if (req.method !== "POST") return reply({ error: "method_not_allowed" }, 405)
  if (!SUPABASE_URL || !SERVICE_ROLE_KEY) return reply({ error: "supabase_runtime_config_missing" }, 500)
  if (!GROQ_API_KEY) return reply({ error: "groq_key_missing" }, 500)

  // Internal Worker Engine executor. Deployment keeps verify_jwt enabled and this second
  // boundary requires the service role token rather than accepting product/HQ browser calls.
  const auth = req.headers.get("Authorization") ?? ""
  if (auth !== `Bearer ${SERVICE_ROLE_KEY}`) return reply({ error: "service_role_required" }, 401)

  const body = await req.json().catch(() => ({})) as {
    taskId?: string
    sourceId?: string
    modelKey?: string
    tokenBudget?: number
  }
  if (!body.taskId || !body.sourceId) return reply({ error: "taskId_and_sourceId_required" }, 400)

  let claim: Claim | null = null
  try {
    const { data, error } = await db.rpc("hq_content_semantic_verifier_claim", {
      p_task_id: body.taskId,
      p_source_id: body.sourceId,
      p_model_key: body.modelKey || MODEL_KEY,
      p_token_budget: Math.max(200, Math.min(4000, Number(body.tokenBudget || 1200))),
    })
    if (error) throw new Error(`semantic_verifier_claim_failed:${error.message}`)
    claim = data as Claim
    if (!claim || claim.decision !== "allow") throw new Error("semantic_verifier_claim_not_authorized")

    const model = await verifySemantics(claim)

    const { data: completion, error: completionError } = await db.rpc("hq_content_semantic_verifier_complete", {
      p_task_id: claim.task_id,
      p_source_id: claim.source_id,
      p_model_invocation_id: claim.model_invocation_id,
      p_verdict: model.verdict.verdict,
      p_confidence: model.verdict.confidence,
      p_evidence_excerpt: model.verdict.evidence_excerpt,
      p_rationale: model.verdict.rationale,
      p_structured_output: model.raw,
    })
    if (completionError) throw new Error(`semantic_verifier_complete_failed:${completionError.message}`)

    return reply({ ok: true, verification: completion })
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    console.error(message)
    if (claim?.task_id && claim.model_invocation_id) {
      const { error: failureError } = await db.rpc("hq_content_semantic_verifier_fail", {
        p_task_id: claim.task_id,
        p_model_invocation_id: claim.model_invocation_id,
        p_error: message,
      })
      if (failureError) console.error(`semantic_verifier_failure_record_failed:${failureError.message}`)
    }
    return reply({ error: message }, 500)
  }
})
