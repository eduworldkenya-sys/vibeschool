import assert from 'node:assert/strict'
import fs from 'node:fs'
const { PGlite } = await import(process.env.WORKBOOK_PGLITE_MODULE || '@electric-sql/pglite')
const db = new PGlite()
const uuid = n => `00000000-0000-0000-0000-${String(n).padStart(12,'0')}`
const user=uuid(1), stranger=uuid(2), student=uuid(3), otherStudent=uuid(4)
const definition=uuid(5), formalDefinition=uuid(6)
const practice=uuid(7), formal=uuid(8), forbidden=uuid(9)
const submit=uuid(10), formalAttempt=uuid(11), hiddenAttempt=uuid(12), foreignAttempt=uuid(13), inProgress=uuid(14)
const manual=uuid(15), objective=uuid(16)

try {
  await db.exec(`
    create role anon; create role authenticated; create schema auth;
    create function auth.uid() returns uuid language sql stable
      as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
    grant usage on schema public,auth to authenticated;
    grant execute on function auth.uid() to authenticated;

    create table students(id uuid primary key,profile_id uuid not null);
    create table assessment_definitions(id uuid primary key,title text,status text,assessment_type text);
    create table assessment_assignments(
      id uuid primary key,assessment_id uuid,status text,
      answer_review_policy text,closes_at timestamptz,
      show_score_policy text,show_explanations boolean,show_worked_solutions boolean);
    create table assessment_attempts(
      id uuid primary key,assignment_id uuid,assessment_id uuid,student_id uuid,
      status text,result_status text,submitted_at timestamptz);
    create table assessment_items(
      id uuid primary key,assessment_id uuid,question_type text,
      auto_marking_mode text,marking_guide jsonb,marks numeric,order_num integer,
      status text,prompt text,correct_answer jsonb,explanation text,worked_solution text);
    create table assessment_responses(
      id uuid primary key,attempt_id uuid,assessment_item_id uuid,status text,
      response_text text,response_value jsonb,max_score numeric,final_score numeric,
      auto_score numeric);
    insert into students values('${student}','${user}'),('${otherStudent}','${stranger}');
    insert into assessment_definitions values
      ('${definition}','Rain and numbers','approved','practice'),
      ('${formalDefinition}','Formal exam','approved','exam');
    insert into assessment_assignments values
      ('${practice}','${definition}','open','after_release',null,'immediate',true,true),
      ('${formal}','${formalDefinition}','open','after_release',null,'immediate',true,true),
      ('${forbidden}','${definition}','open','never',null,'immediate',true,true);
    insert into assessment_attempts values
      ('${submit}','${practice}','${definition}','${student}','teacher_review','partially_marked',now()),
      ('${formalAttempt}','${formal}','${formalDefinition}','${student}','teacher_review','partially_marked',now()),
      ('${hiddenAttempt}','${forbidden}','${definition}','${student}','teacher_review','partially_marked',now()),
      ('${foreignAttempt}','${practice}','${definition}','${otherStudent}','teacher_review','partially_marked',now()),
      ('${inProgress}','${practice}','${definition}','${student}','in_progress','pending',null);
    insert into assessment_items values
      ('${manual}','${definition}','structured','none',
       '{"criteria":[{"id":"evap","label":"Evaporation","marks":1},{"id":"cloud","label":"Condensation","marks":1}]}'::jsonb,2,1,'approved',
       'Explain the formation of rain','null'::jsonb,'Water evaporates and condenses',null),
      ('${objective}','${definition}','numeric','numeric_tolerance',
       '{}'::jsonb,1,2,'approved','What is 20 + 25?','45'::jsonb,'20 + 25 = 45',null);
    insert into assessment_responses values
      ('${uuid(20)}','${submit}','${manual}','teacher_review','Water evaporates',
       'null'::jsonb,2,null,null),
      ('${uuid(21)}','${submit}','${objective}','auto_marked','45','45'::jsonb,1,1,1),
      ('${uuid(22)}','${hiddenAttempt}','${manual}','teacher_review','Water evaporates','null'::jsonb,2,null,null),
      ('${uuid(23)}','${foreignAttempt}','${manual}','teacher_review','Water evaporates','null'::jsonb,2,null,null),
      ('${uuid(24)}','${inProgress}','${manual}','draft','Water evaporates','null'::jsonb,2,null,null);
  `)
  await db.exec(fs.readFileSync('supabase/migrations/20261115040500_exq_learner_self_review.sql','utf8'))
  await db.exec(fs.readFileSync('supabase/migrations/20261115062000_exq_practice_immediate_guided_review.sql','utf8'))
  await db.exec(`reset role;set request.jwt.claim.sub='${user}';set role authenticated`)
  const get = id => db.query('select public.exq_get_my_practice_self_review($1) as result',[id])
  const award = (id, ids, unsure=false) => db.query(
    'select public.exq_set_my_self_review($1,$2,$3,$4) as result',[id,manual,ids,unsure])
  const report=(await get(submit)).rows[0].result
  assert.equal(report.verified_score,1)
  assert.equal(report.verified_max,1)
  assert.equal(report.written_max,2)
  assert.equal(report.reviews.length,1)
  assert.equal(report.items.length,2)
  assert.equal(report.items[0].response_text,'Water evaporates')
  assert.equal(report.items[1].correct_answer,45)

  assert.equal((await award(submit,['evap'])).rows[0].result.self_review_score,1)
  assert.equal((await award(submit,['evap','cloud'])).rows[0].result.self_review_score,2)
  await assert.rejects(() => award(submit,['fake']),/invalid_self_review_selection_or_scheme/)
  await assert.rejects(() => award(submit,['evap','evap']),/invalid_self_review_selection_or_scheme/)
  assert.equal((await award(submit,[],true)).rows[0].result.self_review_score,null)

  await assert.rejects(() => get(formalAttempt),/practice_review_not_available/)
  await assert.rejects(() => award(formalAttempt,['evap']),/result_not_released/)
  await assert.rejects(() => get(hiddenAttempt),/answer_review_not_available/)
  await assert.rejects(() => award(hiddenAttempt,['evap']),/answer_review_not_available/)
  await assert.rejects(() => get(foreignAttempt),/attempt_not_owned_or_found/)
  await assert.rejects(() => get(inProgress),/practice_review_not_available/)
  await assert.rejects(() => award(inProgress,['evap']),/result_not_released/)

  await assert.rejects(() => db.query(
    'update public.assessment_responses set final_score=2 where id=$1',[uuid(20)]),
    /permission denied|row-level security/i)
  await db.exec('reset role')
  const raw=(await db.query('select final_score, self_review_score from assessment_responses where id=$1',[uuid(20)])).rows[0]
  assert.equal(raw.final_score,null,'Self-mark may not change teacher/verified marks')
  assert.equal(raw.self_review_score,null,'Not sure must retain unverified status')
  console.log('Immediate practice review: Postgres ownership, embargo, scores, and idempotent learner marking PASS')
} finally { await db.close() }
