import "jsr:@supabase/functions-js/edge-runtime.d.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"

const JSON_HEADERS = { "Content-Type": "application/json" }
const reply = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: JSON_HEADERS })

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? ""
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
const TAVILY_API_KEY = Deno.env.get("TAVILY_API_KEY") ?? ""

const db = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
})

type Claim = {
  decision: "allow"
  task_id: string
  job_id: string
  proposal_id: string
  worker_key: string
  research_question: string
  required_source_count: number
  require_primary_source: boolean
  allowed_domains: string[] | null
}

type TavilyResult = {
  url?: string
  title?: string
  content?: string
  published_date?: string
}

function normalizeHost(host: string) {
  return host.toLowerCase().replace(/^www\./, "").replace(/\.$/, "")
}

function hostAllowed(url: string, allowedDomains: string[]) {
  if (!allowedDomains.length) return true
  try {
    const host = normalizeHost(new URL(url).hostname)
    return allowedDomains.some((raw) => {
      const allowed = normalizeHost(raw.replace(/^https?:\/\//, "").split("/")[0])
      return host === allowed || host.endsWith(`.${allowed}`)
    })
  } catch {
    return false
  }
}

function classifySource(url: string) {
  const host = normalizeHost(new URL(url).hostname)
  if (
    host.endsWith(".go.ke") ||
    host === "kicd.ac.ke" || host.endsWith(".kicd.ac.ke") ||
    host === "knec.ac.ke" || host.endsWith(".knec.ac.ke")
  ) {
    return { source_type: "official", source_tier: 1, authority_score: 1 }
  }
  if (host.endsWith(".gov") || host.endsWith(".gov.uk") || host.endsWith(".who.int")) {
    return { source_type: "government", source_tier: 1, authority_score: 0.95 }
  }
  if (
    host === "nature.com" || host.endsWith(".nature.com") ||
    host === "science.org" || host.endsWith(".science.org") ||
    host === "pubmed.ncbi.nlm.nih.gov" || host === "doi.org"
  ) {
    return { source_type: "primary_research", source_tier: 2, authority_score: 0.92 }
  }
  if (host.endsWith(".edu") || host.endsWith(".ac.ke") || host.endsWith(".ac.uk")) {
    return { source_type: "academic", source_tier: 2, authority_score: 0.86 }
  }
  return { source_type: "web", source_tier: 4, authority_score: 0.58 }
}

async function sha256(value: string) {
  const bytes = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value))
  return Array.from(new Uint8Array(bytes)).map((b) => b.toString(16).padStart(2, "0")).join("")
}

async function searchSources(claim: Claim) {
  const allowed = Array.isArray(claim.allowed_domains)
    ? claim.allowed_domains.filter((x): x is string => typeof x === "string" && x.trim().length > 0)
    : []
  const maxResults = Math.max(5, Math.min(12, Number(claim.required_source_count || 3) * 3))
  const response = await fetch("https://api.tavily.com/search", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      api_key: TAVILY_API_KEY,
      query: claim.research_question,
      search_depth: "advanced",
      max_results: maxResults,
      include_answer: false,
      include_raw_content: false,
      include_domains: allowed.length ? allowed : undefined,
    }),
  })
  const payload = await response.json().catch(() => ({}))
  if (!response.ok) throw new Error(`research_search_failed:${response.status}`)

  const rows = []
  const seen = new Set<string>()
  for (const candidate of (Array.isArray(payload?.results) ? payload.results : []) as TavilyResult[]) {
    if (!candidate.url || !candidate.url.startsWith("https://")) continue
    if (!hostAllowed(candidate.url, allowed)) continue
    if (seen.has(candidate.url)) continue
    seen.add(candidate.url)

    let classification
    try {
      classification = classifySource(candidate.url)
    } catch {
      continue
    }
    const excerpt = String(candidate.content ?? "").replace(/\s+/g, " ").trim().slice(0, 1800)
    rows.push({
      proposal_id: claim.proposal_id,
      url: candidate.url,
      title: candidate.title?.slice(0, 500) ?? null,
      publisher: normalizeHost(new URL(candidate.url).hostname),
      ...classification,
      // R2.1 deliberately does NOT infer support/contradiction from a search snippet.
      // The hardened evidence gate therefore escalates this packet until a certified
      // semantic verifier or human reviewer classifies the source.
      supports_claim: null,
      contradicts_claim: false,
      published_at: candidate.published_date ?? null,
      accessed_at: new Date().toISOString(),
      retrieved_at: new Date().toISOString(),
      evidence_summary: excerpt || null,
      claim_excerpt: excerpt || null,
      content_hash: await sha256(`${candidate.url}\n${excerpt}`),
      verification_method: "tavily_candidate_retrieval_r2_1",
    })
  }
  return rows
}

Deno.serve(async (req: Request) => {
  if (req.method !== "POST") return reply({ error: "method_not_allowed" }, 405)
  if (!SUPABASE_URL || !SERVICE_ROLE_KEY) return reply({ error: "supabase_runtime_config_missing" }, 500)
  if (!TAVILY_API_KEY) return reply({ error: "tavily_key_missing" }, 500)

  // This is an internal Worker Engine executor, not a browser/HQ endpoint.
  // verify_jwt remains enabled at deployment and we additionally require the service token.
  const auth = req.headers.get("Authorization") ?? ""
  if (auth !== `Bearer ${SERVICE_ROLE_KEY}`) return reply({ error: "service_role_required" }, 401)

  const body = await req.json().catch(() => ({})) as { taskId?: string; jobId?: string }
  if (!body.taskId || !body.jobId) return reply({ error: "taskId_and_jobId_required" }, 400)

  let claimed = false
  try {
    const { data: claimData, error: claimError } = await db.rpc("hq_content_research_claim", {
      p_task_id: body.taskId,
      p_job_id: body.jobId,
      p_lease_seconds: 600,
    })
    if (claimError) throw new Error(`claim_failed:${claimError.message}`)
    const claim = claimData as Claim
    if (!claim || claim.decision !== "allow") throw new Error("claim_not_authorized")
    claimed = true

    const sources = await searchSources(claim)
    if (sources.length) {
      const { error: sourceError } = await db
        .from("curriculum_intelligence_sources")
        .upsert(sources, { onConflict: "proposal_id,url" })
      if (sourceError) throw new Error(`source_persist_failed:${sourceError.message}`)
    }

    const { data: researchResult, error: finalizeError } = await db.rpc("finalize_research_job", {
      p_job_id: claim.job_id,
      p_result: {
        executor: "content-research-worker-r2.1",
        discovery_provider: "tavily",
        candidates_persisted: sources.length,
        semantic_classification: "not_automatically_inferred",
      },
    })
    if (finalizeError) throw new Error(`research_finalize_failed:${finalizeError.message}`)

    const { data: taskResult, error: taskError } = await db.rpc("hq_content_research_complete", {
      p_task_id: claim.task_id,
      p_job_id: claim.job_id,
      p_execution_evidence: {
        executor: "content-research-worker-r2.1",
        discovery_provider: "tavily",
        sources_persisted: sources.length,
        domain_result: researchResult,
        no_model_call: true,
      },
    })
    if (taskError) throw new Error(`task_complete_failed:${taskError.message}`)

    return reply({
      ok: true,
      task: taskResult,
      research: researchResult,
      sourcesPersisted: sources.length,
      semanticVerification: "human_or_certified_verifier_required",
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    console.error(message)
    if (claimed) {
      const { error: failError } = await db.rpc("hq_content_research_fail", {
        p_task_id: body.taskId,
        p_job_id: body.jobId,
        p_error: message,
      })
      if (failError) console.error(`failure_record_failed:${failError.message}`)
    }
    return reply({ error: message }, 500)
  }
})
