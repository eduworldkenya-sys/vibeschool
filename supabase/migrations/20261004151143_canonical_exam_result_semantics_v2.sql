-- Canonical exam-result semantics and scoring policy.
-- Applied to production as migration 20261004151143.

-- Reconstruct the pre-existing production scoring-policy table when the
-- repository is replayed from zero. Production already had this table before
-- this canonical result migration; CREATE IF NOT EXISTS preserves that state.
create table if not exists public.exam_subject_config (
  id uuid primary key default gen_random_uuid(),
  exam_id uuid not null references public.exams(id) on delete cascade,
  subject_id uuid not null references public.subjects(id) on delete cascade,
  pass_mark integer not null,
  max_marks integer not null default 100,
  unique (exam_id, subject_id)
);

alter table public.exam_subject_config enable row level security;

do $
begin
  if not exists (
    select 1 from pg_policies
    where schemaname='public' and tablename='exam_subject_config'
      and policyname='admin manage exam_subject_config'
  ) then
    create policy "admin manage exam_subject_config"
      on public.exam_subject_config
      for all
      using (
        exists (
          select 1 from public.exams
          where exams.id=exam_subject_config.exam_id
            and public.is_school_admin(exams.school_id)
        )
      )
      with check (
        exists (
          select 1 from public.exams
          where exams.id=exam_subject_config.exam_id
            and public.is_school_admin(exams.school_id)
        )
      );
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname='public' and tablename='exam_subject_config'
      and policyname='school members read exam_subject_config'
  ) then
    create policy "school members read exam_subject_config"
      on public.exam_subject_config
      for select
      using (
        exam_id in (
          select e.id
          from public.exams e
          join public.profiles p on p.school_id=e.school_id
          where p.id=auth.uid()
        )
      );
  end if;
end
$;

alter table public.exam_results
  add column if not exists result_state text,
  add column if not exists max_marks numeric;

alter table public.exam_results alter column marks drop not null;

update public.exam_results er
set result_state = case when er.is_absent then 'absent' else 'entered' end
where er.result_state is null;

update public.exam_results er
set max_marks = coalesce((
  select esc.max_marks::numeric
  from public.exam_subject_config esc
  where esc.exam_id = er.exam_id and esc.subject_id = er.subject_id
  limit 1
), 100)
where er.max_marks is null;

update public.exam_results
set marks = null
where result_state = 'absent';

alter table public.exam_results
  alter column result_state set default 'entered',
  alter column result_state set not null,
  alter column max_marks set default 100,
  alter column max_marks set not null;

alter table public.exam_results drop constraint if exists exam_results_marks_check;
alter table public.exam_results drop constraint if exists exam_results_result_state_check;
alter table public.exam_results drop constraint if exists exam_results_score_state_check;
alter table public.exam_results drop constraint if exists exam_results_absence_state_check;

alter table public.exam_results
  add constraint exam_results_result_state_check
    check (result_state in ('entered','absent','not_assessed','exempt','pending','incomplete','late','transferred','awaiting_marking')),
  add constraint exam_results_score_state_check
    check (
      (result_state='entered' and marks is not null and marks >= 0 and marks <= max_marks and max_marks > 0)
      or
      (result_state<>'entered' and marks is null and max_marks > 0)
    ),
  add constraint exam_results_absence_state_check
    check (is_absent = (result_state='absent'));

alter table public.exam_results drop column if exists percentage;
alter table public.exam_results
  add column percentage numeric generated always as (
    case when result_state='entered' and marks is not null and max_marks > 0
      then round((marks / max_marks) * 100, 2)
      else null
    end
  ) stored;

create index if not exists exam_results_state_idx
  on public.exam_results(school_id,class_id,subject_id,exam_id,result_state);

create or replace function public.teacher_get_exam_subject_policy(
  p_exam_id uuid,p_school_id uuid,p_class_id uuid,p_subject_id uuid
)
returns jsonb language plpgsql security definer set search_path=''
as $$
declare
  v_context jsonb; v_exam public.exams%rowtype;
  v_max numeric; v_pass numeric; v_configured boolean := false;
begin
  if auth.uid() is null then raise exception 'not_authenticated'; end if;
  v_context := public.teacher_get_operating_context(null);
  if nullif(v_context->>'school_id','')::uuid is distinct from p_school_id then raise exception 'active_school_changed'; end if;
  if not public.is_live_teacher_subject(p_school_id,p_class_id,p_subject_id) then raise exception 'teacher_subject_not_authorized'; end if;
  select * into v_exam from public.exams where id=p_exam_id and school_id=p_school_id;
  if not found then raise exception 'exam_not_available'; end if;

  select esc.max_marks::numeric,esc.pass_mark::numeric into v_max,v_pass
  from public.exam_subject_config esc
  where esc.exam_id=p_exam_id and esc.subject_id=p_subject_id limit 1;
  v_configured := found;
  if not v_configured then v_max:=100; v_pass:=v_exam.pass_mark; end if;
  if v_max is null or v_max<=0 or v_pass is null or v_pass<0 or v_pass>v_max then raise exception 'exam_subject_policy_invalid'; end if;

  return jsonb_build_object(
    'exam_id',p_exam_id,'school_id',p_school_id,'subject_id',p_subject_id,
    'pass_mark',v_pass,'max_marks',v_max,
    'pass_percentage',round((v_pass/v_max)*100,2),
    'configured',v_configured,'is_locked',v_exam.is_locked
  );
end $$;

revoke all on function public.teacher_get_exam_subject_policy(uuid,uuid,uuid,uuid) from public,anon;
grant execute on function public.teacher_get_exam_subject_policy(uuid,uuid,uuid,uuid) to authenticated;

create or replace function public.teacher_save_exam_result_state(
  p_exam_id uuid,p_school_id uuid,p_class_id uuid,p_subject_id uuid,p_student_id uuid,
  p_marks numeric,p_result_state text,p_expected_updated_at timestamptz default null
)
returns jsonb language plpgsql security invoker set search_path=public,pg_temp
as $$
declare
  v_exam public.exams%rowtype; v_existing public.exam_results%rowtype; v_saved public.exam_results%rowtype;
  v_context jsonb; v_policy jsonb; v_state text:=lower(trim(coalesce(p_result_state,'')));
  v_max numeric; v_marks numeric;
begin
  if auth.uid() is null then raise exception 'not_authenticated'; end if;
  v_context:=public.teacher_get_operating_context(null);
  if nullif(v_context->>'school_id','')::uuid is distinct from p_school_id then raise exception 'active_school_changed'; end if;
  if not exists(select 1 from public.profiles where id=auth.uid() and account_status::text='active' and not coalesce(is_anonymized,false)) then raise exception 'teacher_account_not_active'; end if;
  if v_state not in ('entered','absent','not_assessed','exempt','pending','incomplete','late','transferred','awaiting_marking') then raise exception 'invalid_result_state'; end if;
  if not public.is_live_teacher_subject(p_school_id,p_class_id,p_subject_id) then raise exception 'teacher_subject_not_authorized'; end if;
  if not exists(
    select 1 from public.student_classes
    where school_id=p_school_id and class_id=p_class_id and student_id=p_student_id and is_current=true
      and exists(select 1 from public.students s where s.id=p_student_id and s.deleted_at is null)
  ) then raise exception 'student_not_in_current_class'; end if;

  v_policy:=public.teacher_get_exam_subject_policy(p_exam_id,p_school_id,p_class_id,p_subject_id);
  v_max:=(v_policy->>'max_marks')::numeric;
  v_marks:=case when v_state='entered' then p_marks else null end;
  if v_state='entered' and (v_marks is null or v_marks::text in ('NaN','Infinity','-Infinity') or v_marks<0 or v_marks>v_max) then
    raise exception 'marks_outside_exam_maximum';
  end if;
  if v_state<>'entered' and p_marks is not null then raise exception 'non_scored_result_cannot_have_marks'; end if;

  perform public.teacher_lock_exam_for_result(p_exam_id,p_school_id,p_class_id,p_subject_id);
  select * into v_exam from public.exams where id=p_exam_id and school_id=p_school_id;
  if not found then raise exception 'exam_not_available'; end if;
  if v_exam.is_locked then raise exception 'exam_locked'; end if;

  perform pg_advisory_xact_lock(hashtextextended(p_exam_id::text||':'||p_student_id::text||':'||p_subject_id::text,0));
  select * into v_existing from public.exam_results
  where exam_id=p_exam_id and student_id=p_student_id and subject_id=p_subject_id for update;

  if found then
    if v_existing.school_id<>p_school_id or v_existing.class_id<>p_class_id or v_existing.teacher_id<>auth.uid() then raise exception 'result_context_not_authorized'; end if;
    if v_existing.marks is not distinct from v_marks and v_existing.result_state=v_state
      and v_existing.max_marks=v_max and v_existing.is_absent=(v_state='absent') then
      return to_jsonb(v_existing);
    end if;
    if p_expected_updated_at is null or v_existing.updated_at is distinct from p_expected_updated_at then raise exception 'result_changed_review_again'; end if;
    update public.exam_results
      set marks=v_marks,result_state=v_state,max_marks=v_max,is_absent=(v_state='absent')
      where id=v_existing.id returning * into v_saved;
  else
    if p_expected_updated_at is not null then raise exception 'result_changed_review_again'; end if;
    insert into public.exam_results(exam_id,school_id,class_id,subject_id,student_id,teacher_id,marks,is_absent,result_state,max_marks)
    values(p_exam_id,p_school_id,p_class_id,p_subject_id,p_student_id,auth.uid(),v_marks,(v_state='absent'),v_state,v_max)
    returning * into v_saved;
  end if;
  if v_saved.id is null then raise exception 'result_not_saved'; end if;
  return to_jsonb(v_saved);
end $$;

revoke all on function public.teacher_save_exam_result_state(uuid,uuid,uuid,uuid,uuid,numeric,text,timestamptz) from public,anon;
grant execute on function public.teacher_save_exam_result_state(uuid,uuid,uuid,uuid,uuid,numeric,text,timestamptz) to authenticated;

create or replace function public.teacher_save_exam_result(
  p_exam_id uuid,p_school_id uuid,p_class_id uuid,p_subject_id uuid,p_student_id uuid,
  p_marks numeric,p_is_absent boolean,p_expected_updated_at timestamptz default null
)
returns jsonb language plpgsql security invoker set search_path=public,pg_temp
as $$
begin
  if p_is_absent is null then raise exception 'result_state_required'; end if;
  return public.teacher_save_exam_result_state(
    p_exam_id,p_school_id,p_class_id,p_subject_id,p_student_id,
    case when p_is_absent then null else p_marks end,
    case when p_is_absent then 'absent' else 'entered' end,
    p_expected_updated_at
  );
end $$;

revoke all on function public.teacher_save_exam_result(uuid,uuid,uuid,uuid,uuid,numeric,boolean,timestamptz) from public,anon;
grant execute on function public.teacher_save_exam_result(uuid,uuid,uuid,uuid,uuid,numeric,boolean,timestamptz) to authenticated;

create or replace function public.teacher_save_exam_result_states(p_changes jsonb)
returns jsonb language plpgsql security invoker set search_path=public,pg_temp
as $$
declare v_row jsonb; v_output jsonb:='[]'::jsonb; v_saved jsonb;
begin
  if auth.uid() is null then raise exception 'not_authenticated'; end if;
  if jsonb_typeof(p_changes) is distinct from 'array' or jsonb_array_length(p_changes)<1 or jsonb_array_length(p_changes)>1000 then raise exception 'invalid_result_batch'; end if;
  if exists(select 1 from jsonb_array_elements(p_changes) e group by e->>'exam_id',e->>'student_id',e->>'subject_id' having count(*)>1) then raise exception 'duplicate_result_target'; end if;
  for v_row in select value from jsonb_array_elements(p_changes) order by value->>'exam_id',value->>'student_id',value->>'subject_id' loop
    v_saved:=public.teacher_save_exam_result_state(
      (v_row->>'exam_id')::uuid,(v_row->>'school_id')::uuid,(v_row->>'class_id')::uuid,
      (v_row->>'subject_id')::uuid,(v_row->>'student_id')::uuid,
      case when v_row ? 'marks' and v_row->>'marks' is not null then (v_row->>'marks')::numeric else null end,
      v_row->>'result_state',
      case when v_row ? 'expected_updated_at' and v_row->>'expected_updated_at' is not null then (v_row->>'expected_updated_at')::timestamptz else null end
    );
    v_output:=v_output||jsonb_build_array(v_saved);
  end loop;
  return v_output;
end $$;

revoke all on function public.teacher_save_exam_result_states(jsonb) from public,anon;
grant execute on function public.teacher_save_exam_result_states(jsonb) to authenticated;

create or replace function public.teacher_save_exam_results(p_changes jsonb)
returns jsonb language plpgsql security invoker set search_path=public,pg_temp
as $$
declare v_row jsonb; v_output jsonb:='[]'::jsonb; v_saved jsonb;
begin
  if auth.uid() is null then raise exception 'not_authenticated'; end if;
  if jsonb_typeof(p_changes) is distinct from 'array' or jsonb_array_length(p_changes)<1 or jsonb_array_length(p_changes)>1000 then raise exception 'invalid_mark_batch'; end if;
  if exists(select 1 from jsonb_array_elements(p_changes) e group by e->>'exam_id',e->>'student_id',e->>'subject_id' having count(*)>1) then raise exception 'duplicate_mark_target'; end if;
  for v_row in select value from jsonb_array_elements(p_changes) order by value->>'exam_id',value->>'student_id',value->>'subject_id' loop
    v_saved:=public.teacher_save_exam_result(
      (v_row->>'exam_id')::uuid,(v_row->>'school_id')::uuid,(v_row->>'class_id')::uuid,
      (v_row->>'subject_id')::uuid,(v_row->>'student_id')::uuid,(v_row->>'marks')::numeric,
      (v_row->>'is_absent')::boolean,
      case when v_row ? 'expected_updated_at' and v_row->>'expected_updated_at' is not null then (v_row->>'expected_updated_at')::timestamptz else null end
    );
    v_output:=v_output||jsonb_build_array(v_saved);
  end loop;
  return v_output;
end $$;

revoke all on function public.teacher_save_exam_results(jsonb) from public,anon;
grant execute on function public.teacher_save_exam_results(jsonb) to authenticated;

create or replace function public.teacher_clear_exam_result(
  p_exam_id uuid,p_school_id uuid,p_class_id uuid,p_subject_id uuid,p_student_id uuid,p_expected_updated_at timestamptz
)
returns jsonb language plpgsql security invoker set search_path=public,pg_temp
as $$
declare v_existing public.exam_results%rowtype;
begin
  if auth.uid() is null then raise exception 'not_authenticated'; end if;
  perform public.teacher_get_exam_subject_policy(p_exam_id,p_school_id,p_class_id,p_subject_id);
  perform public.teacher_lock_exam_for_result(p_exam_id,p_school_id,p_class_id,p_subject_id);
  perform pg_advisory_xact_lock(hashtextextended(p_exam_id::text||':'||p_student_id::text||':'||p_subject_id::text,0));
  select * into v_existing from public.exam_results
  where exam_id=p_exam_id and school_id=p_school_id and class_id=p_class_id and subject_id=p_subject_id and student_id=p_student_id
  for update;
  if not found then return jsonb_build_object('deleted',true,'student_id',p_student_id,'already_missing',true); end if;
  if v_existing.teacher_id<>auth.uid() then raise exception 'result_context_not_authorized'; end if;
  if p_expected_updated_at is null or v_existing.updated_at is distinct from p_expected_updated_at then raise exception 'result_changed_review_again'; end if;
  delete from public.exam_results where id=v_existing.id;
  if found then return jsonb_build_object('deleted',true,'student_id',p_student_id,'already_missing',false); end if;
  raise exception 'result_not_cleared';
end $$;

revoke all on function public.teacher_clear_exam_result(uuid,uuid,uuid,uuid,uuid,timestamptz) from public,anon;
grant execute on function public.teacher_clear_exam_result(uuid,uuid,uuid,uuid,uuid,timestamptz) to authenticated;

comment on column public.exam_results.result_state is 'Canonical exam result state. Not-entered is represented by the absence of a row.';
comment on column public.exam_results.max_marks is 'Raw-score denominator captured with the result; never infer /100.';
comment on column public.exam_results.percentage is 'Derived display metric from raw marks/max_marks. Raw evidence remains authoritative.';
