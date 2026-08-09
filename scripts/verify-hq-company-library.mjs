#!/usr/bin/env node
/**
 * HQ Company Library certification verifier.
 *
 * This script is intentionally read-only. It inspects the connected Supabase
 * database and fails closed when Company Library schema, RLS, storage, or RPC
 * privilege invariants are missing.
 *
 * Required env:
 *   SUPABASE_URL
 *   SUPABASE_SERVICE_ROLE_KEY
 */

import { createClient } from "@supabase/supabase-js"

const url = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!url || !serviceKey) {
  console.error("HQ Library verifier requires SUPABASE_URL (or NEXT_PUBLIC_SUPABASE_URL) and SUPABASE_SERVICE_ROLE_KEY.")
  process.exit(2)
}

const supabase = createClient(url, serviceKey, {
  auth: { persistSession: false, autoRefreshToken: false },
})

const requiredTables = [
  "hq_artifacts",
  "hq_artifact_versions",
  "hq_artifact_provenance",
  "hq_artifact_approvals",
  "hq_artifact_links",
]

const ownerRpcs = [
  "hq_library_list",
  "hq_library_get",
  "hq_library_create_artifact",
  "hq_library_add_version",
  "hq_library_add_provenance",
  "hq_library_request_approval",
  "hq_library_decide_approval",
  "hq_library_set_lifecycle",
]

const workerRpcs = [
  "hq_library_worker_publish_artifact",
  "hq_library_worker_request_review",
]

const checks = []
const pass = (name, evidence) => checks.push({ name, ok: true, evidence })
const fail = (name, evidence) => checks.push({ name, ok: false, evidence })

async function rpc(name, args = {}) {
  const result = await supabase.rpc(name, args)
  if (result.error) throw new Error(`${name}: ${result.error.message}`)
  return result.data
}

async function main() {
  // The verifier uses a dedicated read-only certification RPC when available.
  // This avoids embedding raw SQL execution in application code.
  let report
  try {
    report = await rpc("hq_library_certification_report")
  } catch (error) {
    fail("certification RPC exists", error instanceof Error ? error.message : String(error))
    printAndExit()
    return
  }

  pass("certification RPC exists", "hq_library_certification_report returned successfully")

  const tableRows = Array.isArray(report?.tables) ? report.tables : []
  for (const table of requiredTables) {
    const row = tableRows.find((item) => item?.table_name === table)
    if (!row) fail(`table ${table}`, "missing")
    else if (row.rls_enabled !== true) fail(`RLS ${table}`, "disabled")
    else if (!(Number(row.policy_count) > 0)) fail(`policies ${table}`, "no RLS policy")
    else pass(`table ${table}`, `RLS enabled; ${row.policy_count} policy/policies`)
  }

  if (report?.storage?.bucket_name === "hq-company-library" && report?.storage?.public === false) {
    pass("private storage bucket", "hq-company-library is private")
  } else {
    fail("private storage bucket", JSON.stringify(report?.storage ?? null))
  }

  const functionRows = Array.isArray(report?.functions) ? report.functions : []
  for (const name of ownerRpcs) {
    const rows = functionRows.filter((item) => item?.function_name === name)
    if (rows.length === 0) {
      fail(`owner RPC ${name}`, "missing")
      continue
    }
    const unsafe = rows.some((row) => row.public_exec === true || row.anon_exec === true)
    const authenticated = rows.some((row) => row.authenticated_exec === true)
    if (unsafe) fail(`owner RPC ${name}`, "PUBLIC/anon execute privilege present")
    else if (!authenticated) fail(`owner RPC ${name}`, "authenticated execute privilege missing")
    else pass(`owner RPC ${name}`, "no PUBLIC/anon execute; authenticated gated by hq_assert_owner")
  }

  for (const name of workerRpcs) {
    const rows = functionRows.filter((item) => item?.function_name === name)
    if (rows.length === 0) {
      fail(`worker RPC ${name}`, "missing")
      continue
    }
    const unsafe = rows.some((row) => row.public_exec === true || row.anon_exec === true || row.authenticated_exec === true)
    const service = rows.some((row) => row.service_role_exec === true)
    if (unsafe) fail(`worker RPC ${name}`, "client role execute privilege present")
    else if (!service) fail(`worker RPC ${name}`, "service_role execute privilege missing")
    else pass(`worker RPC ${name}`, "service_role only")
  }

  if (report?.foreign_keys?.worker_fk === true && report?.foreign_keys?.source_run_fk === true) {
    pass("workforce lineage foreign keys", "worker and source run lineage constrained")
  } else {
    fail("workforce lineage foreign keys", JSON.stringify(report?.foreign_keys ?? null))
  }

  if (report?.integrity?.orphan_current_versions === 0) pass("current-version integrity", "no orphan current_version_id")
  else fail("current-version integrity", `${report?.integrity?.orphan_current_versions ?? "unknown"} orphan(s)`)

  if (report?.integrity?.cross_artifact_approvals === 0) pass("approval version integrity", "no cross-artifact approval/version links")
  else fail("approval version integrity", `${report?.integrity?.cross_artifact_approvals ?? "unknown"} invalid link(s)`)

  if (report?.integrity?.cross_artifact_provenance === 0) pass("provenance version integrity", "no cross-artifact provenance/version links")
  else fail("provenance version integrity", `${report?.integrity?.cross_artifact_provenance ?? "unknown"} invalid link(s)`)

  printAndExit()
}

function printAndExit() {
  console.log("\nHQ Company Library certification\n")
  for (const check of checks) {
    console.log(`${check.ok ? "PASS" : "FAIL"}  ${check.name} — ${check.evidence}`)
  }
  const failed = checks.filter((check) => !check.ok)
  console.log(`\n${checks.length - failed.length}/${checks.length} checks passed.`)
  if (failed.length > 0) process.exit(1)
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
