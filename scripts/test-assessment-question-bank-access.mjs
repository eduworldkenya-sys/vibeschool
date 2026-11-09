import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const { PGlite } = await import(process.env.WORKBOOK_PGLITE_MODULE || '@electric-sql/pglite')
const db = new PGlite()
const migration = name => readFileSync(new URL(`../supabase/migrations/${name}.sql`, import.meta.url), 'utf8')
const learner = '00000000-0000-4000-8000-000000000001'
const teacher = '00000000-0000-4000-8000-000000000002'

try {
  await db.exec(`
    create role authenticated;
    create role anon;
    create role service_role bypassrls;
    create schema auth;
    grant usage on schema auth to authenticated, anon;
    create function auth.uid() returns uuid language sql stable
      as $$ select nullif(current_setting('test.uid', true), '')::uuid $$;
    create function public.get_my_role() returns text language sql stable
      as $$ select nullif(current_setting('test.role', true), '') $$;
    create function public.is_platform_owner() returns boolean language sql stable
      as $$ select false $$;
    create table public.assessment_questions (
      id uuid primary key default gen_random_uuid(), question_text text, question_type text,
      marks numeric, difficulty text, bloom_level text, competency_tag text, subject_id uuid,
      learning_outcome_id uuid, review_status text, usage_count integer, updated_at timestamptz,
      correct_answer text, author_id uuid
    );
    alter table public.assessment_questions enable row level security;
    grant select on public.assessment_questions to authenticated;
    create policy assessment_questions_teacher_read on public.assessment_questions for select to authenticated
      using (review_status = 'approved' or author_id = auth.uid());
    insert into public.assessment_questions(question_text, review_status, correct_answer, author_id)
      values ('Approved item', 'approved', 'B', '${teacher}'),
             ('Teacher draft', 'draft', 'C', '${teacher}');
  `)
  await db.exec(migration('20260805092030_exq_004c_question_bank_discovery'))
  async function login(id, role) {
    await db.exec(`reset role; set test.uid = '${id}'; set test.role = '${role}'; set role authenticated`)
  }
  const directAnswers = async () =>
    (await db.query('select correct_answer from assessment_questions order by correct_answer')).rows
      .map(row => row.correct_answer)
  const discover = async () => (await db.query('select exq_list_question_bank() as bank')).rows[0].bank.questions

  await login(learner, 'student')
  assert.deepEqual(await directAnswers(), ['B'], 'negative control reproduces learner answer-key exposure')
  assert.equal((await discover()).length, 1)

  await db.exec('reset role')
  await db.exec(migration('20261109123100_restrict_assessment_question_bank_to_staff'))

  await login(learner, 'student')
  assert.deepEqual(await directAnswers(), [])
  await assert.rejects(discover, /question_bank_staff_required/)

  await login(learner, '')
  assert.deepEqual(await directAnswers(), [])
  await assert.rejects(discover, /question_bank_staff_required/)

  await login(teacher, 'teacher')
  assert.deepEqual(await directAnswers(), ['B', 'C'])
  const questions = await discover()
  assert.equal(questions.length, 1)
  assert.equal(questions[0].question_text, 'Approved item')
  assert.equal('correct_answer' in questions[0], false)

  await db.exec('reset role; set role anon')
  await assert.rejects(discover, /permission denied/)
  console.log('Assessment question bank role and answer-key boundaries passed.')
} finally {
  await db.close()
}
