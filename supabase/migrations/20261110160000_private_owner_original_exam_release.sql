-- Secure original exam staging. No question text or answer keys are stored in Git.
-- Existing private schema is not exposed to the Supabase Data API.
create table if not exists private.original_exam_drafts (
  paper_id text primary key check (paper_id ~ '^[a-z0-9][a-z0-9_-]{2,79}$'),
  grade text not null,
  subject text not null,
  paper jsonb not null,
  content_state text not null default 'needs_editorial_review'
    check (content_state in ('needs_editorial_review','reviewed','retired')),
  review_evidence jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (jsonb_typeof(paper)='object'),
  check (paper_id=paper->>'id')
);
alter table private.original_exam_drafts add column if not exists published_at timestamptz;
alter table private.original_exam_drafts add column if not exists publication_receipt jsonb not null default '{}'::jsonb;
alter table private.original_exam_drafts enable row level security;
revoke all on private.original_exam_drafts from public,anon,authenticated;

create or replace function public.hq_list_original_exam_drafts()
returns jsonb language plpgsql security definer
set search_path=public,private,pg_temp
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
      'updated_at',d.updated_at
    ) order by d.created_at desc)
    from private.original_exam_drafts d
  ),'[]'::jsonb);
end;
$fn$;
revoke all on function public.hq_list_original_exam_drafts() from public,anon;
grant execute on function public.hq_list_original_exam_drafts() to authenticated;

create or replace function public.hq_publish_staged_original_exam(
  p_paper_id text,p_approved boolean default false
) returns jsonb language plpgsql security definer
set search_path=public,private,pg_temp
as $fn$
declare
  v_draft private.original_exam_drafts%rowtype;
  v_result jsonb;
begin
  if auth.uid() is null or not coalesce(public.is_platform_owner(),false) then
    raise exception 'platform_owner_required' using errcode='42501';
  end if;
  if not p_approved then
    raise exception 'explicit_owner_approval_required' using errcode='42501';
  end if;
  select * into v_draft from private.original_exam_drafts
    where paper_id=p_paper_id for update;
  if not found then raise exception 'private_exam_draft_not_found'; end if;
  if v_draft.published_at is not null then
    return v_draft.publication_receipt;
  end if;
  if v_draft.content_state<>'reviewed'
     or v_draft.review_evidence->>'independent_review'<>'passed' then
    raise exception 'independent_educational_review_required';
  end if;
  if coalesce(v_draft.review_evidence->>'public_repository_exposure','false')<>'false' then
    raise exception 'exposed_answer_key_cannot_be_published';
  end if;
  v_result:=public.hq_publish_original_practice(v_draft.paper,true,true);
  if not coalesce((v_result->>'published')::boolean,false) then
    raise exception 'canonical_original_exam_publication_failed';
  end if;
  update private.original_exam_drafts
    set published_at=now(),publication_receipt=v_result,updated_at=now()
    where paper_id=p_paper_id;
  return v_result;
end;
$fn$;
revoke all on function public.hq_publish_staged_original_exam(text,boolean) from public,anon;
grant execute on function public.hq_publish_staged_original_exam(text,boolean) to authenticated;
