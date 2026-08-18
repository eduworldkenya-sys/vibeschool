-- Student = 1 full-journey certification.
-- Closes two remaining pilot-level defects:
-- 1) parent KCSE visibility must be relationship-authorized, not notification-preference-authorized;
-- 2) identity-health instrumentation must complete reliably on production-size catalogs.
-- Also introduces one reusable teacher->student relationship predicate to prevent authorization drift.
-- authorization-test: public.parent_student_links
-- authorization-test: public.student_identity_health_runs
-- authorization-test: public.student_classes
-- authorization-test: public.teacher_classes

-- ---------------------------------------------------------------------------
-- Canonical adult relationship predicates.
-- ---------------------------------------------------------------------------
create or replace function public.is_teacher_of_student(p_student_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $function$
  select exists (
    select 1
    from public.student_classes sc
    join public.teacher_classes tc
      on tc.class_id = sc.class_id
     and tc.school_id = sc.school_id
    where sc.student_id = p_student_id
      and sc.is_current = true
      and tc.teacher_id = auth.uid()
  );
$function$;

revoke all on function public.is_teacher_of_student(uuid) from public, anon;
grant execute on function public.is_teacher_of_student(uuid) to authenticated, service_role;

-- Parent access is relationship authority. receives_alerts is only a notification preference.
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
  if v_parent is null then raise exception 'Authentication required'; end if;
  if not public.is_parent_of_student(p_student_id) then raise exception 'Not authorized'; end if;

  select profile_id into v_profile
  from public.students
  where id = p_student_id and deleted_at is null;

  if not found then raise exception 'Learner not found'; end if;

  select kcse_target_grade into v_target
  from public.student_home_state
  where student_id = p_student_id;

  select exam_date into v_exam
  from public.student_exam_readiness_state
  where student_id = p_student_id;

  return jsonb_build_object(
    'student_id',p_student_id,
    'profile_linked',v_profile is not null,
    'target_grade',v_target,
    'exam_date',v_exam,
    'recent_results',coalesce((
      select jsonb_agg(jsonb_build_object(
        'assessment_title',g.assessment_title,
        'assessment_type',g.assessment_type,
        'percentage',g.percentage,
        'released_at',g.released_at,
        'subject_id',g.subject_id
      ) order by g.released_at desc)
      from (
        select * from public.assessment_gradebook_entries
        where student_id=p_student_id
        order by released_at desc
        limit 8
      ) g
    ),'[]'::jsonb),
    'consistency',jsonb_build_object(
      'learning_days_7d',(
        select count(distinct occurred_at::date)
        from public.student_learning_events
        where student_id=p_student_id
          and occurred_at>=now()-interval '7 days'
      )
    ),
    'guardrail','Parent view is intentionally high-level: progress, consistency and released results only.'
  );
end;
$function$;

revoke all on function public.parent_get_student_kcse_brief(uuid) from public, anon;
grant execute on function public.parent_get_student_kcse_brief(uuid) to authenticated, service_role;

-- Teacher views share one canonical relationship predicate.
create or replace function public.teacher_get_student_kcse_brief(p_student_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $function$
declare
  v_teacher uuid := auth.uid();
  v_profile uuid;
  v_target text;
  v_exam date;
begin
  if v_teacher is null then raise exception 'Authentication required'; end if;
  if not public.is_teacher_of_student(p_student_id) then raise exception 'Not authorized'; end if;

  select profile_id into v_profile
  from public.students
  where id=p_student_id and deleted_at is null;
  if not found then raise exception 'Learner not found'; end if;

  select kcse_target_grade into v_target
  from public.student_home_state
  where student_id=p_student_id;

  select exam_date into v_exam
  from public.student_exam_readiness_state
  where student_id=p_student_id;

  return jsonb_build_object(
    'student_id',p_student_id,
    'profile_linked',v_profile is not null,
    'target_grade',v_target,
    'exam_date',v_exam,
    'subject_progress',coalesce((
      select jsonb_agg(jsonb_build_object(
        'subject_id',sp.subject_id,
        'completed_tasks',sp.completed_tasks,
        'total_tasks',sp.total_tasks,
        'average_score',sp.average_score,
        'mastery_percentage',sp.mastery_percentage
      ) order by sp.updated_at desc)
      from public.student_subject_progress sp
      where sp.student_id=p_student_id
    ),'[]'::jsonb),
    'open_interventions',coalesce((
      select jsonb_agg(jsonb_build_object(
        'id',i.id,'priority',i.priority,'recommendation',i.recommendation,
        'status',i.status,'due_at',i.due_at
      ) order by i.created_at desc)
      from public.assessment_interventions i
      where i.student_id=p_student_id and i.status<>'completed'
    ),'[]'::jsonb),
    'recent_results',coalesce((
      select jsonb_agg(jsonb_build_object(
        'title',g.assessment_title,'type',g.assessment_type,'percentage',g.percentage,
        'released_at',g.released_at,'subject_id',g.subject_id
      ) order by g.released_at desc)
      from (
        select * from public.assessment_gradebook_entries
        where student_id=p_student_id
        order by released_at desc
        limit 12
      ) g
    ),'[]'::jsonb),
    'guardrail','Teacher view exposes evidence and interventions, not private learner notes or public ranking.'
  );
end;
$function$;

create or replace function public.teacher_get_student_personalized_path(p_student_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $function$
declare
  caller uuid := auth.uid();
  result jsonb;
begin
  if caller is null then raise exception 'not_authenticated'; end if;
  if not public.is_teacher_of_student(p_student_id) then raise exception 'not_authorized'; end if;

  select jsonb_build_object(
    'student_id',p_student_id,
    'recommendations',coalesce((
      select jsonb_agg(jsonb_build_object(
        'id',r.id,'subject_id',r.subject_id,'outcome_id',r.outcome_id,
        'type',r.recommendation_type,'title',r.title,'reason',r.reason,
        'confidence',r.confidence_score,'priority',r.priority_score,
        'next_review_at',r.next_review_at
      ) order by r.priority_score desc)
      from public.student_learning_recommendations r
      where r.student_id=p_student_id and r.status='active'
    ),'[]'::jsonb),
    'timeline',coalesce((
      select jsonb_agg(jsonb_build_object(
        'event_type',t.event_type,'source_type',t.source_type,'title',t.title,
        'summary',t.summary,'occurred_at',t.occurred_at,'metadata',t.metadata
      ) order by t.occurred_at desc)
      from (
        select * from public.student_learning_timeline
        where student_id=p_student_id
        order by occurred_at desc
        limit 30
      ) t
    ),'[]'::jsonb),
    'subject_progress',coalesce((
      select jsonb_agg(jsonb_build_object(
        'subject_id',p.subject_id,'completed_tasks',p.completed_tasks,
        'total_tasks',p.total_tasks,'average_score',p.average_score,
        'mastery_percentage',p.mastery_percentage
      ) order by p.updated_at desc)
      from public.student_subject_progress p
      where p.student_id=p_student_id
    ),'[]'::jsonb)
  ) into result;

  return result;
end;
$function$;

revoke all on function public.teacher_get_student_kcse_brief(uuid) from public, anon;
grant execute on function public.teacher_get_student_kcse_brief(uuid) to authenticated, service_role;
revoke all on function public.teacher_get_student_personalized_path(uuid) from public, anon;
grant execute on function public.teacher_get_student_personalized_path(uuid) to authenticated, service_role;

-- ---------------------------------------------------------------------------
-- Fast, production-safe Student=1 health instrumentation.
-- ---------------------------------------------------------------------------
create or replace function public.run_student_identity_health_check()
returns jsonb
language plpgsql
security definer
set search_path = public, pg_catalog, pg_temp
as $function$
declare
  v_wrong_fk integer := 0;
  v_missing_fk integer := 0;
  v_duplicates integer := 0;
  v_role_mismatch integer := 0;
  v_profile_without_learner integer := 0;
  v_claimed integer := 0;
  v_unclaimed integer := 0;
  v_status text;
  v_id uuid;
begin
  if current_user not in ('postgres','service_role') then
    raise exception 'service_role_required';
  end if;

  -- pg_catalog avoids the expensive information_schema expansion that timed out in production.
  with student_cols as (
    select a.attrelid, a.attnum
    from pg_attribute a
    join pg_class t on t.oid=a.attrelid
    join pg_namespace n on n.oid=t.relnamespace
    where n.nspname='public'
      and t.relkind in ('r','p')
      and a.attname='student_id'
      and a.attnum>0
      and not a.attisdropped
  ), student_fks as (
    select c.conrelid, unnest(c.conkey) as attnum, c.confrelid, c.confkey
    from pg_constraint c
    where c.contype='f'
      and c.connamespace='public'::regnamespace
  )
  select
    count(*) filter (
      where f.conrelid is not null
        and not (
          f.confrelid='public.students'::regclass
          and f.confkey = array[(select attnum from pg_attribute where attrelid='public.students'::regclass and attname='id' and not attisdropped)]::smallint[]
        )
    )::integer,
    count(*) filter (where f.conrelid is null)::integer
  into v_wrong_fk,v_missing_fk
  from student_cols s
  left join student_fks f on f.conrelid=s.attrelid and f.attnum=s.attnum;

  select count(*)::integer into v_duplicates
  from (
    select profile_id
    from public.students
    where profile_id is not null and deleted_at is null
    group by profile_id
    having count(*)>1
  ) d;

  select count(*)::integer into v_role_mismatch
  from public.students s
  join public.profiles p on p.id=s.profile_id
  where s.deleted_at is null
    and s.profile_id is not null
    and p.role::text<>'student';

  select count(*)::integer into v_profile_without_learner
  from public.profiles p
  where p.role::text='student'
    and p.account_status::text='active'
    and not p.is_anonymized
    and not exists (
      select 1 from public.students s
      where s.profile_id=p.id and s.deleted_at is null
    );

  select count(*) filter(where profile_id is not null)::integer,
         count(*) filter(where profile_id is null)::integer
  into v_claimed,v_unclaimed
  from public.students
  where deleted_at is null;

  v_status := case
    when v_wrong_fk>0 or v_missing_fk>0 or v_duplicates>0 or v_role_mismatch>0 then 'blocked'
    when v_profile_without_learner>0 then 'attention'
    else 'healthy'
  end;

  insert into public.student_identity_health_runs(
    wrong_student_fk_domains,missing_student_fk_constraints,
    duplicate_active_profile_mappings,active_profile_role_mismatches,
    active_student_profiles_without_learner,claimed_active_learners,
    unclaimed_active_learners,status,details
  ) values (
    v_wrong_fk,v_missing_fk,v_duplicates,v_role_mismatch,
    v_profile_without_learner,v_claimed,v_unclaimed,v_status,
    jsonb_build_object(
      'canonical_rule','public student_id columns must FK to public.students(id)',
      'resolver_rule','one active learner row per claimed student profile; ambiguity fails closed',
      'adult_rule','parent and teacher authority comes from canonical student relationships, not account UUID substitution or notification preferences',
      'historical_policy','unclaimed roster learners and incomplete legacy accounts are observed, never guessed or auto-linked'
    )
  ) returning id into v_id;

  return jsonb_build_object(
    'run_id',v_id,'status',v_status,
    'wrong_student_fk_domains',v_wrong_fk,
    'missing_student_fk_constraints',v_missing_fk,
    'duplicate_active_profile_mappings',v_duplicates,
    'active_profile_role_mismatches',v_role_mismatch,
    'active_student_profiles_without_learner',v_profile_without_learner,
    'claimed_active_learners',v_claimed,
    'unclaimed_active_learners',v_unclaimed
  );
end;
$function$;

revoke all on function public.run_student_identity_health_check() from public, anon, authenticated;
grant execute on function public.run_student_identity_health_check() to service_role;

-- ---------------------------------------------------------------------------
-- Fail-closed structural/runtime certification.
-- ---------------------------------------------------------------------------
do $$
declare
  v_bad integer;
  v_def text;
begin
  select count(*)::integer into v_bad
  from pg_constraint c
  join pg_class t on t.oid=c.conrelid
  join pg_namespace n on n.oid=t.relnamespace
  where n.nspname='public'
    and c.contype='f'
    and pg_get_constraintdef(c.oid) like 'FOREIGN KEY (student_id)%'
    and c.confrelid<>'public.students'::regclass;
  if v_bad<>0 then raise exception 'student_one_noncanonical_fk_count:%',v_bad; end if;

  v_def:=pg_get_functiondef('public.parent_get_student_kcse_brief(uuid)'::regprocedure);
  if position('public.is_parent_of_student(p_student_id)' in v_def)=0
     or position('receives_alerts' in v_def)>0 then
    raise exception 'parent_visibility_authority_not_canonical';
  end if;

  v_def:=pg_get_functiondef('public.teacher_get_student_kcse_brief(uuid)'::regprocedure);
  if position('public.is_teacher_of_student(p_student_id)' in v_def)=0 then
    raise exception 'teacher_kcse_authority_not_canonical';
  end if;

  v_def:=pg_get_functiondef('public.teacher_get_student_personalized_path(uuid)'::regprocedure);
  if position('public.is_teacher_of_student(p_student_id)' in v_def)=0 then
    raise exception 'teacher_path_authority_not_canonical';
  end if;

  v_def:=pg_get_functiondef('public.run_student_identity_health_check()'::regprocedure);
  if position('information_schema' in v_def)>0 or position('pg_attribute' in v_def)=0 then
    raise exception 'student_identity_health_scan_not_catalog_safe';
  end if;
end $$;
