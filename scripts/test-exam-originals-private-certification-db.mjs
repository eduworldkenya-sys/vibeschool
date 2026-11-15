import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
const { PGlite } = await import(process.env.WORKBOOK_PGLITE_MODULE || '@electric-sql/pglite')
const db = new PGlite()
const uuid = n => `00000000-0000-0000-0000-${String(n).padStart(12,'0')}`
const owner = uuid(1), nonOwner=uuid(2), definition=uuid(3), assignment=uuid(4)
try {
  await db.exec(`
    create role anon; create role authenticated;
    create schema auth; create schema private;
    create function auth.uid() returns uuid language sql stable as
      $$ select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
    grant usage on schema public,auth to authenticated;
    grant execute on function auth.uid() to authenticated;
    create table public.profiles (id uuid primary key);
    create table public.assessment_definitions(
      id uuid primary key,status text,assessment_type text,
      generation_source text,generation_metadata jsonb
    );
    create table public.assessment_assignments(
      id uuid primary key,assessment_id uuid,status text
    );
    create table public.assessment_attempts(id uuid primary key,assignment_id uuid);
    create table public.assessment_items(
      id uuid primary key,assessment_id uuid,status text,prompt text,
      auto_marking_mode text,correct_answer jsonb,marking_guide jsonb,
      explanation text,worked_solution text,bloom_level text,
      source_exercise_ref jsonb,updated_at timestamptz
    );
    create table public.assessment_item_outcomes(assessment_item_id uuid);
    create table private.original_exam_drafts (
      paper_id text primary key,grade text,subject text,paper jsonb,
      content_state text,review_evidence jsonb,published_at timestamptz,
      publication_receipt jsonb,created_at timestamptz default now(),
      updated_at timestamptz default now()
    );
    create function public.is_platform_owner() returns boolean
      language sql stable security definer as $$ select auth.uid()='${owner}'::uuid $$;
    insert into public.profiles values ('${owner}'),('${nonOwner}');
    insert into public.assessment_definitions values (
      '${definition}','approved','practice','owner_authored_original',
      '{"paper_id":"private-test-001","owner_approved":true}'::jsonb
    );
    insert into public.assessment_assignments values ('${assignment}','${definition}','open');
    insert into public.assessment_assignments values ('${uuid(25)}','${definition}','open');
    insert into public.assessment_items
      select gen_random_uuid(),'${definition}','approved','Question '||n,
        'option_match','"A"'::jsonb,'{}'::jsonb,
        'The correct answer is A because the worked calculation matches.',
        'Check the stated arithmetic step.',null,
        jsonb_build_object('bank_key','G4-P'||n),now()
      from generate_series(1,50) n;
    insert into public.assessment_item_outcomes select id from public.assessment_items;
    insert into private.original_exam_drafts(paper_id,grade,subject,paper,content_state,review_evidence,publication_receipt)
    select 'private-test-001','Grade 4','Mathematics',
      jsonb_build_object(
        'title','VibePapers Test',
        'product_series','papers','paper_number',1,'edition_year',2026,
        'items',(select jsonb_agg(jsonb_build_object(
          'bank_key','G4-P'||n,
          'bloom_level',case when n<=10 then 'remember' when n<=20 then 'understand' else 'apply' end,
          'outcome_code','VS-G4-MA-1.1-01'
        )) from generate_series(1,50) n)
      ),
      'needs_editorial_review','{"public_repository_exposure":"false"}'::jsonb,
      jsonb_build_object('assignment_id','${assignment}');
  `)
  const base=readFileSync('supabase/migrations/20261115063000_exam_originals_catalogue_identity.sql','utf8')
  const sourceStart=base.indexOf('create table if not exists public.exam_original_assignment_series')
  const sourceEnd=base.indexOf('CREATE OR REPLACE FUNCTION public.exq_list_my_assignments')
  assert.ok(sourceStart>=0 && sourceEnd>sourceStart)
  await db.exec(base.slice(sourceStart,sourceEnd))
  const upgrade=readFileSync('supabase/migrations/20261115143000_exam_originals_reviewed_paper_provenance.sql','utf8')
  await db.exec(upgrade)
  const login=async id=>db.exec(`reset role; set request.jwt.claim.sub='${id}'; set role authenticated`)
  const certify=async(number=1)=>db.query(
    'select public.hq_certify_exam_original_assignment($1,$2,$3,$4) result',
    [assignment,'papers',2026,number])
  await login(nonOwner)
  await assert.rejects(()=>certify(),/owner_only_original_certification/)
  await assert.rejects(()=>db.query('select * from public.exam_original_assignment_series'),/permission denied/)
  await login(owner)
  await assert.rejects(()=>certify(),/private_editorial_provenance_required/)
  await db.exec('reset role')
  await db.exec(`
    update private.original_exam_drafts
    set content_state='reviewed',published_at=now(),
      review_evidence=jsonb_build_object(
       'independent_review','passed','public_repository_exposure','false',
       'reviewed_content_md5',md5(paper::text)
      )
    where paper_id='private-test-001';
  `)
  await login(owner)
  await assert.rejects(()=>certify(2),/private_editorial_provenance_required/)
  const receipt=(await certify()).rows[0].result
  assert.equal(receipt.ok,true)
  assert.equal(receipt.series_key,'papers')
  const listed=(await db.query('select public.hq_list_original_exam_drafts() result')).rows[0].result
  assert.equal(listed[0].certified_series,'papers')
  assert.equal(listed[0].assignment_id,assignment)
  assert.equal(listed[0].question_count,50)
  assert.equal(JSON.stringify(listed).includes('Question 1'),false,'list must not leak prompts')
  await db.exec('reset role')
  const { rows }=await db.query('select bloom_level,source_exercise_ref from public.assessment_items')
  assert.equal(rows.length,50)
  assert.ok(rows.every(row=>['remember','understand','apply'].includes(row.bloom_level)))
  assert.ok(rows.every(row=>row.source_exercise_ref.curriculum_candidate_code==='VS-G4-MA-1.1-01'))
  await assert.rejects(
    ()=>db.query(`insert into public.exam_original_assignment_series
      (assignment_id,series_key,edition_year,paper_number,certified_by)
      values ('${uuid(25)}','papers',2026,1,'${owner}')`),
    /unique|duplicate key/i
  )
  console.log('Exam Originals secure certification PASS: owner-only, private-review provenance, 50 cognitive tags, dedupe and no answer leak')
} finally {
  await db.close()
}
