-- Pathways canonical learner authority hardening.
-- Keeps the trust-first UX, but moves durable learner decisions from generic profiles
-- onto canonical public.students identity. Parent/teacher support is read-only.

begin;

create table if not exists public.student_pathway_decisions (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references public.students(id) on delete cascade,
  pathway_id uuid not null references public.pathways(id),
  decision_type text not null check (decision_type in ('quick_check_saved','adopted','changed','reviewed')),
  evidence_snapshot jsonb not null default '{}'::jsonb,
  rule_version text not null,
  idempotency_key text not null,
  created_at timestamptz not null default now(),
  unique(student_id,idempotency_key)
);
alter table public.student_pathway_decisions enable row level security;
revoke all on table public.student_pathway_decisions from public,anon,authenticated;
grant select on table public.student_pathway_decisions to authenticated;
grant all on table public.student_pathway_decisions to service_role;
drop policy if exists student_pathway_decisions_own_read on public.student_pathway_decisions;
create policy student_pathway_decisions_own_read on public.student_pathway_decisions
for select to authenticated using (
  exists(select 1 from public.students s where s.id=student_id and s.profile_id=(select auth.uid()) and s.deleted_at is null)
);
-- authorization-test: public.student_pathway_decisions learner reads own canonical student decisions only; direct client writes denied.

create table if not exists public.student_pathway_passports (
  student_id uuid primary key references public.students(id) on delete cascade,
  pathway_id uuid not null references public.pathways(id),
  source_decision_id uuid not null references public.student_pathway_decisions(id),
  rule_version text not null,
  evidence_snapshot jsonb not null default '{}'::jsonb,
  adopted_at timestamptz not null default now(),
  reviewed_at timestamptz,
  updated_at timestamptz not null default now()
);
alter table public.student_pathway_passports enable row level security;
revoke all on table public.student_pathway_passports from public,anon,authenticated;
grant select on table public.student_pathway_passports to authenticated;
grant all on table public.student_pathway_passports to service_role;
drop policy if exists student_pathway_passports_own_read on public.student_pathway_passports;
create policy student_pathway_passports_own_read on public.student_pathway_passports
for select to authenticated using (
  exists(select 1 from public.students s where s.id=student_id and s.profile_id=(select auth.uid()) and s.deleted_at is null)
);
-- authorization-test: public.student_pathway_passports learner reads own canonical passport only; direct client writes denied.

create table if not exists public.parent_pathway_drafts (
  id uuid primary key default gen_random_uuid(),
  parent_profile_id uuid not null references public.profiles(id) on delete cascade,
  pathway_id uuid not null references public.pathways(id),
  evidence_snapshot jsonb not null default '{}'::jsonb,
  rule_version text not null,
  idempotency_key text not null,
  status text not null default 'active' check(status in ('active','adopted_by_learner','dismissed')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(parent_profile_id,idempotency_key)
);
alter table public.parent_pathway_drafts enable row level security;
revoke all on table public.parent_pathway_drafts from public,anon,authenticated;
grant select on table public.parent_pathway_drafts to authenticated;
grant all on table public.parent_pathway_drafts to service_role;
drop policy if exists parent_pathway_drafts_own_read on public.parent_pathway_drafts;
create policy parent_pathway_drafts_own_read on public.parent_pathway_drafts
for select to authenticated using(parent_profile_id=(select auth.uid()));
-- authorization-test: public.parent_pathway_drafts parent reads only own adult-owned planning drafts; direct client writes denied.

create index if not exists student_pathway_decisions_student_created_idx on public.student_pathway_decisions(student_id,created_at desc);
create index if not exists parent_pathway_drafts_parent_status_idx on public.parent_pathway_drafts(parent_profile_id,status,updated_at desc);

create or replace function public.pathways_save_my_quick_check(
  p_pathway_slug text,p_answers jsonb,p_scores jsonb,p_rule_version text,p_idempotency_key text
) returns jsonb
language plpgsql security definer set search_path=public,pg_temp
as $$
declare
  caller uuid:=auth.uid(); caller_role text; learner public.students%rowtype; chosen public.pathways%rowtype;
  existing public.student_pathway_decisions%rowtype; decision_id uuid; evidence jsonb;
  stem_score integer; social_score integer; arts_score integer; selected_score integer; runner_score integer;
begin
  if caller is null then raise exception 'not_authenticated'; end if;
  select role into caller_role from public.profiles where id=caller and account_status<>'restricted' and is_anonymized is not true;
  if caller_role<>'student' then raise exception 'canonical_student_role_required'; end if;
  select * into learner from public.students where profile_id=caller and deleted_at is null order by created_at asc limit 1;
  if not found then raise exception 'canonical_student_identity_not_found'; end if;
  if p_idempotency_key is null or length(p_idempotency_key)<8 or length(p_idempotency_key)>128 then raise exception 'invalid_idempotency_key'; end if;
  if p_rule_version is null or length(trim(p_rule_version))<3 or length(p_rule_version)>80 then raise exception 'invalid_rule_version'; end if;
  if jsonb_typeof(coalesce(p_answers,'{}'::jsonb))<>'object' or jsonb_typeof(coalesce(p_scores,'{}'::jsonb))<>'object' then raise exception 'invalid_payload_shape'; end if;
  if jsonb_typeof(p_scores->'stem')<>'number' or jsonb_typeof(p_scores->'social')<>'number' or jsonb_typeof(p_scores->'arts')<>'number' then raise exception 'invalid_score_shape'; end if;
  stem_score:=(p_scores->>'stem')::integer; social_score:=(p_scores->>'social')::integer; arts_score:=(p_scores->>'arts')::integer;
  if stem_score<0 or social_score<0 or arts_score<0 then raise exception 'invalid_scores'; end if;
  select * into chosen from public.pathways where slug=lower(trim(p_pathway_slug)) and status='published' and verification_state='verified';
  if not found then raise exception 'verified_pathway_not_found'; end if;
  if chosen.slug='stem' then selected_score:=stem_score; runner_score:=greatest(social_score,arts_score);
  elsif chosen.slug='social-sciences' then selected_score:=social_score; runner_score:=greatest(stem_score,arts_score);
  elsif chosen.slug='arts-and-sports-science' then selected_score:=arts_score; runner_score:=greatest(stem_score,social_score);
  else raise exception 'unsupported_quick_check_pathway'; end if;
  if selected_score<4 or selected_score-runner_score<2 then raise exception 'quick_check_uncertain'; end if;
  evidence:=jsonb_build_object('evidence_class','learner_supplied_quick_check','answers',coalesce(p_answers,'{}'::jsonb),'scores',p_scores,'disclaimer','VibeSchool guidance; not an official placement decision.');
  select * into existing from public.student_pathway_decisions where student_id=learner.id and idempotency_key=p_idempotency_key for update;
  if found then
    if existing.pathway_id<>chosen.id or existing.decision_type<>'quick_check_saved' or existing.rule_version<>p_rule_version or existing.evidence_snapshot<>evidence then
      raise exception 'idempotency_key_reused_for_different_decision';
    end if;
    decision_id:=existing.id;
  else
    insert into public.student_pathway_decisions(student_id,pathway_id,decision_type,evidence_snapshot,rule_version,idempotency_key)
    values(learner.id,chosen.id,'quick_check_saved',evidence,p_rule_version,p_idempotency_key) returning id into decision_id;
  end if;
  insert into public.student_pathway_passports(student_id,pathway_id,source_decision_id,rule_version,evidence_snapshot,adopted_at,updated_at)
  values(learner.id,chosen.id,decision_id,p_rule_version,jsonb_build_object('scores',p_scores),now(),now())
  on conflict(student_id) do update set pathway_id=excluded.pathway_id,source_decision_id=excluded.source_decision_id,rule_version=excluded.rule_version,evidence_snapshot=excluded.evidence_snapshot,adopted_at=excluded.adopted_at,updated_at=now();
  return jsonb_build_object('ok',true,'student_id',learner.id,'pathway_slug',chosen.slug,'pathway_name',chosen.name,'decision_id',decision_id,'idempotent_replay',existing.id is not null);
end $$;
revoke all on function public.pathways_save_my_quick_check(text,jsonb,jsonb,text,text) from public,anon,authenticated;
grant execute on function public.pathways_save_my_quick_check(text,jsonb,jsonb,text,text) to authenticated;
-- authorization-test: only an authenticated canonical student profile with an active public.students row can write a learner Passport.

create or replace function public.pathways_get_my_passport() returns jsonb
language sql stable security invoker set search_path=public
as $$
  select coalesce((select jsonb_build_object('student_id',s.id,'pathway_slug',p.slug,'pathway_name',p.name,'summary',p.summary,'rule_version',pp.rule_version,'evidence_snapshot',pp.evidence_snapshot,'adopted_at',pp.adopted_at,'reviewed_at',pp.reviewed_at,'updated_at',pp.updated_at)
  from public.students s join public.student_pathway_passports pp on pp.student_id=s.id join public.pathways p on p.id=pp.pathway_id
  where s.profile_id=auth.uid() and s.deleted_at is null limit 1),'null'::jsonb)
$$;
revoke all on function public.pathways_get_my_passport() from public,anon;
grant execute on function public.pathways_get_my_passport() to authenticated;

create or replace function public.pathways_save_parent_draft(
  p_pathway_slug text,p_answers jsonb,p_scores jsonb,p_rule_version text,p_idempotency_key text
) returns jsonb
language plpgsql security definer set search_path=public,pg_temp
as $$
declare caller uuid:=auth.uid(); chosen public.pathways%rowtype; existing public.parent_pathway_drafts%rowtype; evidence jsonb;
begin
  if caller is null then raise exception 'not_authenticated'; end if;
  if not exists(select 1 from public.profiles p where p.id=caller and p.role='parent' and p.account_status<>'restricted' and p.is_anonymized is not true) then raise exception 'parent_role_required'; end if;
  if p_idempotency_key is null or length(p_idempotency_key)<8 or length(p_idempotency_key)>128 then raise exception 'invalid_idempotency_key'; end if;
  select * into chosen from public.pathways where slug=lower(trim(p_pathway_slug)) and status='published' and verification_state='verified';
  if not found then raise exception 'verified_pathway_not_found'; end if;
  evidence:=jsonb_build_object('evidence_class','parent_owned_pathways_draft','answers',coalesce(p_answers,'{}'::jsonb),'scores',coalesce(p_scores,'{}'::jsonb),'notice','Adult-owned planning draft; not a learner Pathway Passport.');
  select * into existing from public.parent_pathway_drafts where parent_profile_id=caller and idempotency_key=p_idempotency_key for update;
  if found then
    if existing.pathway_id<>chosen.id or existing.rule_version<>p_rule_version or existing.evidence_snapshot<>evidence then raise exception 'idempotency_key_reused_for_different_decision'; end if;
  else
    insert into public.parent_pathway_drafts(parent_profile_id,pathway_id,evidence_snapshot,rule_version,idempotency_key)
    values(caller,chosen.id,evidence,p_rule_version,p_idempotency_key) returning * into existing;
  end if;
  return jsonb_build_object('ok',true,'draft_id',existing.id,'pathway_slug',chosen.slug,'pathway_name',chosen.name,'idempotent_replay',existing.created_at<>existing.updated_at);
end $$;
revoke all on function public.pathways_save_parent_draft(text,jsonb,jsonb,text,text) from public,anon,authenticated;
grant execute on function public.pathways_save_parent_draft(text,jsonb,jsonb,text,text) to authenticated;
-- authorization-test: parent draft is adult-owned only and cannot write public.student_pathway_passports.

create or replace function public.parent_get_linked_pathway_passports()
returns table(student_id uuid,student_name text,pathway_slug text,pathway_name text,adopted_at timestamptz,reviewed_at timestamptz)
language sql stable security definer set search_path=public,pg_temp
as $$
  select s.id,s.name,p.slug,p.name,pp.adopted_at,pp.reviewed_at
  from public.parent_student_links l join public.students s on s.id=l.student_id and s.deleted_at is null
  left join public.student_pathway_passports pp on pp.student_id=s.id left join public.pathways p on p.id=pp.pathway_id
  where l.parent_id=auth.uid()
$$;
revoke all on function public.parent_get_linked_pathway_passports() from public,anon,authenticated;
grant execute on function public.parent_get_linked_pathway_passports() to authenticated;
-- authorization-test: parent support returns only learners proven by public.parent_student_links; no mutation path.

create or replace function public.teacher_get_assigned_pathway_passports()
returns table(student_id uuid,student_name text,class_id uuid,pathway_slug text,pathway_name text,adopted_at timestamptz,reviewed_at timestamptz)
language sql stable security definer set search_path=public,pg_temp
as $$
  select distinct s.id,s.name,s.class_id,p.slug,p.name,pp.adopted_at,pp.reviewed_at
  from public.teacher_classes tc join public.students s on s.class_id=tc.class_id and s.deleted_at is null
  left join public.student_pathway_passports pp on pp.student_id=s.id left join public.pathways p on p.id=pp.pathway_id
  where tc.teacher_id=auth.uid()
$$;
revoke all on function public.teacher_get_assigned_pathway_passports() from public,anon,authenticated;
grant execute on function public.teacher_get_assigned_pathway_passports() to authenticated;
-- authorization-test: teacher support returns only students in assigned teacher_classes; no learner Passport mutation path.

create or replace function public.pathways_search_public_schools_v2(
  p_query text default null,p_county text default null,p_pathway_slug text default null,p_combination_slug text default null,p_limit integer default 30
) returns table(
  school_id uuid,school_name text,county text,sub_county text,school_category text,ownership_type text,gender_type text,accommodation_type text,cluster text,knec_code text,
  pathway_slug text,pathway_name text,combination_slug text,combination_name text,verified_at timestamptz,source_authority text,source_name text,source_url text,source_reference text,source_observed_at timestamptz
)
language sql stable security definer set search_path=public,pg_temp
as $$
  select d.id,d.name::text,d.county::text,d.sub_county::text,d.school_category::text,d.ownership_type,d.gender_type,d.accommodation_type,null::text,d.knec_code::text,
         p.slug,p.name,c.slug,c.display_name,o.verified_at,src.authority_name,src.source_name,src.source_url,src.source_reference,src.observed_at
  from public.school_directory_public d
  left join public.pathway_school_offerings o on o.school_id=d.id and o.verification_state='verified' and o.verified_at is not null and(o.effective_to is null or o.effective_to>=current_date)
  left join public.pathway_sources src on src.id=o.source_id and src.is_public=true and src.status='active'
  left join public.pathways p on p.id=o.pathway_id and src.id is not null and p.status='published' and p.verification_state='verified'
  left join public.pathway_subject_combinations c on c.id=o.combination_id and p.id is not null and c.status='published' and c.verification_state='verified'
  where (p_query is null or trim(p_query)='' or lower(d.name) like '%'||lower(trim(p_query))||'%')
    and(p_county is null or trim(p_county)='' or lower(coalesce(d.county,''))=lower(trim(p_county)))
    and(p_pathway_slug is null or trim(p_pathway_slug)='' or p.slug=lower(trim(p_pathway_slug)))
    and(p_combination_slug is null or trim(p_combination_slug)='' or c.slug=lower(trim(p_combination_slug)))
  order by case when p_query is not null and lower(d.name)=lower(trim(p_query)) then 0 else 1 end,d.name asc,p.name asc nulls last,c.display_name asc nulls last
  limit least(greatest(coalesce(p_limit,30),1),50)
$$;
revoke all on function public.pathways_search_public_schools_v2(text,text,text,text,integer) from public,anon,authenticated;
grant execute on function public.pathways_search_public_schools_v2(text,text,text,text,integer) to anon,authenticated;
-- authorization-test: anonymous school discovery reads the curated public.school_directory_public projection; verified offering claims require active public provenance.

commit;
