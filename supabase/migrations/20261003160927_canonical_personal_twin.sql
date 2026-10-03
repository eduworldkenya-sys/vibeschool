-- Extend the canonical personal profile/memory; never create a second learner model.
begin;
alter table public.twin_profile add column if not exists twin_settings jsonb not null default '{"enabled":true,"collective":false}'::jsonb;
alter table public.twin_memory add column if not exists event_key uuid;
alter table public.twin_memory add column if not exists active_role text;
alter table public.twin_memory add column if not exists scope_id text;
alter table public.twin_memory add column if not exists route text;
alter table public.twin_memory add column if not exists action text;
alter table public.twin_memory add column if not exists previous_action text;
create unique index if not exists twin_memory_event_dedupe on public.twin_memory(user_id,event_key) where event_key is not null;
create index if not exists twin_memory_scoped_recent on public.twin_memory(user_id,active_role,scope_id,created_at desc) where type='activity_v1';

-- Scope is always revalidated; personal preferences never confer permissions.
create or replace function public.twin_assert_personal_scope(p_role text,p_scope_id text)
returns void language plpgsql security invoker set search_path=public,pg_temp as $$
declare v_uid uuid:=auth.uid(); v_school uuid; v_context jsonb;
begin
  if v_uid is null then raise exception 'not_authenticated'; end if;
  if p_scope_id is null or length(p_scope_id)<1 or length(p_scope_id)>100 then raise exception 'twin_scope_required'; end if;
  if p_role in ('teacher','admin') then
    v_school:=p_scope_id::uuid;
    if p_role='teacher' then
      v_context:=public.teacher_get_operating_context(v_school);
      if (v_context->>'school_id')::uuid is distinct from v_school then raise exception 'twin_scope_not_authorized'; end if;
    elsif not public.is_school_admin(v_school) then raise exception 'twin_scope_not_authorized'; end if;
  elsif p_role='student' then
    if public.current_student_id()::text is distinct from p_scope_id then raise exception 'twin_scope_not_authorized'; end if;
  elsif p_role='parent' then
    if p_scope_id<>v_uid::text or not exists(select 1 from public.parent_student_links where parent_id=v_uid and coalesce(access_level,'full')<>'none') then raise exception 'twin_scope_not_authorized'; end if;
  elsif p_role='hq' then
    if p_scope_id<>'vibeschool' or not public.is_platform_owner() then raise exception 'twin_scope_not_authorized'; end if;
  else raise exception 'twin_role_not_authorized'; end if;
end $$;

create or replace function public.twin_observe_activity(p_role text,p_scope_id text,p_route text,p_action text,p_event_key uuid)
returns boolean language plpgsql security invoker set search_path=public,pg_temp as $$
declare v_uid uuid:=auth.uid(); v_previous text; v_settings jsonb; v_event uuid;
begin
  perform public.twin_assert_personal_scope(p_role,p_scope_id);
  if p_event_key is null or p_route is null or p_route !~ ('^/'||p_role||'(/[a-z0-9_-]+)*$') or length(p_route)>200
    or p_action is null or p_action not in ('home','attendance','results','assessment','homework','timetable','scheme','classhub','students','lessonplan','teach','resources','reports','search','accepted','dismissed','mark_saved','attendance_saved','homework_assigned','lesson_started','lesson_completed','scheme_updated','assessment_saved','student_added','class_created','work_submitted') then raise exception 'invalid_twin_observation'; end if;
  -- Serialize this user's events and settings, preserving order under retries.
  insert into public.twin_profile(user_id) values(v_uid) on conflict(user_id) do nothing;
  select twin_settings into v_settings from public.twin_profile where user_id=v_uid for update;
  if v_settings->'enabled'='false'::jsonb then return false; end if;
  select action into v_previous from public.twin_memory where user_id=v_uid and type='activity_v1'
    and active_role=p_role and scope_id=p_scope_id and created_at>now()-interval '30 minutes'
    order by created_at desc,id desc limit 1;
  -- Only allowlisted categories and route templates are retained, never raw queries/names/marks.
  insert into public.twin_memory(user_id,type,content,event_key,active_role,scope_id,route,action,previous_action)
  values(v_uid,'activity_v1','Observed product activity',p_event_key,p_role,p_scope_id,p_route,p_action,v_previous)
  on conflict(user_id,event_key) where event_key is not null do nothing returning id into v_event;
  if v_event is null then return true; end if;
  delete from public.twin_memory where user_id=v_uid and type='activity_v1' and created_at<now()-interval '90 days';
  update public.twin_profile set updated_at=now() where user_id=v_uid;
  return true;
end $$;

-- Successful domain writes feed the same personal memory even while the drawer
-- is closed. No names, scores or record bodies are copied. Observation is optional:
-- a memory failure is visible in database warnings and cannot undo classroom work.
create or replace function public.twin_capture_domain_activity()
returns trigger language plpgsql security invoker set search_path=public,pg_temp as $$
declare v_row jsonb:=to_jsonb(new); v_old jsonb; v_uid uuid:=auth.uid(); v_school text; v_role text; v_scope text; v_action text; v_screen text; v_key uuid;
begin
  if v_uid is null then return new; end if;
  if TG_OP='UPDATE' then
    v_old:=to_jsonb(old);
    if (v_row-'updated_at')=(v_old-'updated_at') then return new; end if;
  end if;
  v_school:=v_row->>'school_id';
  if TG_TABLE_NAME='homework_submissions' and v_row->>'student_id'=public.current_student_id()::text then
    v_role:='student';v_scope:=v_row->>'student_id';v_action:='work_submitted';v_screen:='tasks';
  elsif v_school is not null and (
    v_row->>'teacher_id'=v_uid::text or public.is_live_teacher_class(v_school::uuid,coalesce(v_row->>'class_id',v_row->>'id')::uuid)
  ) then v_role:='teacher';v_scope:=v_school;
  elsif v_school is not null and public.is_school_admin(v_school::uuid) then v_role:='admin';v_scope:=v_school;
  else return new; end if;
  if v_action is null then
    case TG_TABLE_NAME
      when 'exam_results' then v_action:='mark_saved';v_screen:='results';
      when 'attendance' then v_action:='attendance_saved';v_screen:='attendance';
      when 'homework' then v_action:='homework_assigned';v_screen:='homework';
      when 'lesson_plans' then v_action:='lessonplan';v_screen:='lessonplan';
      when 'scheme_of_work' then v_action:='scheme_updated';v_screen:='scheme';
      when 'cbc_assessments' then v_action:='assessment_saved';v_screen:='assessment';
      when 'teaching_occurrences' then
        v_action:=case v_row->>'lifecycle' when 'completed' then 'lesson_completed' when 'in_progress' then 'lesson_started' else 'teach' end;v_screen:='teach';
      when 'student_classes' then v_action:='student_added';v_screen:='classhub';
      when 'classes' then v_action:='class_created';v_screen:='classhub';
      else return new;
    end case;
  end if;
  -- One observation for a batch statement, not one per learner in a register.
  v_key:=md5(v_uid::text||v_scope||TG_TABLE_NAME||v_action||statement_timestamp()::text)::uuid;
  perform public.twin_observe_activity(v_role,v_scope,'/'||v_role||'/'||v_screen,v_action,v_key);
  return new;
exception when others then
  raise warning 'twin_activity_capture_failed table=% sqlstate=%',TG_TABLE_NAME,SQLSTATE;
  return new;
end $$;
revoke all on function public.twin_capture_domain_activity() from public,anon,authenticated;

do $$ declare v_table text; begin
  foreach v_table in array array['exam_results','attendance','homework','lesson_plans','scheme_of_work','cbc_assessments','teaching_occurrences','student_classes','classes','homework_submissions'] loop
    if to_regclass('public.'||v_table) is not null then
      execute format('drop trigger if exists twin_capture_activity on public.%I',v_table);
      execute format('create trigger twin_capture_activity after insert or update on public.%I for each row execute function public.twin_capture_domain_activity()',v_table);
    end if;
  end loop;
end $$;

create or replace function public.twin_get_personal_memory(p_role text,p_scope_id text)
returns jsonb language plpgsql security invoker set search_path=public,pg_temp as $$
declare v_events jsonb; v_settings jsonb;
begin
  perform public.twin_assert_personal_scope(p_role,p_scope_id);
  select twin_settings into v_settings from public.twin_profile where user_id=auth.uid();
  select coalesce(jsonb_agg(to_jsonb(e) order by e.created_at desc,e.id desc),'[]') into v_events from
    (select id,active_role as role,scope_id,route,action,previous_action,created_at from public.twin_memory
     where user_id=auth.uid() and type='activity_v1' and active_role=p_role and scope_id=p_scope_id
     and created_at>now()-interval '90 days' order by created_at desc,id desc limit 300) e;
  return jsonb_build_object('settings',coalesce(v_settings,'{"enabled":true,"collective":false}'::jsonb),'observations',v_events,'retention_days',90,'source','observed_activity_not_authoritative_records');
end $$;

create or replace function public.twin_set_personal_settings(p_enabled boolean,p_collective boolean)
returns jsonb language plpgsql security invoker set search_path=public,pg_temp as $$
declare v_settings jsonb;
begin
  if auth.uid() is null then raise exception 'not_authenticated'; end if;
  if p_enabled is null or p_collective is null then raise exception 'twin_settings_required'; end if;
  v_settings:=jsonb_build_object('enabled',p_enabled,'collective',p_collective);
  insert into public.twin_profile(user_id,twin_settings) values(auth.uid(),v_settings)
  on conflict(user_id) do update set twin_settings=excluded.twin_settings,updated_at=now();
  return v_settings;
end $$;

create or replace function public.twin_forget_activity()
returns bigint language plpgsql security invoker set search_path=public,pg_temp as $$
declare v_count bigint;
begin
  if auth.uid() is null then raise exception 'not_authenticated'; end if;
  delete from public.twin_memory where user_id=auth.uid() and type='activity_v1';
  get diagnostics v_count=row_count;
  update public.twin_profile set updated_at=now() where user_id=auth.uid();
  return v_count;
end $$;

-- Coarse next-action hints from the last completed week, minimum 50 opted-in
-- people per transition. No content, names, school/entity IDs or exact counts leave this function.
create or replace function public.twin_collective_hints(p_role text,p_scope_id text,p_previous_action text)
returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare v_result jsonb;
begin
  perform public.twin_assert_personal_scope(p_role,p_scope_id);
  if p_previous_action not in ('home','attendance','results','assessment','homework','timetable','scheme','classhub','students','lessonplan','teach','resources','reports','mark_saved') then return '[]'::jsonb; end if;
  select coalesce(jsonb_agg(jsonb_build_object('action',x.action,'route',x.route,'source','collective_opt_in','confidence','limited')),'[]'::jsonb)
  into v_result from (
    select m.action,m.route from public.twin_memory m join public.twin_profile p on p.user_id=m.user_id
    where m.type='activity_v1' and m.active_role=p_role and m.previous_action=p_previous_action
      and p.twin_settings @> '{"collective":true,"enabled":true}'::jsonb
      and m.created_at>=date_trunc('week',now())-interval '7 days' and m.created_at<date_trunc('week',now())
      and m.action in ('attendance','results','assessment','homework','timetable','scheme','classhub','students','lessonplan','teach','resources','reports')
      and m.route ~ ('^/'||p_role||'/[a-z-]+$')
    group by m.action,m.route having count(distinct m.user_id)>=50 order by count(distinct m.user_id) desc limit 3
  ) x;
  return v_result;
end $$;

-- A row lock on shared exams requires their UPDATE policy in PostgreSQL. Teachers
-- may read a school exam without owning it. This narrow helper acquires only the
-- exam lock after current subject authorization; it never writes an exam/result.
create or replace function public.teacher_lock_exam_for_result(p_exam_id uuid,p_school_id uuid,p_class_id uuid,p_subject_id uuid)
returns void language plpgsql security definer set search_path=public,pg_temp as $$
declare v_locked boolean;
begin
  if auth.uid() is null then raise exception 'not_authenticated'; end if;
  if not public.is_live_teacher_subject(p_school_id,p_class_id,p_subject_id) then raise exception 'teacher_subject_not_authorized'; end if;
  select is_locked into v_locked from public.exams where id=p_exam_id and school_id=p_school_id for share;
  if not found then raise exception 'exam_not_available'; end if;
  if v_locked then raise exception 'exam_locked'; end if;
end $$;

-- One canonical transactional mark save for markbook and Twin. INVOKER preserves
-- existing RLS. Existing audit triggers keep consequential lineage.
create or replace function public.teacher_save_exam_result(p_exam_id uuid,p_school_id uuid,p_class_id uuid,p_subject_id uuid,p_student_id uuid,p_marks numeric,p_is_absent boolean,p_expected_updated_at timestamptz default null)
returns jsonb language plpgsql security invoker set search_path=public,pg_temp as $$
declare v_exam public.exams%rowtype; v_existing public.exam_results%rowtype; v_saved public.exam_results%rowtype; v_context jsonb;
begin
  if auth.uid() is null then raise exception 'not_authenticated'; end if;
  v_context:=public.teacher_get_operating_context(null);
  if nullif(v_context->>'school_id','')::uuid is distinct from p_school_id then raise exception 'active_school_changed'; end if;
  if not exists(select 1 from public.profiles where id=auth.uid() and account_status::text='active' and not coalesce(is_anonymized,false)) then raise exception 'teacher_account_not_active'; end if;
  if p_marks is null or p_marks::text in ('NaN','Infinity','-Infinity') or p_marks<0 or p_marks>100 or p_is_absent is null or (p_is_absent and p_marks<>0) then raise exception 'marks_must_be_0_to_100'; end if;
  if not public.is_live_teacher_subject(p_school_id,p_class_id,p_subject_id) then raise exception 'teacher_subject_not_authorized'; end if;
  if not exists(select 1 from public.student_classes where school_id=p_school_id and class_id=p_class_id and student_id=p_student_id and is_current=true and exists(select 1 from public.students s where s.id=p_student_id and s.deleted_at is null)) then raise exception 'student_not_in_current_class'; end if;
  perform public.teacher_lock_exam_for_result(p_exam_id,p_school_id,p_class_id,p_subject_id);
  select * into v_exam from public.exams where id=p_exam_id and school_id=p_school_id;
  if not found then raise exception 'exam_not_available'; end if;
  if v_exam.is_locked then raise exception 'exam_locked'; end if;
  perform pg_advisory_xact_lock(hashtextextended(p_exam_id::text||':'||p_student_id::text||':'||p_subject_id::text,0));
  select * into v_existing from public.exam_results where exam_id=p_exam_id and student_id=p_student_id and subject_id=p_subject_id for update;
  if found then
    if v_existing.school_id<>p_school_id or v_existing.class_id<>p_class_id or v_existing.teacher_id<>auth.uid() then raise exception 'result_context_not_authorized'; end if;
    -- Same-value retries are safe; changed records require fresh review.
    if v_existing.marks=p_marks and v_existing.is_absent=p_is_absent then return to_jsonb(v_existing); end if;
    if p_expected_updated_at is null or v_existing.updated_at is distinct from p_expected_updated_at then raise exception 'result_changed_review_again'; end if;
    update public.exam_results set marks=p_marks,is_absent=p_is_absent where id=v_existing.id returning * into v_saved;
  else
    if p_expected_updated_at is not null then raise exception 'result_changed_review_again'; end if;
    insert into public.exam_results(exam_id,school_id,class_id,subject_id,student_id,teacher_id,marks,is_absent)
    values(p_exam_id,p_school_id,p_class_id,p_subject_id,p_student_id,auth.uid(),p_marks,p_is_absent) returning * into v_saved;
  end if;
  if v_saved.id is null then raise exception 'result_not_saved'; end if;
  return to_jsonb(v_saved);
end $$;

create or replace function public.teacher_save_exam_results(p_changes jsonb)
returns jsonb language plpgsql security invoker set search_path=public,pg_temp as $$
declare v_row jsonb; v_output jsonb:='[]'::jsonb; v_saved jsonb;
begin
  if auth.uid() is null then raise exception 'not_authenticated'; end if;
  if jsonb_typeof(p_changes) is distinct from 'array' or jsonb_array_length(p_changes)<1 or jsonb_array_length(p_changes)>1000 then raise exception 'invalid_mark_batch'; end if;
  if exists(select 1 from jsonb_array_elements(p_changes) e group by e->>'exam_id',e->>'student_id',e->>'subject_id' having count(*)>1) then raise exception 'duplicate_mark_target'; end if;
  for v_row in select value from jsonb_array_elements(p_changes) order by value->>'exam_id',value->>'student_id',value->>'subject_id' loop
    v_saved:=public.teacher_save_exam_result((v_row->>'exam_id')::uuid,(v_row->>'school_id')::uuid,(v_row->>'class_id')::uuid,(v_row->>'subject_id')::uuid,(v_row->>'student_id')::uuid,(v_row->>'marks')::numeric,(v_row->>'is_absent')::boolean,(v_row->>'expected_updated_at')::timestamptz);
    v_output:=v_output||jsonb_build_array(v_saved);
  end loop;
  return v_output;
end $$;
revoke all on function public.teacher_save_exam_results(jsonb) from public,anon;
grant execute on function public.teacher_save_exam_results(jsonb) to authenticated;

revoke all on function public.twin_assert_personal_scope(text,text) from public,anon;
revoke all on function public.twin_observe_activity(text,text,text,text,uuid) from public,anon;
revoke all on function public.twin_get_personal_memory(text,text) from public,anon;
revoke all on function public.twin_set_personal_settings(boolean,boolean) from public,anon;
revoke all on function public.twin_forget_activity() from public,anon;
revoke all on function public.twin_collective_hints(text,text,text) from public,anon;
revoke all on function public.teacher_save_exam_result(uuid,uuid,uuid,uuid,uuid,numeric,boolean,timestamptz) from public,anon;
revoke all on function public.teacher_lock_exam_for_result(uuid,uuid,uuid,uuid) from public,anon;
grant execute on function public.teacher_lock_exam_for_result(uuid,uuid,uuid,uuid) to authenticated;
grant execute on function public.twin_assert_personal_scope(text,text),public.twin_observe_activity(text,text,text,text,uuid),public.twin_get_personal_memory(text,text),public.twin_set_personal_settings(boolean,boolean),public.twin_forget_activity(),public.twin_collective_hints(text,text,text),public.teacher_save_exam_result(uuid,uuid,uuid,uuid,uuid,numeric,boolean,timestamptz) to authenticated;
commit;
