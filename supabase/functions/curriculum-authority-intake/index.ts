import "jsr:@supabase/functions-js/edge-runtime.d.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Content-Type": "application/json",
}
const reply = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: CORS })
const MAX_ARTIFACT_BYTES = 30 * 1024 * 1024
const MAX_OBSERVATIONS_PER_REQUEST = 500

function hex(bytes: Uint8Array) {
  return Array.from(bytes).map((b) => b.toString(16).padStart(2, "0")).join("")
}

function safeArtifactUrl(input: string) {
  const source = new URL(input)
  const host = source.hostname.toLowerCase().replace(/^www\./, "")
  if (host === "drive.google.com") {
    const match = source.pathname.match(/^\/file\/d\/([^/]+)\/(?:preview|view)$/)
    if (!match) throw new Error("unsupported_google_drive_url")
    return `https://drive.usercontent.google.com/download?id=${encodeURIComponent(match[1])}&export=download&confirm=t`
  }
  if (host === "kicd.ac.ke" || host === "drive.usercontent.google.com" || host.endsWith(".googleusercontent.com")) {
    return source.toString()
  }
  throw new Error("artifact_host_not_allowed")
}

async function fetchPdf(input: string) {
  const fetchUrl = safeArtifactUrl(input)
  const response = await fetch(fetchUrl, {
    method: "GET",
    redirect: "follow",
    headers: { "User-Agent": "VibeSchool-CurriculumAuthority/1.0" },
  })
  if (!response.ok) throw new Error(`artifact_fetch_failed:${response.status}`)
  const finalUrl = new URL(response.url)
  const finalHost = finalUrl.hostname.toLowerCase().replace(/^www\./, "")
  if (!(finalHost === "kicd.ac.ke" || finalHost === "drive.usercontent.google.com" || finalHost.endsWith(".googleusercontent.com"))) {
    throw new Error("artifact_redirect_host_not_allowed")
  }
  const length = Number(response.headers.get("content-length") || 0)
  if (length > MAX_ARTIFACT_BYTES) throw new Error("artifact_too_large")
  const bytes = new Uint8Array(await response.arrayBuffer())
  if (!bytes.length || bytes.length > MAX_ARTIFACT_BYTES) throw new Error("artifact_size_invalid")
  if (bytes.length < 5 || String.fromCharCode(...bytes.slice(0, 5)) !== "%PDF-") throw new Error("artifact_not_pdf")
  const digest = new Uint8Array(await crypto.subtle.digest("SHA-256", bytes))
  return { bytes, sha256: hex(digest), fetchUrl, finalUrl: response.url }
}

function requiredText(value: unknown, field: string) {
  const text = typeof value === "string" ? value.trim() : ""
  if (!text) throw new Error(`missing_${field}`)
  return text
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS })
  if (req.method !== "POST") return reply({ error: "method_not_allowed" }, 405)

  try {
    const auth = req.headers.get("Authorization")
    if (!auth) return reply({ error: "Unauthorized" }, 401)

    const url = Deno.env.get("SUPABASE_URL")!
    const anon = Deno.env.get("SUPABASE_ANON_KEY")!
    const service = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    const userDb = createClient(url, anon, { global: { headers: { Authorization: auth } } })
    const db = createClient(url, service)

    const { data: { user }, error: userError } = await userDb.auth.getUser()
    if (userError || !user) return reply({ error: "Unauthorized" }, 401)
    const { data: owner, error: ownerError } = await userDb.rpc("is_platform_owner")
    if (ownerError || !owner) return reply({ error: "HQ platform owner required" }, 403)

    const body = await req.json().catch(() => ({})) as Record<string, unknown>
    const action = requiredText(body.action, "action")

    if (action === "ingest_artifact") {
      const sourceId = requiredText(body.sourceId, "source_id")
      const artifactUrl = requiredText(body.artifactUrl, "artifact_url")
      const { data: source, error: sourceError } = await db
        .from("curriculum_authority_sources")
        .select("id,source_url,source_version,source_published_on,source_status")
        .eq("id", sourceId)
        .maybeSingle()
      if (sourceError) throw sourceError
      if (!source || source.source_status !== "approved") throw new Error("source_not_approved")

      const artifact = await fetchPdf(artifactUrl)
      const path = `${sourceId}/${artifact.sha256}.pdf`
      const upload = await db.storage.from("curriculum-authority-artifacts").upload(path, artifact.bytes, {
        contentType: "application/pdf",
        cacheControl: "31536000",
        upsert: false,
      })
      if (upload.error && !/already exists|duplicate/i.test(upload.error.message)) throw upload.error

      const { data: artifactId, error: artifactError } = await db.rpc("curriculum_authority_register_artifact", {
        p_source_id: sourceId,
        p_source_url: source.source_url,
        p_source_version: source.source_version || "",
        p_source_published_on: source.source_published_on,
        p_content_sha256: artifact.sha256,
        p_storage_locator: `curriculum-authority-artifacts/${path}`,
        p_metadata: {
          fetched_from: artifactUrl,
          resolved_fetch_url: artifact.fetchUrl,
          final_fetch_url: artifact.finalUrl,
          content_type: "application/pdf",
          byte_length: artifact.bytes.length,
          sha256_verified_at: new Date().toISOString(),
          initiated_by: user.id,
        },
      })
      if (artifactError) throw artifactError

      const { data: snapshotId, error: snapshotError } = await db.rpc("curriculum_authority_create_snapshot", {
        p_source_id: sourceId,
        p_artifact_id: artifactId,
      })
      if (snapshotError) throw snapshotError
      return reply({ ok: true, sourceId, artifactId, snapshotId, sha256: artifact.sha256, byteLength: artifact.bytes.length, storagePath: path })
    }

    if (action === "stage_observations") {
      const snapshotId = requiredText(body.snapshotId, "snapshot_id")
      if (!Array.isArray(body.observations) || body.observations.length === 0) throw new Error("observations_required")
      if (body.observations.length > MAX_OBSERVATIONS_PER_REQUEST) throw new Error("too_many_observations")
      const ids: string[] = []
      for (const raw of body.observations as Array<Record<string, unknown>>) {
        const { data: id, error } = await db.rpc("curriculum_authority_add_observation", {
          p_snapshot_id: snapshotId,
          p_observation_key: requiredText(raw.observation_key, "observation_key"),
          p_curriculum_framework: requiredText(raw.curriculum_framework, "curriculum_framework"),
          p_grade: requiredText(raw.grade, "grade"),
          p_subject_label: requiredText(raw.subject_label, "subject_label"),
          p_strand: requiredText(raw.strand, "strand"),
          p_sub_strand: requiredText(raw.sub_strand, "sub_strand"),
          p_topic: typeof raw.topic === "string" ? raw.topic : null,
          p_outcome_text: requiredText(raw.outcome_text, "outcome_text"),
          p_outcome_code: typeof raw.outcome_code === "string" ? raw.outcome_code : null,
          p_outcome_ordinal: Number.isInteger(raw.outcome_ordinal) ? raw.outcome_ordinal : null,
          p_difficulty: typeof raw.difficulty === "string" ? raw.difficulty : null,
          p_competencies: Array.isArray(raw.competencies) ? raw.competencies : [],
          p_values: Array.isArray(raw.values) ? raw.values : [],
          p_key_inquiry_questions: Array.isArray(raw.key_inquiry_questions) ? raw.key_inquiry_questions : [],
          p_suggested_experiences: Array.isArray(raw.suggested_experiences) ? raw.suggested_experiences : [],
          p_assessment_guidance: Array.isArray(raw.assessment_guidance) ? raw.assessment_guidance : [],
          p_source_locator: typeof raw.source_locator === "string" ? raw.source_locator : null,
          p_source_page: typeof raw.source_page === "string" ? raw.source_page : null,
          p_source_section: typeof raw.source_section === "string" ? raw.source_section : null,
          p_raw_payload: raw.raw_payload && typeof raw.raw_payload === "object" ? raw.raw_payload : raw,
        })
        if (error) throw error
        ids.push(String(id))
      }
      return reply({ ok: true, snapshotId, staged: ids.length, observationIds: ids })
    }

    if (action === "seal_reconcile") {
      const snapshotId = requiredText(body.snapshotId, "snapshot_id")
      const sealed = await db.rpc("curriculum_authority_seal_snapshot", { p_snapshot_id: snapshotId })
      if (sealed.error) throw sealed.error
      const reconciled = await db.rpc("curriculum_authority_reconcile_snapshot", { p_snapshot_id: snapshotId })
      if (reconciled.error) throw reconciled.error
      return reply({ ok: true, snapshotId, sealed: sealed.data, reconciled: reconciled.data })
    }

    if (action === "reconcile") {
      const snapshotId = requiredText(body.snapshotId, "snapshot_id")
      const reconciled = await db.rpc("curriculum_authority_reconcile_snapshot", { p_snapshot_id: snapshotId })
      if (reconciled.error) throw reconciled.error
      return reply({ ok: true, snapshotId, reconciled: reconciled.data })
    }

    if (action === "status") {
      const snapshotId = requiredText(body.snapshotId, "snapshot_id")
      const { data: snapshot, error } = await db
        .from("curriculum_authority_snapshots")
        .select("id,status,observation_count,snapshot_sha256,sealed_at,reconciled_at,promoted_at,source_id,artifact_id")
        .eq("id", snapshotId)
        .maybeSingle()
      if (error) throw error
      if (!snapshot) throw new Error("snapshot_not_found")
      const { data: classes, error: classError } = await db
        .from("curriculum_authority_reconciliation")
        .select("classification")
        .eq("snapshot_id", snapshotId)
      if (classError) throw classError
      const counts = (classes || []).reduce<Record<string, number>>((acc, row) => {
        acc[row.classification] = (acc[row.classification] || 0) + 1
        return acc
      }, {})
      return reply({ ok: true, snapshot, classifications: counts })
    }

    return reply({ error: "unknown_action" }, 400)
  } catch (error) {
    console.error("curriculum-authority-intake", error)
    return reply({ error: error instanceof Error ? error.message : String(error) }, 500)
  }
})
