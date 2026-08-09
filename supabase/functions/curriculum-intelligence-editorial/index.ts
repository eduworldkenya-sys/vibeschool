import "jsr:@supabase/functions-js/edge-runtime.d.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Content-Type": "application/json",
}
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: cors })

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors })
  try {
    const auth = req.headers.get("Authorization")
    if (!auth) return json({ error: "Unauthorized" }, 401)
    const url = Deno.env.get("SUPABASE_URL")!
    const anon = Deno.env.get("SUPABASE_ANON_KEY")!
    const service = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    const userDb = createClient(url, anon, { global: { headers: { Authorization: auth } } })
    const { data: { user }, error: userErr } = await userDb.auth.getUser()
    if (userErr || !user) return json({ error: "Unauthorized" }, 401)
    const { data: isOwner, error: ownerErr } = await userDb.rpc("is_platform_owner")
    if (ownerErr || !isOwner) return json({ error: "HQ platform owner required" }, 403)

    const admin = createClient(url, service)
    const body = await req.json().catch(() => ({}))
    const proposalId = body.proposal_id as string | undefined
    let q = admin.from("curriculum_intelligence_proposals")
      .select("id,status,chapter_id,patch,proposed_content,editorial_status")
      .in("status", ["pending_review", "approved"])
    q = proposalId ? q.eq("id", proposalId) : q.eq("editorial_status", "not_prepared").order("generated_at", { ascending: true }).limit(1)
    const { data: rows, error: pErr } = await q
    if (pErr) throw pErr
    const p = rows?.[0]
    if (!p) return json({ status: "no_work" })
    if (!p.chapter_id) return json({ status: "needs_review", reason: "proposal has no chapter target", proposal_id: p.id })

    const seq = Number(p.patch?.sequence)
    if (!Number.isInteger(seq) || seq < 1) return json({ status: "needs_review", reason: "proposal has no deterministic block sequence", proposal_id: p.id })
    const { data: block, error: bErr } = await admin.from("content_blocks")
      .select("id,legacy_block_id,sequence,plain_text,block_type")
      .eq("chapter_id", p.chapter_id).eq("sequence", seq).maybeSingle()
    if (bErr) throw bErr
    if (!block) return json({ status: "needs_review", reason: "target block not found", proposal_id: p.id })

    const content = String(p.patch?.content || p.proposed_content || "").trim()
    if (!content) return json({ status: "needs_review", reason: "empty proposed content", proposal_id: p.id })
    const { data: derivatives, error: dErr } = await admin.from("content_derivatives")
      .select("id,derivative_type,status").eq("source_chapter_id", p.chapter_id)
    if (dErr) throw dErr
    const impacts = (derivatives || []).map((d: any) => ({ derivative_id: d.id, type: d.derivative_type, current_status: d.status, action: "invalidate_and_regenerate" }))
    const editorialPatch = {
      operation: "replace_block_content", sequence: block.sequence, legacy_block_id: block.legacy_block_id,
      block_id: block.id, block_type: block.block_type, expected_current: block.plain_text || "", content,
      source_proposal_id: p.id, prepared_from: "canonical_content_block",
    }
    const { error: uErr } = await admin.from("curriculum_intelligence_proposals").update({
      editorial_patch: editorialPatch, editorial_status: "prepared", editorial_prepared_at: new Date().toISOString(),
      editorial_model: "deterministic-v1", derivative_impacts: impacts,
    }).eq("id", p.id)
    if (uErr) throw uErr
    return json({ status: "prepared", proposal_id: p.id, target: { chapter_id: p.chapter_id, sequence: block.sequence, legacy_block_id: block.legacy_block_id }, derivative_impacts: impacts.length })
  } catch (e) {
    console.error(e)
    return json({ error: e instanceof Error ? e.message : String(e) }, 500)
  }
})
