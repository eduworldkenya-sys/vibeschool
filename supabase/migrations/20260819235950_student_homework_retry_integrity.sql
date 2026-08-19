-- VibeSchool Task 5: homework retry / double-submit integrity.
-- Received work is immutable from the learner side until a teacher explicitly
-- returns it. Network retries return the original server receipt without changing
-- timestamps or revision state.

create or replace function public.save_student_homework_draft(
  p_homework_id uuid,
  p_answers jsonb default '[]'::jsonb,
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
  v_submission public.homework_submissions%rowtype;
  v_answer jsonb;
  v_question_id uuid;
begin
  if v_uid is null then raise exception 'not_authenticated'; end if;
  if p_homework_id is null then raise exception 'homework_required'; end if;
  if jsonb_typeof(coalesce(p_answers, '[]'::jsonb)) <> 'array' then
    raise exception 'answers_must_be_array';
  end if;

  select s.id into v_student_id
  from public.students s
  join public.student_classes sc
    on sc.student_id = s.id
   and sc.is_current = true
  join public.homework h
    on h.class_id = sc.class_id
   and h.school_id = sc.school_id
  where s.profile_id = v_uid
    and h.id = p_homework_id
    and s.deleted_at is null
    and (
      h.target_group_id is null
      or exists (
        select 1
        from public.class_group_members cgm
        where cgm.group_id = h.target_group_id
          and cgm.student_id = s.id
      )
    )
  limit 1;

  if v_student_id is null then raise exception 'homework_not_available'; end if;

  -- A learner cannot mutate accepted/reviewing/marked work. Returned work is the
  -- only post-submit state that may transition back into an editable draft.
  select * into v_submission
  from public.homework_submissions
  where homework_id = p_homework_id
    and student_id = v_student_id
  for update;

  if found and v_submission.status in ('submitted', 'received', 'under_review', 'marked') then
    raise exception 'submission_locked';
  end if;

  insert into public.homework_submissions(
    homework_id,
    student_id,
    status,
    photo_url,
    updated_at
  )
  values(
    p_homework_id,
    v_student_id,
    'draft',
    p_photo_url,
    clock_timestamp()
  )
  on conflict(homework_id,student_id)
    where homework_id is not null and student_id is not null
  do update set
    photo_url = coalesce(excluded.photo_url, public.homework_submissions.photo_url),
    status = 'draft',
    updated_at = clock_timestamp()
  returning * into v_submission;

  for v_answer in
    select value
    from jsonb_array_elements(coalesce(p_answers,'[]'::jsonb))
  loop
    begin
      v_question_id := (v_answer->>'question_id')::uuid;
    exception when others then
      raise exception 'invalid_question_id';
    end;

    if not exists(
      select 1
      from public.homework_questions q
      where q.id = v_question_id
        and q.homework_id = p_homework_id
    ) then
      raise exception 'question_not_in_homework';
    end if;

    insert into public.homework_answers(
      submission_id,
      question_id,
      answer_text
    )
    values(
      v_submission.id,
      v_question_id,
      nullif(trim(v_answer->>'answer_text'),'')
    )
    on conflict(submission_id,question_id)
      where submission_id is not null and question_id is not null
    do update set answer_text = excluded.answer_text;
  end loop;

  return jsonb_build_object(
    'submission_id', v_submission.id,
    'status', v_submission.status,
    'revision_number', v_submission.revision_number,
    'updated_at', v_submission.updated_at
  );
end;
$$;

revoke all on function public.save_student_homework_draft(uuid,jsonb,text)
  from public, anon;
grant execute on function public.save_student_homework_draft(uuid,jsonb,text)
  to authenticated, service_role;

create or replace function public.submit_student_homework(
  p_homework_id uuid,
  p_answers jsonb default '[]'::jsonb,
  p_photo_url text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_uid uuid := auth.uid();
  v_existing public.homework_submissions%rowtype;
  v_existing_status text;
  v_draft jsonb;
  v_submission public.homework_submissions%rowtype;
  v_question_count integer;
  v_answer_count integer;
begin
  if v_uid is null then raise exception 'not_authenticated'; end if;
  if p_homework_id is null then raise exception 'homework_required'; end if;

  select hs.* into v_existing
  from public.homework_submissions hs
  join public.students s on s.id = hs.student_id
  where hs.homework_id = p_homework_id
    and s.profile_id = v_uid
    and s.deleted_at is null
  limit 1
  for update of hs;

  if found then
    v_existing_status := v_existing.status;

    -- Idempotent network/double-submit replay. Preserve the first authoritative
    -- receipt exactly; do not rewrite submission timestamps or revision state.
    if v_existing.status in ('submitted', 'received') then
      return jsonb_build_object(
        'submission_id', v_existing.id,
        'status', 'received',
        'revision_number', v_existing.revision_number,
        'submitted_at', v_existing.submitted_at,
        'received_at', v_existing.received_at,
        'idempotent_replay', true
      );
    end if;

    if v_existing.status in ('under_review', 'marked') then
      raise exception 'submission_locked';
    end if;
  end if;

  v_draft := public.save_student_homework_draft(
    p_homework_id,
    p_answers,
    p_photo_url
  );

  select * into v_submission
  from public.homework_submissions
  where id = (v_draft->>'submission_id')::uuid
  for update;

  select count(*) into v_question_count
  from public.homework_questions q
  where q.homework_id = p_homework_id;

  select count(*) into v_answer_count
  from public.homework_answers a
  join public.homework_questions q on q.id = a.question_id
  where a.submission_id = v_submission.id
    and q.homework_id = p_homework_id
    and nullif(trim(a.answer_text), '') is not null;

  if v_question_count > 0 and v_answer_count <> v_question_count then
    raise exception 'all_questions_required';
  end if;

  if v_question_count = 0 and coalesce(p_photo_url, v_submission.photo_url) is null then
    raise exception 'photo_required';
  end if;

  update public.homework_submissions
  set status = 'received',
      submitted_at = coalesce(submitted_at, clock_timestamp()),
      received_at = coalesce(received_at, clock_timestamp()),
      revision_number = case
        when v_existing_status = 'returned' then revision_number + 1
        else revision_number
      end,
      returned_at = null,
      returned_reason = null,
      updated_at = clock_timestamp()
  where id = v_submission.id
  returning * into v_submission;

  return jsonb_build_object(
    'submission_id', v_submission.id,
    'status', 'received',
    'revision_number', v_submission.revision_number,
    'submitted_at', v_submission.submitted_at,
    'received_at', v_submission.received_at,
    'idempotent_replay', false
  );
end;
$$;

revoke all on function public.submit_student_homework(uuid,jsonb,text)
  from public, anon;
grant execute on function public.submit_student_homework(uuid,jsonb,text)
  to authenticated, service_role;

comment on function public.submit_student_homework(uuid,jsonb,text) is
  'Task 5 learner homework submission: canonical learner/class/group scope, immutable received state, idempotent replay, returned-work revision support.';
