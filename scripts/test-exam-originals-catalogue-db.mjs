import assert from 'node:assert/strict'
import fs from 'node:fs'
const { PGlite } = await import(process.env.WORKBOOK_PGLITE_MODULE || '@electric-sql/pglite')
const db = new PGlite()
const uuid=n=>`00000000-0000-0000-0000-${String(n).padStart(12,'0')}`
const owner=uuid(1), teacher=uuid(2), definition=uuid(3),assignment=uuid(4)
try {
  await db.exec(`
    create role anon;create role authenticated;create schema auth;
    create function auth.uid() returns uuid language sql stable
      as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
    grant usage on schema auth,public to authenticated;
    grant execute on function auth.uid() to authenticated;
    create table profiles(id uuid primary key);
    create table assessment_definitions(id uuid primary key,status text,assessment_type text);
    create table assessment_assignments(id uuid primary key,assessment_id uuid,status text);
    create table assessment_attempts(id uuid primary key,assignment_id uuid);
    create table assessment_items(
      id uuid primary key,assessment_id uuid,status text,prompt text,
      auto_marking_mode text, correct_answer jsonb,marking_guide jsonb,
      explanation text,worked_solution text);
    create table assessment_item_outcomes(assessment_item_id uuid);
    create function public.is_platform_owner() returns boolean language sql stable security definer
      as $$select auth.uid()='${owner}'::uuid$$;
    insert into profiles values('${owner}'),('${teacher}');
    insert into assessment_definitions values('${definition}','approved','practice');
    insert into assessment_assignments values('${assignment}','${definition}','open');
    insert into assessment_items
      select gen_random_uuid(),'${definition}','approved','Question '||n,
        'numeric_tolerance','45'::jsonb,'{}'::jsonb,'The expected value is 45',null
      from generate_series(1,30) as n;
    insert into assessment_item_outcomes select id from assessment_items;
  `)
  const source=fs.readFileSync('supabase/migrations/20261115063000_exam_originals_catalogue_identity.sql','utf8')
  const start=source.indexOf('create table if not exists public.exam_original_assignment_series')
  const end=source.indexOf('CREATE OR REPLACE FUNCTION public.exq_list_my_assignments')
  if(start<0||end<=start)throw Error('Catalog SQL contract moved; inspect and update fixture')
  await db.exec(source.slice(start,end))
  const certify=(key='cat')=>db.query(
    'select public.hq_certify_exam_original_assignment($1,$2,$3,$4) result',[assignment,key,2026,1])
  const setRole=async id=>db.exec(`reset role;set request.jwt.claim.sub='${id}';set role authenticated`)
  await setRole(teacher)
  await assert.rejects(()=>certify(),/owner_only_original_certification/)
  await assert.rejects(()=>db.query('select * from public.exam_original_assignment_series'),/permission denied/)
  await setRole(owner)
  await assert.rejects(()=>certify('papers'),/paper_item_count_mismatch/)
  const receipt=(await certify()).rows[0].result
  assert.equal(receipt.series_key,'cat')
  await assert.rejects(()=>db.query('select * from public.exam_original_assignment_series'),/permission denied/)
  await db.exec('reset role')
  const rows=(await db.query('select * from public.exam_original_assignment_series')).rows
  assert.equal(rows.length,1)
  assert.equal(rows[0].edition_year,2026)
  await db.exec(`insert into assessment_attempts values('${uuid(11)}','${assignment}')`)
  await setRole(owner)
  await assert.rejects(()=>certify(),/cannot_rebrand_attempted_exam/)
  console.log('Originals catalogue authorisation: nonowner denied, direct read denied, paper count checked, existing attempts locked PASS')
} finally { await db.close() }
