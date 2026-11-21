import assert from "node:assert/strict";
import fs from "node:fs";
import { requiredRoleForPath, roleCanVisit } from "../lib/auth-routing.ts";
import { REPORTED_COUNTY_ALLOCATIONS, reportedAllocation } from "../lib/teacher/tsc2026CountyAllocations.ts";
import { meetsTscRecruitmentMinimum } from "../lib/teacher/tscSandboxMatching.ts";
import { tsc2026MockScore } from "../lib/teacher/tsc2026MockScore.ts";

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
assert.match(discovery, /PremiumTeacherMarketplace/);
assert.match(discovery, /\/teacher\/marketplace\/sandbox/);
const premium = fs.readFileSync("components/teacher/marketplace/PremiumTeacherMarketplace.tsx", "utf8");
for (const contract of ["teacher_vacancies", "vibetutor_open_requests", "teacher_swap_listings", "teacher_employment_directory", "teacher_employment_requests", "teacher_employment_shortlists", "getAdminSchoolAuthority", "requestUrl(", "swapUrl(", "vacancyApplication(", "/teacher/marketplace/manage", "/teacher/marketplace/sandbox"]) {
  assert.ok(premium.includes(contract), "Premium marketplace must keep real canonical integration: " + contract);
}
assert.match(gateway, /PremiumTeacherMarketplace/);
assert.ok(discovery.indexOf("<PremiumTeacherMarketplace />") < discovery.indexOf("<TeacherOpportunities />"), "Real premium workspace comes before secondary legacy tools");
assert.ok(gateway.indexOf("<PremiumTeacherMarketplace />") < gateway.indexOf("<TeacherExperiencePreview />"), "Teacher workspace precedes Teacher OS teaser");
assert.doesNotMatch(discovery, /getSupabaseClient|\.insert\(|\.update\(|\.delete\(/);
assert.match(managed, /teacher_swap_interests/);
assert.match(managed, /teacher_swap_messages/);
assert.match(gateway, /PremiumTeacherMarketplace/);
assert.match(navigation, /href: '\/teacher\/marketplace\/manage'/);
assert.match(publicOpportunities, /marketplace\/manage\?swap=/);
assert.ok(premium.includes('/teacher/marketplace/sandbox') && premium.includes('/login?redirect=/teacher/pulse'), "Official recruitment and Teacher OS are available as secondary destinations");
assert.ok(discovery.includes('TeacherOpportunities') && discovery.includes('PremiumTeacherMarketplace'), "Legacy TSC discovery remains accessible without becoming the primary screen");

// All eight combinations of the three advertised minimum checks.
for (const citizen of [false,true]) for (const qualification of [false,true]) for (const registration of [false,true]) {
  assert.equal(meetsTscRecruitmentMinimum({citizen,qualification,registration}), citizen && qualification && registration);
}
const primaryMock = {level: "primary", qualification: "p1-6-28", ageBand: "primary-50", qualifyingYear: 2010, internship: ""};
const postMock = {level: "secondary", qualification: "degree-top", ageBand: "post-50", qualifyingYear: 2010, internship: "12-plus"};
assert.deepEqual(tsc2026MockScore(primaryMock), {
  qualification: 5, age: 20, qualifyingYear: 75, internship: 0,
  maxQualification: 5, maxAge: 20, maxQualifyingYear: 75, maxInternship: 0,
  total: 100, maximum: 100,
}, "2026 TSC primary maximum 5+20+75");
assert.deepEqual(tsc2026MockScore(postMock), {
  qualification: 3, age: 7, qualifyingYear: 20, internship: 70,
  maxQualification: 3, maxAge: 7, maxQualifyingYear: 20, maxInternship: 70,
  total: 100, maximum: 100,
}, "2026 TSC post-primary maximum 3+7+20+70");
assert.equal(tsc2026MockScore({...primaryMock, qualification:"p1-29-50",ageBand:"primary-44-46",qualifyingYear:2019}).total, 51, "primary 2019 score: 3+10+38");
assert.equal(tsc2026MockScore({...primaryMock, qualifyingYear:2026}).qualifyingYear, 10);
assert.equal(tsc2026MockScore({...primaryMock, qualifyingYear:2011}).qualifyingYear, 70);
assert.equal(tsc2026MockScore({...postMock,qualification:"degree-middle",ageBand:"post-44",qualifyingYear:2019,internship:"under-12"}).total, 66, "post-primary 2+3+11+50");
assert.equal(tsc2026MockScore({...postMock,internship:"none"}).internship, 0);
assert.equal(tsc2026MockScore({...postMock,qualifyingYear:2026}).qualifyingYear, 4);
assert.equal(tsc2026MockScore({...postMock,level:"junior"}).total, 100, "junior uses post-primary rules");
assert.equal(tsc2026MockScore({...postMock,qualification:"p1-6-28"}), null, "P1 alone is not post-primary scoring qualification");
assert.equal(tsc2026MockScore({...postMock,qualifyingYear:2027}), null, "no future year scores");
assert.equal(tsc2026MockScore({...postMock,internship:""}), null, "missing experience is not zero");
assert.equal(tsc2026MockScore({...primaryMock,ageBand:"post-50"}), null, "age bands differ by level");
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
assert.match(view, /county && \(/, "county gates quick eligibility questions");
assert.match(view, /pickerVisible\.map/, "county search and short list must render");
assert.match(view, /function QuickYesNo\(/, "quick Yes-No controls must be reusable");
assert.match(view, /aria-pressed=\{value === answer\}/, "quick answers must expose selection accessibly");
assert.match(view, /type="button" aria-pressed=\{value === answer\}/, "no sensitive actual ID entry is required");
assert.match(view, /Kenyan citizen\?/);
assert.match(view, /TSC registered \/ number\?/);
assert.match(view, /Teaching qualification\?/);
assert.match(view, /National ID\?/);
assert.match(view, /KCPE certificate\?/);
assert.match(view, /KCSE certificate\?/);
assert.match(view, /Teaching certificate\?/);
assert.match(view, /Official transcripts\?/);
assert.match(view, /School leaving certificates\?/);
assert.match(view, /Previously employed by TSC\?/);
assert.match(view, /kcseGrades = \["A", "A-", "B\+", "B", "B-", "C\+", "C"/);
assert.match(view, /id="tsc-kcse-grade"/);
assert.match(view, /answers\.kcse === "yes"/, "show KCSE mean grade only when certificate is declared");
assert.match(view, /answers\.qualification === "yes"/);
assert.match(view, /answers\.registration === "yes"/);
assert.match(view, /meetsTscRecruitmentMinimum\(minimumChecks\)/);
assert.match(view, /tsc2026MockScore\(/, "pure deterministic mock score");
assert.match(view, /mockScore \?/, "mock results render directly from selected values");
assert.match(view, /county && minimumMet \? tsc2026MockScore/, "do not score until minimum self-declarations");
assert.match(view, /disabled|minimumMet/, "level-specific scoring requires qualification checks");
assert.match(view, /No ID or certificate numbers are collected here/, "no identity secrets");
assert.match(view, /no KCSE grade or county bonus marks/i, "KCSE grade and county cannot add score");
assert.match(view, /County figures unavailable/, "do not fabricate junior county totals");
assert.match(view, /Separately|separate|independently/i, "not official TSC selection");
assert.match(view, /window\.setTimeout\(\(\) => setShowNotice\(false\), 2000\)/, "notice auto dismiss");
assert.match(view, /aria-label="Close recruitment notice"/);
assert.doesNotMatch(view, /Calculate mock score|setMockRevealed\(|setStep\(|stepTabs/, "one-screen live mock must not rely on tabs or a Calculate button");
assert.doesNotMatch(view, /input[^>]*name="(idNumber|tscNumber)"/, "only yes/no status, no real identifiers");
assert.match(view, /real recruitment figures, not fictional school vacancies/i);
assert.match(view, /reported recruitment allocation/i);
assert.match(view, /not subject-specific matches|not a list of schools or subject combinations|not subject-specific matches/i);
assert.match(view, /useKenyaCounties/);
assert.match(view, /https:\/\/teachersonline\.tsc\.go\.ke\//);
assert.match(view, /OFFICIAL_TSC_ADVERTS/);
assert.match(view, /applications are free/i);
assert.match(view, /aria-live="polite"/);
assert.match(css, /max-width:480px/);
assert.match(css, /\.pickerList/, "county picker keeps compact mobile grid");
assert.match(css, /\.mockFields/, "mock selection layout exists");
assert.match(view, /const \[countyQuery, setCountyQuery\]/, "county search input must be controlled");
assert.match(view, /rankedCounties/, "county counts must be sorted by the selected teaching level");
assert.match(view, /visibleCounties\.map/, "ranked counties must actually be rendered");
assert.match(view, /showAllCounties \? rankedCounties : rankedCounties\.slice\(0, 8\)/, "top eight by default, all 47 on demand");
assert.match(view, /level === "junior" \? \(/, "junior-school unavailable state instead of fabricated county counts");
assert.match(view, /COUNTY_ALLOCATION_SOURCE/, "show the reported allocation source");
assert.match(view, /not live vacancies remaining/, "do not present allocation counts as unfilled live posts");
assert.match(view, /const timer = window\.setInterval\(update, 30000\)/, "deadline countdown automatically updates");
assert.match(view, /window\.clearInterval\(timer\)/, "deadline countdown must clean up its interval");
assert.match(view, /Date\.parse\("2026-11-23T21:00:00Z"\)/, "countdown is based on Kenya local midnight at end of 23 November");
assert.match(css, /\.countyList\{/, "county list has a responsive layout");
assert.match(css, /\.deadlineClock\{/, "countdown has a dedicated presentation");
assert.doesNotMatch(view + dataModule, /DEMO_OPENINGS|Example Secondary School|Example Primary School|Example Junior School|matchDemoOpenings/i);
for(const file of ["app/teacher/page.tsx","app/teacher/marketplace/page.tsx","app/teacher/marketplace/sandbox/VacancyMatchSandbox.tsx","app/pathways/page.tsx","app/pathways/check/page.tsx","app/sandbox/page.tsx","components/public/PublicProductSandbox.tsx"]){
 const value=fs.readFileSync(file, "utf8");
 assert.doesNotMatch(value, /no[- ]login|no[- ]sign[- ]in/i, "avoid access-marketing copy in "+file);
}
for (const token of [".insert(", ".upsert(", ".update(", ".delete(", ".rpc("]) {
  assert.equal(view.includes(token), false, "public recruitment page cannot write to production: " + token);
}
console.log("TSC marketplace: PASS (auth isolation, published allocation totals, no invented school matches, guidance and copy)");
