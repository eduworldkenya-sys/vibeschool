-- Forward-only integration: reuse canonical learner events, enrolment and groups.
-- Recovery: revert client entrypoints; retain enrolment/event history and private sheets.
begin;
create or replace function public.teacher_can_access_class(p_class_id uuid,p_subject_id uuid default null,p_require_class_teacher boolean default false)
returns boolean language sql stable security definer set search_path=public,auth,pg_temp as $$
 select exists(select 1 from public.classes c join public.teacher_classes tc on tc.class_id=c.id and tc.school_id=c.school_id
 join public.school_members sm on sm.school_id=c.school_id and sm.profile_id=tc.teacher_id and sm.role::text='teacher'
 join public.profiles p on p.id=tc.teacher_id and p.role::text='teacher' and p.account_status::text='active' and not coalesce(p.is_anonymized,false)
 where c.id=p_class_id and tc.teacher_id=auth.uid() and (p_subject_id is null or tc.subject_id=p_subject_id) and (not p_require_class_teacher or tc.is_class_teacher));
$$;
revoke all on function public.teacher_can_access_class(uuid,uuid,boolean) from public,anon;
grant execute on function public.teacher_can_access_class(uuid,uuid,boolean) to authenticated,service_role;
create unique index teacher_learner_events_request_student_uidx on public.teacher_learner_events(created_by,student_id,(metadata->>'request_id')) where metadata ? 'request_id';
create function public.teacher_record_class_action(p_class_id uuid,p_subject_id uuid,p_student_ids uuid[],p_kind text,p_note text,p_due_date date,p_request_id uuid)
returns integer language plpgsql security definer set search_path=public,auth,pg_temp as $$
declare v_school uuid; v_hash text; v_existing integer;
begin
 if auth.uid() is null or not public.teacher_can_access_class(p_class_id,p_subject_id,p_subject_id is null) then raise exception 'teacher_scope_not_authorized' using errcode='42501';end if;
 if p_request_id is null or coalesce(cardinality(p_student_ids),0) not between 1 and 1000 or p_kind not in('observation','participation','recognition','followup','parent_contact','management') or length(trim(coalesce(p_note,''))) not between 1 and 2000 then raise exception 'invalid_class_action';end if;
 if (select count(distinct id) from unnest(p_student_ids) id)<>cardinality(p_student_ids) or array_position(p_student_ids,null) is not null then raise exception 'duplicate_or_invalid_learner';end if;
 if p_kind='followup' and p_due_date is null then raise exception 'followup_date_required';end if;
 select c.school_id into v_school from public.classes c where c.id=p_class_id;
 v_hash:=md5(jsonb_build_object('class',p_class_id,'subject',p_subject_id,'learners',(select jsonb_agg(id order by id) from unnest(p_student_ids) id),'kind',p_kind,'note',trim(p_note),'due',p_due_date)::text);
 perform pg_advisory_xact_lock(hashtextextended(auth.uid()::text||p_request_id::text,0));
 select count(*) into v_existing from public.teacher_learner_events e where e.created_by=auth.uid() and e.metadata->>'request_id'=p_request_id::text;
 if v_existing>0 then
  if v_existing<>cardinality(p_student_ids) or exists(select 1 from public.teacher_learner_events e where e.created_by=auth.uid() and e.metadata->>'request_id'=p_request_id::text and e.metadata->>'payload_hash' is distinct from v_hash) then raise exception 'class_action_request_conflict';end if;
  return v_existing;
 end if;
 if exists(select 1 from unnest(p_student_ids) selected(student_id) where not exists(select 1 from public.student_classes sc join public.students s on s.id=sc.student_id and s.deleted_at is null where sc.student_id=selected.student_id and sc.school_id=v_school and sc.class_id=p_class_id and sc.is_current)) then raise exception 'learner_not_in_class';end if;
 insert into public.teacher_learner_events(school_id,class_id,student_id,subject_id,event_kind,note,due_at,created_by,metadata)
 select v_school,p_class_id,id,p_subject_id,p_kind,trim(p_note),case when p_due_date is not null then (p_due_date+time '23:59:59') at time zone 'Africa/Nairobi' end,auth.uid(),jsonb_build_object('request_id',p_request_id,'payload_hash',v_hash) from unnest(p_student_ids) id;
 return cardinality(p_student_ids);
end $$;
revoke all on function public.teacher_record_class_action(uuid,uuid,uuid[],text,text,date,uuid) from public,anon,service_role;
grant execute on function public.teacher_record_class_action(uuid,uuid,uuid[],text,text,date,uuid) to authenticated;

-- Teacher-owned roster changes preserve the same student identity and all evidence.
create function public.teacher_manage_class_learner(p_class_id uuid,p_student_id uuid,p_action text,p_payload jsonb,p_request_id uuid)
returns uuid language plpgsql security definer set search_path=public,auth,pg_temp as $$
declare v_school uuid; v_target uuid; v_hash text; v_old_hash text; v_student public.students%rowtype; v_name text; v_admission text; v_current uuid;
begin
 if auth.uid() is null or not public.teacher_can_access_class(p_class_id,null,true) then raise exception 'class_teacher_required' using errcode='42501';end if;
 if p_request_id is null or p_action not in('edit','move','leave','restore') or jsonb_typeof(p_payload) is distinct from 'object' then raise exception 'invalid_learner_action';end if;
 select school_id into v_school from public.classes where id=p_class_id;
 v_hash:=md5(jsonb_build_object('class',p_class_id,'student',p_student_id,'action',p_action,'payload',p_payload)::text);
 perform pg_advisory_xact_lock(hashtextextended(auth.uid()::text||p_request_id::text,0));
 select metadata->>'payload_hash' into v_old_hash from public.teacher_learner_events where created_by=auth.uid() and metadata->>'request_id'=p_request_id::text limit 1;
 if v_old_hash is not null then if v_old_hash<>v_hash then raise exception 'learner_request_conflict';end if;return p_student_id;end if;
 select * into v_student from public.students where id=p_student_id and deleted_at is null for update;
 if not found then raise exception 'learner_not_found';end if;
 select class_id into v_current from public.student_classes where student_id=p_student_id and is_current;
 if p_action='restore' then
  if v_current is not null or not exists(select 1 from public.student_classes where student_id=p_student_id and class_id=p_class_id and school_id=v_school and not is_current) then raise exception 'learner_restore_conflict';end if;
  update public.student_classes set is_current=true,left_at=null where student_id=p_student_id and class_id=p_class_id and school_id=v_school;
 else
  if v_current is distinct from p_class_id then raise exception 'learner_context_changed';end if;
 end if;
 if p_action='edit' then
  if (p_payload->'expected') is distinct from jsonb_build_object('name',v_student.name,'admission_number',v_student.admission_number,'gender',v_student.gender,'date_of_birth',v_student.date_of_birth) then raise exception 'learner_edit_conflict' using errcode='40001';end if;
  v_name:=trim(p_payload->>'name');v_admission:=nullif(trim(p_payload->>'admission_number'),'');
  if coalesce(length(v_name),0) not between 1 and 200 or coalesce(length(v_admission),0)>80 or (coalesce(p_payload->>'gender','') not in('','male','female','other') and (p_payload->>'gender') is distinct from v_student.gender) then raise exception 'invalid_learner_details';end if;
  if nullif(p_payload->>'date_of_birth','')::date>current_date then raise exception 'invalid_birth_date';end if;
  perform pg_advisory_xact_lock(hashtextextended(v_school::text||':admission',0));
  if v_admission is not null and exists(select 1 from public.students s join public.student_classes sc on sc.student_id=s.id and sc.school_id=v_school where s.id<>p_student_id and s.deleted_at is null and lower(trim(s.admission_number))=lower(v_admission)) then raise exception 'admission_identifier_conflict';end if;
  update public.students set name=v_name,admission_number=v_admission,gender=nullif(p_payload->>'gender',''),date_of_birth=nullif(p_payload->>'date_of_birth','')::date where id=p_student_id;
 end if;
 if p_action='move' then
  v_target:=(p_payload->>'target_class_id')::uuid;
  if v_target is null or v_target=p_class_id or not public.teacher_can_access_class(v_target,null,true) or not exists(select 1 from public.classes where id=v_target and school_id=v_school) then raise exception 'target_class_not_authorized' using errcode='42501';end if;
 end if;
 insert into public.teacher_learner_events(school_id,class_id,student_id,event_kind,event_code,note,created_by,metadata)
 values(v_school,p_class_id,p_student_id,'management',p_action,'Roster updated: '||p_action,auth.uid(),jsonb_build_object('request_id',p_request_id,'payload_hash',v_hash,'target_class_id',v_target));
 if p_action in('move','leave') then
  update public.student_classes set is_current=false,left_at=greatest(clock_timestamp(),joined_at+interval '1 microsecond') where student_id=p_student_id and class_id=p_class_id and is_current;
 end if;
 if p_action='move' then
  insert into public.student_classes(student_id,school_id,class_id,is_current) values(p_student_id,v_school,v_target,true)
  on conflict(student_id,class_id) do update set is_current=true,left_at=null;
 end if;
 if p_action in('move','leave','restore') then update public.students set class_id=case when p_action='leave' then null when p_action='move' then v_target else p_class_id end where id=p_student_id;end if;
 return p_student_id;
end $$;
revoke all on function public.teacher_manage_class_learner(uuid,uuid,text,jsonb,uuid) from public,anon,service_role;
grant execute on function public.teacher_manage_class_learner(uuid,uuid,text,jsonb,uuid) to authenticated;
create function public.teacher_get_departed_class_learners(p_class_id uuid) returns table(id uuid,name text,admission_number text,left_at timestamptz)
language plpgsql security definer set search_path=public,auth,pg_temp as $$
begin
 if auth.uid() is null or not public.teacher_can_access_class(p_class_id,null,true) then raise exception 'class_teacher_required' using errcode='42501';end if;
 return query select s.id,s.name,s.admission_number,sc.left_at from public.student_classes sc join public.students s on s.id=sc.student_id and s.deleted_at is null join public.classes c on c.id=sc.class_id and c.school_id=sc.school_id where sc.class_id=p_class_id and not sc.is_current and not exists(select 1 from public.student_classes current_sc where current_sc.student_id=s.id and current_sc.is_current) order by s.name limit 1000;
end $$;
revoke all on function public.teacher_get_departed_class_learners(uuid) from public,anon,service_role;
grant execute on function public.teacher_get_departed_class_learners(uuid) to authenticated;

-- Workbook group creation inherits the teacher's subject when class-wide access is absent.
create or replace function public.teacher_create_workbook_group(p_school_id uuid,p_class_id uuid,p_name text,p_student_ids uuid[],p_request_id uuid) returns uuid
language plpgsql security invoker set search_path=public,auth,pg_temp as $$
declare v_subject uuid; v_result uuid;
begin
 if auth.uid() is null or not public.teacher_can_access_class(p_class_id) or not exists(select 1 from public.classes where id=p_class_id and school_id=p_school_id) then raise exception 'class_not_assigned' using errcode='42501';end if;
 if p_request_id is null or length(trim(coalesce(p_name,''))) not between 1 and 80 or coalesce(cardinality(p_student_ids),0) not between 1 and 1000 then raise exception 'invalid_group';end if;
 if not public.teacher_can_access_class(p_class_id,null,true) then select subject_id into v_subject from public.teacher_classes where teacher_id=auth.uid() and class_id=p_class_id and school_id=p_school_id order by subject_id limit 1;end if;
 if exists(select 1 from unnest(p_student_ids) student where student is null or not exists(select 1 from public.student_classes sc join public.students s on s.id=sc.student_id and s.deleted_at is null where sc.student_id=student and sc.class_id=p_class_id and sc.school_id=p_school_id and sc.is_current)) then raise exception 'group_learner_not_enrolled';end if;
 insert into public.class_groups(id,class_id,school_id,created_by,subject_id,name,color,type,mode) values(p_request_id,p_class_id,p_school_id,auth.uid(),v_subject,trim(p_name),'#244c37','custom','static') on conflict(id) do nothing returning id into v_result;
 if v_result is null then
  if not exists(select 1 from public.class_groups where id=p_request_id and class_id=p_class_id and created_by=auth.uid() and name=trim(p_name)) or exists(select student from unnest(p_student_ids) student except select student_id from public.class_group_members where group_id=p_request_id) or exists(select student_id from public.class_group_members where group_id=p_request_id except select student from unnest(p_student_ids) student) then raise exception 'group_request_conflict';end if;return p_request_id;
 end if;
 insert into public.class_group_members(group_id,student_id) select v_result,student from (select distinct unnest(p_student_ids) student) selected;return v_result;
end $$;
revoke all on function public.teacher_create_workbook_group(uuid,uuid,text,uuid[],uuid) from public,anon,service_role;
grant execute on function public.teacher_create_workbook_group(uuid,uuid,text,uuid[],uuid) to authenticated;
create or replace function public.teacher_resolve_class_group_members(p_group_id uuid)
returns table(student_id uuid, reason text)
language plpgsql
stable
security definer
set search_path = public, auth, pg_temp
as $$
declare
  g public.class_groups%rowtype;
  v_rule text;
  v_threshold numeric;
  v_count integer;
  v_since timestamptz;
begin
  select * into g from public.class_groups where id = p_group_id and archived_at is null and (expires_at is null or expires_at>now());
  if not found then raise exception 'group_not_found'; end if;
  if (
    (g.subject_id is null and not public.teacher_can_access_class(g.class_id, null, true))
    or
    (g.subject_id is not null and not public.teacher_can_access_class(g.class_id, g.subject_id, false))
  ) then
    raise exception 'teacher_scope_not_authorized';
  end if;

  if g.mode <> 'smart' then
    return query
      select m.student_id, 'saved member'::text
      from public.class_group_members m
      join public.student_classes sc
        on sc.student_id = m.student_id
       and sc.class_id = g.class_id
       and sc.school_id = g.school_id
       and sc.is_current = true
      where m.group_id = g.id;
    return;
  end if;

  v_rule := g.rules->>'rule';

  if v_rule = 'attendance_below' then
    v_threshold := greatest(0, least(100, coalesce((g.rules->>'threshold')::numeric, 80)));
    return query
      with roster as (
        select sc.student_id from public.student_classes sc
        where sc.class_id=g.class_id and sc.school_id=g.school_id and sc.is_current=true
      ), agg as (
        select r.student_id, count(a.id) as total,
          count(a.id) filter (where a.status='present') as present
        from roster r
        left join public.attendance a
          on a.student_id=r.student_id and a.class_id=g.class_id and a.school_id=g.school_id and a.timetable_slot_id is null
        group by r.student_id
      )
      select a.student_id,
        'Attendance ' || round(100.0*a.present/nullif(a.total,0))::text || '% is below ' || round(v_threshold)::text || '%'
      from agg a
      where a.total > 0 and (100.0*a.present/nullif(a.total,0)) < v_threshold;
    return;
  end if;

  if v_rule = 'absence_count_at_least' then
    v_count := greatest(1, least(50, coalesce((g.rules->>'count')::integer, 3)));
    return query
      select sc.student_id, format('%s recorded absences', count(a.id))
      from public.student_classes sc
      join public.attendance a
        on a.student_id=sc.student_id and a.class_id=g.class_id
       and a.school_id=g.school_id and a.status='absent' and a.timetable_slot_id is null
      where sc.class_id=g.class_id and sc.school_id=g.school_id and sc.is_current=true
      group by sc.student_id
      having count(a.id) >= v_count;
    return;
  end if;

  if v_rule = 'missing_homework_at_least' then
    v_count := greatest(1, least(20, coalesce((g.rules->>'count')::integer, 2)));
    return query
      with roster as (
        select sc.student_id from public.student_classes sc
        where sc.class_id=g.class_id and sc.school_id=g.school_id and sc.is_current=true
      ), missing as (
        select r.student_id, count(h.id)::int as missing_count
        from roster r
        join public.homework h
          on h.class_id=g.class_id and h.school_id=g.school_id
         and h.teacher_id=auth.uid()
         and h.due_date is not null and h.due_date < (now() at time zone 'Africa/Nairobi')::date
         and (g.subject_id is null or h.subject=(select name from public.subjects where id=g.subject_id))
         and (h.target_group_id is null or exists(select 1 from public.class_group_members m where m.group_id=h.target_group_id and m.student_id=r.student_id))
        left join public.homework_submissions hs
          on hs.homework_id=h.id and hs.student_id=r.student_id and hs.status in('submitted','received','marked','returned','resubmitted')
        where hs.id is null
        group by r.student_id
      )
      select m.student_id, format('%s overdue tasks have no submission', m.missing_count)
      from missing m where m.missing_count >= v_count;
    return;
  end if;

  if v_rule = 'assessment_below' then
    v_threshold := greatest(0, least(100, coalesce((g.rules->>'threshold')::numeric, 50)));
    return query
      with latest as (
        select distinct on (e.student_id,e.subject_id) e.student_id,e.subject_id,e.percentage
        from public.assessment_gradebook_entries e
        join public.student_classes sc on sc.student_id=e.student_id and sc.class_id=g.class_id and sc.school_id=g.school_id and sc.is_current
        where e.class_id=g.class_id and e.school_id=g.school_id and e.teacher_id=auth.uid() and e.released_at is not null
          and e.percentage is not null and (g.subject_id is null or e.subject_id=g.subject_id)
        order by e.student_id,e.subject_id,e.released_at desc,e.assessment_id desc
      ) select distinct l.student_id,'Latest released score '||round(l.percentage)::text||'% is below '||round(v_threshold)::text||'%'
        from latest l where l.percentage<v_threshold;
    return;
  end if;

  if v_rule = 'no_participation_since' then
    v_since := coalesce((g.rules->>'since')::timestamptz, now() - interval '7 days');
    return query
      select sc.student_id, format('No recorded participation since %s', v_since::date)
      from public.student_classes sc
      where sc.class_id=g.class_id and sc.school_id=g.school_id and sc.is_current=true
        and not exists (
          select 1 from public.teacher_learner_events e
          where e.student_id=sc.student_id
            and e.class_id=g.class_id
            and e.school_id=g.school_id
            and e.event_kind='participation' and e.created_by=auth.uid()
            and e.created_at >= v_since
            and e.archived_at is null
            and (g.subject_id is null or e.subject_id=g.subject_id)
        );
    return;
  end if;

  raise exception 'unsupported_smart_rule';
end;
$$;

revoke all on function public.teacher_resolve_class_group_members(uuid) from public, anon;
grant execute on function public.teacher_resolve_class_group_members(uuid) to authenticated, service_role;

alter table public.student_provisioning_receipts add column request_id uuid;
create unique index student_provisioning_receipts_request_uidx on public.student_provisioning_receipts(actor_id,operation,request_id) where request_id is not null;
create or replace function public.teacher_add_student_v2(
  p_name text,
  p_admission_number text default null,
  p_class_id uuid default null,
  p_school_id uuid default null,
  p_request_id uuid default null
)
returns uuid
language plpgsql
security definer
set search_path = public, auth, pg_temp
as $function$
declare
  v_student_id uuid;
  v_uid uuid := auth.uid();
  v_role text;
  v_admission text := nullif(lower(trim(p_admission_number)), '');
  v_payload_hash text;
  v_saved_hash text;
begin
  if v_uid is null then raise exception 'not_authenticated'; end if;
  if p_school_id is null then raise exception 'school_required'; end if;
  if p_request_id is null then raise exception 'request_id_required'; end if;
  if length(trim(coalesce(p_name,''))) not between 1 and 200 or coalesce(length(p_admission_number),0)>80 then raise exception 'student_name_required'; end if;

  select sm.role::text into v_role
  from public.school_members sm
  where sm.school_id=p_school_id
    and sm.profile_id=v_uid
    and sm.role::text in ('teacher','admin','owner')
  limit 1;
  if v_role is null or not exists(select 1 from public.profiles p where p.id=v_uid and p.account_status::text='active' and not coalesce(p.is_anonymized,false)) then raise exception 'not_authorized'; end if;

  if p_class_id is not null then
    if not exists(select 1 from public.classes c where c.id=p_class_id and c.school_id=p_school_id) then
      raise exception 'class_school_mismatch';
    end if;
    if v_role='teacher' and not exists(
      select 1 from public.teacher_classes tc
      where tc.teacher_id=v_uid and tc.school_id=p_school_id and tc.class_id=p_class_id and tc.is_class_teacher=true
    ) then
      raise exception 'teacher_not_assigned_to_class';
    end if;
  end if;

  v_payload_hash := md5(jsonb_build_object(
    'request_id',p_request_id,'school_id',p_school_id,'class_id',p_class_id,
    'name',trim(p_name),'admission',v_admission
  )::text);

  perform pg_advisory_xact_lock(hashtextextended(
    v_uid::text || ':teacher_add_student_v2:' || p_request_id::text, 0
  ));

  select r.student_id,r.payload_hash into v_student_id,v_saved_hash
  from public.student_provisioning_receipts r where r.actor_id=v_uid and r.operation='teacher_add_student' and r.request_id=p_request_id;
  if v_student_id is not null then
    if v_saved_hash<>v_payload_hash then raise exception 'roster_request_conflict';end if;
    return v_student_id;
  end if;
  perform pg_advisory_xact_lock(hashtextextended(p_school_id::text||':admission',0));

  if v_admission is not null and exists (
    select 1
    from public.students existing
    join public.student_classes sc
      on sc.student_id=existing.id and sc.is_current=true
    where sc.school_id=p_school_id
      and existing.deleted_at is null
      and lower(trim(existing.admission_number))=v_admission
  ) then
    raise exception 'admission_identifier_conflict';
  end if;

  insert into public.students(name,admission_number,class_id,created_by)
  values(trim(p_name),nullif(trim(p_admission_number),''),p_class_id,v_uid)
  returning id into v_student_id;

  if p_class_id is not null then
    insert into public.student_classes(student_id,class_id,school_id,is_current,joined_at)
    values(v_student_id,p_class_id,p_school_id,true,now());
  end if;

  insert into public.student_claim_codes(student_id,code,claimed,role)
  values(v_student_id,upper(substr(replace(gen_random_uuid()::text,'-',''),1,8)),false,'both');

  insert into public.student_provisioning_receipts(actor_id,operation,payload_hash,student_id,request_id)
  values(v_uid,'teacher_add_student',v_payload_hash,v_student_id,p_request_id);

  return v_student_id;
end;
$function$;

revoke all on function public.teacher_add_student_v2(text,text,uuid,uuid,uuid) from public, anon;
grant execute on function public.teacher_add_student_v2(text,text,uuid,uuid,uuid) to authenticated, service_role;

create function public.teacher_start_class_game(p_class_id uuid,p_subject_id uuid,p_title text,p_group_ids uuid[],p_request_id uuid) returns uuid
language plpgsql security definer set search_path=public,auth,pg_temp as $$
declare v_school uuid;v_game public.classroom_games%rowtype;
begin
 if auth.uid() is null or not public.teacher_can_access_class(p_class_id,p_subject_id,p_subject_id is null) then raise exception 'teacher_scope_not_authorized' using errcode='42501';end if;
 if p_request_id is null or length(trim(coalesce(p_title,''))) not between 1 and 100 or coalesce(cardinality(p_group_ids),0) not between 2 and 20 or cardinality(p_group_ids)<>(select count(distinct g) from unnest(p_group_ids) g) then raise exception 'invalid_game';end if;
 select school_id into v_school from public.classes where id=p_class_id;
 perform pg_advisory_xact_lock(hashtextextended(auth.uid()::text||p_request_id::text,0));
 select * into v_game from public.classroom_games where id=p_request_id;
 if v_game.id is not null then
  if v_game.teacher_id<>auth.uid() or v_game.class_id<>p_class_id or v_game.subject_id is distinct from p_subject_id or v_game.title<>trim(p_title) or exists(select g from unnest(p_group_ids) g except select t.group_id from public.classroom_game_teams t where t.game_id=v_game.id) or exists(select t.group_id from public.classroom_game_teams t where t.game_id=v_game.id except select g from unnest(p_group_ids) g) then raise exception 'game_request_conflict';end if;return v_game.id;
 end if;
 if exists(select 1 from unnest(p_group_ids) wanted(id) where not exists(select 1 from public.class_groups g where g.id=wanted.id and g.class_id=p_class_id and g.school_id=v_school and g.subject_id is not distinct from p_subject_id and g.type='game' and g.archived_at is null and (g.expires_at is null or g.expires_at>now()))) then raise exception 'game_group_scope_mismatch';end if;
 insert into public.classroom_games(id,school_id,class_id,subject_id,teacher_id,title,status) values(p_request_id,v_school,p_class_id,p_subject_id,auth.uid(),trim(p_title),'active');
 insert into public.classroom_game_teams(game_id,group_id,label,score) select p_request_id,g.id,g.name,0 from public.class_groups g where g.id=any(p_group_ids);
 return p_request_id;
end $$;
revoke all on function public.teacher_start_class_game(uuid,uuid,text,uuid[],uuid) from public,anon,service_role;
grant execute on function public.teacher_start_class_game(uuid,uuid,text,uuid[],uuid) to authenticated;
create function public.teacher_reset_class_game(p_game_id uuid) returns integer language plpgsql security definer set search_path=public,auth,pg_temp as $$
declare v_game public.classroom_games%rowtype;v_count integer;
begin
 select * into v_game from public.classroom_games where id=p_game_id and teacher_id=auth.uid() and status='active' for update;
 if v_game.id is null or not public.teacher_can_access_class(v_game.class_id,v_game.subject_id,v_game.subject_id is null) then raise exception 'game_not_authorized' using errcode='42501';end if;
 update public.classroom_game_teams set score=0 where game_id=p_game_id;get diagnostics v_count=row_count;return v_count;
end $$;
revoke all on function public.teacher_reset_class_game(uuid) from public,anon,service_role;
grant execute on function public.teacher_reset_class_game(uuid) to authenticated;

commit;
