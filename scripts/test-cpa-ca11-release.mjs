import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const read = path => readFileSync(path, 'utf8')
const catalogue = read('supabase/migrations/20261115121200_cpa_private_paper_catalogue_and_quiz_gate.sql')
const release = read('supabase/migrations/20261115122500_release_cpa_ca11_intro_unit.sql')
const stage = read('supabase/migrations/20261115115000_stage_cpa_ca11_intro_foundation.sql')
const college = read('app/student/college/page.tsx')
const roadmap = read('app/learn/[courseSlug]/page.tsx')
const reader = read('app/learn/[courseSlug]/[moduleSlug]/[topicSlug]/page.tsx')
const profile = read('lib/learn/ensure-course-learner-profile.ts')

const requireContracts = data => {
  // College catalogued before launch, but only for its authenticated owner.
  assert.match(data.catalogue, /security definer/i)
  assert.match(data.catalogue, /set search_path = public, pg_temp/)
  assert.match(data.catalogue, /v_user is null or not exists/)
  assert.match(data.catalogue, /p\.user_id = v_user/)
  assert.match(data.catalogue, /p\.education_stage = 'post_secondary'/)
  assert.match(data.catalogue, /p\.qualification_code = 'CPA'/)
  assert.match(data.catalogue, /p\.examining_body = 'KASNEB'/)
  assert.match(data.catalogue, /revoke all on function public\.get_my_cpa_paper_catalogue\(\) from public, anon/)
  assert.match(data.catalogue, /grant execute on function public\.get_my_cpa_paper_catalogue\(\) to authenticated/)
  assert.doesNotMatch(data.catalogue, /create policy|disable row level security|grant select on public\.courses|grant select on public\.modules/i)

  // A quiz question may be read only on a published topic belonging to a
  // released course; the answer is submitted to a server-side verifier.
  assert.match(data.catalogue, /t\.content_status = 'published'/)
  assert.match(data.catalogue, /c\.status = 'live'/)
  assert.match(data.catalogue, /select q\.id, q\.question_text/)
  assert.match(data.catalogue, /jsonb_build_object\(/)
  assert.match(data.catalogue, /'id', option_row\.option->>'id'/)
  assert.match(data.catalogue, /'text', option_row\.option->>'text'/)
  assert.match(data.catalogue, /null::text/)
  assert.match(data.catalogue, /q\.correct_option_id = p_option_id/)
  assert.match(data.catalogue, /jsonb_array_elements\(q\.options\)/)
  assert.match(data.catalogue, /opt->>'id' = p_option_id/)
  assert.match(data.catalogue, /revoke all on function public\.get_public_quiz_questions\(uuid\) from public, anon/)
  assert.match(data.catalogue, /revoke all on function public\.submit_quiz_answer\(uuid,text\) from public, anon/)
  assert.doesNotMatch(data.reader, /\.from\('quiz_questions'\)/)
  assert.doesNotMatch(data.reader, /correct_option_id/)
  assert.match(data.reader, /\.rpc\('get_public_quiz_questions'/)
  assert.match(data.reader, /\.rpc\('submit_quiz_answer'/)
  assert.match(data.reader, /result\.is_correct/)
  assert.match(data.reader, /Your answer was not checked/)

  // One existing auth user -> one account-linked legacy course profile.
  assert.match(data.profile, /getUser\(\)/)
  assert.match(data.profile, /user\.id !== userId/)
  assert.match(data.profile, /\.from\('learner_profiles'\)/)
  assert.match(data.profile, /upsert\(\{ id: user\.id \}/)
  assert.match(data.roadmap, /await ensureCourseLearnerProfile\(user\.id\)/)
  assert.match(data.reader, /await ensureCourseLearnerProfile\(user\.id\)/)
  assert.match(data.roadmap, /onConflict: 'learner_id,course_id'/)
  assert.match(data.reader, /onConflict: 'learner_id,topic_id'/)
  assert.doesNotMatch(data.profile, /createUser|signUp|school_id|student_classes/)

  // CPA-only course publishing, precise question count and fail-closed scope.
  assert.match(data.stage, /content_status='in_review'/)
  assert.match(data.release, /slug='kasneb-cpa'/)
  assert.match(data.release, /qualification_code='CPA'/)
  assert.match(data.release, /slug='ca11'/)
  assert.match(data.release, /content_status='in_review'/)
  assert.match(data.release, /v_topic_count <> 3/)
  assert.match(data.release, /v_question_count <> 12/)
  assert.match(data.release, /v_foreign_topics > 0/)
  assert.match(data.release, /v_incorrect_answers <> 0/)
  assert.match(data.release, /t\.content_status='published'|set content_status='published'/)
  assert.match(data.release, /status='live'/)
  assert.doesNotMatch(data.release, /update public\.courses set status='live'\s*;/)
  assert.match(data.college, /\.rpc\('get_my_cpa_paper_catalogue'\)/)
  assert.match(data.college, /savedPaperLive/)
  assert.match(data.roadmap, /grouped\[m\.id\]/)
}

const good = {catalogue,release,stage,college,roadmap,reader,profile}
requireContracts(good)
assert.throws(() => requireContracts({
  ...good,
  catalogue: catalogue.replace("p.user_id = v_user","p.user_id is not null")
}), /p\\.user_id/)
assert.throws(() => requireContracts({
  ...good,
  reader: reader.replace(".rpc('submit_quiz_answer'",".from('quiz_questions'")
}), /submit_quiz_answer/)
assert.throws(() => requireContracts({
  ...good,
  release: release.replace('v_question_count <> 12','v_question_count < 0')
}), /v_question_count/)

console.log('PASS: CPA owner-only paper catalogue, legacy profile identity, safe server-side quiz, guarded first-unit release, negative controls')
