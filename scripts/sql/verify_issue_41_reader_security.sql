-- Issue #41 reader-security regression checks.
-- Run after applying 20260810070000_issue_41_split_vibetextbook_reader_security.sql.
-- This script changes no persistent data. Every row must report PASS.
begin;

create temporary table issue41_reader_ids (
  scenario text primary key,
  publication_id uuid
) on commit drop;

insert into issue41_reader_ids (scenario, publication_id)
select 'published', id
from public.vibe_publications
where format = 'vibetextbook' and status = 'published'
order by created_at
limit 1;

insert into issue41_reader_ids (scenario, publication_id)
select 'non_public', id
from public.vibe_publications
where format = 'vibetextbook' and status <> 'published'
order by created_at
limit 1;

grant select on issue41_reader_ids to anon;

select
  'private_reader_is_security_definer' as test,
  case when p.prosecdef then 'PASS' else 'FAIL' end as result
from pg_proc p
join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public'
  and p.oid = 'public.get_vibetextbook_reader(uuid)'::regprocedure

union all

select
  'public_reader_is_security_invoker',
  case when not p.prosecdef then 'PASS' else 'FAIL' end
from pg_proc p
join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public'
  and p.oid = 'public.get_public_vibetextbook_reader(uuid)'::regprocedure

union all

select
  'anon_cannot_execute_private_reader',
  case
    when not has_function_privilege(
      'anon',
      'public.get_vibetextbook_reader(uuid)',
      'execute'
    ) then 'PASS'
    else 'FAIL'
  end

union all

select
  'anon_can_execute_public_reader',
  case
    when has_function_privilege(
      'anon',
      'public.get_public_vibetextbook_reader(uuid)',
      'execute'
    ) then 'PASS'
    else 'FAIL'
  end

union all

select
  'private_reader_has_fixed_empty_search_path',
  case
    when coalesce(array_to_string(p.proconfig, ','), '') like '%search_path=%'
      and coalesce(array_to_string(p.proconfig, ','), '') not like '%search_path=public%'
    then 'PASS'
    else 'FAIL'
  end
from pg_proc p
where p.oid = 'public.get_vibetextbook_reader(uuid)'::regprocedure

union all

select
  'reader_does_not_serialize_whole_publication_row',
  case
    when pg_get_functiondef(
      'public.get_vibetextbook_reader(uuid)'::regprocedure
    ) not ilike '%to_jsonb(publication_row)%'
    then 'PASS'
    else 'FAIL'
  end

union all

select
  'reader_does_not_join_teacher_derivatives_or_answer_keys',
  case
    when pg_get_functiondef(
      'public.get_vibetextbook_reader(uuid)'::regprocedure
    ) not ilike '%content_derivatives%'
      and pg_get_functiondef(
        'public.get_vibetextbook_reader(uuid)'::regprocedure
      ) not ilike '%generated_assessment_items%'
    then 'PASS'
    else 'FAIL'
  end;

set local role anon;

select
  'anonymous_published_reader_contract' as test,
  case
    when i.publication_id is null then 'SKIP_NO_FIXTURE'
    when (r.payload->>'ok')::boolean
      and r.payload->'publication'->>'status' = 'published'
      and not (r.payload->'publication' ? 'author_id')
      and not (r.payload->'publication' ? 'earnings_ksh')
      and not (r.payload ? 'resume')
        is false -- resume key is allowed but must be null
      and r.payload->'resume' = 'null'::jsonb
    then 'PASS'
    else 'FAIL'
  end as result
from issue41_reader_ids i
cross join lateral (
  select public.get_public_vibetextbook_reader(i.publication_id) as payload
) r
where i.scenario = 'published'

union all

select
  'anonymous_non_public_is_indistinguishable_from_missing',
  case
    when i.publication_id is null then 'SKIP_NO_FIXTURE'
    when public.get_public_vibetextbook_reader(i.publication_id)
      = jsonb_build_object('ok', false, 'reason', 'not_found')
    then 'PASS'
    else 'FAIL'
  end
from issue41_reader_ids i
where i.scenario = 'non_public'

union all

select
  'anonymous_payload_has_no_locked_chapter_bodies',
  case
    when i.publication_id is null then 'SKIP_NO_FIXTURE'
    when not exists (
      select 1
      from jsonb_array_elements(
        public.get_public_vibetextbook_reader(i.publication_id)->'chapters'
      ) chapter
      where chapter->>'status' <> 'published'
         or (
           coalesce((chapter->>'can_read')::boolean, false) = false
           and chapter->'blocks' <> 'null'::jsonb
         )
    )
    then 'PASS'
    else 'FAIL'
  end
from issue41_reader_ids i
where i.scenario = 'published';

reset role;
rollback;
