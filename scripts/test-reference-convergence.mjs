import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
const read = path => readFileSync(path,"utf8");
const migration=read("supabase/migrations/20261106164000_verified_geography_hierarchy_read_models.sql");
assert.match(migration,/s.verification_state = 'verified'/);
assert.match(migration,/w.verification_state = 'verified'/);
assert.match(migration,/grant execute on function public.list_kenya_subcounties\(text\) to anon, authenticated/);
assert.match(migration,/grant execute on function public.list_kenya_wards\(uuid\) to anon, authenticated/);
assert.doesNotMatch(migration,/grant select on public.geo_(?:wards|subcounties)/i);
const state=read("lib/geography/useKenyaLocation.ts");
assert.match(state,/setSelection\(\{ countyCode, subcountyId: "", wardId: "" \}\)/);
assert.match(state,/setSelection\(current => \(\{ ...current, subcountyId, wardId: "" \}\)\)/);
const fields=read("components/geography/KenyaLocationFields.tsx");
for(const label of ["County","Subcounty","Ward"]) assert.match(fields,new RegExp('label="'+label+'"'));
for(const path of ["app/hq/geography/page.tsx","app/hq/schools/page.tsx","app/teacher/TeachingJobs.tsx"]) {
 const code=read(path);
 assert.match(code,/SearchableSelect/,path);
}
assert.match(read("app/teacher/TeachingJobs.tsx"),/normalizeKenyaCounty\(j.county, officialCounties\)/);
console.log("Reference convergence contract: PASS");
