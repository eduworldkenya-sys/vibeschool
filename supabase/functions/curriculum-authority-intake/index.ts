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
const MAX_REDIRECTS = 8
const MAX_HTML_BYTES = 512 * 1024

function hex(bytes: Uint8Array) {
  return Array.from(bytes).map((b) => b.toString(16).padStart(2, "0")).join("")
}

function normalizedHost(url: URL) {
  return url.hostname.toLowerCase().replace(/^www\./, "")
}

function isAllowedArtifactHost(url: URL) {
  const host = normalizedHost(url)
  return host === "kicd.ac.ke" ||
    host === "drive.google.com" ||
    host === "drive.usercontent.google.com" ||
    host.endsWith(".googleusercontent.com")
}

function assertAllowedArtifactUrl(url: URL, code = "artifact_host_not_allowed") {
  if (url.protocol !== "https:" || !isAllowedArtifactHost(url)) throw new Error(`${code}:${normalizedHost(url)}`)
}

function googleDriveFileId(input: URL) {
  if (normalizedHost(input) !== "drive.google.com") return null
  const match = input.pathname.match(/^\/file\/d\/([^/]+)(?:\/(?:preview|view))?\/?$/)
  return match?.[1] || null
}

function safeArtifactUrl(input: string) {
  const source = new URL(input)
  assertAllowedArtifactUrl(source)
  const fileId = googleDriveFileId(source)
  if (normalizedHost(source) === "drive.google.com" && !fileId) throw new Error("unsupported_google_drive_url")
  return {
    source,
    fileId,
    fetchUrl: fileId
      ? new URL(`https://drive.usercontent.google.com/download?id=${encodeURIComponent(fileId)}&export=download&confirm=t`)
      : source,
  }
}

async function fetchAllowed(url: URL) {
  let current = new URL(url)
  for (let redirectCount = 0; redirectCount <= MAX_REDIRECTS; redirectCount += 1) {
    assertAllowedArtifactUrl(current, "artifact_redirect_host_not_allowed")
    const response = await fetch(current, {
      method: "GET",
      redirect: "manual",
      headers: {
        "User-Agent": "VibeSchool-CurriculumAuthority/1.1",
        "Accept": "application/pdf,application/octet-stream;q=0.9,text/html;q=0.2,*/*;q=0.1",
      },
    })
    if (response.status >= 300 && response.status < 400) {
      const location = response.headers.get("location")
      if (!location) throw new Error(`artifact_redirect_missing_location:${response.status}`)
      current = new URL(location, current)
      continue
    }
    return { response, finalUrl: current }
  }
  throw new Error("artifact_redirect_limit_exceeded")
}

function htmlInput(html: string, name: string) {
  const escaped = name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
  const patterns = [
    new RegExp(`<input[^>]+name=["']${escaped}["'][^>]+value=["']([^"']+)["']`, "i"),
    new RegExp(`<input[^>]+value=["']([^"']+)["'][^>]+name=["']${escaped}["']`, "i"),
  ]
  for (const pattern of patterns) {
    const match = html.match(pattern)
    if (match?.[1]) return match[1].replace(/&amp;/g, "&")
  }
  return null
}

function htmlFormAction(html: string) {
  return html.match(/<form[^>]+action=["']([^"']+)["']/i)?.[1]?.replace(/&amp;/g, "&") || null
}

async function resolveGoogleDriveConfirmation(response: Response, finalUrl: URL, fileId: string) {
  const contentType = (response.headers.get("content-type") || "").toLowerCase()
  if (!contentType.includes("text/html")) return null
  const contentLength = Number(response.headers.get("content-length") || 0)
  if (contentLength > MAX_HTML_BYTES) throw new Error("artifact_confirmation_too_large")
  const html = await response.text()
  if (new TextEncoder().encode(html).length > MAX_HTML_BYTES) throw new Error("artifact_confirmation_too_large")

  const confirm = htmlInput(html, "confirm")
  const uuid = htmlInput(html, "uuid")
  const id = htmlInput(html, "id") || fileId
  const action = htmlFormAction(html)

  if (!confirm && !action) return null
  const next = action ? new URL(action, finalUrl) : new URL("https://drive.usercontent.google.com/download")
  assertAllowedArtifactUrl(next, "artifact_confirmation_host_not_allowed")
  if (!next.searchParams.has("id")) next.searchParams.set("id", id)
  if (!next.searchParams.has("export")) next.searchParams.set("export", "download")
  if (confirm && !next.searchParams.has("confirm")) next.searchParams.set("confirm", confirm)
  if (uuid && !next.searchParams.has("uuid")) next.searchParams.set("uuid", uuid)
  return next
}

async function responseToPdf(response: Response, finalUrl: URL, fetchUrl: URL) {
  if (!response.ok) throw new Error(`artifact_fetch_failed:${response.status}:${normalizedHost(finalUrl)}`)
  const length = Number(response.headers.get("content-length") || 0)
  if (length > MAX_ARTIFACT_BYTES) throw new Error("artifact_too_large")
  const bytes = new Uint8Array(await response.arrayBuffer())
  if (!bytes.length || bytes.length > MAX_ARTIFACT_BYTES) throw new Error("artifact_size_invalid")
  if (bytes.length < 5 || String.fromCharCode(...bytes.slice(0, 5)) !== "%PDF-") {
    const contentType = response.headers.get("content-type") || "unknown"
    throw new Error(`artifact_not_pdf:${contentType.split(";")[0]}:${normalizedHost(finalUrl)}`)
  }
  const digest = new Uint8Array(await crypto.subtle.digest("SHA-256", bytes))
  return { bytes, sha256: hex(digest), fetchUrl: fetchUrl.toString(), finalUrl: finalUrl.toString() }
}

async function fetchPdf(input: string) {
  const safe = safeArtifactUrl(input)
  const first = await fetchAllowed(safe.fetchUrl)

  if (safe.fileId) {
    const confirmationUrl = await resolveGoogleDriveConfirmation(first.response.clone(), first.finalUrl, safe.fileId)
    if (confirmationUrl) {
      const confirmed = await fetchAllowed(confirmationUrl)
      return responseToPdf(confirmed.response, confirmed.finalUrl, safe.fetchUrl)
    }
  }

  return responseToPdf(first.response, first.finalUrl, safe.fetchUrl)
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
      if (source.source_url !== artifactUrl) throw new Error("artifact_url_must_match_approved_source")

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
    const message = error instanceof Error ? error.message : String(error)
    const safeMessage = message.replace(/[\r\n]/g, " ").slice(0, 500)
    console.error("curriculum-authority-intake", safeMessage)
    return reply({ error: safeMessage, code: safeMessage.split(":")[0] }, 500)
  }
})
