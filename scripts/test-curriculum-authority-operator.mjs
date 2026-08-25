import fs from "node:fs"

const migration = fs.readFileSync("supabase/migrations/20260818133000_curriculum_authority_operator_intake_v1.sql", "utf8")
const fn = fs.readFileSync("supabase/functions/curriculum-authority-intake/index.ts", "utf8")
const page = fs.readFileSync("app/hq/curriculum-authority/page.tsx", "utf8")
const nav = fs.readFileSync("components/hq/HQShell.tsx", "utf8")

const checks = [
  ["private artifact bucket", migration.includes("'curriculum-authority-artifacts'") && migration.includes("false") && migration.includes("application/pdf")],
  ["no browser storage policy", !migration.toLowerCase().includes("create policy")],
  ["owner JWT verified", fn.includes("auth.getUser()") && fn.includes('rpc("is_platform_owner")')],
  ["service role isolated to intake", fn.includes("SUPABASE_SERVICE_ROLE_KEY")],
  ["fetch allow-list", fn.includes("artifact_host_not_allowed") && fn.includes('host === "kicd.ac.ke"') && fn.includes('host === "drive.google.com"')],
  ["redirect allow-list", fn.includes("artifact_redirect_host_not_allowed") && fn.includes("MAX_REDIRECTS") && fn.includes('redirect: "manual"')],
  ["Google Drive confirmation handling", fn.includes("resolveGoogleDriveConfirmation") && fn.includes('htmlInput(html, "confirm")') && fn.includes('htmlInput(html, "uuid")')],
  ["confirmation host remains constrained", fn.includes("artifact_confirmation_host_not_allowed")],
  ["view-only Drive evidence fallback", fn.includes("fetchGoogleDriveViewerPdf") && fn.includes("MAX_VIEWER_PAGES") && fn.includes("artifact_viewer_page_not_png")],
  ["viewer capture provenance is explicit", fn.includes('captureKind: "google_drive_viewer_rendered_pdf"') && fn.includes("source_byte_identical") && fn.includes("viewer_page_count")],
  ["viewer pages become a real PDF", fn.includes("PDFDocument.create()") && fn.includes("pdf.embedPng") && fn.includes("pdf.save")],
  ["approved source URL is immutable at ingest", fn.includes("artifact_url_must_match_approved_source")],
  ["PDF magic gate", fn.includes('!== "%PDF-"')],
  ["artifact size cap", fn.includes("MAX_ARTIFACT_BYTES")],
  ["SHA-256 artifact hash", fn.includes('crypto.subtle.digest("SHA-256"')],
  ["private immutable upload", fn.includes('.storage.from("curriculum-authority-artifacts").upload') && fn.includes("upsert: false")],
  ["canonical artifact RPC", fn.includes('rpc("curriculum_authority_register_artifact"')],
  ["canonical observation RPC", fn.includes('rpc("curriculum_authority_add_observation"')],
  ["service seals/reconciles only", fn.includes('rpc("curriculum_authority_seal_snapshot"') && fn.includes('rpc("curriculum_authority_reconcile_snapshot"') && !fn.includes('rpc("curriculum_authority_promote_snapshot"') && !fn.includes('rpc("curriculum_authority_bind_hierarchy"')],
  ["bounded error disclosure", fn.includes("safeMessage") && fn.includes("slice(0, 500)") && fn.includes("code: safeMessage.split")],
  ["HQ isolated client", page.includes('from "@/lib/hq/supabase"') && !page.includes('from "@/lib/supabase"')],
  ["owner source registration", page.includes('rpc("curriculum_authority_register_source"')],
  ["owner hierarchy binding", page.includes('rpc("curriculum_authority_bind_hierarchy"')],
  ["owner final promotion", page.includes('rpc("curriculum_authority_promote_snapshot"') && page.includes('PROMOTE OFFICIAL')],
  ["placeholder observations rejected", page.includes("Placeholder rows cannot be staged")],
  ["KICD Grade 10 Chemistry canary evidence", page.includes("kicd.ac.ke/cbc-materials/curriculum-designs/grade-ten/#category6") && page.includes("1R293rOfFoxio7GqwY-mVAolmLDnnHnQ2") && page.includes('parent_authority_page: KICD_G10_PURE_SCIENCES_PAGE')],
  ["HQ navigation", nav.includes('"/hq/curriculum-authority"')],
]

let failed = false
for (const [label, pass] of checks) {
  console.log(`${pass ? "PASS" : "FAIL"}  ${label}`)
  if (!pass) failed = true
}
if (failed) process.exit(1)
console.log(`Curriculum Authority operator contract: PASS (${checks.length}/${checks.length})`)
