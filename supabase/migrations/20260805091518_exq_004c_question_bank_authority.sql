begin;

alter table public.assessment_questions
  add column if not exists school_id uuid null references public.schools(id) on delete cascade,
  add column if not exists subject_id uuid null references public.subjects(id) on delete set null,
  add column if not exists learning_outcome_id uuid null references public.curriculum_learning_outcomes(id) on delete set null,
  add column if not exists source_assessment_item_id uuid null references public.assessment_items(id) on delete set null,
  add column if not exists parent_question_id uuid null references public.assessment_questions(id) on delete set null,
  add column if not exists version integer not null default 1,
  add column if not exists marks numeric not null default 1,
  add column if not exists bloom_level text null,
  add column if not exists accepted_answers jsonb not null default '[]'::jsonb,
  add column if not exists marking_guide jsonb not null default '{}'::jsonb,
  add column if not exists explanation text null,
  add column if not exists fingerprint text null,
  add column if not exists review_status text not null default 'draft',
  add column if not exists reviewed_by uuid null references auth.users(id) on delete set null,
  add column if not exists reviewed_at timestamptz null,
  add column if not exists usage_count integer not null default 0,
  add column if not exists last_used_at timestamptz null;

alter table public.assessment_questions
  drop constraint if exists assessment_questions_version_chk,
  add constraint assessment_questions_version_chk check (version > 0),
  drop constraint if exists assessment_questions_marks_chk,
  add constraint assessment_questions_marks_chk check (marks > 0),
  drop constraint if exists assessment_questions_usage_count_chk,
  add constraint assessment_questions_usage_count_chk check (usage_count >= 0),
  drop constraint if exists assessment_questions_review_status_chk,
  add constraint assessment_questions_review_status_chk check (review_status in ('draft','review','approved','rejected','retired')),
  drop constraint if exists assessment_questions_bloom_level_chk,
  add constraint assessment_questions_bloom_level_chk check (bloom_level is null or bloom_level in ('remember','understand','apply','analyse','evaluate','create'));

create unique index if not exists assessment_questions_author_fingerprint_version_uidx
  on public.assessment_questions(author_id,fingerprint,version)
  where author_id is not null and fingerprint is not null;
create index if not exists assessment_questions_discovery_idx
  on public.assessment_questions(subject_id,curriculum_id,learning_outcome_id,review_status,difficulty,bloom_level);
create index if not exists assessment_questions_author_status_idx
  on public.assessment_questions(author_id,review_status,updated_at desc);
create index if not exists assessment_questions_source_item_idx
  on public.assessment_questions(source_assessment_item_id)
  where source_assessment_item_id is not null;

alter table public.assessment_questions enable row level security;
drop policy if exists assessment_questions_read on public.assessment_questions;
drop policy if exists assessment_questions_teacher_read on public.assessment_questions;
drop policy if exists assessment_questions_teacher_manage on public.assessment_questions;
create policy assessment_questions_teacher_read on public.assessment_questions
for select to authenticated using (review_status='approved' or author_id=(select auth.uid()) or reviewed_by=(select auth.uid()));
create policy assessment_questions_teacher_manage on public.assessment_questions
for all to authenticated using (author_id=(select auth.uid())) with check (author_id=(select auth.uid()));

create or replace function public.exq_promote_assessment_item_to_question_bank(
  p_assessment_item_id uuid,p_learning_outcome_id uuid default null,p_competency_tag text default null
)
returns jsonb language plpgsql security definer set search_path=public,pg_temp
as $$
declare caller uuid:=auth.uid(); item public.assessment_items%rowtype; definition public.assessment_definitions%rowtype;
existing_id uuid; question_id uuid; normalized_fingerprint text;
begin
  if caller is null then raise exception 'not_authenticated'; end if;
  select * into item from public.assessment_items where id=p_assessment_item_id;
  if not found then raise exception 'assessment_item_not_found'; end if;
  select * into definition from public.assessment_definitions where id=item.assessment_id;
  if not found then raise exception 'assessment_not_found'; end if;
  if definition.teacher_id is distinct from caller then raise exception 'assessment_not_owned'; end if;
  if item.status='retired' then raise exception 'assessment_item_retired'; end if;
  normalized_fingerprint:=encode(digest(lower(regexp_replace(btrim(item.prompt),'\s+',' ','g')),'sha256'),'hex');
  select id into existing_id from public.assessment_questions
  where author_id=caller and fingerprint=normalized_fingerprint and review_status<>'retired'
  order by version desc limit 1;
  if existing_id is not null then return jsonb_build_object('ok',true,'created',false,'question_id',existing_id); end if;
  insert into public.assessment_questions(
    school_id,subject_id,curriculum_id,learning_outcome_id,source_assessment_item_id,
    question_text,question_type,options,correct_answer,difficulty,competency_tag,
    source_type,status,author_id,marks,bloom_level,accepted_answers,marking_guide,
    explanation,fingerprint,review_status,version
  ) values (
    definition.school_id,definition.subject_id,null,p_learning_outcome_id,item.id,
    item.prompt,item.question_type,item.options,
    case when item.correct_answer is null then null else item.correct_answer#>>'{}' end,
    item.difficulty,nullif(btrim(coalesce(p_competency_tag,'')),''),
    'assessment_item','draft',caller,item.marks,item.bloom_level,item.accepted_answers,
    item.marking_guide,item.explanation,normalized_fingerprint,'draft',1
  ) returning id into question_id;
  return jsonb_build_object('ok',true,'created',true,'question_id',question_id);
end;
$$;

create or replace function public.exq_approve_question_bank_item(p_question_id uuid)
returns jsonb language plpgsql security definer set search_path=public,pg_temp
as $$
declare caller uuid:=auth.uid(); q public.assessment_questions%rowtype;
begin
  if caller is null then raise exception 'not_authenticated'; end if;
  select * into q from public.assessment_questions where id=p_question_id for update;
  if not found then raise exception 'question_not_found'; end if;
  if q.author_id is distinct from caller then raise exception 'question_not_owned'; end if;
  if q.review_status='retired' then raise exception 'question_retired'; end if;
  update public.assessment_questions set review_status='approved',status='published',reviewed_by=caller,reviewed_at=now(),updated_at=now() where id=q.id;
  return jsonb_build_object('ok',true,'question_id',q.id,'review_status','approved');
end;
$$;

create or replace function public.exq_add_question_bank_item_to_assessment(
  p_question_id uuid,p_assessment_id uuid,p_order_num integer
)
returns jsonb language plpgsql security definer set search_path=public,pg_temp
as $$
declare caller uuid:=auth.uid(); q public.assessment_questions%rowtype; ad public.assessment_definitions%rowtype; item_id uuid;
begin
  if caller is null then raise exception 'not_authenticated'; end if;
  if p_order_num<=0 then raise exception 'invalid_order_num'; end if;
  select * into q from public.assessment_questions where id=p_question_id;
  if not found then raise exception 'question_not_found'; end if;
  if q.review_status<>'approved' and q.author_id is distinct from caller then raise exception 'question_not_available'; end if;
  select * into ad from public.assessment_definitions where id=p_assessment_id for update;
  if not found then raise exception 'assessment_not_found'; end if;
  if ad.teacher_id is distinct from caller then raise exception 'assessment_not_owned'; end if;
  if ad.status not in ('draft','review') then raise exception 'assessment_locked'; end if;
  insert into public.assessment_items(
    assessment_id,source_item_id,question_type,prompt,options,accepted_answers,
    correct_answer,marking_guide,explanation,marks,difficulty,bloom_level,
    auto_marking_mode,order_num,status,generated_by
  ) values (
    ad.id,q.id,q.question_type,q.question_text,coalesce(q.options,'[]'::jsonb),q.accepted_answers,
    case when q.correct_answer is null then null else to_jsonb(q.correct_answer) end,q.marking_guide,
    q.explanation,q.marks,q.difficulty,q.bloom_level,
    case when q.correct_answer is null then 'none' else 'case_insensitive' end,
    p_order_num,'draft','question_bank'
  ) returning id into item_id;
  update public.assessment_questions set usage_count=usage_count+1,last_used_at=now(),updated_at=now() where id=q.id;
  return jsonb_build_object('ok',true,'assessment_item_id',item_id,'question_id',q.id);
end;
$$;

revoke all on function public.exq_promote_assessment_item_to_question_bank(uuid,uuid,text) from public,anon;
revoke all on function public.exq_approve_question_bank_item(uuid) from public,anon;
revoke all on function public.exq_add_question_bank_item_to_assessment(uuid,uuid,integer) from public,anon;
grant execute on function public.exq_promote_assessment_item_to_question_bank(uuid,uuid,text) to authenticated,service_role;
grant execute on function public.exq_approve_question_bank_item(uuid) to authenticated,service_role;
grant execute on function public.exq_add_question_bank_item_to_assessment(uuid,uuid,integer) to authenticated,service_role;

commit;
