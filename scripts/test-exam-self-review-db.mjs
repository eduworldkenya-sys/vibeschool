/**
 * Isolated PostgreSQL contract test; no access to production Supabase.
 * CI passes WORKBOOK_PGLITE_MODULE from its pinned isolated test install.
 */
import assert from 'node:assert/strict'
import fs from 'node:fs'
const { PGlite } = await import(process.env.WORKBOOK_PGLITE_MODULE || '@electric-sql/pglite')
const db = new PGlite()
const uuid = number => `00000000-0000-0000-0000-${String(number).padStart(12, '0')}`
const learner = uuid(1)
const stranger = uuid(2)
const student = uuid(3)
const otherStudent = uuid(4)
const assignment = uuid(5)
const embargo = uuid(6)
const future = uuid(7)
const attempt = uuid(8)
const otherAttempt = uuid(9)
const pendingAttempt = uuid(10)
const laterAttempt = uuid(11)
const assessment = uuid(12)
const item = uuid(13)
const response = uuid(14)
const practiceAttempt = uuid(18)
const formalAttempt = uuid(19)
const practiceAssignment = uuid(20)
const practiceResponse = uuid(21)

try {
  await db.exec(`
    create role authenticated;
    create role anon;
    create schema auth;
    create function auth.uid() returns uuid language sql stable
      as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
    grant usage on schema public,auth to authenticated;
    grant execute on function auth.uid() to authenticated;

    create table students(id uuid primary key, profile_id uuid not null);
    create table assessment_assignments(
      id uuid primary key, answer_review_policy text, closes_at timestamptz,
      show_score_policy text
    );
    create table assessment_definitions(id uuid primary key, assessment_type text);
    create table assessment_attempts(
      id uuid primary key, assignment_id uuid, assessment_id uuid,
      student_id uuid, status text, result_status text, submitted_at timestamptz
    );
    create table assessment_items(
      id uuid primary key, assessment_id uuid, question_type text,
      auto_marking_mode text, marking_guide jsonb, marks numeric, order_num integer, prompt text
    );
    create table assessment_responses(
      id uuid primary key, attempt_id uuid, assessment_item_id uuid,
      status text, response_text text, max_score numeric, final_score numeric
    );
    insert into students values
      ('${student}','${learner}'), ('${otherStudent}','${stranger}');
    insert into assessment_definitions values ('${assessment}','practice');
    insert into assessment_assignments values
      ('${assignment}','after_release',null,'after_release'),
      ('${embargo}','never',null,'after_release'),
      ('${future}','after_close',now()+interval '3 days','after_release'),
      ('${practiceAssignment}','after_release',null,'immediate');
    insert into assessment_attempts values
      ('${attempt}','${assignment}','${assessment}','${student}','released','released',now()),
      ('${otherAttempt}','${assignment}','${assessment}','${otherStudent}','released','released',now()),
      ('${pendingAttempt}','${assignment}','${assessment}','${student}','teacher_review','partially_marked',now()),
      ('${laterAttempt}','${future}','${assessment}','${student}','released','released',now()),
      ('${practiceAttempt}','${practiceAssignment}','${assessment}','${student}','teacher_review','partially_marked',now()),
      ('${formalAttempt}','${assignment}','${assessment}','${student}','teacher_review','partially_marked',now());
    insert into assessment_items values
      ('${item}','${assessment}','structured','none',
      '{"criteria":[{"id":"evap","label":"Water evaporates","marks":1},{"id":"cloud","label":"Water vapour cools and condenses","marks":1}]}'::jsonb,2,1,'Describe the water cycle');
    insert into assessment_responses values
      ('${response}','${attempt}','${item}','teacher_review','Water evaporates and rises.',2,0),
      ('${uuid(15)}','${otherAttempt}','${item}','teacher_review','Water rises.',2,0),
      ('${uuid(16)}','${pendingAttempt}','${item}','teacher_review','Water rises.',2,0),
      ('${uuid(17)}','${laterAttempt}','${item}','teacher_review','Water rises.',2,0),
      ('${practiceResponse}','${practiceAttempt}','${item}','teacher_review','Water evaporates.',2,0),
      ('${uuid(22)}','${formalAttempt}','${item}','teacher_review','Water rises.',2,0);
  `)

  const sql = fs.readFileSync('supabase/migrations/20261115040500_exq_learner_self_review.sql','utf8')
  await db.exec(sql)
  await db.exec(fs.readFileSync('supabase/migrations/20261115073000_exq_practice_post_submit_self_review.sql','utf8'))

  async function login(profileId) {
    await db.exec(`reset role; set request.jwt.claim.sub='${profileId}'; set role authenticated`)
  }
  const get = id => db.query('select public.exq_get_my_self_review($1) result',[id])
  const mark = (id, selected, unsure = false) =>
    db.query('select public.exq_set_my_self_review($1,$2,$3,$4) result',[id,item,selected,unsure])

  await login(learner)
  let got = (await get(attempt)).rows[0].result
  assert.equal(got.items.length,1)
  assert.equal(got.items[0].criteria[0].id,'evap')
  assert.equal(got.items[0].prompt,'Describe the water cycle')
  assert.equal(got.items[0].response_text,'Water evaporates and rises.')

  await assert.rejects(() => get(otherAttempt), /attempt_not_owned_or_found/)
  await assert.rejects(() => mark(otherAttempt,['evap']), /attempt_not_owned_or_found/)
  await assert.rejects(() => get(pendingAttempt), /result_not_released/)
  await assert.rejects(() => mark(pendingAttempt,['evap']), /result_not_released/)
  await assert.rejects(() => get(laterAttempt), /answer_review_not_available/)
  await assert.rejects(() => get(formalAttempt), /result_not_released_or_practice_not_submitted/)
  await assert.rejects(() => mark(formalAttempt,['evap']), /result_not_released_or_practice_not_submitted/)
  const practice = (await get(practiceAttempt)).rows[0].result
  assert.equal(practice.items[0].response_text,'Water evaporates.')
  assert.equal((await mark(practiceAttempt,['evap'])).rows[0].result.self_review_score,1)

  let awarded=(await mark(attempt,['evap'])).rows[0].result
  assert.equal(awarded.self_review_score,1)
  assert.equal(awarded.score_authority,'learner_self_assessed_not_verified')
  awarded=(await mark(attempt,['evap','cloud'])).rows[0].result
  assert.equal(awarded.self_review_score,2)
  await assert.rejects(() => mark(attempt,['fake']), /invalid_self_review_selection_or_scheme/)
  await assert.rejects(() => mark(attempt,['evap','evap']), /invalid_self_review_selection_or_scheme/)
  await assert.rejects(() => mark(attempt,['evap'],true), /invalid_self_review_selection/)
  awarded=(await mark(attempt,[],true)).rows[0].result
  assert.equal(awarded.self_review_score,null)
  assert.equal(awarded.unsure,true)

  await assert.rejects(() =>
    db.query('update public.assessment_responses set final_score=2 where id=$1',[response]),
    /permission denied|row-level security/i,
    'authenticated learner cannot directly overwrite verified results'
  )
  await db.exec('reset role')
  const canonical=(await db.query('select final_score, self_review_score, self_review_unsure from public.assessment_responses where id=$1',[response])).rows[0]
  assert.equal(Number(canonical.final_score),0, 'self marks must not alter canonical gradebook score')
  assert.equal(canonical.self_review_score,null)
  assert.equal(canonical.self_review_unsure,true)
  console.log('Released learner-owned self-marking SQL: privacy, rubric and gradebook invariants PASS')
} finally {
  await db.close()
}
