import assert from "node:assert/strict";
import fs from "node:fs";
import { requiredRoleForPath, roleCanVisit } from "../lib/auth-routing.ts";
import { REPORTED_COUNTY_ALLOCATIONS, reportedAllocation } from "../lib/teacher/tsc2026CountyAllocations.ts";

assert.equal(requiredRoleForPath("/teacher/marketplace/sandbox"), null, "public recruitment guide");
assert.equal(requiredRoleForPath("/teacher/marketplace/sandbox/"), null, "trailing slash public");
assert.equal(requiredRoleForPath("/teacher/marketplace/sandbox/other"), "teacher", "no broad role bypass");
assert.equal(requiredRoleForPath("/teacher/marketplace"), null, "public marketplace browsing");
assert.equal(requiredRoleForPath("/teacher/marketplace/"), null, "public trailing slash");
assert.equal(requiredRoleForPath("/teacher/marketplace/manage"), "teacher", "private management protected");
assert.equal(requiredRoleForPath("/teacher/marketplace/manage/"), "teacher", "private trailing slash");
assert.equal(requiredRoleForPath("/teacher/marketplace/other"), "teacher", "no blanket marketplace access");
assert.equal(requiredRoleForPath("/teacher/pulse"), "teacher", "teacher OS protected");
assert.equal(roleCanVisit(null, "/teacher/marketplace/sandbox"), true);
assert.equal(roleCanVisit(null, "/teacher/marketplace"), true);
assert.equal(roleCanVisit(null, "/teacher/marketplace/manage"), false);

const middleware = fs.readFileSync("middleware.ts", "utf8");
const teacherShell = fs.readFileSync("app/teacher/layout.tsx", "utf8");
assert.ok(middleware.includes("pathname === '/teacher/marketplace'"));
assert.ok(middleware.includes("pathname === '/teacher/marketplace/sandbox'"));
assert.ok(middleware.indexOf("pathname === '/teacher/marketplace'") < middleware.indexOf("createServerClient("));
assert.equal((teacherShell.match(/pathname === "\/teacher\/marketplace"/g) ?? []).length, 2);
assert.equal((teacherShell.match(/pathname === "\/teacher\/marketplace\/sandbox"/g) ?? []).length, 2);

const discovery = fs.readFileSync("app/teacher/marketplace/page.tsx", "utf8");
const managed = fs.readFileSync("app/teacher/marketplace/manage/page.tsx", "utf8");
const gateway = fs.readFileSync("app/teacher/page.tsx", "utf8");
const navigation = fs.readFileSync("components/teacher/navigation.ts", "utf8");
const publicOpportunities = fs.readFileSync("components/teacher/marketplace/TeacherOpportunities.tsx", "utf8");
assert.match(discovery, /PublicHeader/);
assert.match(discovery, /PublicFooter/);
assert.match(discovery, /TeacherOpportunities/);
assert.match(discovery, /\/teacher\/marketplace\/sandbox/);
assert.match(discovery, /\/teacher\/marketplace\/manage/);
assert.doesNotMatch(discovery, /getSupabaseClient|\.insert\(|\.update\(|\.delete\(/);
assert.match(managed, /teacher_swap_interests/);
assert.match(managed, /teacher_swap_messages/);
assert.match(gateway, /href="\/teacher\/marketplace"/);
assert.match(navigation, /href: '\/teacher\/marketplace\/manage'/);
assert.match(publicOpportunities, /marketplace\/manage\?swap=/);
assert.ok(gateway.indexOf('href="/teacher/marketplace/sandbox"') < gateway.indexOf('href="/login?redirect=/teacher/pulse"'), "TSC recruitment guide must be the first hero action");
assert.ok(discovery.indexOf('href="/teacher/marketplace/sandbox"') < discovery.indexOf('href="#listings"'), "recruitment guide before listings");

assert.equal(REPORTED_COUNTY_ALLOCATIONS.length, 47);
assert.equal(new Set(REPORTED_COUNTY_ALLOCATIONS.map(row => row.county)).size, 47);
assert.equal(REPORTED_COUNTY_ALLOCATIONS.reduce((a,row) => a + row.primary, 0), 5609);
assert.equal(REPORTED_COUNTY_ALLOCATIONS.reduce((a,row) => a + row.secondary, 0), 2086);
assert.equal(reportedAllocation("secondary", "Murang’a").count, 133);
assert.equal(reportedAllocation("primary", "Tharaka-Nithi").count, 101);
assert.equal(reportedAllocation("secondary", "Kiambu").count, 123);
assert.equal(reportedAllocation("junior", "Kiambu").count, null);
assert.equal(reportedAllocation("junior", "").count, 25);
assert.equal(reportedAllocation("secondary", "Unknown").count, null);

const root = fs.readFileSync("app/teacher/marketplace/sandbox/page.tsx", "utf8");
const view = fs.readFileSync("app/teacher/marketplace/sandbox/VacancyMatchSandbox.tsx", "utf8");
const dataModule = fs.readFileSync("lib/teacher/tscSandboxMatching.ts", "utf8");
const css = fs.readFileSync("app/teacher/marketplace/sandbox/sandbox.module.css", "utf8");
assert.match(root, /index: false/);
assert.match(view, /real recruitment figures, not fictional school vacancies/i);
assert.match(view, /reported recruitment allocation/i);
assert.match(view, /not subject-specific matches|not a list of schools or subject combinations|not subject-specific matches/i);
assert.match(view, /useKenyaCounties/);
assert.match(view, /https:\/\/teachersonline\.tsc\.go\.ke\//);
assert.match(view, /OFFICIAL_TSC_ADVERTS/);
assert.match(view, /applications are free/i);
assert.match(view, /aria-live="polite"/);
assert.match(css, /max-width:480px/);
assert.doesNotMatch(view + dataModule, /DEMO_OPENINGS|Example Secondary School|Example Primary School|Example Junior School|matchDemoOpenings/i);
for(const file of ["app/teacher/page.tsx","app/teacher/marketplace/page.tsx","app/teacher/marketplace/sandbox/VacancyMatchSandbox.tsx","app/pathways/page.tsx","app/pathways/check/page.tsx","app/sandbox/page.tsx","components/public/PublicProductSandbox.tsx"]){
 const value=fs.readFileSync(file, "utf8");
 assert.doesNotMatch(value, /no[- ]login|no[- ]sign[- ]in/i, "avoid access-marketing copy in "+file);
}
for (const token of [".insert(", ".upsert(", ".update(", ".delete(", ".rpc("]) {
  assert.equal(view.includes(token), false, "public recruitment page cannot write to production: " + token);
}
console.log("TSC marketplace: PASS (auth isolation, published allocation totals, no invented school matches, guidance and copy)");
