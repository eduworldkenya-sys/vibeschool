-- access: owner-only public.hq_list_original_exam_drafts and public.hq_certify_exam_original_assignment
-- authorization-test: public.hq_certify_exam_original_assignment scripts/test-exam-originals-private-certification-db.mjs
-- EXQ Originals: owner-reviewed private paper -> one certified product.
-- No answer keys or unpublished prompts are included in this migration.
-- Prior-to-attempt requirement is enforced by the preexisting owner RPC.
begin;

-- A paper number identifies one exam in a series and year, not one per assignment.
create unique index if not exists exam_original_series_paper_unique
  on public.exam_original_assignment_series(series_key,edition_year,paper_number);

create or replace function public.hq_certify_exam_original_assignment(
 p_assignment_id uuid, p_series_key text, p_edition_year integer, p_paper_number integer
) returns jsonb language plpgsql security definer set search_path to 'public','pg_temp'
as $fn$
declare
  v_aa public.assessment_assignments%rowtype;
  v_ad public.assessment_definitions%rowtype;
  v_count integer;
  v_bad integer;
  v_tagged integer;
begin
  if auth.uid() is null or not public.is_platform_owner() then
    raise exception 'owner_only_original_certification';
  end if;
  if p_series_key not in ('cat','try','term','papers','mock')
    or p_edition_year not between 2024 and 2100 or p_paper_number<=0
  then raise exception 'invalid_original_series'; end if;

  select * into v_aa from public.assessment_assignments where id=p_assignment_id for update;
  if not found or v_aa.status not in ('assigned','open') then raise exception 'assignment_not_open'; end if;
  select * into v_ad from public.assessment_definitions where id=v_aa.assessment_id;
  if not found or v_ad.status not in ('approved','open') then raise exception 'assessment_not_approved'; end if;

  if not exists (
    select 1 from private.original_exam_drafts d
    where d.paper_id=v_ad.generation_metadata->>'paper_id'
      and v_ad.generation_source='owner_authored_original'
      and v_ad.generation_metadata->>'owner_approved'='true'
      and d.content_state='reviewed' and d.published_at is not null
      and d.review_evidence->>'independent_review'='passed'
      and d.review_evidence->>'public_repository_exposure'='false'
      and d.review_evidence->>'reviewed_content_md5'=md5(d.paper::text)
      and d.publication_receipt->>'assignment_id'=p_assignment_id::text
      and d.paper->>'product_series'=p_series_key
      and d.paper->>'paper_number'=p_paper_number::text
      and d.paper->>'edition_year'=p_edition_year::text
  ) then raise exception 'private_editorial_provenance_required'; end if;

  if exists (select 1 from public.assessment_attempts at where at.assignment_id=v_aa.id) then
    raise exception 'cannot_rebrand_attempted_exam';
  end if;

  select count(*) into v_count from public.assessment_items ai
  where ai.assessment_id=v_ad.id and ai.status='approved';
  if (p_series_key='cat' and v_count<>30)
    or (p_series_key='try' and v_count not between 10 and 15)
    or (p_series_key in ('papers','term') and v_count<>50)
    or (p_series_key='mock' and v_count<10) then
    raise exception 'paper_item_count_mismatch';
  end if;

  -- Preserve cognitive targets in the canonical EXQ items, not a second
  -- question bank. This is permitted only before the first learner attempt.
  update public.assessment_items ai
  set bloom_level=source.item->>'bloom_level',
      source_exercise_ref=coalesce(ai.source_exercise_ref,'{}'::jsonb) ||
        jsonb_build_object('curriculum_candidate_code',source.item->>'outcome_code'),
      updated_at=now()
  from private.original_exam_drafts d,
       lateral jsonb_array_elements(d.paper->'items') as source(item)
  where d.paper_id=v_ad.generation_metadata->>'paper_id'
    and ai.assessment_id=v_ad.id
    and ai.source_exercise_ref->>'bank_key'=source.item->>'bank_key'
    and source.item->>'bloom_level' in ('remember','understand','apply','analyze','evaluate','create')
    and nullif(source.item->>'outcome_code','') is not null;
  get diagnostics v_tagged=ROW_COUNT;
  if v_tagged<>v_count then raise exception 'cognitive_outcome_metadata_incomplete'; end if;

  select count(*) into v_bad
  from public.assessment_items ai
  where ai.assessment_id=v_ad.id and
    (ai.status<>'approved'
      or nullif(btrim(ai.prompt),'') is null
      or not exists (select 1 from public.assessment_item_outcomes aio
        where aio.assessment_item_id=ai.id)
      or (ai.auto_marking_mode<>'none' and ai.correct_answer is null)
      or (ai.auto_marking_mode='none' and not (
        coalesce(jsonb_typeof(ai.marking_guide->'criteria')='array',false)
        and case when jsonb_typeof(ai.marking_guide->'criteria')='array'
          then jsonb_array_length(ai.marking_guide->'criteria') between 1 and 20 else false end
        and not exists (
          select 1 from jsonb_array_elements(
            case when jsonb_typeof(ai.marking_guide->'criteria')='array'
              then ai.marking_guide->'criteria' else '[]'::jsonb end
          ) as guide(point)
          where jsonb_typeof(guide.point)<>'object'
             or jsonb_typeof(guide.point->'id')<>'string'
             or jsonb_typeof(guide.point->'label')<>'string'
             or jsonb_typeof(guide.point->'marks')<>'number'
             or coalesce((guide.point->>'marks')::numeric,0)<=0
        )))
      or (nullif(btrim(coalesce(ai.explanation,'')),'') is null
           and nullif(btrim(coalesce(ai.worked_solution,'')),'') is null));
  if v_bad>0 then raise exception 'paper_quality_gate_failed'; end if;

  insert into public.exam_original_assignment_series
    (assignment_id,series_key,edition_year,paper_number,certified_by,certified_at)
  values (v_aa.id,p_series_key,p_edition_year,p_paper_number,auth.uid(),now())
  on conflict (assignment_id) do update
    set series_key=excluded.series_key, edition_year=excluded.edition_year,
        paper_number=excluded.paper_number, certified_by=excluded.certified_by,
        certified_at=excluded.certified_at;
  return jsonb_build_object('ok',true,'assignment_id',v_aa.id,
    'series_key',p_series_key,'paper_number',p_paper_number);
end;
$fn$;
revoke all on function public.hq_certify_exam_original_assignment(uuid,text,integer,integer) from public, anon;
grant execute on function public.hq_certify_exam_original_assignment(uuid,text,integer,integer) to authenticated;


create or replace function public.hq_list_original_exam_drafts()
returns jsonb language plpgsql security definer
set search_path to 'public', 'private', 'pg_temp'
as $fn$
begin
  if auth.uid() is null or not coalesce(public.is_platform_owner(),false) then
    raise exception 'platform_owner_required' using errcode='42501';
  end if;
  return coalesce((
    select jsonb_agg(jsonb_build_object(
      'id',d.paper_id,'grade',d.grade,'subject',d.subject,
      'title',d.paper->>'title',
      'question_count',jsonb_array_length(d.paper->'items'),
      'status',d.content_state,'published',d.published_at is not null,
      'updated_at',d.updated_at,
      'assignment_id',d.publication_receipt->>'assignment_id',
      'product_series',d.paper->>'product_series',
      'paper_number',d.paper->'paper_number',
      'edition_year',d.paper->'edition_year',
      'certified_series',meta.series_key
    ) order by d.created_at desc)
    from private.original_exam_drafts d
    left join public.exam_original_assignment_series meta
      on meta.assignment_id::text = d.publication_receipt->>'assignment_id'
  ),'[]'::jsonb);
end;
$fn$;
revoke all on function public.hq_list_original_exam_drafts() from public, anon;
grant execute on function public.hq_list_original_exam_drafts() to authenticated;
comment on function public.hq_list_original_exam_drafts() is
  'Owner-only private draft metadata, publication receipt, and certified product identity. Never exposes question text in the list.';

commit;
