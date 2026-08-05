-- HW-STUDENT-001 — canonical homework submission authority

alter table public.homework_submissions
  add column if not exists received_at timestamptz,
  add column if not exists updated_at timestamptz not null default clock_timestamp(),
  add column if not exists revision_number integer not null default 1,
  add column if not exists returned_at timestamptz,
  add column if not exists returned_reason text;

alter table public.homework_submissions
  drop constraint if exists homework_submissions_status_check;

alter table public.homework_submissions
  add constraint homework_submissions_status_check
  check (status in ('draft','submitted','received','under_review','returned','marked'));

alter table public.homework_submissions
  add constraint homework_submissions_revision_number_check
  check (revision_number > 0);

create unique index if not exists uq_homework_submissions_homework_student
  on public.homework_submissions(homework_id, student_id)
  where homework_id is not null and student_id is not null;

create unique index if not exists uq_homework_answers_submission_question
  on public.homework_answers(submission_id, question_id)
  where submission_id is not null and question_id is not null;

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
begin
  if v_uid is null then raise exception 'not_authenticated'; end if;

  select s.id into v_student_id
  from public.students s
  join public.student_classes sc on sc.student_id=s.id and sc.is_current=true
  join public.homework h on h.class_id=sc.class_id
  where s.profile_id=v_uid and h.id=p_homework_id and s.deleted_at is null
  limit 1;

  if v_student_id is null then raise exception 'homework_not_available'; end if;

  insert into public.homework_submissions(homework_id,student_id,status,photo_url,updated_at)
  values(p_homework_id,v_student_id,'draft',p_photo_url,clock_timestamp())
  on conflict(homework_id,student_id) where homework_id is not null and student_id is not null
  do update set
    photo_url=coalesce(excluded.photo_url,public.homework_submissions.photo_url),
    status=case when public.homework_submissions.status in ('marked','under_review') then public.homework_submissions.status else 'draft' end,
    updated_at=clock_timestamp()
  returning * into v_submission;

  if v_submission.status in ('marked','under_review') then
    raise exception 'submission_locked';
  end if;

  for v_answer in select value from jsonb_array_elements(coalesce(p_answers,'[]'::jsonb)) loop
    insert into public.homework_answers(submission_id,question_id,answer_text)
    values(v_submission.id,(v_answer->>'question_id')::uuid,nullif(trim(v_answer->>'answer_text'),''))
    on conflict(submission_id,question_id) where submission_id is not null and question_id is not null
    do update set answer_text=excluded.answer_text;
  end loop;

  return jsonb_build_object(
    'submission_id',v_submission.id,
    'status',v_submission.status,
    'revision_number',v_submission.revision_number,
    'updated_at',v_submission.updated_at
  );
end;
$$;

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
  v_draft jsonb;
  v_submission public.homework_submissions%rowtype;
begin
  v_draft := public.save_student_homework_draft(p_homework_id,p_answers,p_photo_url);

  select * into v_submission
  from public.homework_submissions
  where id=(v_draft->>'submission_id')::uuid
  for update;

  if v_submission.status in ('marked','under_review') then raise exception 'submission_locked'; end if;

  update public.homework_submissions
  set status='received',
      submitted_at=clock_timestamp(),
      received_at=clock_timestamp(),
      revision_number=case when status='returned' then revision_number+1 else revision_number end,
      returned_at=null,
      returned_reason=null,
      updated_at=clock_timestamp()
  where id=v_submission.id
  returning * into v_submission;

  return jsonb_build_object(
    'submission_id',v_submission.id,
    'status',v_submission.status,
    'revision_number',v_submission.revision_number,
    'submitted_at',v_submission.submitted_at,
    'received_at',v_submission.received_at
  );
end;
$$;

revoke all on function public.save_student_homework_draft(uuid,jsonb,text) from public, anon;
revoke all on function public.submit_student_homework(uuid,jsonb,text) from public, anon;
grant execute on function public.save_student_homework_draft(uuid,jsonb,text) to authenticated;
grant execute on function public.submit_student_homework(uuid,jsonb,text) to authenticated;
