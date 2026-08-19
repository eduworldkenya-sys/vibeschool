-- VibeSchool Task 5: canonical, retry-safe learner exercise submission.

create or replace function public.student_save_exercise_draft(
  p_exercise_id uuid,
  p_notes text default null,
  p_photo_url text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_uid uuid := auth.uid();
  v_student_id uuid;
  v_submission public.exercise_submissions%rowtype;
begin
  if v_uid is null then raise exception 'not_authenticated'; end if;
  if p_exercise_id is null then raise exception 'exercise_required'; end if;

  select s.id into v_student_id
  from public.students s
  join public.student_classes sc
    on sc.student_id = s.id
   and sc.is_current = true
  join public.exercises e
    on e.class_id = sc.class_id
   and (e.school_id is null or e.school_id = sc.school_id)
  where s.profile_id = v_uid
    and s.deleted_at is null
    and e.id = p_exercise_id
    and e.homework_id is null
  limit 1;

  if v_student_id is null then raise exception 'exercise_not_available'; end if;

  select * into v_submission
  from public.exercise_submissions
  where exercise_id = p_exercise_id
    and student_id = v_student_id
  for update;

  if found and v_submission.status in ('submitted', 'marked') then
    raise exception 'submission_locked';
  end if;

  insert into public.exercise_submissions(
    exercise_id, student_id, notes, photo_url, status, submitted_at
  ) values (
    p_exercise_id, v_student_id, nullif(btrim(p_notes), ''), p_photo_url, 'pending', null
  )
  on conflict(exercise_id, student_id)
  do update set
    notes = excluded.notes,
    photo_url = coalesce(excluded.photo_url, public.exercise_submissions.photo_url),
    status = 'pending'
  returning * into v_submission;

  return jsonb_build_object(
    'submission_id', v_submission.id,
    'status', v_submission.status,
    'notes', v_submission.notes,
    'photo_url', v_submission.photo_url,
    'submitted_at', v_submission.submitted_at
  );
end;
$$;

revoke all on function public.student_save_exercise_draft(uuid,text,text)
  from public, anon;
grant execute on function public.student_save_exercise_draft(uuid,text,text)
  to authenticated, service_role;

create or replace function public.student_submit_exercise(
  p_exercise_id uuid,
  p_notes text default null,
  p_photo_url text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_uid uuid := auth.uid();
  v_student_id uuid;
  v_existing public.exercise_submissions%rowtype;
  v_draft jsonb;
  v_submission public.exercise_submissions%rowtype;
begin
  if v_uid is null then raise exception 'not_authenticated'; end if;
  if p_exercise_id is null then raise exception 'exercise_required'; end if;

  select s.id into v_student_id
  from public.students s
  where s.profile_id = v_uid
    and s.deleted_at is null
  limit 1;
  if v_student_id is null then raise exception 'learner_identity_not_found'; end if;

  select * into v_existing
  from public.exercise_submissions
  where exercise_id = p_exercise_id
    and student_id = v_student_id
  for update;

  if found then
    if v_existing.status = 'submitted' then
      return jsonb_build_object(
        'submission_id', v_existing.id,
        'status', v_existing.status,
        'notes', v_existing.notes,
        'photo_url', v_existing.photo_url,
        'submitted_at', v_existing.submitted_at,
        'idempotent_replay', true
      );
    end if;
    if v_existing.status = 'marked' then raise exception 'submission_locked'; end if;
  end if;

  v_draft := public.student_save_exercise_draft(p_exercise_id, p_notes, p_photo_url);

  select * into v_submission
  from public.exercise_submissions
  where id = (v_draft->>'submission_id')::uuid
  for update;

  if nullif(btrim(coalesce(v_submission.notes, '')), '') is null
     and nullif(btrim(coalesce(v_submission.photo_url, '')), '') is null then
    raise exception 'exercise_response_required';
  end if;

  update public.exercise_submissions
  set status = 'submitted',
      submitted_at = coalesce(submitted_at, clock_timestamp())
  where id = v_submission.id
  returning * into v_submission;

  return jsonb_build_object(
    'submission_id', v_submission.id,
    'status', v_submission.status,
    'notes', v_submission.notes,
    'photo_url', v_submission.photo_url,
    'submitted_at', v_submission.submitted_at,
    'idempotent_replay', false
  );
end;
$$;

revoke all on function public.student_submit_exercise(uuid,text,text)
  from public, anon;
grant execute on function public.student_submit_exercise(uuid,text,text)
  to authenticated, service_role;

comment on function public.student_submit_exercise(uuid,text,text) is
  'Task 5 learner exercise submit: canonical current-class authorization, one attempt row per learner/exercise, stable retry-safe receipt, marked-state lock.';
