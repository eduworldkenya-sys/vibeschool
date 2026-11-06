import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const migration = readFileSync("supabase/migrations/20261106180000_hq_geography_commissioning_status.sql","utf8");
const page = readFileSync("app/hq/geography/page.tsx","utf8");

assert.match(migration,/auth\.uid\(\) is null or not coalesce\(public\.is_platform_owner\(\),false\)/);
assert.match(migration,/revoke all on function public\.hq_geography_commissioning_status\(\) from public, anon, authenticated/);
assert.match(migration,/grant execute on function public\.hq_geography_commissioning_status\(\) to authenticated/);
assert.match(migration,/verification_state='verified'/);
assert.match(migration,/legacy_ward_candidates/);
assert.doesNotMatch(migration,/\b(?:insert into|update public\.geo_|delete from public\.geo_)\b/i);
assert.match(page,/supabase\.rpc\("hq_geography_commissioning_status"\)/);
assert.match(page,/No bulk promotion is enabled/);
assert.match(page,/commissioningError/);
console.log("HQ geography commissioning: PASS (owner-only, non-mutating, candidates distinguished)");
