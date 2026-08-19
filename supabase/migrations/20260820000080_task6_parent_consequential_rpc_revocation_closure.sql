begin;

-- Task 6: consequential Parent RPCs must re-establish current family authority
-- at execution time. SECURITY DEFINER functions cannot rely on caller RLS.

-- Legacy generic Parent conversation creation is superseded by the canonical
-- child-scoped parent_start_child_thread RPC. Production may still contain the
-- legacy function while a clean zero-to-current reconstruction may not. Harden
-- it only when present so repository reconstruction remains deterministic.
do $legacy_parent_start_conversation$
begin
  if to_regprocedure('public.parent_start_conversation(uuid,uuid,text)') is not null then
    execute 'revoke all on function public.parent_start_conversation(uuid,uuid,text) from public, anon, authenticated, service_role';
    execute $sql$
      comment on function public.parent_start_conversation(uuid,uuid,text) is
        'Disabled legacy generic Parent conversation entrypoint. Use parent_start_child_thread so every family conversation is child-scoped and relationship-authorized.'
    $sql$;
  end if;
end;
$legacy_parent_start_conversation$;

-- Rebuild the canonical child-scoped conversation entrypoint around the current
-- canonical enrollment instead of students.class_id, and require an active
-- relationship before both thread reuse and creation.
create or replace function public.parent_start_child_thread(
  p_student_id uuid,
  p_staff_id uuid,
  p_context_tag text default 'general'
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_parent_id uuid := auth.uid();
  v_class_id uuid;
  v_school_id uuid;
  v_staff_role text;
  v_thread_id uuid;
  v_context_tag text;
begin
  if v_parent_id is null then
    raise exception 'authentication required' using errcode = '28000';
  end if;

  if p_student_id is null or p_staff_id is null then
    raise exception 'student and staff are required' using errcode = '22004';
  end if;

  if not public.is_parent_of_student(p_student_id) then
    raise exception 'active parent relationship required' using errcode = '42501';
  end if;

  select sc.class_id, sc.school_id
    into v_class_id, v_school_id
  from public.student_classes sc
  join public.students s on s.id = sc.student_id
  where sc.student_id = p_student_id
    and sc.is_current = true
    and s.deleted_at is null
  order by sc.joined_at desc nulls last, sc.created_at desc nulls last
  limit 1;

  if v_class_id is null or v_school_id is null then
    raise exception 'learner does not have an active school class' using errcode = '23514';
  end if;

  select p.role::text
    into v_staff_role
  from public.profiles p
  where p.id = p_staff_id
    and p.account_status::text = 'active'
    and coalesce(p.is_anonymized, false) = false;

  if v_staff_role = 'teacher' then
    if not exists (
      select 1
      from public.teacher_classes tc
      where tc.teacher_id = p_staff_id
        and tc.class_id = v_class_id
        and tc.school_id = v_school_id
    ) then
      raise exception 'teacher is not assigned to this learner class' using errcode = '42501';
    end if;
  elsif v_staff_role = 'admin' then
    if not exists (
      select 1
      from public.school_members sm
      where sm.profile_id = p_staff_id
        and sm.school_id = v_school_id
        and sm.role = any (array['owner'::public.member_role, 'admin'::public.member_role])
    ) then
      raise exception 'administrator is not authorized for this learner school' using errcode = '42501';
    end if;
  else
    raise exception 'recipient is not authorized school staff' using errcode = '42501';
  end if;

  v_context_tag := case lower(coalesce(p_context_tag, 'general'))
    when 'question' then 'question'
    when 'urgent' then 'urgent'
    when 'concern' then 'concern'
    when 'enquiry' then 'enquiry'
    else 'general'
  end;

  -- Never reuse a sibling/general thread. The learner identity is part of the
  -- conversation identity, and participants who left are not active members.
  select t.id
    into v_thread_id
  from public.vc_threads t
  where t.type = 'direct'
    and t.student_id = p_student_id
    and t.school_id = v_school_id
    and exists (
      select 1
      from public.vc_participants vp
      where vp.thread_id = t.id
        and vp.profile_id = v_parent_id
        and vp.left_at is null
    )
    and exists (
      select 1
      from public.vc_participants vp
      where vp.thread_id = t.id
        and vp.profile_id = p_staff_id
        and vp.left_at is null
    )
  order by t.created_at desc
  limit 1;

  if v_thread_id is not null then
    -- Re-check immediately before returning an existing consequential resource.
    if not public.is_parent_of_student(p_student_id) then
      raise exception 'active parent relationship required' using errcode = '42501';
    end if;
    return v_thread_id;
  end if;

  -- The Task-6 trigger on vc_threads re-checks this relationship on insert/update,
  -- closing the revoke-between-check-and-write TOCTOU window.
  insert into public.vc_threads (
    school_id,
    student_id,
    type,
    created_by,
    context_tag
  ) values (
    v_school_id,
    p_student_id,
    'direct',
    v_parent_id,
    v_context_tag
  )
  returning id into v_thread_id;

  insert into public.vc_participants (thread_id, profile_id, school_id)
  values
    (v_thread_id, v_parent_id, v_school_id),
    (v_thread_id, p_staff_id, v_school_id);

  return v_thread_id;
end;
$function$;

revoke all on function public.parent_start_child_thread(uuid,uuid,text)
  from public, anon, service_role;
grant execute on function public.parent_start_child_thread(uuid,uuid,text)
  to authenticated;

-- Self-use is consequential learner state. A stale Parent session must not retain
-- this mutation after the family relationship has been revoked.
create or replace function public.parent_set_student_self_use(
  p_student_id uuid,
  p_enabled boolean
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $function$
declare
  v_uid uuid := auth.uid();
begin
  if v_uid is null then
    raise exception 'not_authenticated' using errcode = '28000';
  end if;

  if not public.is_parent_of_student(p_student_id) then
    raise exception 'active_parent_relationship_required' using errcode = '42501';
  end if;

  update public.students
  set self_use_enabled = p_enabled,
      self_use_enabled_at = case when p_enabled then now() else null end,
      self_use_enabled_by = case when p_enabled then v_uid else null end
  where id = p_student_id
    and deleted_at is null;

  if not found then
    raise exception 'learner_not_found';
  end if;

  return jsonb_build_object(
    'status','success',
    'student_id',p_student_id,
    'self_use_enabled',p_enabled
  );
end;
$function$;

revoke all on function public.parent_set_student_self_use(uuid,boolean)
  from public, anon, service_role;
grant execute on function public.parent_set_student_self_use(uuid,boolean)
  to authenticated;

-- This SECURITY DEFINER brief bypasses table RLS by design, so release status
-- must be expressed inside the function itself. Never infer Parent visibility
-- from gradebook row existence.
create or replace function public.parent_get_student_kcse_brief(p_student_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $function$
declare
  v_parent uuid := auth.uid();
  v_profile uuid;
  v_target text;
  v_exam date;
begin
  if v_parent is null then
    raise exception 'Authentication required' using errcode = '28000';
  end if;
  if not public.is_parent_of_student(p_student_id) then
    raise exception 'Not authorized' using errcode = '42501';
  end if;

  select profile_id
    into v_profile
  from public.students
  where id = p_student_id
    and deleted_at is null;
  if not found then
    raise exception 'Learner not found';
  end if;

  select kcse_target_grade
    into v_target
  from public.student_home_state
  where student_id = p_student_id;

  select exam_date
    into v_exam
  from public.student_exam_readiness_state
  where student_id = p_student_id;

  return jsonb_build_object(
    'student_id', p_student_id,
    'profile_linked', v_profile is not null,
    'target_grade', v_target,
    'exam_date', v_exam,
    'recent_results', coalesce((
      select jsonb_agg(
        jsonb_build_object(
          'assessment_title', g.assessment_title,
          'assessment_type', g.assessment_type,
          'percentage', g.percentage,
          'released_at', g.released_at,
          'subject_id', g.subject_id
        ) order by g.released_at desc
      )
      from (
        select *
        from public.assessment_gradebook_entries
        where student_id = p_student_id
          and released_at is not null
        order by released_at desc
        limit 8
      ) g
    ), '[]'::jsonb),
    'consistency', jsonb_build_object(
      'learning_days_7d', (
        select count(distinct occurred_at::date)
        from public.student_learning_events
        where student_id = p_student_id
          and occurred_at >= now() - interval '7 days'
      )
    ),
    'guardrail', 'Parent view is intentionally high-level: progress, consistency and released results only.'
  );
end;
$function$;

revoke all on function public.parent_get_student_kcse_brief(uuid)
  from public, anon, service_role;
grant execute on function public.parent_get_student_kcse_brief(uuid)
  to authenticated;

commit;
