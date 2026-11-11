import assert from "node:assert/strict";
import fs from "node:fs";
import { DEMO_OPENINGS, matchDemoOpenings } from "../lib/teacher/tscSandboxMatching.ts";

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

const root = fs.readFileSync("app/teacher/marketplace/sandbox/page.tsx", "utf8");
const view = fs.readFileSync("app/teacher/marketplace/sandbox/VacancyMatchSandbox.tsx", "utf8");
const css = fs.readFileSync("app/teacher/marketplace/sandbox/sandbox.module.css", "utf8");
assert.match(root, /index: false/, "sandbox cannot be SEO indexed as real vacancies");
assert.match(view, /working demo, not a live vacancy search/i, "demo warning required");
assert.match(view, /not a real vacancy/i, "every result clearly distinguishes examples");
assert.match(view, /https:\/\/teachersonline\.tsc\.go\.ke\//, "official portal linked");
assert.match(view, /useKenyaCounties/, "reuse canonical counties directory");
assert.match(view, /aria-live="polite"/, "match result updates accessible");
assert.match(css, /max-width:480px/, "mobile small-screen treatment");
for (const token of [".insert(", ".upsert(", ".update(", ".delete(", ".rpc("]) {
  assert.equal(view.includes(token), false, "sandbox cannot write to production tables: " + token);
}

console.log("TSC marketplace sandbox: PASS (matching, order, geography, empty states, demo safeguards and accessibility)");
