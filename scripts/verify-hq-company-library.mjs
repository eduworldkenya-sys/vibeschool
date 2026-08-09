#!/usr/bin/env node
/**
 * HQ Company Library certification verifier.
 *
 * This script is intentionally read-only. It inspects the connected Supabase
 * database and fails closed when Company Library schema, RLS, storage, RPC
 * privilege, approval, version, or workforce-lineage invariants are missing.
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

  const storagePolicies = report?.storage_policies ?? {}
  for (const operation of ["select", "insert", "update", "delete"]) {
    const count = Number(storagePolicies[`${operation}_policies`] ?? 0)
    if (count > 0) pass(`storage ${operation.toUpperCase()} policy`, `${count} scoped policy/policies`)
    else fail(`storage ${operation.toUpperCase()} policy`, "missing Company Library storage policy")
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

  if (report?.approval_guard?.one_pending_index === true) {
    pass("single pending approval guard", "partial unique index present")
  } else {
    fail("single pending approval guard", "partial unique index missing")
  }

  const zeroIntegrityChecks = [
    ["current-version integrity", "orphan_current_versions", "orphan current_version_id"],
    ["approval version integrity", "cross_artifact_approvals", "cross-artifact approval/version link"],
    ["provenance version integrity", "cross_artifact_provenance", "cross-artifact provenance/version link"],
    ["stale approval integrity", "stale_pending_approvals", "pending approval for a non-current version"],
    ["duplicate approval integrity", "duplicate_pending_approvals", "duplicate pending approval"],
    ["publication approval integrity", "published_without_approved_current", "published artifact without approved current version"],
  ]

  for (const [name, key, description] of zeroIntegrityChecks) {
    const value = report?.integrity?.[key]
    if (value === 0) pass(name, `no ${description}s`)
    else fail(name, `${value ?? "unknown"} ${description}(s)`)
  }

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
