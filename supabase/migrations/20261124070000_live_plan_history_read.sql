-- Read-only, teacher-scoped reverse link: normal Lesson Plan -> its Live sessions.
-- No new lesson, attendance, mastery, progress or completion authority.
-- access: authenticated RPC only; private vibe_live tables have no direct grants.
-- authorization-test: scripts/test-live-lesson-two-way.mjs and disposable DB security CI.
-- Rollback: revoke EXECUTE and drop public.vibe_live_plan_history(uuid); no data deletion.
begin;

create or replace function public.vibe_live_plan_history(p_lesson_plan_id uuid)
returns jsonb
language plpgsql security definer set search_path=''
as $$
declare
  v_caller uuid := auth.uid();
  v_plan public.lesson_plans%rowtype;
  v_school uuid;
  v_result jsonb;
begin
  if v_caller is null or p_lesson_plan_id is null then
    raise exception 'live_plan_history_unauthorized' using errcode='42501';
  end if;
  select * into v_plan from public.lesson_plans
    where id=p_lesson_plan_id and teacher_id=v_caller;
  if not found then
    raise exception 'live_plan_history_unauthorized' using errcode='42501';
  end if;
  select c.school_id into v_school
  from public.classes c where c.id=v_plan.class_id;
  if v_school is null or (v_plan.school_id is not null
      and v_plan.school_id<>v_school)
    or not coalesce(public.teacher_can_access_class(v_plan.class_id,null,false),false)
    or (public.teacher_get_operating_context(null)->>'school_id') is distinct from v_school::text then
    raise exception 'live_plan_history_unauthorized' using errcode='42501';
  end if;

  select coalesce(jsonb_agg(
      jsonb_build_object(
        'id',s.id,'title',s.title,'status',s.status,'startedAt',s.created_at,
        'occurrenceId',s.teaching_occurrence_id,
        'joined',(select count(*) from vibe_live.participants p where p.session_id=s.id),
        'responses',(select count(*) from vibe_live.responses a
          join vibe_live.prompts q on q.id=a.prompt_id
          where q.session_id=s.id and q.kind in ('quiz','exercise','poll')),
        'saved',(select count(*) from public.lesson_evidence e
          join vibe_live.prompts q on q.id=e.live_prompt_id
          where q.session_id=s.id)
      ) order by s.created_at desc,s.id
    ),'[]'::jsonb) into v_result
  from (
    select id,title,status,created_at,teaching_occurrence_id
    from vibe_live.sessions
    where lesson_plan_id=p_lesson_plan_id and teacher_id=v_caller
      and class_id=v_plan.class_id and school_id=v_school and mode='school'
    order by created_at desc,id
    limit 12
  ) s;
  return v_result;
end;
$$;

revoke all on function public.vibe_live_plan_history(uuid)
  from public,anon,authenticated;
grant execute on function public.vibe_live_plan_history(uuid) to authenticated;
commit;
