import fs from "node:fs";
import assert from "node:assert/strict";

const consumers = [
  "app/teacher/marketplace/page.tsx",
  "app/teacher/onboarding/school/page.tsx",
  "app/admin/settings/school/page.tsx",
  "app/hq/schools/intelligence/page.tsx",
  "app/hq/vibetutor/imports/page.tsx",
];
const read = path => fs.readFileSync(path, "utf8");
const picker = read("components/ui/SearchableSelect.tsx");
const registry = read("lib/geography/kenyaCounties.ts");
const migration = read("supabase/migrations/20261106132000_public_canonical_kenya_county_lookup.sql");

assert.match(registry, /rpc\("list_kenya_counties"/);
assert.match(registry, /rows\.length !== 47/);
assert.match(migration, /from public\.geo_counties c/);
assert.match(migration, /revoke all on function public\.list_kenya_counties\(\) from public/);
assert.match(migration, /grant execute on function public\.list_kenya_counties\(\) to anon, authenticated/);
assert.match(picker, /role="combobox"/);
assert.match(picker, /role="listbox"/);
assert.match(picker, /aria-activedescendant/);
assert.match(picker, /ArrowDown/);
assert.match(picker, /Escape/);
assert.match(picker, /Clear \$\{label\}/);

for (const path of consumers) {
  const code = read(path);
  assert.match(code, /useKenyaCounties\(\)/, path + " must use canonical county source");
  assert.match(code, /<SearchableSelect\b/, path + " must use shared picker");
  assert.doesNotMatch(code, /(?:const|let)\s+(?:COUNTIES|KENYAN_COUNTIES|counties)\s*=\s*\[/, path + " must not duplicate counties");
}
const imports = read("app/hq/vibetutor/imports/page.tsx");
assert.match(imports, /parsed\.map\(row => payload\(row, KENYAN_COUNTIES\)\)/);
console.log("Canonical reference selectors: PASS (5 consumers, registry, lookup, accessibility)");
