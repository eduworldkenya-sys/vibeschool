begin;

create table if not exists public.report_cards (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools(id) on delete cascade,
  student_id uuid not null references public.students(id) on delete cascade,
  class_id uuid not null references public.classes(id) on delete restrict,
  term_id uuid not null references public.academic_terms(id) on delete restrict,
  academic_year integer not null,
  teacher_id uuid not null references auth.users(id) on delete restrict,
  status text not null default 'draft',
  overall_comment text null,
  generated_snapshot jsonb not null default '{}'::jsonb,
  submitted_at timestamptz null,
  approved_by uuid null references auth.users(id) on delete restrict,
  approved_at timestamptz null,
  published_at timestamptz null,
  locked_at timestamptz null,
  revision integer not null default 1,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint report_cards_status_chk check (status in ('draft','review','approved','published','locked','returned')),
  constraint report_cards_revision_chk check (revision > 0),
  constraint report_cards_lifecycle_chk check (
    (status='draft' and submitted_at is null and approved_at is null and published_at is null and locked_at is null)
    or (status in ('review','returned') and submitted_at is not null and published_at is null and locked_at is null)
    or (status='approved' and submitted_at is not null and approved_by is not null and approved_at is not null and published_at is null and locked_at is null)
    or (status='published' and submitted_at is not null and approved_by is not null and approved_at is not null and published_at is not null and locked_at is null)
    or (status='locked' and submitted_at is not null and approved_by is not null and approved_at is not null and published_at is not null and locked_at is not null)
  )
);

create table if not exists public.report_card_subjects (
  id uuid primary key default gen_random_uuid(),
  report_card_id uuid not null references public.report_cards(id) on delete cascade,
  subject_id uuid not null references public.subjects(id) on delete restrict,
  teacher_id uuid not null references auth.users(id) on delete restrict,
  assessment_average numeric null,
  mastery_average numeric null,
  growth_percentage numeric null,
  strongest_outcomes jsonb not null default '[]'::jsonb,
  support_outcomes jsonb not null default '[]'::jsonb,
  intervention_summary jsonb not null default '[]'::jsonb,
  teacher_comment text null,
  evidence_snapshot jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint report_card_subjects_assessment_chk check (assessment_average is null or (assessment_average>=0 and assessment_average<=100)),
  constraint report_card_subjects_mastery_chk check (mastery_average is null or (mastery_average>=0 and mastery_average<=100)),
  constraint report_card_subjects_growth_chk check (growth_percentage is null or (growth_percentage>=-100 and growth_percentage<=100))
);

create unique index if not exists report_cards_student_term_uidx on public.report_cards(school_id,student_id,term_id,revision);
create unique index if not exists report_card_subjects_report_subject_uidx on public.report_card_subjects(report_card_id,subject_id);
create index if not exists report_cards_teacher_status_idx on public.report_cards(teacher_id,status,updated_at desc);
create index if not exists report_cards_school_status_idx on public.report_cards(school_id,status,updated_at desc);

alter table public.report_cards enable row level security;
alter table public.report_card_subjects enable row level security;

drop policy if exists report_cards_teacher_read on public.report_cards;
create policy report_cards_teacher_read on public.report_cards
for select to authenticated using (
  teacher_id=(select auth.uid())
  or exists (select 1 from public.school_members sm where sm.school_id=report_cards.school_id and sm.profile_id=(select auth.uid()) and sm.role in ('owner','admin'))
);

drop policy if exists report_card_subjects_read on public.report_card_subjects;
create policy report_card_subjects_read on public.report_card_subjects
for select to authenticated using (
  exists (
    select 1 from public.report_cards rc
    where rc.id=report_card_subjects.report_card_id
      and (rc.teacher_id=(select auth.uid()) or exists (
        select 1 from public.school_members sm
        where sm.school_id=rc.school_id and sm.profile_id=(select auth.uid()) and sm.role in ('owner','admin')
      ))
  )
);

create or replace function public.exq_create_report_card(p_student_id uuid,p_class_id uuid,p_term_id uuid,p_academic_year integer)
returns uuid language plpgsql security definer set search_path=public,pg_temp
as $$
declare caller uuid:=auth.uid(); school uuid; report_id uuid;
begin
  if caller is null then raise exception 'not_authenticated'; end if;
  select tc.school_id into school from public.teacher_classes tc where tc.teacher_id=caller and tc.class_id=p_class_id limit 1;
  if school is null then raise exception 'teacher_not_assigned_to_class'; end if;
  if not exists (select 1 from public.student_classes sc where sc.student_id=p_student_id and sc.class_id=p_class_id and sc.school_id=school and sc.is_current=true) then raise exception 'student_not_in_class'; end if;
  select id into report_id from public.report_cards where school_id=school and student_id=p_student_id and term_id=p_term_id and status in ('draft','review','returned','approved') order by revision desc limit 1;
  if report_id is not null then return report_id; end if;
  insert into public.report_cards(school_id,student_id,class_id,term_id,academic_year,teacher_id,status)
  values(school,p_student_id,p_class_id,p_term_id,p_academic_year,caller,'draft') returning id into report_id;
  return report_id;
end;
$$;

create or replace function public.exq_submit_report_card(p_report_card_id uuid,p_overall_comment text default null)
returns jsonb language plpgsql security definer set search_path=public,pg_temp
as $$
declare caller uuid:=auth.uid(); rc public.report_cards%rowtype; missing_comments integer;
begin
  if caller is null then raise exception 'not_authenticated'; end if;
  select * into rc from public.report_cards where id=p_report_card_id for update;
  if not found then raise exception 'report_card_not_found'; end if;
  if rc.teacher_id is distinct from caller then raise exception 'report_card_not_owned'; end if;
  if rc.status not in ('draft','returned') then raise exception 'report_card_not_submittable'; end if;
  select count(*) into missing_comments from public.report_card_subjects rcs where rcs.report_card_id=rc.id and nullif(btrim(coalesce(rcs.teacher_comment,'')),'') is null;
  if missing_comments>0 then raise exception 'subject_comments_missing'; end if;
  update public.report_cards set status='review',overall_comment=nullif(btrim(coalesce(p_overall_comment,'')),''),submitted_at=now(),updated_at=now() where id=rc.id;
  return jsonb_build_object('ok',true,'report_card_id',rc.id,'status','review');
end;
$$;

create or replace function public.exq_review_report_card(p_report_card_id uuid,p_decision text,p_reason text default null)
returns jsonb language plpgsql security definer set search_path=public,pg_temp
as $$
declare caller uuid:=auth.uid(); rc public.report_cards%rowtype; allowed boolean; next_status text;
begin
  if caller is null then raise exception 'not_authenticated'; end if;
  if p_decision not in ('approved','returned') then raise exception 'invalid_report_decision'; end if;
  select * into rc from public.report_cards where id=p_report_card_id for update;
  if not found then raise exception 'report_card_not_found'; end if;
  select exists(select 1 from public.school_members sm where sm.school_id=rc.school_id and sm.profile_id=caller and sm.role in ('owner','admin')) into allowed;
  if not allowed then raise exception 'reviewer_not_authorized'; end if;
  if rc.status<>'review' then raise exception 'report_card_not_in_review'; end if;
  next_status:=p_decision;
  update public.report_cards
  set status=next_status,
      overall_comment=case when p_decision='returned' and nullif(btrim(coalesce(p_reason,'')),'') is not null then concat_ws(E'\n',overall_comment,'Returned: '||btrim(p_reason)) else overall_comment end,
      approved_by=case when p_decision='approved' then caller else null end,
      approved_at=case when p_decision='approved' then now() else null end,
      updated_at=now()
  where id=rc.id;
  return jsonb_build_object('ok',true,'report_card_id',rc.id,'status',next_status);
end;
$$;

create or replace function public.exq_publish_report_card(p_report_card_id uuid)
returns jsonb language plpgsql security definer set search_path=public,pg_temp
as $$
declare caller uuid:=auth.uid(); rc public.report_cards%rowtype; allowed boolean; snapshot jsonb;
begin
  if caller is null then raise exception 'not_authenticated'; end if;
  select * into rc from public.report_cards where id=p_report_card_id for update;
  if not found then raise exception 'report_card_not_found'; end if;
  select exists(select 1 from public.school_members sm where sm.school_id=rc.school_id and sm.profile_id=caller and sm.role in ('owner','admin')) into allowed;
  if not allowed then raise exception 'publisher_not_authorized'; end if;
  if rc.status<>'approved' then raise exception 'report_card_not_approved'; end if;
  select jsonb_build_object('report_card',to_jsonb(rc),'subjects',coalesce(jsonb_agg(to_jsonb(rcs) order by rcs.subject_id) filter (where rcs.id is not null),'[]'::jsonb),'published_by',caller,'published_at',now())
  into snapshot from public.report_card_subjects rcs where rcs.report_card_id=rc.id;
  update public.report_cards set status='published',generated_snapshot=snapshot,published_at=now(),updated_at=now() where id=rc.id;
  return jsonb_build_object('ok',true,'report_card_id',rc.id,'status','published');
end;
$$;

create or replace function public.exq_lock_report_card(p_report_card_id uuid)
returns jsonb language plpgsql security definer set search_path=public,pg_temp
as $$
declare caller uuid:=auth.uid(); rc public.report_cards%rowtype; allowed boolean;
begin
  if caller is null then raise exception 'not_authenticated'; end if;
  select * into rc from public.report_cards where id=p_report_card_id for update;
  if not found then raise exception 'report_card_not_found'; end if;
  select exists(select 1 from public.school_members sm where sm.school_id=rc.school_id and sm.profile_id=caller and sm.role in ('owner','admin')) into allowed;
  if not allowed then raise exception 'locker_not_authorized'; end if;
  if rc.status<>'published' then raise exception 'report_card_not_published'; end if;
  update public.report_cards set status='locked',locked_at=now(),updated_at=now() where id=rc.id;
  return jsonb_build_object('ok',true,'report_card_id',rc.id,'status','locked');
end;
$$;

revoke all on function public.exq_create_report_card(uuid,uuid,uuid,integer) from public,anon;
revoke all on function public.exq_submit_report_card(uuid,text) from public,anon;
revoke all on function public.exq_review_report_card(uuid,text,text) from public,anon;
revoke all on function public.exq_publish_report_card(uuid) from public,anon;
revoke all on function public.exq_lock_report_card(uuid) from public,anon;
grant execute on function public.exq_create_report_card(uuid,uuid,uuid,integer) to authenticated,service_role;
grant execute on function public.exq_submit_report_card(uuid,text) to authenticated,service_role;
grant execute on function public.exq_review_report_card(uuid,text,text) to authenticated,service_role;
grant execute on function public.exq_publish_report_card(uuid) to authenticated,service_role;
grant execute on function public.exq_lock_report_card(uuid) to authenticated,service_role;

commit;
