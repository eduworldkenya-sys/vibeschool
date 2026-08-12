-- EXQ-008D — Report validation and academic audit authority.
-- Production-equivalent repository migration.

alter table public.report_cards
  add column if not exists validation_status text not null default 'not_validated',
  add column if not exists validation_issues jsonb not null default '[]'::jsonb,
  add column if not exists validated_at timestamptz null,
  add column if not exists validated_by uuid null references auth.users(id) on delete set null;

alter table public.report_cards
  drop constraint if exists report_cards_validation_status_chk,
  add constraint report_cards_validation_status_chk
    check (validation_status in ('not_validated','warnings','blocked','passed','frozen'));

create table if not exists public.report_card_audit_log (
  id uuid primary key default gen_random_uuid(),
  report_card_id uuid not null references public.report_cards(id) on delete cascade,
  school_id uuid not null references public.schools(id) on delete cascade,
  actor_id uuid not null references auth.users(id) on delete restrict,
  action text not null,
  from_status text null,
  to_status text null,
  evidence_version integer null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  constraint report_card_audit_log_action_chk check (action in ('created','evidence_generated','narrative_generated','validated','submitted','returned','approved','published','locked'))
);

create index if not exists report_card_audit_log_report_idx on public.report_card_audit_log(report_card_id,created_at desc);
create index if not exists report_card_audit_log_school_idx on public.report_card_audit_log(school_id,created_at desc);
alter table public.report_card_audit_log enable row level security;

drop policy if exists report_card_audit_log_read on public.report_card_audit_log;
create policy report_card_audit_log_read on public.report_card_audit_log for select to authenticated
using (exists(select 1 from public.report_cards rc where rc.id=report_card_audit_log.report_card_id and (rc.teacher_id=(select auth.uid()) or exists(select 1 from public.school_members sm where sm.school_id=rc.school_id and sm.profile_id=(select auth.uid()) and sm.role in ('owner','admin')))));

create or replace function public.exq_validate_report_card(p_report_card_id uuid)
returns jsonb
language plpgsql
security definer
set search_path=public,pg_temp
as $$
declare
  caller uuid:=auth.uid();
  rc public.report_cards%rowtype;
  issues jsonb:='[]'::jsonb;
  blocking_count integer:=0;
  warning_count integer:=0;
  subject_count integer:=0;
  missing_comments integer:=0;
  missing_narratives integer:=0;
  unresolved_interventions integer:=0;
  attendance_total integer:=0;
  result_status text;
begin
  if caller is null then raise exception 'not_authenticated'; end if;
  select * into rc from public.report_cards where id=p_report_card_id for update;
  if not found then raise exception 'report_card_not_found'; end if;
  if rc.teacher_id is distinct from caller and not exists (
    select 1 from public.school_members sm
    where sm.school_id=rc.school_id and sm.profile_id=caller and sm.role in ('owner','admin')
  ) then raise exception 'report_card_not_authorized'; end if;
  if rc.status in ('published','locked') then raise exception 'report_card_validation_frozen'; end if;

  select count(*),
         count(*) filter(where nullif(btrim(coalesce(teacher_comment,'')),'') is null),
         count(*) filter(where generated_at is null or achievement_summary is null or recommended_next_steps is null)
  into subject_count,missing_comments,missing_narratives
  from public.report_card_subjects where report_card_id=rc.id;

  if subject_count=0 then
    blocking_count:=blocking_count+1;
    issues:=issues||jsonb_build_array(jsonb_build_object('severity','blocking','code','subjects_missing','message','No subject reports exist.'));
  end if;
  if rc.completeness_status<>'complete' then
    blocking_count:=blocking_count+1;
    issues:=issues||jsonb_build_array(jsonb_build_object('severity','blocking','code','evidence_incomplete','message','The evidence snapshot is not complete.'));
  end if;
  if missing_comments>0 then
    blocking_count:=blocking_count+1;
    issues:=issues||jsonb_build_array(jsonb_build_object('severity','blocking','code','subject_comments_missing','message',missing_comments||' subject comment(s) are missing.','count',missing_comments));
  end if;
  if missing_narratives>0 then
    blocking_count:=blocking_count+1;
    issues:=issues||jsonb_build_array(jsonb_build_object('severity','blocking','code','subject_narratives_missing','message',missing_narratives||' subject narrative(s) have not been generated.','count',missing_narratives));
  end if;

  select count(*) into unresolved_interventions
  from public.assessment_interventions ai
  join public.academic_terms t on t.id=rc.term_id
  where ai.student_id=rc.student_id and ai.class_id=rc.class_id
    and ai.status in ('open','in_progress','escalated')
    and ai.created_at::date between t.start_date and t.end_date;
  if unresolved_interventions>0 then
    warning_count:=warning_count+1;
    issues:=issues||jsonb_build_array(jsonb_build_object('severity','warning','code','open_interventions','message',unresolved_interventions||' intervention(s) remain open.','count',unresolved_interventions));
  end if;

  select count(*) into attendance_total
  from public.attendance a join public.academic_terms t on t.id=rc.term_id
  where a.student_id=rc.student_id and a.class_id=rc.class_id and a.date between t.start_date and t.end_date;
  if attendance_total=0 then
    warning_count:=warning_count+1;
    issues:=issues||jsonb_build_array(jsonb_build_object('severity','warning','code','attendance_missing','message','No attendance records were found for the term.'));
  end if;

  result_status:=case when blocking_count>0 then 'blocked' when warning_count>0 then 'warnings' else 'passed' end;

  update public.report_cards
  set validation_status=result_status,validation_issues=issues,validated_at=now(),validated_by=caller,updated_at=now()
  where id=rc.id;

  insert into public.report_card_audit_log(report_card_id,school_id,actor_id,action,from_status,to_status,evidence_version,metadata)
  values(rc.id,rc.school_id,caller,'validated',rc.status,rc.status,rc.evidence_version,jsonb_build_object('validation_status',result_status,'blocking_count',blocking_count,'warning_count',warning_count,'issues',issues));

  return jsonb_build_object('ok',true,'report_card_id',rc.id,'validation_status',result_status,'blocking_count',blocking_count,'warning_count',warning_count,'issues',issues);
end;
$$;

revoke all on function public.exq_validate_report_card(uuid) from public,anon;
revoke all on function public.exq_submit_report_card(uuid,text) from public,anon;
revoke all on function public.exq_review_report_card(uuid,text,text) from public,anon;
grant execute on function public.exq_validate_report_card(uuid) to authenticated,service_role;
grant execute on function public.exq_submit_report_card(uuid,text) to authenticated,service_role;
grant execute on function public.exq_review_report_card(uuid,text,text) to authenticated,service_role;
