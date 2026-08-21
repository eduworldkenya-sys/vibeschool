import assert from "node:assert/strict"
import { readFileSync } from "node:fs"

const migration = readFileSync(
  "supabase/migrations/20260821214000_repair_hq_billing_overview_contract.sql",
  "utf8",
)
const page = readFileSync("app/hq/billing/page.tsx", "utf8")

assert.match(migration, /b\.created_at\s*\n\s*from public\.billing_subscriptions/)
assert.match(migration, /jsonb_agg\(to_jsonb\(x\) order by x\.created_at desc\)/)
assert.match(migration, /'revenue_30d'/)
assert.match(migration, /revoke all on function public\.hq_billing_overview\(integer\) from public, anon/)
assert.match(migration, /auth\.uid\(\) is null/)
assert.match(migration, /is_platform_owner\(\)/)
assert.match(page, /Billing data unavailable\./)
assert.match(page, /data === null/)
assert.match(page, /Loading account billing records…/)
assert.match(page, /data\.subscriptions\.length > 0/)
assert.doesNotMatch(page, /d\?\.subscriptions\?\.length/)

console.log("HQ billing overview regression contract: PASS")
