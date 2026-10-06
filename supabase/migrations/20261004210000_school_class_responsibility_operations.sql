begin;

-- One school-authoritative appointment can be shared by several teachers.
-- A membership row, rather than a job-title permission, determines who sees it.
-- authorization-test: public.school_responsibilities assigned same-school teacher/admin allowed; unassigned, former, cross-school teacher and anon denied
create table public.school_responsibilities (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools(id) on delete cascade,
  title text not null check (length(btrim(title)) between 2 and 100),
  category text not null check (category in ('department','games','club','teacher_duty','examination','event','other')),
  scope_label text not null check (length(btrim(scope_label)) between 1 and 120),
  sharing_mode text not null default 'shared' check (sharing_mode in ('shared','lead_and_support')),
  starts_on date not null,
  ends_on date,
  created_by uuid not null references public.profiles(id) on delete restrict,
  ended_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (ends_on is null or ends_on >= starts_on)
);

-- authorization-test: public.school_responsibility_members teacher reads own active interval only; admin reads history; former, unassigned, cross-school and anon denied
create table public.school_responsibility_members (
  id uuid primary key default gen_random_uuid(),
  responsibility_id uuid not null references public.school_responsibilities(id) on delete cascade,
  profile_id uuid not null references public.profiles(id) on delete restrict,
  member_role text not null default 'member' check (member_role in ('lead','member')),
  starts_on date not null,
  ends_on date,
  ended_at timestamptz,
  end_recorded_by uuid references public.profiles(id) on delete set null,
  end_reason text check (end_reason is null or end_reason in ('handover','rescheduled')),
  created_at timestamptz not null default now(),
  unique (responsibility_id, profile_id, starts_on),
  check (ends_on is null or ends_on >= starts_on)
);
do $$
declare v_constraint name;
begin
  select conname into v_constraint from pg_constraint
    where conrelid='public.school_responsibility_members'::regclass and contype='u'
      and pg_get_constraintdef(oid) like 'UNIQUE (responsibility_id, profile_id, starts_on)%'
    limit 1;
  if v_constraint is null then raise exception 'responsibility_member_start_constraint_missing'; end if;
  execute format('alter table public.school_responsibility_members drop constraint %I',v_constraint);
end; $$;
create unique index school_responsibility_members_active_start_uidx
  on public.school_responsibility_members(responsibility_id,profile_id,starts_on)
  where ended_at is null;

-- Stable request receipts make network retries safe for official appointments.
-- access: service-only public.school_responsibility_requests
-- authorization-test: public.school_responsibility_requests anon/authenticated denied; security-definer admin RPC writes receipts; service role only direct access
create table public.school_responsibility_requests (
  actor_id uuid not null references public.profiles(id) on delete cascade,
  request_id uuid not null,
  payload jsonb not null,
  result_id uuid not null references public.school_responsibilities(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (actor_id,request_id)
);
revoke all on public.school_responsibility_requests from public,anon,authenticated;
grant all on public.school_responsibility_requests to service_role;
alter table public.school_responsibility_requests enable row level security;

create index school_responsibilities_school_dates_idx
  on public.school_responsibilities(school_id, starts_on, ends_on)
  where ended_at is null;
create index school_responsibility_members_teacher_idx
  on public.school_responsibility_members(profile_id, starts_on, ends_on)
  where ended_at is null;

create or replace function public.teacher_can_read_school_responsibility(p_responsibility_id uuid,p_profile_id uuid)
returns boolean language sql stable security definer set search_path=public,auth,pg_temp as $$
  select p_profile_id=auth.uid() and exists(
    select 1 from public.school_responsibilities r
    where r.id=p_responsibility_id and r.ended_at is null
      and (r.ends_on is null or r.ends_on>=current_date)
      and public.is_operational_school_member(r.school_id)
      and (
        public.is_school_admin(r.school_id)
        or exists(select 1 from public.school_responsibility_members m where m.responsibility_id=r.id and m.profile_id=p_profile_id and m.ended_at is null and m.starts_on<=current_date and (m.ends_on is null or m.ends_on>=current_date))
      )
  )
$$;

alter table public.school_responsibilities enable row level security;
alter table public.school_responsibility_members enable row level security;
revoke all on public.school_responsibilities, public.school_responsibility_members from public, anon, authenticated;
grant select on public.school_responsibilities, public.school_responsibility_members to authenticated;
grant all on public.school_responsibilities, public.school_responsibility_members to service_role;

create policy school_responsibility_assigned_read on public.school_responsibilities
for select to authenticated using (public.teacher_can_read_school_responsibility(id,auth.uid()));
create policy school_responsibility_member_read on public.school_responsibility_members
for select to authenticated using (
  public.teacher_can_read_school_responsibility(responsibility_id,auth.uid())
  and (
    exists(select 1 from public.school_responsibilities r where r.id=responsibility_id and public.is_school_admin(r.school_id))
    or (profile_id=auth.uid() and ended_at is null and starts_on<=current_date and (ends_on is null or ends_on>=current_date))
  )
);

-- Production already has this canonical ledger, but its creation was never captured in tracked migrations.
-- Reconstruct its verified production shape here so a clean migration replay can apply class operations.
-- authorization-test: public.library_books assigned-class teachers read; same-school administrators write; other teachers, cross-school actors and anon denied
create table if not exists public.library_books (
  id uuid primary key default gen_random_uuid(),
  school_id uuid references public.schools(id) on delete cascade,
  title text not null,
  author text,
  isbn text,
  subject text,
  class_level text,
  total_copies integer default 1,
  available_copies integer default 1,
  added_by uuid references public.profiles(id),
  created_at timestamptz default now(),
  deleted_at timestamptz
);
alter table public.library_books enable row level security;

-- authorization-test: public.library_borrowings assigned-class learner history readable; same-school administrators write; unassigned, cross-school actors and anon denied
create table if not exists public.library_borrowings (
  id uuid primary key default gen_random_uuid(),
  school_id uuid references public.schools(id) on delete cascade,
  book_id uuid references public.library_books(id) on delete cascade,
  borrower_type text check (borrower_type in ('student', 'staff')),
  student_id uuid references public.students(id),
  staff_id uuid references public.profiles(id),
  issued_by uuid references public.profiles(id),
  issued_at timestamptz default now(),
  due_date date not null,
  returned_at timestamptz,
  condition_out text default 'good' check (condition_out in ('good', 'fair', 'damaged')),
  condition_in text check (condition_in in ('good', 'fair', 'damaged', 'lost')),
  fine_amount numeric(10, 2) default 0,
  fine_paid boolean default false,
  notes text,
  created_at timestamptz default now(),
  deleted_at timestamptz
);
alter table public.library_borrowings enable row level security;

-- Keep the school library canonical, but grant teachers only class-context reads.
-- Legacy borrowings without a class snapshot remain readable only through current assigned learner-class access.
alter table public.library_borrowings
  add column if not exists issued_for_class_id uuid references public.classes(id) on delete set null,
  add column if not exists issue_request_id uuid;
create index if not exists library_borrowings_class_learner_history_idx
  on public.library_borrowings(issued_for_class_id, student_id, issued_at desc)
  where deleted_at is null;
create unique index if not exists library_borrowings_issue_request_uidx
  on public.library_borrowings(issued_by,issue_request_id)
  where issue_request_id is not null;

drop policy if exists school_library_books on public.library_books;
drop policy if exists school_library_borrowings on public.library_borrowings;
revoke all on public.library_books, public.library_borrowings from public, anon, authenticated;
grant select, insert, update, delete on public.library_books, public.library_borrowings to authenticated;
grant all on public.library_books, public.library_borrowings to service_role;
create policy school_library_books_read on public.library_books
for select to authenticated using (
  public.is_operational_school_member(school_id)
  and (
    public.is_school_admin(school_id)
    or exists (
      select 1 from public.teacher_classes tc
      where tc.school_id = library_books.school_id
        and tc.teacher_id = auth.uid()
        and public.teacher_can_access_class(tc.class_id, tc.subject_id, false)
    )
  )
);
create policy school_library_books_admin_write on public.library_books
for all to authenticated
using (public.is_school_admin(school_id))
with check (public.is_school_admin(school_id));

create policy school_library_borrowings_assigned_read on public.library_borrowings
for select to authenticated using (
  public.is_operational_school_member(school_id)
  and (
    public.is_school_admin(school_id)
    or (
      student_id is not null and (
        (issued_for_class_id is not null and issued_for_class_id in (
          select tc.class_id from public.teacher_classes tc
          where tc.teacher_id = auth.uid() and tc.school_id = library_borrowings.school_id
            and public.teacher_can_access_class(tc.class_id, tc.subject_id, false)
        ))
        or exists (
          select 1 from public.student_classes sc join public.teacher_classes tc
            on tc.class_id = sc.class_id and tc.school_id = sc.school_id
          where sc.student_id = library_borrowings.student_id
            and sc.school_id = library_borrowings.school_id and sc.is_current
            and tc.teacher_id = auth.uid()
            and public.teacher_can_access_class(tc.class_id, tc.subject_id, false)
        )
      )
    )
  )
);
create policy school_library_borrowings_admin_write on public.library_borrowings
for all to authenticated
using (public.is_school_admin(school_id))
with check (public.is_school_admin(school_id));

-- authorization-test: public.class_duty_rosters assigned same-class teacher read; class teacher write; subject-only, cross-school and anon denied
create table public.class_duty_rosters (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools(id) on delete cascade,
  class_id uuid not null references public.classes(id) on delete cascade,
  duty_code text not null check (duty_code in ('board','classroom','materials','line_leader','attendance_helper','other')),
  title text not null check (length(btrim(title)) between 2 and 80),
  starts_on date not null,
  ends_on date not null,
  created_by uuid not null references public.profiles(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  archived_at timestamptz,
  check (ends_on >= starts_on),
  unique (class_id, duty_code, starts_on)
);
-- authorization-test: public.class_duty_roster_members assigned class teacher read; subject-only, cross-school and anon denied
create table public.class_duty_roster_members (
  id uuid primary key default gen_random_uuid(),
  roster_id uuid not null references public.class_duty_rosters(id) on delete cascade,
  student_id uuid not null references public.students(id) on delete restrict,
  active boolean not null default true,
  assigned_at timestamptz not null default now(),
  ended_at timestamptz,
  unique (roster_id, student_id),
  check ((active and ended_at is null) or (not active and ended_at is not null))
);
create index class_duty_rosters_class_dates_idx on public.class_duty_rosters(class_id, starts_on, ends_on) where archived_at is null;
create index class_duty_members_roster_active_idx on public.class_duty_roster_members(roster_id, active);
alter table public.class_duty_rosters enable row level security;
alter table public.class_duty_roster_members enable row level security;
revoke all on public.class_duty_rosters, public.class_duty_roster_members from public, anon, authenticated;
grant select on public.class_duty_rosters, public.class_duty_roster_members to authenticated;
grant all on public.class_duty_rosters, public.class_duty_roster_members to service_role;
create policy class_duty_assigned_teacher_read on public.class_duty_rosters
for select to authenticated using (public.teacher_can_access_class(class_id, null, false) and school_id = (select c.school_id from public.classes c where c.id = class_id));
create policy class_duty_class_teacher_write on public.class_duty_rosters
for all to authenticated using (public.teacher_can_access_class(class_id, null, true))
with check (public.teacher_can_access_class(class_id, null, true) and school_id = (select c.school_id from public.classes c where c.id = class_id) and created_by = auth.uid());
create policy class_duty_members_assigned_read on public.class_duty_roster_members
for select to authenticated using (exists (select 1 from public.class_duty_rosters r where r.id = roster_id and public.teacher_can_access_class(r.class_id, null, false)));

create or replace function public.teacher_save_class_duty_roster(
  p_class_id uuid, p_duty_code text, p_title text, p_starts_on date, p_ends_on date, p_student_ids uuid[]
) returns uuid
language plpgsql security definer set search_path = public, auth, pg_temp as $$
declare v_school_id uuid; v_id uuid; v_uid uuid := auth.uid(); v_student_id uuid;
begin
  if v_uid is null then raise exception 'not_authenticated' using errcode='42501'; end if;
  if p_class_id is null or p_starts_on is null or p_ends_on is null or p_ends_on < p_starts_on then raise exception 'duty_dates_invalid'; end if;
  if p_duty_code not in ('board','classroom','materials','line_leader','attendance_helper','other') then raise exception 'duty_type_invalid'; end if;
  if length(btrim(coalesce(p_title,''))) not between 2 and 80 then raise exception 'duty_title_invalid'; end if;
  if coalesce(cardinality(p_student_ids),0) not between 1 and 8 then raise exception 'duty_members_required'; end if;
  if (select count(distinct x) from unnest(p_student_ids) x) <> cardinality(p_student_ids) then raise exception 'duplicate_duty_member'; end if;
  if not public.teacher_can_access_class(p_class_id,null,true) then raise exception 'class_teacher_required' using errcode='42501'; end if;
  select school_id into v_school_id from public.classes where id=p_class_id;
  if v_school_id is null then raise exception 'class_not_found'; end if;

  insert into public.class_duty_rosters(school_id,class_id,duty_code,title,starts_on,ends_on,created_by)
  values(v_school_id,p_class_id,p_duty_code,btrim(p_title),p_starts_on,p_ends_on,v_uid)
  on conflict(class_id,duty_code,starts_on) do update set title=excluded.title, ends_on=excluded.ends_on, updated_at=now()
  returning id into v_id;

  foreach v_student_id in array p_student_ids loop
    if not exists(select 1 from public.student_classes sc where sc.student_id=v_student_id and sc.class_id=p_class_id and sc.school_id=v_school_id and sc.is_current) then
      raise exception 'learner_not_currently_enrolled' using errcode='23514';
    end if;
  end loop;

  update public.class_duty_roster_members set active=false,ended_at=now()
  where roster_id=v_id and active and not(student_id=any(p_student_ids));
  insert into public.class_duty_roster_members(roster_id,student_id,active,ended_at)
  select v_id,x,true,null from unnest(p_student_ids) x
  on conflict(roster_id,student_id) do update set active=true,ended_at=null;
  return v_id;
end; $$;

create or replace function public.teacher_issue_class_library_book(
  p_class_id uuid, p_student_id uuid, p_book_id uuid, p_due_date date, p_condition text, p_request_id uuid
) returns uuid
language plpgsql security definer set search_path = public, auth, pg_temp as $$
declare v_uid uuid:=auth.uid(); v_school_id uuid; v_available integer; v_loan_id uuid; v_existing public.library_borrowings%rowtype;
begin
  if v_uid is null then raise exception 'not_authenticated' using errcode='42501'; end if;
  if p_request_id is null then raise exception 'issue_request_id_required'; end if;
  if not public.teacher_can_access_class(p_class_id,null,false) then raise exception 'teacher_class_not_authorized' using errcode='42501'; end if;
  perform pg_advisory_xact_lock(hashtextextended(v_uid::text||':'||p_request_id::text,0));
  select * into v_existing from public.library_borrowings where issued_by=v_uid and issue_request_id=p_request_id;
  if found then
    if v_existing.issued_for_class_id is distinct from p_class_id or v_existing.student_id is distinct from p_student_id or v_existing.book_id is distinct from p_book_id or v_existing.due_date is distinct from p_due_date or v_existing.condition_out is distinct from p_condition then raise exception 'issue_request_payload_conflict'; end if;
    return v_existing.id;
  end if;
  if p_due_date is null or p_due_date<current_date then raise exception 'due_date_invalid'; end if;
  if p_condition not in ('good','fair','damaged') then raise exception 'book_condition_invalid'; end if;
  select c.school_id into v_school_id from public.classes c where c.id=p_class_id;
  if v_school_id is null then raise exception 'class_not_found'; end if;
  if not exists(select 1 from public.student_classes sc where sc.student_id=p_student_id and sc.class_id=p_class_id and sc.school_id=v_school_id and sc.is_current) then raise exception 'learner_not_currently_enrolled' using errcode='42501'; end if;
  select available_copies into v_available from public.library_books where id=p_book_id and school_id=v_school_id and deleted_at is null for update;
  if not found then raise exception 'school_book_not_found'; end if;
  if coalesce(v_available,0)<=0 then raise exception 'no_copies_available'; end if;
  update public.library_books set available_copies=available_copies-1 where id=p_book_id and school_id=v_school_id;
  insert into public.library_borrowings(school_id,book_id,borrower_type,student_id,issued_by,issued_at,due_date,condition_out,fine_amount,fine_paid,issued_for_class_id,issue_request_id)
  values(v_school_id,p_book_id,'student',p_student_id,v_uid,now(),p_due_date,p_condition,0,false,p_class_id,p_request_id) returning id into v_loan_id;
  return v_loan_id;
end; $$;

create or replace function public.teacher_return_class_library_book(p_borrowing_id uuid,p_condition_in text default 'good')
returns uuid language plpgsql security definer set search_path=public,auth,pg_temp as $$
declare v_uid uuid:=auth.uid(); v_loan public.library_borrowings%rowtype;
begin
  if v_uid is null then raise exception 'not_authenticated' using errcode='42501'; end if;
  if p_condition_in not in ('good','fair','damaged','lost') then raise exception 'book_condition_invalid'; end if;
  select * into v_loan from public.library_borrowings where id=p_borrowing_id and borrower_type='student' and deleted_at is null for update;
  if not found then raise exception 'borrowing_not_found'; end if;
  if v_loan.issued_for_class_id is not null then
    if not public.teacher_can_access_class(v_loan.issued_for_class_id,null,false) then raise exception 'teacher_class_not_authorized' using errcode='42501'; end if;
  elsif not exists(
    select 1 from public.student_classes sc
    where sc.student_id=v_loan.student_id and sc.school_id=v_loan.school_id and sc.is_current
      and public.teacher_can_access_class(sc.class_id,null,false)
  ) then
    raise exception 'teacher_class_not_authorized' using errcode='42501';
  end if;
  if v_loan.returned_at is not null then raise exception 'borrowing_already_returned'; end if;
  update public.library_borrowings set returned_at=now(),condition_in=p_condition_in where id=p_borrowing_id and returned_at is null;
  if p_condition_in<>'lost' then update public.library_books set available_copies=least(coalesce(total_copies,0),coalesce(available_copies,0)+1) where id=v_loan.book_id and school_id=v_loan.school_id and deleted_at is null; end if;
  return p_borrowing_id;
end; $$;

create or replace function public.teacher_get_class_operations(p_class_id uuid)
returns jsonb language plpgsql stable security definer set search_path=public,auth,pg_temp as $$
declare v_school_id uuid; v_result jsonb;
begin
  if auth.uid() is null then raise exception 'not_authenticated' using errcode='42501'; end if;
  if not public.teacher_can_access_class(p_class_id,null,false) then raise exception 'teacher_class_not_authorized' using errcode='42501'; end if;
  select school_id into v_school_id from public.classes where id=p_class_id;
  select jsonb_build_object(
    'duties',coalesce((select jsonb_agg(jsonb_build_object('id',r.id,'duty_code',r.duty_code,'title',r.title,'starts_on',r.starts_on,'ends_on',r.ends_on,'members',coalesce((select jsonb_agg(jsonb_build_object('student_id',m.student_id,'student_name',s.name,'active',m.active)) from public.class_duty_roster_members m join public.students s on s.id=m.student_id where m.roster_id=r.id),'[]'::jsonb))) from public.class_duty_rosters r where r.class_id=p_class_id and r.school_id=v_school_id and r.archived_at is null),'[]'::jsonb),
    'borrowings',coalesce((select jsonb_agg(jsonb_build_object('id',b.id,'student_id',b.student_id,'student_name',s.name,'book_id',b.book_id,'book_title',lb.title,'issued_at',b.issued_at,'due_date',b.due_date,'returned_at',b.returned_at,'condition_out',b.condition_out,'condition_in',b.condition_in) order by b.due_date) from public.library_borrowings b join public.students s on s.id=b.student_id join public.library_books lb on lb.id=b.book_id where b.school_id=v_school_id and b.borrower_type='student' and b.deleted_at is null and (b.issued_for_class_id=p_class_id or (b.issued_for_class_id is null and exists(select 1 from public.student_classes sc where sc.student_id=b.student_id and sc.class_id=p_class_id and sc.school_id=v_school_id and sc.is_current)) )),'[]'::jsonb),
    'books',coalesce((select jsonb_agg(jsonb_build_object('id',b.id,'title',b.title,'author',b.author,'available_copies',b.available_copies) order by b.title) from public.library_books b where b.school_id=v_school_id and b.deleted_at is null),'[]'::jsonb)
  ) into v_result;
  return v_result;
end; $$;

create or replace function public.teacher_get_my_school_responsibilities()
returns jsonb language plpgsql stable security definer set search_path=public,auth,pg_temp as $$
declare v_uid uuid:=auth.uid(); v_school uuid; v_result jsonb;
begin
  if v_uid is null then raise exception 'not_authenticated' using errcode='42501'; end if;
  select active_school_id into v_school from public.get_my_teacher_school_context();
  if v_school is null then return jsonb_build_object('school_id',null,'teaching_roles','[]'::jsonb,'appointments','[]'::jsonb,'upcoming_appointments','[]'::jsonb); end if;
  if not public.is_operational_school_member(v_school) then raise exception 'school_membership_required' using errcode='42501'; end if;
  select jsonb_build_object(
    'school_id',v_school,
    'teaching_roles',coalesce((select jsonb_agg(jsonb_build_object('class_id',c.id,'class_name',concat_ws(' ',c.name,c.stream),'subject_name',sub.name,'is_class_teacher',tc.is_class_teacher) order by c.name,sub.name) from public.teacher_classes tc join public.classes c on c.id=tc.class_id and c.school_id=tc.school_id join public.subjects sub on sub.id=tc.subject_id where tc.teacher_id=v_uid and tc.school_id=v_school),'[]'::jsonb),
    'appointments',coalesce((select jsonb_agg(jsonb_build_object('id',r.id,'title',r.title,'category',r.category,'scope_label',r.scope_label,'sharing_mode',r.sharing_mode,'member_role',m.member_role,'starts_on',m.starts_on,'ends_on',coalesce(m.ends_on,r.ends_on),'colleagues',coalesce((select jsonb_agg(jsonb_build_object('name',p.full_name,'role',cm.member_role) order by cm.member_role,p.full_name) from public.school_responsibility_members cm join public.profiles p on p.id=cm.profile_id where cm.responsibility_id=r.id and cm.ended_at is null and cm.starts_on<=current_date and (cm.ends_on is null or cm.ends_on>=current_date) and cm.profile_id<>v_uid),'[]'::jsonb)) order by r.starts_on desc) from public.school_responsibility_members m join public.school_responsibilities r on r.id=m.responsibility_id join public.profiles p on p.id=m.profile_id where r.school_id=v_school and m.profile_id=v_uid and r.ended_at is null and m.ended_at is null and m.starts_on<=current_date and coalesce(m.ends_on,r.ends_on,'infinity'::date)>=current_date),'[]'::jsonb),
    'upcoming_appointments',coalesce((select jsonb_agg(jsonb_build_object('id',r.id,'title',r.title,'category',r.category,'scope_label',r.scope_label,'sharing_mode',r.sharing_mode,'member_role',m.member_role,'starts_on',m.starts_on,'ends_on',coalesce(m.ends_on,r.ends_on),'colleagues',coalesce((select jsonb_agg(jsonb_build_object('name',p.full_name,'role',cm.member_role) order by cm.member_role,p.full_name) from public.school_responsibility_members cm join public.profiles p on p.id=cm.profile_id where cm.responsibility_id=r.id and cm.ended_at is null and cm.starts_on=m.starts_on and coalesce(cm.ends_on,r.ends_on,'infinity'::date)>=cm.starts_on and cm.profile_id<>v_uid),'[]'::jsonb)) order by m.starts_on,r.title) from public.school_responsibility_members m join public.school_responsibilities r on r.id=m.responsibility_id join public.profiles p on p.id=m.profile_id where r.school_id=v_school and m.profile_id=v_uid and r.ended_at is null and m.ended_at is null and m.starts_on>current_date and coalesce(m.ends_on,r.ends_on,'infinity'::date)>=m.starts_on),'[]'::jsonb)
  ) into v_result;
  return v_result;
end; $$;

create or replace function public.teacher_get_school_responsibility_admin_context()
returns jsonb language plpgsql stable security definer set search_path=public,auth,pg_temp as $$
declare v_uid uuid:=auth.uid(); v_school uuid; v_result jsonb;
begin
  if v_uid is null then raise exception 'not_authenticated' using errcode='42501'; end if;
  select active_school_id into v_school from public.get_my_teacher_school_context();
  if v_school is null then return jsonb_build_object('school_id',null,'teachers','[]'::jsonb); end if;
  if not public.is_school_admin(v_school) then raise exception 'school_admin_required' using errcode='42501'; end if;
  select jsonb_build_object(
    'school_id',v_school,
    'teachers',coalesce((
      select jsonb_agg(jsonb_build_object('id',p.id,'name',coalesce(nullif(btrim(p.full_name),''),'Teacher')) order by p.full_name,p.id)
      from public.school_members sm join public.profiles p on p.id=sm.profile_id
      where sm.school_id=v_school and sm.role::text='teacher' and coalesce(sm.status::text,'active')='active'
        and p.role::text='teacher' and p.account_status::text='active' and not coalesce(p.is_anonymized,false)
    ),'[]'::jsonb),
    'responsibilities',coalesce((
      select jsonb_agg(jsonb_build_object(
        'id',r.id,'title',r.title,'category',r.category,'scope_label',r.scope_label,
        'sharing_mode',r.sharing_mode,'starts_on',r.starts_on,'ends_on',r.ends_on,
        'members',coalesce((
          select jsonb_agg(jsonb_build_object('id',m.profile_id,'name',coalesce(nullif(btrim(p.full_name),''),'Teacher'),'role',m.member_role) order by m.member_role,p.full_name)
          from public.school_responsibility_members m join public.profiles p on p.id=m.profile_id
          where m.responsibility_id=r.id and m.ended_at is null and m.starts_on<=current_date
            and coalesce(m.ends_on,r.ends_on,'infinity'::date)>=current_date
        ),'[]'::jsonb),
        'upcoming_members',coalesce((
          select jsonb_agg(jsonb_build_object('id',m.profile_id,'name',coalesce(nullif(btrim(p.full_name),''),'Teacher'),'role',m.member_role,'starts_on',m.starts_on) order by m.starts_on,m.member_role,p.full_name)
          from public.school_responsibility_members m join public.profiles p on p.id=m.profile_id
          where m.responsibility_id=r.id and m.ended_at is null and m.starts_on>current_date
            and coalesce(m.ends_on,r.ends_on,'infinity'::date)>=m.starts_on
        ),'[]'::jsonb),
        'history',coalesce((
          select jsonb_agg(jsonb_build_object('id',m.profile_id,'name',coalesce(nullif(btrim(p.full_name),''),'Teacher'),'role',m.member_role,'starts_on',m.starts_on,'ends_on',m.ends_on,'end_reason',m.end_reason,'ended_by_name',coalesce(nullif(btrim(ep.full_name),''),'School admin')) order by coalesce(m.ended_at,'-infinity'::timestamptz) desc,m.starts_on desc,m.member_role,p.full_name)
          from public.school_responsibility_members m join public.profiles p on p.id=m.profile_id
          left join public.profiles ep on ep.id=m.end_recorded_by
          where m.responsibility_id=r.id and (m.ended_at is not null or m.ends_on<current_date)
        ),'[]'::jsonb)
      ) order by r.starts_on desc)
      from public.school_responsibilities r
      where r.school_id=v_school and r.ended_at is null and coalesce(r.ends_on,'infinity'::date)>=current_date
    ),'[]'::jsonb)
  ) into v_result;
  return v_result;
end; $$;

create or replace function public.admin_transfer_school_responsibility(p_responsibility_id uuid,p_effective_on date,p_members jsonb,p_request_id uuid)
returns uuid language plpgsql security definer set search_path=public,auth,pg_temp as $$
declare v_uid uuid:=auth.uid(); v_row public.school_responsibilities%rowtype; v_member jsonb; v_profile uuid; v_role text; v_count integer:=0; v_leads integer:=0; v_payload jsonb; v_existing jsonb; v_result uuid;
begin
  if v_uid is null then raise exception 'not_authenticated' using errcode='42501'; end if;
  select * into v_row from public.school_responsibilities where id=p_responsibility_id and ended_at is null for update;
  if not found then raise exception 'responsibility_not_found'; end if;
  if not public.is_school_admin(v_row.school_id) then raise exception 'school_admin_required' using errcode='42501'; end if;
  if p_request_id is null then raise exception 'responsibility_request_id_required'; end if;
  perform pg_advisory_xact_lock(hashtextextended(v_uid::text||':'||p_request_id::text,0));
  v_payload:=jsonb_build_object('operation','transfer_handover','responsibility_id',p_responsibility_id,'effective_on',p_effective_on,'members',p_members);
  select payload,result_id into v_existing,v_result from public.school_responsibility_requests where actor_id=v_uid and request_id=p_request_id;
  if found then
    if v_existing is distinct from v_payload then raise exception 'responsibility_request_payload_conflict'; end if;
    return v_result;
  end if;
  if p_effective_on is null or p_effective_on<=current_date or p_effective_on<=v_row.starts_on or (v_row.ends_on is not null and p_effective_on>v_row.ends_on) then raise exception 'responsibility_transfer_date_invalid'; end if;
  if exists(select 1 from public.school_responsibility_members where responsibility_id=v_row.id and ended_at is null and starts_on>current_date) then raise exception 'responsibility_future_handover_already_scheduled'; end if;
  if jsonb_typeof(p_members) is distinct from 'array' or jsonb_array_length(p_members) not between 1 and 20 then raise exception 'responsibility_members_required'; end if;
  for v_member in select value from jsonb_array_elements(p_members) loop
    v_profile:=nullif(v_member->>'profile_id','')::uuid; v_role:=v_member->>'role';
    if v_profile is null or v_role not in ('lead','member') or not exists(select 1 from public.school_members sm join public.profiles p on p.id=sm.profile_id where sm.profile_id=v_profile and sm.school_id=v_row.school_id and sm.role::text='teacher' and coalesce(sm.status::text,'active')='active' and p.role::text='teacher' and p.account_status::text='active' and not coalesce(p.is_anonymized,false)) then raise exception 'responsibility_teacher_membership_required' using errcode='42501'; end if;
    if exists(select 1 from public.school_responsibility_members where responsibility_id=v_row.id and profile_id=v_profile and starts_on=p_effective_on and ended_at is not null) then raise exception 'duplicate_responsibility_member'; end if;
    if v_role='lead' then v_leads:=v_leads+1; end if; v_count:=v_count+1;
  end loop;
  if (select count(distinct nullif(value->>'profile_id','')::uuid) from jsonb_array_elements(p_members))<>v_count then raise exception 'duplicate_responsibility_member'; end if;
  if v_row.sharing_mode='lead_and_support' and (v_leads<>1 or v_count<2) then raise exception 'one_lead_and_support_required'; end if;
  update public.school_responsibility_members set ends_on=p_effective_on-1,end_recorded_by=v_uid,end_reason='handover'
    where responsibility_id=v_row.id and ended_at is null and starts_on<=current_date
      and (ends_on is null or ends_on>=current_date);
  update public.school_responsibilities set updated_at=now() where id=v_row.id;
  for v_member in select value from jsonb_array_elements(p_members) loop
    insert into public.school_responsibility_members(responsibility_id,profile_id,member_role,starts_on,ends_on)
    values(v_row.id,nullif(v_member->>'profile_id','')::uuid,v_member->>'role',p_effective_on,v_row.ends_on)
    on conflict(responsibility_id,profile_id,starts_on) where ended_at is null do update set member_role=excluded.member_role,ends_on=excluded.ends_on,ended_at=null;
  end loop;
  insert into public.school_responsibility_requests(actor_id,request_id,payload,result_id) values(v_uid,p_request_id,v_payload,v_row.id);
  return v_row.id;
end; $$;

create or replace function public.admin_reschedule_school_responsibility_handover(p_responsibility_id uuid,p_effective_on date,p_members jsonb,p_request_id uuid)
returns uuid language plpgsql security definer set search_path=public,auth,pg_temp as $$
declare v_uid uuid:=auth.uid(); v_row public.school_responsibilities%rowtype; v_member jsonb; v_profile uuid; v_role text; v_count integer:=0; v_leads integer:=0; v_payload jsonb; v_existing jsonb; v_result uuid;
begin
  if v_uid is null then raise exception 'not_authenticated' using errcode='42501'; end if;
  select * into v_row from public.school_responsibilities where id=p_responsibility_id and ended_at is null for update;
  if not found then raise exception 'responsibility_not_found'; end if;
  if not public.is_school_admin(v_row.school_id) then raise exception 'school_admin_required' using errcode='42501'; end if;
  if p_request_id is null then raise exception 'responsibility_request_id_required'; end if;
  perform pg_advisory_xact_lock(hashtextextended(v_uid::text||':'||p_request_id::text,0));
  v_payload:=jsonb_build_object('operation','reschedule_handover','responsibility_id',p_responsibility_id,'effective_on',p_effective_on,'members',p_members);
  select payload,result_id into v_existing,v_result from public.school_responsibility_requests where actor_id=v_uid and request_id=p_request_id;
  if found then
    if v_existing is distinct from v_payload then raise exception 'responsibility_request_payload_conflict'; end if;
    return v_result;
  end if;
  if p_effective_on is null or p_effective_on<=current_date or p_effective_on<=v_row.starts_on or (v_row.ends_on is not null and p_effective_on>v_row.ends_on) then raise exception 'responsibility_transfer_date_invalid'; end if;
  if not exists(select 1 from public.school_responsibility_members where responsibility_id=v_row.id and ended_at is null and starts_on>current_date) then raise exception 'responsibility_future_handover_not_found'; end if;
  if jsonb_typeof(p_members) is distinct from 'array' or jsonb_array_length(p_members) not between 1 and 20 then raise exception 'responsibility_members_required'; end if;
  for v_member in select value from jsonb_array_elements(p_members) loop
    v_profile:=nullif(v_member->>'profile_id','')::uuid; v_role:=v_member->>'role';
    if v_profile is null or v_role not in ('lead','member') or not exists(select 1 from public.school_members sm join public.profiles p on p.id=sm.profile_id where sm.profile_id=v_profile and sm.school_id=v_row.school_id and sm.role::text='teacher' and coalesce(sm.status::text,'active')='active' and p.role::text='teacher' and p.account_status::text='active' and not coalesce(p.is_anonymized,false)) then raise exception 'responsibility_teacher_membership_required' using errcode='42501'; end if;
    if v_role='lead' then v_leads:=v_leads+1; end if;
    v_count:=v_count+1;
  end loop;
  if (select count(distinct nullif(value->>'profile_id','')::uuid) from jsonb_array_elements(p_members))<>v_count then raise exception 'duplicate_responsibility_member'; end if;
  if v_row.sharing_mode='lead_and_support' and (v_leads<>1 or v_count<2) then raise exception 'one_lead_and_support_required'; end if;
  update public.school_responsibility_members set ended_at=now(),end_recorded_by=v_uid,end_reason='rescheduled'
    where responsibility_id=v_row.id and ended_at is null and starts_on>current_date;
  update public.school_responsibility_members set ends_on=p_effective_on-1,end_recorded_by=v_uid,end_reason='handover'
    where responsibility_id=v_row.id and ended_at is null and starts_on<=current_date
      and (ends_on is null or ends_on>=current_date);
  update public.school_responsibilities set updated_at=now() where id=v_row.id;
  for v_member in select value from jsonb_array_elements(p_members) loop
    insert into public.school_responsibility_members(responsibility_id,profile_id,member_role,starts_on,ends_on)
    values(v_row.id,nullif(v_member->>'profile_id','')::uuid,v_member->>'role',p_effective_on,v_row.ends_on);
  end loop;
  insert into public.school_responsibility_requests(actor_id,request_id,payload,result_id) values(v_uid,p_request_id,v_payload,v_row.id);
  return v_row.id;
end; $$;

create or replace function public.admin_assign_school_responsibility(
  p_school_id uuid,p_title text,p_category text,p_scope_label text,p_sharing_mode text,p_starts_on date,p_ends_on date,p_members jsonb,p_request_id uuid
) returns uuid language plpgsql security definer set search_path=public,auth,pg_temp as $$
declare v_uid uuid:=auth.uid(); v_id uuid; v_member jsonb; v_profile uuid; v_role text; v_count integer:=0; v_leads integer:=0; v_payload jsonb; v_existing jsonb;
begin
  if v_uid is null then raise exception 'not_authenticated' using errcode='42501'; end if;
  if p_request_id is null then raise exception 'responsibility_request_id_required'; end if;
  perform pg_advisory_xact_lock(hashtextextended(v_uid::text||':'||p_request_id::text,0));
  if not public.is_school_admin(p_school_id) then raise exception 'school_admin_required' using errcode='42501'; end if;
  v_payload:=jsonb_build_object('school_id',p_school_id,'title',btrim(coalesce(p_title,'')),'category',p_category,'scope_label',btrim(coalesce(p_scope_label,'')),'sharing_mode',p_sharing_mode,'starts_on',p_starts_on,'ends_on',p_ends_on,'members',p_members);
  select payload,result_id into v_existing,v_id from public.school_responsibility_requests where actor_id=v_uid and request_id=p_request_id;
  if found then
    if v_existing is distinct from v_payload then raise exception 'responsibility_request_payload_conflict'; end if;
    return v_id;
  end if;
  if length(btrim(coalesce(p_title,''))) not between 2 and 100 or length(btrim(coalesce(p_scope_label,''))) not between 1 and 120 then raise exception 'responsibility_details_invalid'; end if;
  if p_category not in ('department','games','club','teacher_duty','examination','event','other') or p_sharing_mode not in ('shared','lead_and_support') then raise exception 'responsibility_type_invalid'; end if;
  if p_starts_on is null or (p_ends_on is not null and p_ends_on<p_starts_on) then raise exception 'responsibility_dates_invalid'; end if;
  if jsonb_typeof(p_members) is distinct from 'array' or jsonb_array_length(p_members) not between 1 and 20 then raise exception 'responsibility_members_required'; end if;
  insert into public.school_responsibilities(school_id,title,category,scope_label,sharing_mode,starts_on,ends_on,created_by)
  values(p_school_id,btrim(p_title),p_category,btrim(p_scope_label),p_sharing_mode,p_starts_on,p_ends_on,v_uid) returning id into v_id;
  for v_member in select value from jsonb_array_elements(p_members) loop
    v_profile:=nullif(v_member->>'profile_id','')::uuid; v_role:=v_member->>'role';
    if v_profile is null or v_role not in ('lead','member') or not exists(select 1 from public.school_members sm join public.profiles p on p.id=sm.profile_id where sm.profile_id=v_profile and sm.school_id=p_school_id and sm.role::text='teacher' and coalesce(sm.status::text,'active')='active' and p.role::text='teacher' and p.account_status::text='active' and not coalesce(p.is_anonymized,false)) then raise exception 'responsibility_teacher_membership_required' using errcode='42501'; end if;
    if exists(select 1 from public.school_responsibility_members where responsibility_id=v_id and profile_id=v_profile) then raise exception 'duplicate_responsibility_member'; end if;
    if v_role='lead' then v_leads:=v_leads+1; end if;
    v_count:=v_count+1;
    insert into public.school_responsibility_members(responsibility_id,profile_id,member_role,starts_on,ends_on) values(v_id,v_profile,v_role,p_starts_on,p_ends_on);
  end loop;
  if p_sharing_mode='lead_and_support' and (v_leads<>1 or v_count<2) then raise exception 'one_lead_and_support_required'; end if;
  insert into public.school_responsibility_requests(actor_id,request_id,payload,result_id) values(v_uid,p_request_id,v_payload,v_id);
  return v_id;
end; $$;

revoke all on function public.teacher_save_class_duty_roster(uuid,text,text,date,date,uuid[]) from public,anon;
revoke all on function public.teacher_issue_class_library_book(uuid,uuid,uuid,date,text,uuid) from public,anon;
revoke all on function public.teacher_return_class_library_book(uuid,text) from public,anon;
revoke all on function public.teacher_get_class_operations(uuid) from public,anon;
revoke all on function public.teacher_get_my_school_responsibilities() from public,anon;
revoke all on function public.teacher_can_read_school_responsibility(uuid,uuid) from public,anon;
revoke all on function public.teacher_get_school_responsibility_admin_context() from public,anon;
revoke all on function public.admin_assign_school_responsibility(uuid,text,text,text,text,date,date,jsonb,uuid) from public,anon;
revoke all on function public.admin_transfer_school_responsibility(uuid,date,jsonb,uuid) from public,anon;
revoke all on function public.admin_reschedule_school_responsibility_handover(uuid,date,jsonb,uuid) from public,anon;
grant execute on function public.teacher_save_class_duty_roster(uuid,text,text,date,date,uuid[]) to authenticated;
grant execute on function public.teacher_issue_class_library_book(uuid,uuid,uuid,date,text,uuid) to authenticated;
grant execute on function public.teacher_return_class_library_book(uuid,text) to authenticated;
grant execute on function public.teacher_get_class_operations(uuid) to authenticated;
grant execute on function public.teacher_get_my_school_responsibilities() to authenticated;
grant execute on function public.teacher_can_read_school_responsibility(uuid,uuid) to authenticated;
grant execute on function public.teacher_get_school_responsibility_admin_context() to authenticated;
grant execute on function public.admin_assign_school_responsibility(uuid,text,text,text,text,date,date,jsonb,uuid) to authenticated;
grant execute on function public.admin_transfer_school_responsibility(uuid,date,jsonb,uuid) to authenticated;
grant execute on function public.admin_reschedule_school_responsibility_handover(uuid,date,jsonb,uuid) to authenticated;

commit;
