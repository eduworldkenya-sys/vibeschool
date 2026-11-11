import assert from "node:assert/strict";
import fs from "node:fs";
import { DEMO_OPENINGS, matchDemoOpenings } from "../lib/teacher/tscSandboxMatching.ts";
import { requiredRoleForPath, roleCanVisit } from "../lib/auth-routing.ts";
import { REPORTED_COUNTY_ALLOCATIONS, reportedAllocation } from "../lib/teacher/tsc2026CountyAllocations.ts";

const search = (overrides = {}) =>
  matchDemoOpenings({ level: "secondary", subjectOne: "Mathematics", subjectTwo: "Physics", county: "", ...overrides });

assert.equal(search().ready, true, "valid teaching pair should enable matching");
assert.deepEqual(search().matches.map(item => item.id), ["S-01"], "maths / physics match");
assert.deepEqual(search({ subjectOne: "Physics", subjectTwo: "Mathematics" }).matches.map(item => item.id), ["S-01"], "subject order should not matter");
assert.deepEqual(search({ county: "Kiambu" }).matches, [], "county filter excludes other counties");
assert.deepEqual(search({ county: "Kiambu" }).inOtherCounties.map(item => item.id), ["S-01"], "outside county suggestion should be available");
assert.deepEqual(search({ county: "Murang'a" }).matches.map(item => item.id), ["S-01"], "county match is explicit");
assert.equal(search({ subjectTwo: "" }).ready, false, "missing subject should not imply qualification");
assert.equal(search({ subjectOne: "Physics", subjectTwo: "Physics" }).ready, false, "duplicate subjects are invalid");
assert.deepEqual(search({ level: "primary", subjectOne: "", subjectTwo: "", county: "Kilifi" }).matches.map(item => item.id), ["P-02"], "primary uses level and county");
assert.deepEqual(search({ level: "junior", subjectOne: "Integrated Science", subjectTwo: "Mathematics", county: "Kiambu" }).matches.map(item => item.id), ["J-01"], "junior pair matches");
assert.equal(search({ subjectOne: "Chemistry", subjectTwo: "History" }).matches.length, 0, "no false matches for unlisted pairs");
assert.ok(DEMO_OPENINGS.every(item => item.school.startsWith("Example ")), "all fixtures must visibly use sample school names");


assert.equal(requiredRoleForPath("/teacher/marketplace/sandbox"), null, "sandbox must be accessible anonymously");
assert.equal(requiredRoleForPath("/teacher/marketplace/sandbox/"), null, "trailing slash public");
assert.equal(requiredRoleForPath("/teacher/marketplace/sandbox/other"), "teacher", "no broad role bypass");
assert.equal(requiredRoleForPath("/teacher/marketplace"), "teacher", "real marketplace must stay protected");
assert.equal(requiredRoleForPath("/teacher/pulse"), "teacher", "teacher OS must stay protected");
assert.equal(roleCanVisit(null, "/teacher/marketplace/sandbox"), true, "anonymous sandbox allowed");
assert.equal(roleCanVisit(null, "/teacher/marketplace"), false, "anonymous marketplace denied");

const middleware = fs.readFileSync("middleware.ts", "utf8");
const teacherShell = fs.readFileSync("app/teacher/layout.tsx", "utf8");
assert.ok(middleware.includes("pathname === '/teacher/marketplace/sandbox'"), "middleware must explicitly skip sandbox login");
assert.ok(middleware.indexOf("pathname === '/teacher/marketplace/sandbox'") < middleware.indexOf("createServerClient("),
  "anonymous exception must run before Supabase initialization");
assert.equal((teacherShell.match(/pathname === "\/teacher\/marketplace\/sandbox"/g) ?? []).length, 2,
  "teacher shell must bypass auth both during effect and render");

assert.equal(REPORTED_COUNTY_ALLOCATIONS.length, 47, "all counties must be represented");
assert.equal(new Set(REPORTED_COUNTY_ALLOCATIONS.map(row => row.county)).size, 47, "county unique");
assert.equal(REPORTED_COUNTY_ALLOCATIONS.reduce((a,row) => a + row.primary, 0), 5609, "primary total");
assert.equal(REPORTED_COUNTY_ALLOCATIONS.reduce((a,row) => a + row.secondary, 0), 2086, "secondary total");
assert.equal(reportedAllocation("secondary", "Murang’a").count, 133, "apostrophe normalisation");
assert.equal(reportedAllocation("primary", "Tharaka-Nithi").count, 101, "hyphen normalisation");
assert.equal(reportedAllocation("secondary", "Kiambu").count, 123, "secondary county example");
assert.equal(reportedAllocation("junior", "Kiambu").count, null, "junior county numbers are not inferred");
assert.equal(reportedAllocation("junior", "").count, 25, "junior national total only");
assert.equal(reportedAllocation("secondary", "Unknown").count, null, "unknown county must not be 0");

const root = fs.readFileSync("app/teacher/marketplace/sandbox/page.tsx", "utf8");
const view = fs.readFileSync("app/teacher/marketplace/sandbox/VacancyMatchSandbox.tsx", "utf8");
const css = fs.readFileSync("app/teacher/marketplace/sandbox/sandbox.module.css", "utf8");
assert.match(root, /index: false/, "sandbox cannot be SEO indexed as real vacancies");
assert.match(view, /working demo, not a live vacancy search/i, "demo warning required");
assert.match(view, /reported recruitment allocation/i, "county figures must be distinguished from examples");
assert.match(view, /not a subject-specific match/i, "county numbers must never be labelled as matches");
assert.match(view, /useKenyaCounties/, "reuse canonical county registry");
assert.match(view, /not a real vacancy/i, "every result clearly distinguishes examples");
assert.match(view, /https:\/\/teachersonline\.tsc\.go\.ke\//, "official portal linked");
assert.match(view, /useKenyaCounties/, "reuse canonical counties directory");
assert.match(view, /aria-live="polite"/, "match result updates accessible");
assert.match(css, /max-width:480px/, "mobile small-screen treatment");
for (const token of [".insert(", ".upsert(", ".update(", ".delete(", ".rpc("]) {
  assert.equal(view.includes(token), false, "sandbox cannot write to production tables: " + token);
}

console.log("TSC marketplace sandbox: PASS (matching, order, geography, empty states, demo safeguards and accessibility)");
