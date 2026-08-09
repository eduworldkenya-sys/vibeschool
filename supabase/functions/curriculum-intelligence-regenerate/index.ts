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
    let q = admin.from("curriculum_intelligence_regeneration_jobs")
      .select("id,proposal_id,chapter_id,job_type,status,attempt_count")
      .eq("status", "queued").order("created_at", { ascending: true }).limit(1)
    if (proposalId) q = q.eq("proposal_id", proposalId)
    const { data: jobs, error: jErr } = await q
    if (jErr) throw jErr
    const job = jobs?.[0]
    if (!job) return json({ status: "no_work" })

    await admin.from("curriculum_intelligence_regeneration_jobs").update({
      status: "running", started_at: new Date().toISOString(), attempt_count: (job.attempt_count || 0) + 1,
      updated_at: new Date().toISOString(),
    }).eq("id", job.id)

    let result: any = {}
    if (job.job_type === "teacher_notes") {
      const { data: ctx, error: cErr } = await admin.rpc("ce_get_teacher_derivation_context", { p_chapter_id: job.chapter_id })
      if (cErr) throw cErr
      const notes = {
        title: `${ctx.chapter_title || "Unit"} teacher notes`,
        summary: "Regenerated after approved Curriculum Intelligence update.",
        sections: (ctx.blocks || []).filter((b: any) => b.text).slice(0, 24).map((b: any) => ({ heading: b.block_type, body: b.text })),
        keyPoints: (ctx.blocks || []).filter((b: any) => b.text).slice(0, 10).map((b: any) => String(b.text).slice(0, 240)),
        teachingPrompts: ["Ask learners what changed in the updated evidence.", "Separate established knowledge from emerging research where relevant."],
      }
      const { data: saved, error: sErr } = await admin.rpc("ce_save_content_derivative", {
        p_chapter_id: job.chapter_id, p_derivative_type: "teacher_notes", p_title: notes.title, p_body: notes,
        p_class_id: null, p_audience: "teacher", p_generator: "curriculum_intelligence_regenerate",
        p_model: "deterministic-v1", p_quality: { source_grounded: true, regenerated_after_intelligence: true },
      })
      if (sErr) throw sErr
      result = saved
    } else if (job.job_type === "assessment") {
      const { data: blocks, error: bErr } = await admin.from("content_blocks").select("id,plain_text,is_assessable,block_type").eq("chapter_id", job.chapter_id).order("sequence")
      if (bErr) throw bErr
      const questions = (blocks || []).filter((b: any) => b.is_assessable || b.block_type === "question").slice(0, 8).map((b: any, i: number) => ({ n: i + 1, prompt: b.plain_text, source_block_id: b.id }))
      result = { questions, count: questions.length, review_required: true }
    } else if (job.job_type === "project_brief") {
      result = { status: "review_required", reason: "Project regeneration requires teacher/context decision; no automatic classroom task created." }
    } else if (job.job_type === "vibelab_review") {
      const { data: interactives, error: iErr } = await admin.from("content_blocks").select("id,legacy_block_id,block_type,payload").eq("chapter_id", job.chapter_id).eq("block_type", "interactive")
      if (iErr) throw iErr
      result = { interactive_count: (interactives || []).length, interactives: interactives || [], review_required: (interactives || []).length > 0 }
    } else if (job.job_type === "qa") {
      const { data: chapter, error: cErr } = await admin.from("vibe_chapters").select("id,title,blocks,learning_outcomes,word_count,alignment_status").eq("id", job.chapter_id).single()
      if (cErr) throw cErr
      const blocks = Array.isArray(chapter.blocks) ? chapter.blocks : []
      const issues: string[] = []
      if (!blocks.length) issues.push("no_blocks")
      if (!chapter.learning_outcomes?.length) issues.push("no_learning_outcomes")
      if ((chapter.word_count || 0) < 200) issues.push("thin_chapter")
      result = { pass: issues.length === 0, issues, block_count: blocks.length, alignment_status: chapter.alignment_status }
    }

    await admin.from("curriculum_intelligence_regeneration_jobs").update({
      status: "completed", result, completed_at: new Date().toISOString(), updated_at: new Date().toISOString(),
    }).eq("id", job.id)
    return json({ status: "completed", job_id: job.id, job_type: job.job_type, result })
  } catch (e) {
    console.error(e)
    return json({ error: e instanceof Error ? e.message : String(e) }, 500)
  }
})
