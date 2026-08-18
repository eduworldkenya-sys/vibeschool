import "jsr:@supabase/functions-js/edge-runtime.d.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"

const JSON_HEADERS = { "Content-Type": "application/json" }
const reply = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: JSON_HEADERS })

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? ""
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
const TAVILY_API_KEY = Deno.env.get("TAVILY_API_KEY") ?? ""
const db = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, { auth: { persistSession: false, autoRefreshToken: false } })

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
  seed_urls: string[] | null
}

type Candidate = { url: string; title?: string; content?: string; published_date?: string; provider?: string }

const compact = (value: string) => value.replace(/\s+/g, " ").trim()
const normalizeHost = (host: string) => host.toLowerCase().replace(/^www\./, "").replace(/\.$/, "")
const host = (raw: string) => normalizeHost(new URL(raw).hostname)

function isPrivateIpv4(hostname: string) {
  const parts = hostname.split(".").map(Number)
  if (parts.length !== 4 || parts.some((part) => !Number.isInteger(part) || part < 0 || part > 255)) return false
  const [a, b] = parts
  return a === 10 || a === 127 || a === 0 || (a === 169 && b === 254) || (a === 172 && b >= 16 && b <= 31) || (a === 192 && b === 168)
}

function safeHttps(raw: string) {
  const url = new URL(raw)
  if (url.protocol !== "https:" || url.username || url.password) throw new Error("unsafe_url")
  const hostname = url.hostname.toLowerCase()
  if (!hostname || hostname === "localhost" || hostname.endsWith(".localhost") || hostname.endsWith(".local") || hostname === "::1" || hostname.includes(":") || isPrivateIpv4(hostname)) {
    throw new Error("private_url")
  }
  return url
}

function hostAllowed(url: string, allowedDomains: string[]) {
  if (!allowedDomains.length) return true
  const hostname = host(url)
  return allowedDomains.some((raw) => {
    const allowed = normalizeHost(raw.replace(/^https?:\/\//, "").split("/")[0])
    return hostname === allowed || hostname.endsWith(`.${allowed}`)
  })
}

function classify(url: string) {
  const h = host(url)
  if (h.endsWith(".go.ke") || h === "kicd.ac.ke" || h.endsWith(".kicd.ac.ke") || h === "knec.ac.ke" || h.endsWith(".knec.ac.ke")) {
    return { source_type: "official", source_tier: 1, authority_score: 1 }
  }
  if (h.endsWith(".gov") || h.endsWith(".gov.uk") || h.endsWith(".who.int")) {
    return { source_type: "government", source_tier: 1, authority_score: 0.95 }
  }
  if (h === "nature.com" || h.endsWith(".nature.com") || h === "science.org" || h.endsWith(".science.org") || h === "pubmed.ncbi.nlm.nih.gov" || h === "doi.org") {
    return { source_type: "primary_research", source_tier: 2, authority_score: 0.92 }
  }
  if (h.endsWith(".edu") || h.endsWith(".ac.ke") || h.endsWith(".ac.uk")) {
    return { source_type: "academic", source_tier: 2, authority_score: 0.86 }
  }
  return { source_type: "web", source_tier: 4, authority_score: 0.58 }
}

async function sha256(value: string) {
  const bytes = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value))
  return Array.from(new Uint8Array(bytes)).map((b) => b.toString(16).padStart(2, "0")).join("")
}

function htmlText(value: string) {
  return compact(value
    .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, " ")
    .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, " ")
    .replace(/<noscript\b[^>]*>[\s\S]*?<\/noscript>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'"))
}

async function fetchText(rawUrl: string) {
  let current = safeHttps(rawUrl)
  for (let redirect = 0; redirect <= 3; redirect += 1) {
    const response = await fetch(current.toString(), {
      redirect: "manual",
      headers: { "Accept": "text/html,text/plain;q=0.9,*/*;q=0.2", "User-Agent": "VibeSchool-Content-Research/3.1" },
      signal: AbortSignal.timeout(12000),
    })
    if (response.status >= 300 && response.status < 400) {
      const location = response.headers.get("location")
      if (!location || redirect === 3) throw new Error("research_redirect_denied")
      current = safeHttps(new URL(location, current).toString())
      continue
    }
    if (!response.ok) throw new Error(`research_source_fetch_failed:${response.status}`)
    const contentType = (response.headers.get("content-type") ?? "").toLowerCase()
    if (!contentType.includes("text/html") && !contentType.includes("text/plain") && !contentType.includes("application/xhtml+xml")) {
      throw new Error("research_source_content_type_unsupported")
    }
    const raw = (await response.text()).slice(0, 300000)
    const text = contentType.includes("html") || contentType.includes("xhtml") ? htmlText(raw) : compact(raw)
    if (text.length < 40) throw new Error("research_source_material_too_short")
    return { url: current.toString(), text: text.slice(0, 4000) }
  }
  throw new Error("research_source_fetch_unreachable")
}

async function seedCandidates(seedUrls: string[], allowed: string[]): Promise<Candidate[]> {
  const out: Candidate[] = []
  for (const raw of seedUrls.slice(0, 10)) {
    try {
      const safe = safeHttps(raw).toString()
      if (!hostAllowed(safe, allowed)) continue
      const fetched = await fetchText(safe)
      out.push({ url: fetched.url, title: host(fetched.url), content: fetched.text, provider: "trusted_seed_https" })
    } catch (error) {
      console.warn(`seed_source_unavailable:${error instanceof Error ? error.message : String(error)}`)
    }
  }
  return out
}

async function tavilyCandidates(query: string, maxResults: number, allowed: string[]): Promise<Candidate[]> {
  if (!TAVILY_API_KEY) throw new Error("tavily_key_missing")
  const response = await fetch("https://api.tavily.com/search", {
    method: "POST",
    headers: { "Content-Type": "application/json", "Authorization": `Bearer ${TAVILY_API_KEY}` },
    body: JSON.stringify({ query, search_depth: "advanced", max_results: maxResults, include_answer: false, include_raw_content: false, include_domains: allowed.length ? allowed : undefined }),
    signal: AbortSignal.timeout(12000),
  })
  const payload = await response.json().catch(() => ({})) as { results?: Candidate[] }
  if (!response.ok) throw new Error(`tavily:${response.status}`)
  return (Array.isArray(payload.results) ? payload.results : []).map((item) => ({ ...item, provider: "tavily" }))
}

async function publicFallback(query: string, maxResults: number, allowed: string[]): Promise<Candidate[]> {
  const search = new URL("https://html.duckduckgo.com/html/")
  search.searchParams.set("q", query)
  const response = await fetch(search, { headers: { "User-Agent": "VibeSchool-Content-Research/3.1" }, signal: AbortSignal.timeout(12000) })
  if (!response.ok) throw new Error(`public_search:${response.status}`)
  const html = await response.text()
  const urls: string[] = []
  for (const match of html.matchAll(/href=["']([^"']+)["']/gi)) {
    let raw = match[1]
    try {
      if (raw.startsWith("//")) raw = `https:${raw}`
      const parsed = new URL(raw, "https://html.duckduckgo.com")
      const uddg = parsed.searchParams.get("uddg")
      const candidate = uddg ? decodeURIComponent(uddg) : parsed.toString()
      const safe = safeHttps(candidate).toString()
      if (host(safe).includes("duckduckgo.com") || !hostAllowed(safe, allowed) || urls.includes(safe)) continue
      urls.push(safe)
      if (urls.length >= maxResults) break
    } catch { /* ignore malformed search result */ }
  }
  const out: Candidate[] = []
  for (const url of urls) {
    try {
      const fetched = await fetchText(url)
      out.push({ url: fetched.url, title: host(fetched.url), content: fetched.text, provider: "public_https_fallback" })
    } catch { /* fail closed per source */ }
  }
  return out
}

async function collectCandidates(claim: Claim) {
  const allowed = Array.isArray(claim.allowed_domains) ? claim.allowed_domains.filter((x): x is string => typeof x === "string" && x.trim().length > 0) : []
  const seeds = Array.isArray(claim.seed_urls) ? claim.seed_urls.filter((x): x is string => typeof x === "string" && x.startsWith("https://")) : []
  const maxResults = Math.max(5, Math.min(10, Number(claim.required_source_count || 3) * 3))
  const candidates: Candidate[] = await seedCandidates(seeds, allowed)
  const providers = new Set<string>(candidates.map((item) => item.provider ?? "trusted_seed_https"))

  if (candidates.length < claim.required_source_count) {
    try {
      const found = await tavilyCandidates(claim.research_question, maxResults, allowed)
      candidates.push(...found)
      providers.add("tavily")
    } catch (error) {
      console.warn(`tavily_unavailable:${error instanceof Error ? error.message : String(error)}`)
      try {
        const found = await publicFallback(claim.research_question, maxResults, allowed)
        candidates.push(...found)
        providers.add("public_https_fallback")
      } catch (fallbackError) {
        console.warn(`public_search_unavailable:${fallbackError instanceof Error ? fallbackError.message : String(fallbackError)}`)
      }
    }
  }

  return { candidates, provider: Array.from(providers).join("+") || "none", allowed }
}

async function buildRows(claim: Claim) {
  const found = await collectCandidates(claim)
  const rows: Record<string, unknown>[] = []
  const seen = new Set<string>()
  for (const candidate of found.candidates) {
    try {
      const url = safeHttps(candidate.url).toString()
      if (!hostAllowed(url, found.allowed) || seen.has(url)) continue
      seen.add(url)
      const excerpt = compact(String(candidate.content ?? "")).slice(0, 1800)
      if (!excerpt) continue
      rows.push({
        proposal_id: claim.proposal_id,
        url,
        title: candidate.title?.slice(0, 500) ?? null,
        publisher: host(url),
        ...classify(url),
        supports_claim: null,
        contradicts_claim: false,
        published_at: candidate.published_date ?? null,
        accessed_at: new Date().toISOString(),
        retrieved_at: new Date().toISOString(),
        evidence_summary: excerpt,
        claim_excerpt: excerpt,
        content_hash: await sha256(`${url}\n${excerpt}`),
        verification_method: `${candidate.provider ?? found.provider}_candidate_retrieval_r3_1`,
      })
    } catch { /* fail closed per candidate */ }
  }
  return { rows, provider: found.provider }
}

Deno.serve(async (req: Request) => {
  if (req.method !== "POST") return reply({ error: "method_not_allowed" }, 405)
  if (!SUPABASE_URL || !SERVICE_ROLE_KEY) return reply({ error: "supabase_runtime_config_missing" }, 500)
  if ((req.headers.get("Authorization") ?? "") !== `Bearer ${SERVICE_ROLE_KEY}`) return reply({ error: "service_role_required" }, 401)

  const body = await req.json().catch(() => ({})) as { taskId?: string; jobId?: string }
  if (!body.taskId || !body.jobId) return reply({ error: "taskId_and_jobId_required" }, 400)

  let claimed = false
  try {
    const { data, error } = await db.rpc("hq_content_research_claim", { p_task_id: body.taskId, p_job_id: body.jobId, p_lease_seconds: 600 })
    if (error) throw new Error(`claim_failed:${error.message}`)
    const claim = data as Claim
    if (!claim || claim.decision !== "allow") throw new Error("claim_not_authorized")
    claimed = true

    const found = await buildRows(claim)
    if (found.rows.length) {
      const { error: persistError } = await db.from("curriculum_intelligence_sources").upsert(found.rows, { onConflict: "proposal_id,url" })
      if (persistError) throw new Error(`source_persist_failed:${persistError.message}`)
    }

    const { data: researchResult, error: finalizeError } = await db.rpc("finalize_research_job", {
      p_job_id: claim.job_id,
      p_result: { executor: "content-research-worker-r3.1", discovery_provider: found.provider, candidates_persisted: found.rows.length, semantic_classification: "not_automatically_inferred" },
    })
    if (finalizeError) throw new Error(`research_finalize_failed:${finalizeError.message}`)

    const { data: taskResult, error: taskError } = await db.rpc("hq_content_research_complete", {
      p_task_id: claim.task_id,
      p_job_id: claim.job_id,
      p_execution_evidence: { executor: "content-research-worker-r3.1", discovery_provider: found.provider, sources_persisted: found.rows.length, domain_result: researchResult, no_model_call: true },
    })
    if (taskError) throw new Error(`task_complete_failed:${taskError.message}`)

    return reply({ ok: true, task: taskResult, research: researchResult, sourcesPersisted: found.rows.length, provider: found.provider, semanticVerification: "human_or_certified_verifier_required" })
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    console.error(message)
    if (claimed) {
      const { error: failError } = await db.rpc("hq_content_research_fail", { p_task_id: body.taskId, p_job_id: body.jobId, p_error: message })
      if (failError) console.error(`failure_record_failed:${failError.message}`)
    }
    return reply({ error: message }, 500)
  }
})
