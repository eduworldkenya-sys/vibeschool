-- #774: preserve the existing learner-event authority; serialize About revisions.
-- No data rewrite, new identity, or read permission. Applies to old clients too.
create or replace function public.guard_learner_context_revision()
returns trigger language plpgsql security invoker
set search_path = public, pg_temp
as $$
declare
  v_latest uuid;
  v_retry public.teacher_learner_events%rowtype;
begin
  if tg_op in ('UPDATE', 'DELETE') then
    if old.event_code like 'learner_context_%' or
       (tg_op = 'UPDATE' and new.event_code like 'learner_context_%') then
      raise exception 'learner_context_history_is_append_only' using errcode = '42501';
    end if;
    if tg_op = 'DELETE' then return old; else return new; end if;
  end if;
  if new.event_code is null or new.event_code not like 'learner_context_%' then return new; end if;
  if auth.uid() is null or new.created_by is distinct from auth.uid()
    or not public.teacher_can_access_class(new.class_id, null, true) then
    raise exception 'class_teacher_scope_required' using errcode = '42501';
  end if;
  if new.event_code not in (
    'learner_context_strengths','learner_context_interests','learner_context_learning_preferences',
    'learner_context_helpful_strategies','learner_context_support_needs','learner_context_accommodations',
    'learner_context_communication_preferences','learner_context_responsibilities'
  ) or new.event_kind is distinct from 'management'
    or new.subject_id is not null or new.visibility is distinct from 'class_teacher'
    or new.archived_at is not null or length(coalesce(new.note,'')) > 1200
    or nullif(new.metadata->>'request_id','') is null then
    raise exception 'invalid_learner_context_revision' using errcode = '22023';
  end if;
  -- All writers of a learner's section use this lock, including direct REST inserts.
  perform pg_advisory_xact_lock(hashtextextended(new.class_id::text || ':' || new.student_id::text || ':' || new.event_code, 0));
  select * into v_retry from public.teacher_learner_events e
    where e.created_by = new.created_by and e.student_id = new.student_id
      and e.metadata->>'request_id' = new.metadata->>'request_id';
  if found then
    if v_retry.school_id is distinct from new.school_id or v_retry.class_id is distinct from new.class_id
      or v_retry.event_code is distinct from new.event_code or v_retry.note is distinct from new.note then
      raise exception 'request_id_payload_conflict' using errcode = '22023';
    end if;
    -- Existing client confirms the previously committed row after this signal.
    raise exception 'learner_context_request_already_committed' using errcode = '23505';
  end if;
  select e.id into v_latest from public.teacher_learner_events e
    where e.class_id = new.class_id and e.student_id = new.student_id
      and e.event_code = new.event_code and e.archived_at is null
    order by e.created_at desc, e.id desc limit 1;
  if v_latest is distinct from nullif(new.metadata->>'supersedes_event_id','')::uuid then
    raise exception 'learner_context_changed_refresh_before_saving' using errcode = '40001';
  end if;
  -- Server time establishes a deterministic latest revision, even within one transaction.
  new.created_at := clock_timestamp();
  return new;
end;
$$;
revoke all on function public.guard_learner_context_revision() from public, anon, authenticated;
create trigger learner_context_revision_guard
before insert or update or delete on public.teacher_learner_events
for each row execute function public.guard_learner_context_revision();

-- Latest About values must not disappear behind the general timeline's row limit.
create function public.teacher_get_learner_context(p_class_id uuid, p_student_id uuid)
returns table (field_key text, event_id uuid, note text, created_at timestamptz)
language sql stable security invoker set search_path = public, pg_temp
as $$
  select distinct on (e.event_code)
    substr(e.event_code, 17), e.id, e.note, e.created_at
  from public.teacher_learner_events e
  where auth.uid() is not null
    and public.teacher_can_access_class(p_class_id, null, true)
    and e.class_id = p_class_id and e.student_id = p_student_id
    and e.event_kind = 'management' and e.event_code like 'learner_context_%'
    and e.subject_id is null and e.visibility = 'class_teacher' and e.archived_at is null
    and exists (select 1 from public.student_classes sc
      where sc.class_id = e.class_id and sc.student_id = e.student_id
        and sc.school_id = e.school_id and sc.is_current is true)
  order by e.event_code, e.created_at desc, e.id desc;
$$;
revoke all on function public.teacher_get_learner_context(uuid, uuid) from public, anon;
grant execute on function public.teacher_get_learner_context(uuid, uuid) to authenticated;
