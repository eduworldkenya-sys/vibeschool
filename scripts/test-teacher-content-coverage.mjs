import fs from "node:fs";
import assert from "node:assert/strict";

const lesson = fs.readFileSync("app/teacher/lesson-notes/page.tsx", "utf8");
const authority = fs.readFileSync("supabase/migrations/20260820104000_teacher_content_coverage_authority.sql", "utf8");
const pilot = fs.readFileSync("supabase/migrations/20260820104200_teacher_content_pilot_scope_and_backfill.sql", "utf8");
const telemetry = fs.readFileSync("supabase/migrations/20260820104100_teacher_content_telemetry_contract.sql", "utf8");
const hq = fs.readFileSync("app/hq/content/coverage/page.tsx", "utf8");

function has(text, needle, message) {
  assert.ok(text.includes(needle), message ?? `Missing contract: ${needle}`);
}

has(lesson, '.eq("alignment_status", "verified")', "Curriculum fallback must require verified chapter alignment");
has(lesson, '.eq("status", "published")', "Teacher resources must require published chapter/publication state");
has(lesson, "VibeSchool does not yet have verified material for this lesson.", "Missing-content UX must be explicit");
has(lesson, "curriculum_identity_conflict", "Corrupt identity must fail closed and emit telemetry");
has(lesson, "Locked — access is required", "Entitlement denial must be a visible locked state");
has(lesson, "get_vibetextbook_reader", "Teacher notes must consume canonical reader entitlement authority");
has(lesson, "list_teaching_resources", "Explicit verified lesson links must remain first priority");

has(authority, "verification_state='VERIFIED'", "Teacher-authoritative mappings must require VERIFIED state");
has(authority, "rv.lifecycle_status='certified'", "Teacher-authoritative resources must pin certified versions");
has(authority, "curriculum_resource_mapping_reviews", "Ambiguous mapping review queue is required");
has(authority, "source_type <> 'official'", "Exact outcome mapping must reject non-official outcomes");
has(authority, "manual_unverified", "Unverified manual relationships must remain explicitly distinguishable");

has(pilot, "vc.alignment_status='verified'", "Deterministic backfill may only consume human-verified chapters");
has(pilot, "vp.status='published'", "Deterministic backfill may only consume published publications");
has(pilot, "lr.curriculum_id=lp.curriculum_id", "Backfill must use exact curriculum IDs");
has(pilot, "learning_resource_versions", "Backfill must pin an immutable certified version");

for (const forbidden of ["similarity(", "embedding", "ilike", "levenshtein", "fuzzy", "websearch_to_tsquery"]) {
  assert.ok(!authority.toLowerCase().includes(forbidden), `Authority migration contains forbidden fuzzy matching primitive: ${forbidden}`);
  assert.ok(!pilot.toLowerCase().includes(forbidden), `Pilot mapping migration contains forbidden fuzzy matching primitive: ${forbidden}`);
}

for (const event of [
  "teacher.lesson_notes_opened",
  "teacher.lesson_content_found",
  "teacher.lesson_curriculum_fallback_used",
  "teacher.lesson_content_unavailable",
  "teacher.lesson_content_entitlement_blocked",
  "teacher.lesson_content_broken",
]) has(telemetry, event, `Missing telemetry event ${event}`);

has(hq, "Teacher Content Coverage", "HQ must expose content coverage");
has(hq, "Fuzzy matches never count", "HQ must communicate deterministic truth boundary");
has(hq, "curriculum_resource_mapping_reviews", "HQ must expose ambiguous review backlog");

console.log("Teacher content coverage contract: PASS");
