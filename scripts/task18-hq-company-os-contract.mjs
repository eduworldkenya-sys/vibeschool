#!/usr/bin/env node
import fs from "node:fs"

const read = path => fs.readFileSync(path, "utf8")
const today = read("app/hq/page.tsx")
const shell = read("components/hq/HQShell.tsx")
const layout = read("app/hq/layout.tsx")
const middleware = read("middleware.ts")
const ownerReport = read("supabase/migrations/20260819221000_hq_operating_system_v2.sql")
const workforceRpc = read("supabase/migrations/20260814155000_worker_engine_we_r1_3_control_room_rpc.sql")

const canonicalNav = [
  ['"Today"','"/hq"'],
  ['"Operations"','"/hq/intelligence"'],
  ['"Decisions"','"/hq/decisions"'],
  ['"Alerts"','"/hq/notifications"'],
  ['"Schools"','"/hq/schools"'],
  ['"People"','"/hq/users"'],
  ['"Product & Learning"','"/hq/analytics"'],
  ['"Growth"','"/hq/marketing"'],
  ['"Finance"','"/hq/billing"'],
  ['"Workforce"','"/hq/workforce"'],
  ['"Security & Controls"','"/hq/security"'],
]

const checks = [
  ["Today is the canonical HQ landing label", shell.includes('["Today","/hq"')],
  ["canonical owner jobs are reachable from primary navigation", canonicalNav.every(([label, href]) => shell.includes(`[${label},${href}`))],
  ["legacy duplicate Workforce navigation labels are removed", !shell.includes('["Teachers","/hq/workforce"') && !shell.includes('["Worker Engine","/hq/workforce"')],
  ["legacy duplicate Security navigation labels are removed", !shell.includes('["Platform Health","/hq/security"') && !shell.includes('["Settings","/hq/security"')],
  ["mobile owner navigation includes Today, decisions, Workforce and alerts", ['["Today","/hq"','["Decide","/hq/decisions"','["Workforce","/hq/workforce"','["Alerts","/hq/notifications"'].every(x => shell.includes(x))],
  ["Today loads independent evidence sources with allSettled", today.includes("Promise.allSettled")],
  ["Today has explicit live/cached/failed evidence states", today.includes('"loading"|"live"|"cached"|"failed"')],
  ["Today explains Unknown is not zero or healthy", today.includes("Unknown means evidence is unavailable or insufficient")],
  ["partial source failure does not collapse the whole Today surface", today.includes("Some HQ evidence sources are unavailable") && !today.includes("for(const result of[r,c,h,d])if(result.error)throw result.error")],
  ["Today aggregates one Needs Attention concept", today.includes("Needs Attention") && today.includes('kind:"Incident"') && today.includes('kind:"Decision"') && today.includes('kind:"Worker"')],
  ["Today integrates the existing Workforce Control Room snapshot", today.includes('hq_workforce_get_control_room_snapshot') && today.includes('href="/hq/workforce"')],
  ["Today keeps Decision Inbox as an authoritative existing surface", today.includes('href="/hq/decisions"') && today.includes('hq_workforce_list_decisions')],
  ["Today integrates the existing HQ Twin without granting hidden authority", today.includes("HQTwinDrawer") && today.includes("Ask HQ Twin")],
  ["Today avoids the prior fabricated region split", !today.includes("learners*.23") && !today.includes("learners*.14") && !today.includes("learners*.11")],
  ["Today avoids prior hard-coded subject mastery fallbacks", !today.includes("??85") && !today.includes("??78") && !today.includes("??72") && !today.includes("??68") && !today.includes("??64")],
  ["Today labels learning activity as activity, not effectiveness", today.includes("Activity, not effectiveness")],
  ["Today never equates payment initiation with revenue", today.includes("Never STK initiation")],
  ["HQ layout verifies owner authority before rendering protected client surfaces", layout.includes('hq_check_owner_access') && layout.includes('allowed')],
  ["HQ browser auth remains isolated from ordinary app auth", read("lib/hq/supabase.ts").includes('storageKey: "vibeschool-hq-auth"')],
  ["HQ routes remain private/no-store at middleware boundary", middleware.includes("pathname.startsWith('/hq')") && middleware.includes("private, no-store")],
  ["seven-day owner report asserts owner inside the database boundary", ownerReport.includes("perform public.hq_assert_owner();")],
  ["seven-day owner report revokes public and anon execution", ownerReport.includes("revoke all on function public.hq_get_seven_day_owner_report() from public, anon")],
  ["Control Room RPC is database-owner-gated", workforceRpc.includes("hq_assert_owner")],
  ["Today keeps consequential operating-cycle action on the existing governed RPC", today.includes('hq_run_operating_cycle')],
  ["Today is responsive for mobile owner operation", today.includes("@media(max-width:720px)") && shell.includes("hq-bottom-nav")],
]

const failures = checks.filter(([, ok]) => !ok)
for (const [name, ok] of checks) console.log(`${ok ? "PASS" : "FAIL"} ${name}`)
console.log(`\nTask 18 HQ Company OS contract: ${checks.length - failures.length}/${checks.length} checks passed.`)
if (failures.length) process.exit(1)
