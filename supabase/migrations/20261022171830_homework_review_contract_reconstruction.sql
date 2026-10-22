-- Reconstruct the live homework review authority for clean deployments.
-- Preserves legacy public table identities, uses one audited teacher/admin RPC,
-- and requires explicit release of marks/feedback to learner clients.
alter table public.homework_submissions
  add column if not exists reviewed_at timestamptz,
  add column if not exists reviewed_by uuid,
  add column if not exists returned_at timestamptz,
  add column if not exists returned_reason text,
  add column if not exists feedback_released_at timestamptz,
  add column if not exists model_answers_released_at timestamptz;

create table if not exists public.homework_submission_reviews (
  id uuid primary key default gen_random_uuid(),
  submission_id uuid not null references public.homework_submissions(id) on delete cascade,
  revision_number integer not null check(revision_number > 0),
  action text not null check(action in ('received','under_review','returned','marked','feedback_released','model_answers_released')),
  mark integer,
  feedback text,
  reason text,
  actor_id uuid not null references public.profiles(id) on delete restrict,
  created_at timestamptz not null default clock_timestamp()
);

create index if not exists idx_homework_submission_reviews_submission
  on public.homework_submission_reviews(submission_id, created_at desc);

alter table public.homework_submission_reviews enable row level security;
revoke all on public.homework_submission_reviews from public, anon, authenticated;
grant select on public.homework_submission_reviews to authenticated;
grant select, insert, update, delete on public.homework_submission_reviews to service_role;
drop policy if exists homework_submission_reviews_teacher_read on public.homework_submission_reviews;
create policy homework_submission_reviews_teacher_read
  on public.homework_submission_reviews for select to authenticated
  using(exists(
    select 1 from public.homework_submissions hs
    join public.homework h on h.id=hs.homework_id
    where hs.id=homework_submission_reviews.submission_id
      and (
        (h.teacher_id=(select auth.uid()) and public.is_live_teacher_class(h.school_id,h.class_id))
        or public.is_school_admin(h.school_id)
      )
  ));

create or replace function public.review_homework_submission(
  p_submission_id uuid,
  p_action text,
  p_mark integer default null,
  p_feedback text default null,
  p_reason text default null,
  p_release_model_answers boolean default false
) returns jsonb
language plpgsql security definer set search_path=public,pg_temp
as $function$
declare
  v_uid uuid := auth.uid();
  v_submission public.homework_submissions%rowtype;
  v_next_status text;
  v_feedback text := nullif(trim(coalesce(p_feedback, '')), '');
  v_reason text := nullif(trim(coalesce(p_reason, '')), '');
  v_now timestamptz := clock_timestamp();
begin
  if v_uid is null then raise exception 'not_authenticated'; end if;
  if p_submission_id is null then raise exception 'submission_required'; end if;

  select hs.* into v_submission
  from public.homework_submissions hs
  join public.homework h on h.id=hs.homework_id
  where hs.id=p_submission_id
    and (
      (h.teacher_id=v_uid and public.is_live_teacher_class(h.school_id,h.class_id))
      or public.is_school_admin(h.school_id)
    )
  for update;
  if not found then raise exception 'submission_not_available'; end if;

  if p_action not in ('under_review','returned','marked','feedback_released','model_answers_released') then
    raise exception 'invalid_review_action';
  end if;
  if p_action = 'under_review' then
    if v_submission.status not in ('submitted','received','returned') then raise exception 'invalid_status_transition'; end if;
    v_next_status := 'under_review';
  elsif p_action = 'returned' then
    if v_submission.status not in ('submitted','received','under_review','marked') then raise exception 'invalid_status_transition'; end if;
    if v_reason is null or length(v_reason) < 5 then raise exception 'return_reason_required'; end if;
    v_next_status := 'returned';
  elsif p_action = 'marked' then
    if v_submission.status not in ('submitted','received','under_review','returned','marked') then raise exception 'invalid_status_transition'; end if;
    if p_mark is null then raise exception 'mark_required'; end if;
    if p_mark < 0 then raise exception 'mark_out_of_range'; end if;
    v_next_status := 'marked';
  elsif p_action = 'feedback_released' then
    if v_submission.status <> 'marked' then raise exception 'mark_required_before_feedback_release'; end if;
    v_next_status := 'marked';
  else
    if v_submission.status <> 'marked' then raise exception 'mark_required_before_answer_release'; end if;
    v_next_status := 'marked';
  end if;

  update public.homework_submissions
  set status = v_next_status,
      mark = case when p_action = 'marked' then p_mark else mark end,
      feedback = case when p_action in ('marked','feedback_released') then coalesce(v_feedback, feedback) else feedback end,
      returned_at = case when p_action = 'returned' then v_now when p_action = 'marked' then null else returned_at end,
      returned_reason = case when p_action = 'returned' then v_reason when p_action = 'marked' then null else returned_reason end,
      reviewed_at = case when p_action in ('under_review','returned','marked') then v_now else reviewed_at end,
      reviewed_by = case when p_action in ('under_review','returned','marked') then v_uid else reviewed_by end,
      feedback_released_at = case
        when p_action = 'feedback_released' then v_now
        when p_action in ('returned','marked') then null
        else feedback_released_at
      end,
      model_answers_released_at = case
        when p_action = 'model_answers_released' or p_release_model_answers then v_now
        when p_action = 'returned' then null
        else model_answers_released_at
      end,
      updated_at = v_now
  where id=p_submission_id
  returning * into v_submission;

  insert into public.homework_submission_reviews(
    submission_id, revision_number, action, mark, feedback, reason, actor_id, created_at
  ) values (
    v_submission.id, v_submission.revision_number, p_action,
    case when p_action='marked' then p_mark else v_submission.mark end,
    case when p_action in ('marked','feedback_released') then v_feedback else null end,
    v_reason, v_uid, v_now
  );

  return jsonb_build_object(
    'submission_id', v_submission.id,
    'status', v_submission.status,
    'mark', v_submission.mark,
    'feedback', v_submission.feedback,
    'revision_number', v_submission.revision_number,
    'reviewed_at', v_submission.reviewed_at,
    'feedback_released_at', v_submission.feedback_released_at,
    'model_answers_released_at', v_submission.model_answers_released_at
  );
end;
$function$;

revoke all on function public.review_homework_submission(uuid,text,integer,text,text,boolean) from public,anon;
grant execute on function public.review_homework_submission(uuid,text,integer,text,text,boolean) to authenticated,service_role;
