-- CBC examination phase 1: class-wide viewing and audited class-teacher corrections.
-- Additive only. Keep existing canonical exam-result save functions and
-- per-subject edit policies. Never deploy without authorization integration tests.
begin;

-- Security-definer is intentional here: checking an assignment must not be
-- blocked by the caller's teacher_classes RLS when that teacher has a valid
-- teaching role. Do NOT use user_metadata for authorization.
create or replace function public.teacher_can_view_class_exam(
  p_school_id uuid, p_class_id uuid
) returns boolean
language sql stable security definer
set search_path = ''
as $function$
  select (select auth.uid()) is not null and exists (
    select 1
    from public.teacher_classes tc
    join public.school_members sm
      on sm.profile_id = tc.teacher_id
     and sm.school_id = tc.school_id
     and sm.role = 'teacher'
    join public.profiles p
      on p.id = tc.teacher_id
     and p.account_status::text = 'active'
     and not coalesce(p.is_anonymized, false)
    join public.classes c
      on c.id = tc.class_id and c.school_id = tc.school_id
    where tc.teacher_id = (select auth.uid())
      and tc.school_id = p_school_id
      and tc.class_id = p_class_id
  );
$function$;

create or replace function public.teacher_is_current_class_teacher(
  p_school_id uuid, p_class_id uuid
) returns boolean
language sql stable security definer
set search_path = ''
as $function$
  select (select auth.uid()) is not null and exists (
    select 1
    from public.teacher_classes tc
    join public.school_members sm
      on sm.profile_id = tc.teacher_id
     and sm.school_id = tc.school_id
     and sm.role = 'teacher'
    join public.profiles p
      on p.id = tc.teacher_id
     and p.account_status::text = 'active'
     and not coalesce(p.is_anonymized, false)
    join public.classes c
      on c.id = tc.class_id and c.school_id = tc.school_id
    where tc.teacher_id = (select auth.uid())
      and tc.school_id = p_school_id
      and tc.class_id = p_class_id
      and tc.is_class_teacher = true
  );
$function$;

revoke all on function public.teacher_can_view_class_exam(uuid,uuid) from public, anon;
grant execute on function public.teacher_can_view_class_exam(uuid,uuid) to authenticated;
revoke all on function public.teacher_is_current_class_teacher(uuid,uuid) from public, anon;
grant execute on function public.teacher_is_current_class_teacher(uuid,uuid) to authenticated;

-- Readers for a class may view all its subject marks; this does NOT grant
-- INSERT/UPDATE/DELETE on a single result in an unassigned subject.
drop policy if exists "Teacher class-wide examination review" on public.exam_results;
create policy "Teacher class-wide examination review" on public.exam_results
for select to authenticated
using (public.teacher_can_view_class_exam(school_id, class_id));

-- Class teachers can correct existing subject marks with explicit reasons. Existing
-- records retain teacher_id (original recorder); the actor is captured by the
-- platform_events audit stream. Per-subject writers keep their existing RPC.
create or replace function public.teacher_correct_class_exam_result(
  p_exam_id uuid,
  p_school_id uuid,
  p_class_id uuid,
  p_subject_id uuid,
  p_student_id uuid,
  p_marks numeric,
  p_result_state text,
  p_expected_updated_at timestamptz,
  p_reason text
) returns jsonb
language plpgsql security definer
set search_path = ''
as $function$
declare
  v_context jsonb;
  v_exam public.exams%rowtype;
  v_existing public.exam_results%rowtype;
  v_saved public.exam_results%rowtype;
  v_max numeric;
  v_state text := lower(trim(coalesce(p_result_state,'')));
  v_score numeric;
  v_reason text := trim(coalesce(p_reason,''));
  v_action text;
begin
  if (select auth.uid()) is null then raise exception 'not_authenticated'; end if;
  if char_length(v_reason) < 10 or char_length(v_reason) > 500 then
    raise exception 'correction_reason_required';
  end if;

  v_context := public.teacher_get_operating_context(null);
  if nullif(v_context->>'school_id','')::uuid is distinct from p_school_id then
    raise exception 'active_school_changed';
  end if;
  if not public.teacher_is_current_class_teacher(p_school_id, p_class_id) then
    raise exception 'class_teacher_not_authorized';
  end if;

  if not exists (
    select 1 from public.student_classes sc
    join public.students s on s.id = sc.student_id and s.deleted_at is null
    where sc.school_id = p_school_id and sc.class_id = p_class_id
      and sc.student_id = p_student_id and sc.is_current = true
  ) then raise exception 'student_not_in_current_class'; end if;

  -- Only a learning area actually assigned to this school class may be edited.
  -- Prevent arbitrary same-school subject IDs being used as a write target.
  if not exists (
    select 1 from public.teacher_classes tc
    join public.school_members sm
      on sm.school_id = tc.school_id and sm.profile_id = tc.teacher_id
     and sm.role = 'teacher'
    where tc.school_id = p_school_id
      and tc.class_id = p_class_id and tc.subject_id = p_subject_id
  ) then raise exception 'class_subject_not_assigned'; end if;

  if v_state not in (
    'entered','absent','not_assessed','exempt','pending','incomplete',
    'late','transferred','awaiting_marking'
  ) then raise exception 'invalid_result_state'; end if;

  -- FOR SHARE serializes with an exam lock and avoids a post-approval write.
  select * into v_exam from public.exams
  where id = p_exam_id and school_id = p_school_id
  for share;
  if not found then raise exception 'exam_not_available'; end if;
  if v_exam.is_locked then raise exception 'exam_locked'; end if;

  select esc.max_marks into v_max from public.exam_subject_config esc
  where esc.exam_id = p_exam_id and esc.subject_id = p_subject_id;
  if not found then v_max := 100; end if;
  if v_max is null or v_max <= 0 then raise exception 'invalid_exam_maximum'; end if;
  v_score := case when v_state = 'entered' then p_marks else null end;
  if v_state = 'entered' and
     (v_score is null or v_score::text in ('NaN','Infinity','-Infinity')
       or v_score < 0 or v_score > v_max) then
    raise exception 'marks_outside_exam_maximum';
  end if;
  if v_state <> 'entered' and p_marks is not null then
    raise exception 'non_scored_result_cannot_have_marks';
  end if;

  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(
      p_exam_id::text||':'||p_student_id::text||':'||p_subject_id::text, 0
    )
  );
  select * into v_existing from public.exam_results er
  where er.exam_id = p_exam_id and er.student_id = p_student_id
    and er.subject_id = p_subject_id
  for update;

  if found then
    if v_existing.school_id is distinct from p_school_id
      or v_existing.class_id is distinct from p_class_id then
      raise exception 'result_context_not_authorized';
    end if;
    if v_existing.marks is not distinct from v_score
      and v_existing.result_state = v_state
      and v_existing.max_marks = v_max then
      return to_jsonb(v_existing);
    end if;
    if p_expected_updated_at is null
      or v_existing.updated_at is distinct from p_expected_updated_at then
      raise exception 'result_changed_review_again';
    end if;
    update public.exam_results
      set marks = v_score, result_state = v_state, max_marks = v_max,
          is_absent = (v_state = 'absent')
    where id = v_existing.id
    returning * into v_saved;
    v_action := 'corrected';
  else
    -- Subject teacher is the entry authority. Class teacher may review
    -- missing marks but cannot silently originate another subject's score.
    raise exception 'result_not_entered_by_subject_teacher';
  end if;

  -- Existing pilot audit trigger logs the value change. This companion
  -- audit event records WHY and WHO, in the same transaction as the write.
  insert into public.platform_events(
    event_type, actor_id, school_id, entity_type, entity_id,
    metadata, idempotency_key
  ) values (
    'authority.exam_result_class_correction', (select auth.uid()),
    p_school_id, 'exam_results', v_saved.id,
    pg_catalog.jsonb_build_object(
      'reason',v_reason,'action',v_action,
      'exam_id',p_exam_id,'class_id',p_class_id,
      'student_id',p_student_id,'subject_id',p_subject_id,
      'old_marks',v_existing.marks,'new_marks',v_saved.marks,
      'old_state',v_existing.result_state,'new_state',v_saved.result_state
    ),
    'class-exam-correction:'||v_saved.id::text||':'||
      pg_catalog.clock_timestamp()::text
  );

  return to_jsonb(v_saved);
end
$function$;

revoke all on function public.teacher_correct_class_exam_result(
  uuid,uuid,uuid,uuid,uuid,numeric,text,timestamptz,text
) from public, anon;
grant execute on function public.teacher_correct_class_exam_result(
  uuid,uuid,uuid,uuid,uuid,numeric,text,timestamptz,text
) to authenticated;

commit;
