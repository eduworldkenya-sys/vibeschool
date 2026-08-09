import { serve } from "https://deno.land/std@0.168.0/http/server.ts"

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? ""
const ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY") ?? ""
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
const ANTHROPIC_KEY = Deno.env.get("ANTHROPIC_API_KEY") ?? ""
const MODEL = Deno.env.get("CURRICULUM_INTELLIGENCE_MODEL") ?? "claude-haiku-4-5-20251001"
const CORS = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type" }

type Row = Record<string, unknown>
const row = (v: unknown): Row => v && typeof v === "object" && !Array.isArray(v) ? v as Row : {}
const arr = (v: unknown): unknown[] => Array.isArray(v) ? v : []
const txt = (v: unknown): string => typeof v === "string" ? v : ""
const number = (v: unknown, d = 0) => Number.isFinite(Number(v)) ? Number(v) : d
const reply = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { ...CORS, "Content-Type": "application/json" } })

async function rest(path: string, init: RequestInit = {}) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
    ...init,
    headers: { "Content-Type": "application/json", apikey: SERVICE_KEY, Authorization: `Bearer ${SERVICE_KEY}`, Prefer: "return=representation", ...(init.headers || {}) },
  })
  const data = await res.json().catch(() => null)
  if (!res.ok) throw new Error(txt(row(data).message) || `${path}:${res.status}`)
  return data
}

async function requireOwner(req: Request) {
  const auth = req.headers.get("authorization") ?? ""
  if (!auth.toLowerCase().startsWith("bearer ")) throw new Error("not_authenticated")
  const userRes = await fetch(`${SUPABASE_URL}/auth/v1/user`, { headers: { apikey: ANON_KEY, Authorization: auth } })
  const user = row(await userRes.json().catch(() => ({})))
  const id = txt(user.id)
  if (!userRes.ok || !id) throw new Error("not_authenticated")
  const owners = arr(await rest(`platform_owners?profile_id=eq.${encodeURIComponent(id)}&select=profile_id`))
  if (!owners.length) throw new Error("platform_owner_required")
  return id
}

function due(target: Row) {
  const next = txt(target.next_check_at)
  const last = txt(target.last_checked_at)
  if (!next && !last) return -Infinity
  return new Date(next || last).getTime()
}

async function chooseTarget(id?: string) {
  if (id) {
    const rows = arr(await rest(`curriculum_intelligence_watch_targets?id=eq.${encodeURIComponent(id)}&enabled=eq.true&select=*`)).map(row)
    if (!rows.length) throw new Error("watch_target_not_found")
    return rows[0]
  }
  const rows = arr(await rest("curriculum_intelligence_watch_targets?enabled=eq.true&select=*")).map(row)
  if (!rows.length) throw new Error("no_enabled_watch_targets")
  rows.sort((a, b) => due(a) - due(b))
  return rows[0]
}

async function currentContext(target: Row) {
  const chapterId = txt(target.chapter_id)
  const publicationId = txt(target.publication_id)
  if (chapterId) {
    const ch = arr(await rest(`vibe_chapters?id=eq.${encodeURIComponent(chapterId)}&select=id,title,number,blocks,learning_outcomes,publication_id`)).map(row)[0]
    if (ch) return { kind: "chapter", ...ch }
  }
  if (publicationId) {
    const pub = arr(await rest(`vibe_publications?id=eq.${encodeURIComponent(publicationId)}&select=id,title,description,cbc_subject,cbc_grade,curriculum_framework`)).map(row)[0]
    const chapters = arr(await rest(`vibe_chapters?publication_id=eq.${encodeURIComponent(publicationId)}&select=id,title,number,blocks,learning_outcomes&order=number.asc&limit=30`)).map(row)
    if (pub) return { kind: "publication", publication: pub, chapters }
  }
  return { kind: "watch_only" }
}

function contextText(ctx: Row) {
  if (txt(ctx.kind) === "chapter") {
    const blocks = arr(ctx.blocks).map(row).slice(0, 60).map((b, i) => `${i + 1}. ${txt(b.content).slice(0, 700)}`).join("\n")
    return `Chapter: ${txt(ctx.title)}\nOutcomes: ${JSON.stringify(ctx.learning_outcomes ?? [])}\n${blocks}`.slice(0, 22000)
  }
  if (txt(ctx.kind) === "publication") {
    const pub = row(ctx.publication)
    const chapters = arr(ctx.chapters).map(row).map(ch => `Chapter ${number(ch.number)} ${txt(ch.title)}: ${arr(ch.blocks).map(row).slice(0, 8).map(b => txt(b.content)).join(" ").slice(0, 1000)}`).join("\n")
    return `Publication: ${txt(pub.title)} · ${txt(pub.cbc_grade)} · ${txt(pub.cbc_subject)} · ${txt(pub.curriculum_framework)}\n${chapters}`.slice(0, 22000)
  }
  return "No specific Vibeschool passage is attached. Create only an enrichment/review candidate, not a direct replacement."
}

function parseProposal(raw: string) {
  const tagged = raw.match(/<proposal_json>([\s\S]*?)<\/proposal_json>/i)?.[1] || raw
  try { return row(JSON.parse(tagged.trim().replace(/^```json\s*/i, "").replace(/```\s*$/, ""))) } catch { return null }
}

function urlsFrom(value: unknown, out = new Map<string, Row>()): Map<string, Row> {
  if (Array.isArray(value)) { value.forEach(v => urlsFrom(v, out)); return out }
  if (!value || typeof value !== "object") return out
  const obj = value as Row
  const url = txt(obj.url)
  if (/^https?:\/\//i.test(url)) out.set(url, { url, title: txt(obj.title) || null, evidence_summary: txt(obj.snippet) || null })
  Object.values(obj).forEach(v => urlsFrom(v, out))
  return out
}

function authority(url: string, preferred: string[]) {
  try {
    const host = new URL(url).hostname.replace(/^www\./, "").toLowerCase()
    if (preferred.some(d => host === d || host.endsWith(`.${d}`))) return 0.97
    if (/\.go\.ke$|\.gov\.|\.ac\.ke$|\.edu$|nature\.com$|science\.org$|pubmed\.ncbi\.nlm\.nih\.gov$/.test(host)) return 0.92
    return 0.7
  } catch { return 0.5 }
}

function normalizeType(v: string) {
  if (["curriculum_change","correction","current_update","current_fact_update","enrichment","assessment_update","teacher_guidance","new_content","review_candidate"].includes(v)) return v
  return "review_candidate"
}

async function research(target: Row, ctx: Row) {
  if (!ANTHROPIC_KEY) throw new Error("anthropic_key_missing")
  const preferred = arr(target.preferred_domains).filter((v): v is string => typeof v === "string")
  const prompt = `You are Vibeschool Curriculum Intelligence, a conservative educational research editor for Kenya.
WATCH: ${txt(target.label)} | ${txt(target.grade)} | ${txt(target.subject)}
QUERY: ${txt(target.query)}
PREFERRED AUTHORITIES: ${preferred.join(", ") || "none"}
CURRENT VIBESCHOOL CONTENT:
${contextText(ctx)}

Search the live web. Prefer official curriculum bodies, governments, original research, universities and governing bodies. Verify important claims with at least two credible independent sources when possible. Never claim a KICD/KNEC curriculum change without an official KICD/KNEC source. Distinguish emerging research from established knowledge. Compare new evidence with Vibeschool rather than rewriting content just because an article is newer.

Classify relevance: C0 curriculum-required; C1 factual correction; C2 changed real-world fact/data; C3 strong contemporary enrichment; C4 optional enrichment; C5 irrelevant. Return at most ONE highest-value proposal. If there is no material change, return no_change.

Final response must contain only:
<proposal_json>{"decision":"proposal|no_change","title":"...","claim":"...","current_content":"...","proposed_content":"original learner-facing draft","rationale":"...","proposal_type":"curriculum_change|correction|current_fact_update|enrichment|review_candidate","curriculum_relevance":"C0|C1|C2|C3|C4|C5","confidence":0.0,"verification_status":"verified|insufficient_evidence|disputed|unverified","volatility":"low|medium|high","source_urls":["https://..."],"source_notes":["..."]}</proposal_json>`

  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-api-key": ANTHROPIC_KEY, "anthropic-version": "2023-06-01" },
    body: JSON.stringify({ model: MODEL, max_tokens: 4200, temperature: 0.1, tools: [{ type: "web_search_20250305", name: "web_search", max_uses: 5 }], messages: [{ role: "user", content: prompt }] }),
  })
  const raw = row(await res.json().catch(() => ({})))
  if (!res.ok) throw new Error(`anthropic_web_search_failed:${res.status}:${txt(row(raw.error).message)}`)
  const finalText = arr(raw.content).map(row).filter(b => txt(b.type) === "text").map(b => txt(b.text)).join("\n")
  const proposal = parseProposal(finalText)
  const found = urlsFrom(raw)
  const requested = arr(proposal?.source_urls).filter((v): v is string => typeof v === "string" && /^https?:\/\//.test(v))
  const notes = arr(proposal?.source_notes).filter((v): v is string => typeof v === "string")
  const urls = [...new Set([...requested, ...found.keys()])].slice(0, 12)
  const sources = urls.map((url, i) => ({ proposal_id: null, url, title: found.get(url)?.title || null, publisher: null, source_type: "web", authority_score: authority(url, preferred), supports_claim: true, evidence_summary: notes[i] || found.get(url)?.evidence_summary || null }))
  const usage = row(raw.usage)
  const searchRequests = number(row(usage.server_tool_use).web_search_requests, 0)
  return { proposal, sources, searchRequests }
}

async function sha256(value: string) {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value.toLowerCase().replace(/\s+/g, " ").trim()))
  return Array.from(new Uint8Array(digest)).map(v => v.toString(16).padStart(2, "0")).join("")
}

function nextCheck(cadence: string) {
  const d = new Date()
  if (cadence === "daily") d.setUTCDate(d.getUTCDate() + 1)
  else if (cadence === "monthly") d.setUTCMonth(d.getUTCMonth() + 1)
  else d.setUTCDate(d.getUTCDate() + 7)
  return d.toISOString()
}

serve(async req => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS })
  if (req.method !== "POST") return reply({ error: "method_not_allowed" }, 405)
  let runId = ""
  try {
    if (!SUPABASE_URL || !ANON_KEY || !SERVICE_KEY) throw new Error("supabase_environment_incomplete")
    const userId = await requireOwner(req)
    const body = row(await req.json().catch(() => ({})))
    const target = await chooseTarget(txt(body.targetId) || undefined)
    const runRows = arr(await rest("curriculum_intelligence_runs", { method: "POST", body: JSON.stringify([{ watch_target_id: target.id, status: "running", trigger_type: "manual", started_by: userId, model: MODEL }]) })).map(row)
    runId = txt(runRows[0]?.id)
    if (!runId) throw new Error("run_create_failed")

    const result = await research(target, await currentContext(target))
    const p = result.proposal
    const now = new Date().toISOString()
    await rest(`curriculum_intelligence_watch_targets?id=eq.${encodeURIComponent(txt(target.id))}`, { method: "PATCH", body: JSON.stringify({ last_checked_at: now, next_check_at: nextCheck(txt(target.cadence)), updated_at: now }) })

    if (!p || txt(p.decision) !== "proposal" || txt(p.curriculum_relevance) === "C5") {
      await rest(`curriculum_intelligence_runs?id=eq.${runId}`, { method: "PATCH", body: JSON.stringify({ status: "no_change", completed_at: now, search_requests: result.searchRequests, sources_found: result.sources.length, summary: txt(p?.rationale) || "No material content change found." }) })
      return reply({ ok: true, runId, status: "no_change", target: { id: target.id, label: target.label } })
    }

    const evidenceCount = result.sources.length
    let verification = txt(p.verification_status) || "unverified"
    let confidence = Math.max(0, Math.min(1, number(p.confidence)))
    if (evidenceCount < 2) { if (verification === "verified") verification = "insufficient_evidence"; confidence = Math.min(confidence, 0.6) }
    const relevance = ["C0","C1","C2","C3","C4"].includes(txt(p.curriculum_relevance)) ? txt(p.curriculum_relevance) : "C4"
    const fingerprint = await sha256(`${txt(target.id)}|${txt(p.claim)}|${txt(p.proposed_content).slice(0, 1200)}`)
    const duplicate = arr(await rest(`curriculum_intelligence_proposals?research_fingerprint=eq.${fingerprint}&select=id,status`)).map(row)[0]
    if (duplicate) {
      await rest(`curriculum_intelligence_runs?id=eq.${runId}`, { method: "PATCH", body: JSON.stringify({ status: "duplicate", completed_at: now, search_requests: result.searchRequests, sources_found: evidenceCount, summary: `Duplicate of ${txt(duplicate.id)}` }) })
      return reply({ ok: true, runId, status: "duplicate", proposalId: duplicate.id })
    }

    const inserted = arr(await rest("curriculum_intelligence_proposals", { method: "POST", body: JSON.stringify([{ watch_target_id: target.id, publication_id: txt(target.publication_id) || null, chapter_id: txt(target.chapter_id) || null, proposal_type: normalizeType(txt(p.proposal_type)), title: txt(p.title) || "Curriculum Intelligence proposal", claim: txt(p.claim) || null, current_content: txt(p.current_content) || null, proposed_content: txt(p.proposed_content), patch: { operation: "research_draft", auto_apply: false }, rationale: txt(p.rationale) || "Research-derived editorial candidate.", curriculum_relevance: relevance, confidence, verification_status: verification, volatility: ["low","medium","high"].includes(txt(p.volatility)) ? txt(p.volatility) : "medium", status: "pending_review", generated_by: `curriculum_intelligence_engine:${MODEL}`, engine_run_id: runId, research_fingerprint: fingerprint }]) })).map(row)
    const proposalId = txt(inserted[0]?.id)
    if (!proposalId) throw new Error("proposal_insert_failed")

    if (result.sources.length) await rest("curriculum_intelligence_sources", { method: "POST", body: JSON.stringify(result.sources.map(s => ({ ...s, proposal_id: proposalId }))) })
    await rest("curriculum_intelligence_audit", { method: "POST", body: JSON.stringify([{ proposal_id: proposalId, actor_id: userId, action: "engine_generated", after_state: { relevance, verification, confidence, source_count: evidenceCount }, note: `Generated by ${MODEL} with server-side web search.` }]) })
    await rest(`curriculum_intelligence_runs?id=eq.${runId}`, { method: "PATCH", body: JSON.stringify({ status: "completed", completed_at: now, search_requests: result.searchRequests, proposals_created: 1, sources_found: evidenceCount, summary: txt(p.rationale).slice(0, 1200) }) })
    return reply({ ok: true, runId, status: "completed", proposalId, target: { id: target.id, label: target.label }, relevance, verification, confidence, sourcesFound: evidenceCount })
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e)
    if (runId) await rest(`curriculum_intelligence_runs?id=eq.${runId}`, { method: "PATCH", body: JSON.stringify({ status: "failed", completed_at: new Date().toISOString(), error: message }) }).catch(() => null)
    return reply({ ok: false, runId: runId || null, error: message }, message === "not_authenticated" ? 401 : message === "platform_owner_required" ? 403 : 500)
  }
})
