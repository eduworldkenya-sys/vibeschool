-- Per-class examination moderation and publication gate.
-- Canonical marks remain in public.exam_results. Unpublished results are private
-- to authorized school staff. Never aggregate a CBC national examination.
-- authorization-test: public.exam_class_subject_reviews only assigned subject staff and school admins read; no direct browser mutations; parent and anonymous denied; see scripts/test-class-exam-authority-db.mjs
-- authorization-test: public.exam_class_publications only assigned class staff and school admins read; publication writes require school admin RPC; parent/anonymous denied
begin;

create table if not exists public.exam_class_subject_reviews (
  exam_id uuid not null references public.exams(id) on delete cascade,
  school_id uuid not null references public.schools(id) on delete cascade,
  class_id uuid not null references public.classes(id) on delete cascade,
  subject_id uuid not null references public.subjects(id),
  state text not null default 'draft'
    check(state in ('draft','submitted','verified','reopened')),
  submitted_by uuid references public.profiles(id),
  submitted_at timestamptz,
  verified_by uuid references public.profiles(id),
  verified_at timestamptz,
  updated_at timestamptz not null default now(),
  primary key(exam_id,class_id,subject_id)
);
create index if not exists exam_reviews_school_index
  on public.exam_class_subject_reviews(school_id,class_id,exam_id);
alter table public.exam_class_subject_reviews enable row level security;
revoke all on public.exam_class_subject_reviews from anon, authenticated;
grant select on public.exam_class_subject_reviews to authenticated;

create table if not exists public.exam_class_publications (
  exam_id uuid not null references public.exams(id) on delete cascade,
  school_id uuid not null references public.schools(id) on delete cascade,
  class_id uuid not null references public.classes(id) on delete cascade,
  status text not null default 'draft' check (status in ('draft','published')),
  published_at timestamptz,
  published_by uuid references public.profiles(id),
  updated_at timestamptz not null default now(),
  primary key(exam_id,class_id)
);
alter table public.exam_class_publications enable row level security;
revoke all on public.exam_class_publications from anon, authenticated;
grant select on public.exam_class_publications to authenticated;

create or replace function public.exam_class_is_published(
  p_exam_id uuid,p_school_id uuid,p_class_id uuid
) returns boolean language sql stable security definer
set search_path=''
as $function$
  select (select auth.uid()) is not null and exists (
    select 1 from public.exam_class_publications pub
    where pub.exam_id=p_exam_id and pub.school_id=p_school_id
      and pub.class_id=p_class_id and pub.status='published'
  );
$function$;
revoke all on function public.exam_class_is_published(uuid,uuid,uuid) from public, anon;
grant execute on function public.exam_class_is_published(uuid,uuid,uuid) to authenticated;

drop policy if exists "Class exam review by assigned staff" on public.exam_class_subject_reviews;
create policy "Class exam review by assigned staff"
  on public.exam_class_subject_reviews
  for select to authenticated
  using(public.teacher_can_view_class_exam(school_id,class_id)
    or public.is_school_admin(school_id));

drop policy if exists "Class exam publication by assigned staff" on public.exam_class_publications;
create policy "Class exam publication by assigned staff"
  on public.exam_class_publications
  for select to authenticated
  using(public.teacher_can_view_class_exam(school_id,class_id)
    or public.is_school_admin(school_id));

-- Remove legacy unrestricted student/parent result reads: neither may view
-- incomplete or unapproved marks. School staff policies stay in effect.
drop policy if exists "exam_results_parent_read" on public.exam_results;
drop policy if exists "exam_results_student_read" on public.exam_results;
create policy "Published exam results for learner" on public.exam_results
  for select to authenticated
  using (
    public.exam_class_is_published(exam_id,school_id,class_id)
    and exists(select 1 from public.students s
      where s.id=exam_results.student_id and s.profile_id=(select auth.uid())
        and s.deleted_at is null)
  );
create policy "Published exam results for linked parent" on public.exam_results
  for select to authenticated
  using (
    public.exam_class_is_published(exam_id,school_id,class_id)
    and exists(select 1 from public.parent_student_links psl
      where psl.student_id=exam_results.student_id
        and psl.parent_id=(select auth.uid()))
  );

-- Remarks also contain sensitive learner outcomes. Legacy 'member read'
-- exposed every report remark to a same-school parent/member.
drop policy if exists "remarks_member_read" on public.report_card_remarks;
drop policy if exists "report_card_remarks_student_read" on public.report_card_remarks;
create policy "School staff read class examination remarks" on public.report_card_remarks
  for select to authenticated
  using(public.teacher_can_view_class_exam(school_id,class_id)
    or public.is_school_admin(school_id));
create policy "Learner reads published exam remarks" on public.report_card_remarks
  for select to authenticated
  using(
    public.exam_class_is_published(exam_id,school_id,class_id)
    and exists (select 1 from public.students s
      where s.id=report_card_remarks.student_id
        and s.profile_id=(select auth.uid()) and s.deleted_at is null)
  );
create policy "Parent reads linked published exam remarks" on public.report_card_remarks
  for select to authenticated
  using(
    public.exam_class_is_published(exam_id,school_id,class_id)
    and exists (select 1 from public.parent_student_links psl
      where psl.student_id=report_card_remarks.student_id
        and psl.parent_id=(select auth.uid()))
  );

-- The same rule applies to direct table writes, legacy bulk RPCs, and any
-- later content producer. Editing requires explicit reopening first.
create or replace function public.exam_result_submission_guard()
returns trigger language plpgsql security definer
set search_path=''
as $function$
declare v_exam uuid;v_class uuid;v_subject uuid;v_school uuid;
begin
  v_exam:=coalesce(new.exam_id,old.exam_id);
  v_class:=coalesce(new.class_id,old.class_id);
  v_school:=coalesce(new.school_id,old.school_id);
  v_subject:=coalesce(new.subject_id,old.subject_id);
  if exists (
    select 1 from public.exam_class_publications p
    where p.exam_id=v_exam and p.class_id=v_class and p.school_id=v_school
      and p.status='published'
  ) then raise exception 'exam_class_published_reopen_required'; end if;
  if exists (
    select 1 from public.exam_class_subject_reviews r
    where r.exam_id=v_exam and r.class_id=v_class and r.school_id=v_school
      and r.subject_id=v_subject and r.state in ('submitted','verified')
  ) then raise exception 'subject_results_submitted_reopen_required'; end if;
  return coalesce(new,old);
end;
$function$;
drop trigger if exists exam_result_submission_guard on public.exam_results;
create trigger exam_result_submission_guard
  before insert or update or delete on public.exam_results
  for each row execute function public.exam_result_submission_guard();

create or replace function public.teacher_get_class_exam_lifecycle(
 p_exam_id uuid,p_school_id uuid,p_class_id uuid
) returns jsonb language plpgsql security definer set search_path=''
as $function$
declare v_state jsonb;v_reviews jsonb;v_sub_count integer;
begin
  if (select auth.uid()) is null then raise exception 'not_authenticated';end if;
  if not (public.teacher_can_view_class_exam(p_school_id,p_class_id)
    or public.is_school_admin(p_school_id)) then
      raise exception 'class_exam_lifecycle_not_authorized';
  end if;
  if not exists (select 1 from public.exams e
    where e.id=p_exam_id and e.school_id=p_school_id)
  then raise exception 'exam_not_available';end if;
  select to_jsonb(pub) into v_state from public.exam_class_publications pub
    where pub.exam_id=p_exam_id and pub.school_id=p_school_id and pub.class_id=p_class_id;
  select coalesce(jsonb_agg(jsonb_build_object(
    'subject_id',r.subject_id,'state',r.state,'submitted_at',r.submitted_at,
    'verified_at',r.verified_at,'updated_at',r.updated_at
  ) order by r.subject_id),'[]'::jsonb) into v_reviews
  from public.exam_class_subject_reviews r
  where r.exam_id=p_exam_id and r.school_id=p_school_id and r.class_id=p_class_id;
  select count(distinct tc.subject_id) into v_sub_count from public.teacher_classes tc
  join public.school_members sm on sm.profile_id=tc.teacher_id
    and sm.school_id=tc.school_id and sm.role='teacher'
  where tc.school_id=p_school_id and tc.class_id=p_class_id;
  return jsonb_build_object('status',coalesce(v_state->>'status','draft'),
    'subjects',v_reviews,'expected_subject_count',v_sub_count,
    'is_school_admin',public.is_school_admin(p_school_id));
end;
$function$;

create or replace function public.teacher_submit_class_exam_subject(
 p_exam_id uuid,p_school_id uuid,p_class_id uuid,p_subject_id uuid
) returns jsonb language plpgsql security definer set search_path=''
as $function$
declare v_count integer;v_done integer;v_exam_locked boolean;v_current text;
begin
  if not public.is_live_teacher_subject(p_school_id,p_class_id,p_subject_id) then
    raise exception 'subject_teacher_not_authorized';end if;
  if nullif(public.teacher_get_operating_context(null)->>'school_id','')::uuid
    is distinct from p_school_id then raise exception 'active_school_changed';end if;
  select e.is_locked into v_exam_locked from public.exams e
    where e.id=p_exam_id and e.school_id=p_school_id for update;
  if not found then raise exception 'exam_not_available'; end if;
  if v_exam_locked then raise exception 'exam_locked';end if;
  if public.exam_class_is_published(p_exam_id,p_school_id,p_class_id) then
    raise exception 'exam_class_published_reopen_required';end if;
  select count(*) into v_count from public.student_classes sc
    join public.students s on s.id=sc.student_id and s.deleted_at is null
    where sc.school_id=p_school_id and sc.class_id=p_class_id and sc.is_current=true;
  if v_count=0 then raise exception 'class_has_no_enrolled_learners';end if;
  select count(distinct er.student_id) into v_done from public.exam_results er
    join public.student_classes sc on sc.school_id=er.school_id
      and sc.class_id=er.class_id and sc.student_id=er.student_id and sc.is_current=true
    where er.exam_id=p_exam_id and er.school_id=p_school_id and er.class_id=p_class_id
      and er.subject_id=p_subject_id
      and er.result_state in ('entered','absent','exempt','not_assessed','transferred');
  if v_done<>v_count then raise exception 'subject_results_incomplete % of %',v_done,v_count;end if;
  select r.state into v_current from public.exam_class_subject_reviews r
    where r.exam_id=p_exam_id and r.class_id=p_class_id and r.subject_id=p_subject_id;
  if v_current in ('submitted','verified') then raise exception 'subject_already_submitted';end if;
  insert into public.exam_class_subject_reviews(exam_id,school_id,class_id,subject_id,
    state,submitted_by,submitted_at,verified_by,verified_at,updated_at)
  values(p_exam_id,p_school_id,p_class_id,p_subject_id,
    'submitted',(select auth.uid()),now(),null,null,now())
  on conflict(exam_id,class_id,subject_id) do update
  set state='submitted',submitted_by=(select auth.uid()),submitted_at=now(),
      verified_by=null,verified_at=null,updated_at=now();
  return jsonb_build_object('status','submitted','completed',v_done,'total',v_count);
end;
$function$;

create or replace function public.school_review_class_exam_subject(
 p_exam_id uuid,p_school_id uuid,p_class_id uuid,p_subject_id uuid,
 p_action text,p_reason text default null
) returns jsonb language plpgsql security definer set search_path=''
as $function$
declare v_state text;v_locked boolean;
begin
  if not public.is_school_admin(p_school_id) then
    raise exception 'exam_review_admin_required';end if;
  select e.is_locked into v_locked from public.exams e
    where e.id=p_exam_id and e.school_id=p_school_id for update;
  if not found then raise exception 'exam_not_available'; end if;
  if v_locked then raise exception 'exam_locked';end if;
  if public.exam_class_is_published(p_exam_id,p_school_id,p_class_id) then
    raise exception 'exam_class_published_reopen_required';end if;
  select r.state into v_state from public.exam_class_subject_reviews r
    where r.exam_id=p_exam_id and r.school_id=p_school_id
      and r.class_id=p_class_id and r.subject_id=p_subject_id for update;
  if not found then raise exception 'subject_has_no_submission'; end if;
  if p_action='verify' and v_state='submitted' then
    update public.exam_class_subject_reviews
      set state='verified',verified_by=(select auth.uid()),
        verified_at=now(),updated_at=now()
      where exam_id=p_exam_id and class_id=p_class_id and subject_id=p_subject_id;
  elsif p_action='reopen' and v_state in ('submitted','verified') and
    char_length(trim(coalesce(p_reason,''))) between 10 and 500 then
    update public.exam_class_subject_reviews
      set state='reopened',verified_by=null,verified_at=null,updated_at=now()
      where exam_id=p_exam_id and class_id=p_class_id and subject_id=p_subject_id;
  else raise exception 'invalid_review_transition_or_reason';end if;
  insert into public.platform_events(event_type,actor_id,school_id,entity_type,entity_id,metadata,idempotency_key)
  values('authority.exam_subject_review',(select auth.uid()),p_school_id,
    'exams',p_exam_id,
    jsonb_build_object('class_id',p_class_id,'subject_id',p_subject_id,
      'action',p_action,'reason',p_reason,'previous_state',v_state),
    'exam-review:'||p_exam_id::text||':'||p_class_id::text||':'||
    p_subject_id::text||':'||pg_catalog.clock_timestamp()::text);
  return jsonb_build_object('status',case when p_action='verify' then 'verified' else 'reopened' end);
end;
$function$;

create or replace function public.school_set_class_exam_publication(
 p_exam_id uuid,p_school_id uuid,p_class_id uuid,p_publish boolean,
 p_reason text default null
) returns jsonb language plpgsql security definer set search_path=''
as $function$
declare v_expected int;v_verified int;v_enrolled int;v_exam_locked boolean;
begin
  if not public.is_school_admin(p_school_id) then
    raise exception 'exam_publish_admin_required';end if;
  if p_publish is null then raise exception 'invalid_publication_action';end if;
  select e.is_locked into v_exam_locked from public.exams e
    where e.id=p_exam_id and e.school_id=p_school_id for update;
  if not found then raise exception 'exam_not_available';end if;
  if not exists(select 1 from public.classes c
      where c.id=p_class_id and c.school_id=p_school_id) then
    raise exception 'class_not_available';end if;
  if p_publish then
    if v_exam_locked then raise exception 'exam_locked';end if;
    select count(*) into v_enrolled from public.student_classes sc
      join public.students s on s.id=sc.student_id and s.deleted_at is null
      where sc.school_id=p_school_id and sc.class_id=p_class_id and sc.is_current=true;
    if v_enrolled=0 then raise exception 'class_has_no_enrolled_learners';end if;
    select count(distinct tc.subject_id) into v_expected from public.teacher_classes tc
      join public.school_members sm
        on sm.profile_id=tc.teacher_id and sm.school_id=tc.school_id and sm.role='teacher'
      where tc.school_id=p_school_id and tc.class_id=p_class_id;
    if v_expected=0 then raise exception 'class_has_no_subjects';end if;
    select count(*) into v_verified from public.exam_class_subject_reviews r
      where r.exam_id=p_exam_id and r.school_id=p_school_id and r.class_id=p_class_id
        and r.state='verified';
    if v_verified<>v_expected then
      raise exception 'exam_subjects_not_fully_verified % of %',v_verified,v_expected;
    end if;
  elsif char_length(trim(coalesce(p_reason,''))) not between 10 and 500 then
    raise exception 'unpublish_reason_required';
  end if;
  insert into public.exam_class_publications(exam_id,school_id,class_id,status,
    published_at,published_by,updated_at)
  values(p_exam_id,p_school_id,p_class_id,
    case when p_publish then 'published' else 'draft' end,
    case when p_publish then now() else null end,
    case when p_publish then (select auth.uid()) else null end,now())
  on conflict(exam_id,class_id) do update set
    status=excluded.status,published_at=excluded.published_at,
    published_by=excluded.published_by,updated_at=now();
  insert into public.platform_events(event_type,actor_id,school_id,entity_type,entity_id,metadata,idempotency_key)
  values('authority.exam_class_publication',(select auth.uid()),p_school_id,
    'exams',p_exam_id,
    jsonb_build_object('class_id',p_class_id,'action',
      case when p_publish then 'publish' else 'unpublish' end,'reason',p_reason),
    'exam-publication:'||p_exam_id::text||':'||p_class_id::text||':'||
      pg_catalog.clock_timestamp()::text);
  return jsonb_build_object('status',case when p_publish then 'published' else 'draft' end);
end;
$function$;

revoke all on function public.teacher_get_class_exam_lifecycle(uuid,uuid,uuid) from public,anon;
revoke all on function public.teacher_submit_class_exam_subject(uuid,uuid,uuid,uuid) from public,anon;
revoke all on function public.school_review_class_exam_subject(uuid,uuid,uuid,uuid,text,text) from public,anon;
revoke all on function public.school_set_class_exam_publication(uuid,uuid,uuid,boolean,text) from public,anon;
grant execute on function public.teacher_get_class_exam_lifecycle(uuid,uuid,uuid) to authenticated;
grant execute on function public.teacher_submit_class_exam_subject(uuid,uuid,uuid,uuid) to authenticated;
grant execute on function public.school_review_class_exam_subject(uuid,uuid,uuid,uuid,text,text) to authenticated;
grant execute on function public.school_set_class_exam_publication(uuid,uuid,uuid,boolean,text) to authenticated;
commit;
