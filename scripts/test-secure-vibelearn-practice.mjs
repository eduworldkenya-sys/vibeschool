import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const read = path => readFileSync(path, "utf8");
const page = read("app/student/vibelearn/practice/page.tsx");
const bank = read("supabase/migrations/20261109123000_secure_independent_topic_practice.sql");
const grounded = read("supabase/migrations/20261109124000_grounded_practice_no_answer_leak.sql");

assert.match(page, /student_list_vibelearn_practice_questions/, "Bank questions must be delivered by scoped RPC");
assert.match(page, /recordVibeLearnPracticeAnswer/, "Verified practice must retain server marking");
assert.match(page, /recordGroundedPracticeAnswer/, "Source practice must retain server marking");
assert.doesNotMatch(page, /\.from\('exam_question_bank'\)/, "No browser table query");
assert.doesNotMatch(page, /correct_index|correctIndex/, "No raw answer keys in practice frontend");
assert.match(page, /Browse published learning units/);
assert.match(bank, /auth\.uid\(\)/);
assert.match(bank, /Learner profile not found/);
assert.match(bank, /provenance_status in \('teacher_verified','publisher_verified','official_verified'\)/);
assert.match(bank, /b\.status='active'/);
assert.match(bank, /revoke execute on function public\.student_list_vibelearn_practice_questions/);
assert.doesNotMatch(bank, /correct_index|explanation/, "Question delivery must not include answers or explanations");
assert.match(grounded, /student_get_grounded_chapter_practice/);
assert.doesNotMatch(grounded, /'answer',case/, "Grounded question delivery must not leak solution text");
assert.match(grounded, /revoke execute on function public\.student_get_grounded_chapter_practice/);
console.log("PASS: VibeLearn practice question delivery is key-free and server-marked");
