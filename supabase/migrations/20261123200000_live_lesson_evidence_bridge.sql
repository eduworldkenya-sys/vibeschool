-- Live Lesson -> canonical Lesson Plan bridge.
-- School Live sessions receive an immutable teacher-owned plan link. Teacher-approved
-- formative responses become canonical lesson evidence without marking attendance,
-- mastery, scheme coverage, or completing the teaching occurrence.
-- Rollback: revoke EXECUTE and drop function; UI will fail closed. Keep linkage
-- columns and evidence rows for audit; never delete learner evidence to roll back.
begin;

alter table vibe_live.sessions
  add column if not exists lesson_plan_id uuid references public.lesson_plans(id) on delete set null,
  add column if not exists teaching_occurrence_id uuid references public.teaching_occurrences(id) on delete set null;
alter table vibe_live.sessions
  add constraint live_session_school_plan_only
  check (lesson_plan_id is null or mode='school');
alter table vibe_live.sessions
  add constraint live_session_occurrence_requires_plan
  check (teaching_occurrence_id is null or lesson_plan_id is not null);
create index if not exists live_session_plan_lookup
  on vibe_live.sessions(lesson_plan_id,created_at desc) where lesson_plan_id is not null;

alter table public.lesson_evidence
  add column if not exists live_prompt_id uuid references vibe_live.prompts(id) on delete set null;
create unique index if not exists lesson_evidence_live_response_key
  on public.lesson_evidence(live_prompt_id,student_id)
  where live_prompt_id is not null and student_id is not null;

-- All calls resolve the actor server-side. No direct grants to vibe_live tables.
-- The only public surface is this guarded RPC. Its review is teacher-only.
create or replace function public.vibe_live_lesson_bridge(
  p_action text,
  p_session_id uuid,
  p_lesson_plan_id uuid default null,
  p_occurrence_id uuid default null
) returns jsonb
language plpgsql security definer set search_path = ''
as $$
declare
  v_caller uuid := auth.uid();
  v_room vibe_live.sessions%rowtype;
  v_plan public.lesson_plans%rowtype;
  v_occ uuid;
  v_added integer := 0;
begin
  if p_action is null or p_action not in ('bind','review','capture')
    or p_session_id is null or v_caller is null then
    raise exception 'live_bridge_invalid_request' using errcode='22023';
  end if;

  select * into v_room
  from vibe_live.sessions where id=p_session_id for update;
  if not found or v_room.teacher_id<>v_caller or v_room.mode<>'school'
    or not vibe_live.host_allowed(
      v_caller,v_room.mode,v_room.class_id,v_room.school_id,v_room.group_id
    ) or not coalesce(public.teacher_can_access_class(v_room.class_id,null,false),false)
    or (public.teacher_get_operating_context(null)->>'school_id') is distinct from v_room.school_id::text
  then
    raise exception 'live_bridge_not_authorized' using errcode='42501';
  end if;

  if p_action='bind' then
    if p_lesson_plan_id is null then
      raise exception 'live_bridge_plan_required' using errcode='22023';
    end if;
    select * into v_plan from public.lesson_plans
    where id=p_lesson_plan_id and teacher_id=v_caller
      and class_id=v_room.class_id
      and (school_id is null or school_id=v_room.school_id);
    if not found then
      raise exception 'live_bridge_plan_not_authorized' using errcode='42501';
    end if;

    -- Resolve an existing authoritative occurrence; NEVER create a timetable
    -- occurrence just because a Live session was started.
    if v_plan.timetable_slot_id is not null then
      select o.id into v_occ from public.teaching_occurrences o
      where o.timetable_slot_id=v_plan.timetable_slot_id
        and o.occurrence_date=v_plan.taught_date
        and o.teacher_id=v_caller and o.school_id=v_room.school_id
        and o.class_id=v_room.class_id and o.subject_id=v_plan.subject_id;
    else
      select o.id into v_occ from public.teaching_occurrences o
      where o.unscheduled_plan_id=v_plan.id
        and o.teacher_id=v_caller and o.school_id=v_room.school_id
        and o.class_id=v_room.class_id and o.subject_id=v_plan.subject_id;
    end if;
    if p_occurrence_id is not null and p_occurrence_id is distinct from v_occ then
      raise exception 'live_bridge_occurrence_mismatch' using errcode='42501';
    end if;
    if v_room.lesson_plan_id is not null
      and v_room.lesson_plan_id<>v_plan.id then
      raise exception 'live_bridge_already_bound' using errcode='23505';
    end if;
    if v_room.teaching_occurrence_id is not null
      and v_occ is not null
      and v_room.teaching_occurrence_id<>v_occ then
      raise exception 'live_bridge_occurrence_conflict' using errcode='23505';
    end if;
    update vibe_live.sessions
    set lesson_plan_id=v_plan.id,
        teaching_occurrence_id=coalesce(teaching_occurrence_id,v_occ)
    where id=v_room.id;
  elsif p_lesson_plan_id is not null or p_occurrence_id is not null then
    raise exception 'live_bridge_unexpected_context' using errcode='22023';
  end if;

  select * into v_room from vibe_live.sessions where id=p_session_id;

  if p_action='capture' then
    if v_room.status<>'ended' or v_room.lesson_plan_id is null then
      raise exception 'live_bridge_end_and_link_first' using errcode='22023';
    end if;
    -- Record raw observations only. Do NOT infer scores, attendance or mastery.
    -- Per-answer unique index makes retries safe even after client timeouts.
    with recorded as (
      insert into public.lesson_evidence(
        lesson_id,class_id,teacher_id,student_id,evidence_type,
        title,description,teaching_occurrence_id,live_prompt_id
      )
      select v_room.lesson_plan_id,v_room.class_id,v_caller,a.student_id,
        case when q.kind in ('quiz','exercise') then q.kind else 'observation' end,
        left('Live · '||q.kind||' · '||q.body,160),
        left(a.body,2000),
        v_room.teaching_occurrence_id,q.id
      from vibe_live.prompts q
      join vibe_live.responses a on a.prompt_id=q.id
      join vibe_live.participants p on p.session_id=q.session_id
        and p.student_id=a.student_id
      where q.session_id=v_room.id and q.kind in ('quiz','exercise','poll')
      on conflict (live_prompt_id,student_id)
        where live_prompt_id is not null and student_id is not null do nothing
      returning id
    )
    select count(*)::integer into v_added from recorded;
  end if;

  return jsonb_build_object(
    'lessonPlanId',v_room.lesson_plan_id,
    'occurrenceId',v_room.teaching_occurrence_id,
    'status',v_room.status,
    'joined', (select count(*) from vibe_live.participants p where p.session_id=v_room.id),
    'questions', (select count(*) from vibe_live.prompts q
      where q.session_id=v_room.id and q.kind in ('quiz','exercise','poll')),
    'responses', (select count(*) from vibe_live.responses a
      join vibe_live.prompts q on q.id=a.prompt_id
      where q.session_id=v_room.id and q.kind in ('quiz','exercise','poll')),
    'saved', (select count(*) from public.lesson_evidence e
      join vibe_live.prompts q on q.id=e.live_prompt_id
      where q.session_id=v_room.id),
    'added',v_added
  );
end;
$$;
revoke all on function public.vibe_live_lesson_bridge(text,uuid,uuid,uuid)
  from public,anon,authenticated;
grant execute on function public.vibe_live_lesson_bridge(text,uuid,uuid,uuid)
  to authenticated;
commit;
