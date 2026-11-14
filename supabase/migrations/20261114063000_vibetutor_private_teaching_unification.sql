-- VibeSchool private tutoring: independent activation, private tasks, and group membership.
-- Security model: signed-in active teachers; accepted tutor/learner invitations; no school data sharing.
begin;

-- Preserve the existing FK from invitations to vibetutor_tutors, while allowing
-- a teacher to tutor privately without publishing to the marketplace.
create or replace function public.vibetutor_ensure_private_tutor()
returns void language plpgsql security definer set search_path = '' as $$
declare v_name text;
begin
  select nullif(trim(p.full_name), '') into v_name
  from public.profiles p
  where p.id = auth.uid() and p.role::text = 'teacher'
    and p.account_status::text = 'active'
    and not coalesce(p.is_anonymized, false);
  if not found then raise exception 'An active teacher account is required' using errcode='42501'; end if;
  insert into public.vibetutor_tutors (profile_id, display_name, status, source)
  values (auth.uid(), coalesce(v_name, 'VibeSchool Teacher'), 'paused', 'private_tutoring')
  on conflict (profile_id) do nothing;
end $$;
revoke all on function public.vibetutor_ensure_private_tutor() from public, anon, authenticated;

create or replace function public.vibetutor_create_student_invite() returns uuid
language plpgsql security definer set search_path = '' as $$
declare v_token uuid;
begin
  perform public.vibetutor_ensure_private_tutor();
  if (select count(*) from public.vibetutor_student_invitations
      where tutor_id = auth.uid() and status in ('open','invited')) >= 5 then
    raise exception 'Maximum of 5 outstanding invitations. Revoke an unused invitation first';
  end if;
  insert into public.vibetutor_student_invitations(tutor_id)
  values (auth.uid()) returning token into v_token;
  return v_token;
end $$;
revoke all on function public.vibetutor_create_student_invite() from public,anon;
grant execute on function public.vibetutor_create_student_invite() to authenticated;

create or replace function public.vibetutor_invite_student_by_code(p_code text) returns text
language plpgsql security definer set search_path = '' as $$
declare v_student uuid;
begin
  perform public.vibetutor_ensure_private_tutor();
  if p_code is null or upper(trim(p_code)) !~ '^[0-9A-F]{16}$' then raise exception 'Invalid student code'; end if;
  if (select count(*) from public.vibetutor_student_invitations
      where tutor_id=auth.uid() and created_at > now()-interval '1 hour') >= 10 then
    raise exception 'Invitation limit reached. Try again later';
  end if;
  select c.student_id into v_student from public.vibetutor_student_invite_codes c
  join public.students s on s.id=c.student_id and s.deleted_at is null and s.profile_id is not null
  where c.code=upper(trim(p_code));
  if v_student is null then raise exception 'Code not found'; end if;
  if exists(select 1 from public.vibetutor_student_invitations
    where tutor_id=auth.uid() and student_id=v_student
      and status in ('invited','pending_guardian','accepted')) then
    raise exception 'You already have an invitation or tuition connection with this student';
  end if;
  insert into public.vibetutor_student_invitations(tutor_id,student_id,status)
  values(auth.uid(),v_student,'invited');
  return 'sent';
end $$;
revoke all on function public.vibetutor_invite_student_by_code(text) from public,anon;
grant execute on function public.vibetutor_invite_student_by_code(text) to authenticated;

create table public.vibetutor_private_tasks (
  id uuid primary key default gen_random_uuid(),
  invitation_id uuid not null references public.vibetutor_student_invitations(id) on delete cascade,
  tutor_id uuid not null references public.profiles(id),
  student_id uuid not null references public.students(id),
  title text not null check (char_length(trim(title)) between 1 and 120),
  instructions text not null default '' check (char_length(instructions) <= 2000),
  status text not null default 'assigned' check (status in ('assigned','completed','reviewed')),
  learner_note text not null default '' check (char_length(learner_note) <= 2000),
  tutor_feedback text not null default '' check (char_length(tutor_feedback) <= 2000),
  created_at timestamptz not null default now(),
  completed_at timestamptz,
  reviewed_at timestamptz
);
create index vibetutor_private_tasks_scope_idx on public.vibetutor_private_tasks(invitation_id, created_at desc);
create index vibetutor_private_tasks_student_idx on public.vibetutor_private_tasks(student_id, status);
alter table public.vibetutor_private_tasks enable row level security;
revoke all on public.vibetutor_private_tasks from public, anon, authenticated;

create or replace function public.vibetutor_assign_private_task(p_invitation uuid,p_title text,p_instructions text default '')
returns uuid language plpgsql security definer set search_path = '' as $$
declare v_tutor uuid; v_student uuid; v_id uuid;
begin
  select a.tutor_id, a.student_record_id into v_tutor,v_student
  from public.vibetutor_private_access(p_invitation) a;
  if v_tutor is null or v_tutor <> auth.uid() then raise exception 'Accepted tutor connection required' using errcode='42501'; end if;
  if char_length(trim(coalesce(p_title,''))) not between 1 and 120
    or char_length(coalesce(p_instructions,'')) > 2000 then raise exception 'Invalid task'; end if;
  if (select count(*) from public.vibetutor_private_tasks
      where tutor_id = auth.uid() and created_at > now() - interval '1 hour') >= 40 then
    raise exception 'Task creation limit reached';
  end if;
  insert into public.vibetutor_private_tasks(invitation_id,tutor_id,student_id,title,instructions)
  values(p_invitation,v_tutor,v_student,trim(p_title),coalesce(p_instructions,''))
  returning id into v_id;
  return v_id;
end $$;

create or replace function public.vibetutor_my_private_tasks(p_invitation uuid default null)
returns jsonb language sql stable security definer set search_path = '' as $$
  select coalesce(jsonb_agg(jsonb_build_object(
    'id',t.id,'invitation_id',t.invitation_id,'title',t.title,
    'instructions',t.instructions,'status',t.status,'learner_note',t.learner_note,
    'tutor_feedback',t.tutor_feedback,'created_at',t.created_at,
    'completed_at',t.completed_at,'reviewed_at',t.reviewed_at,
    'is_tutor',t.tutor_id=auth.uid()) order by t.created_at desc), '[]'::jsonb)
  from public.vibetutor_private_tasks t
  where (p_invitation is null or t.invitation_id=p_invitation)
    and exists(select 1 from public.vibetutor_private_access(t.invitation_id))
$$;

create or replace function public.vibetutor_complete_private_task(p_task uuid,p_note text default '')
returns void language plpgsql security definer set search_path = '' as $$
begin
  if char_length(coalesce(p_note,'')) > 2000 then raise exception 'Note too long'; end if;
  update public.vibetutor_private_tasks t
    set learner_note=coalesce(p_note,''), status='completed',completed_at=now(),
        tutor_feedback='',reviewed_at=null
  where t.id=p_task and t.status in ('assigned','completed','reviewed')
    and exists(select 1 from public.vibetutor_private_access(t.invitation_id) a
      where a.student_record_id=t.student_id and a.student_profile_id=auth.uid());
  if not found then raise exception 'Private task unavailable' using errcode='42501'; end if;
end $$;

create or replace function public.vibetutor_review_private_task(p_task uuid,p_feedback text)
returns void language plpgsql security definer set search_path = '' as $$
begin
  if char_length(trim(coalesce(p_feedback,''))) not between 1 and 2000 then raise exception 'Feedback required'; end if;
  update public.vibetutor_private_tasks t
    set tutor_feedback=trim(p_feedback),status='reviewed',reviewed_at=now()
  where t.id=p_task and t.status in ('completed','reviewed')
    and t.tutor_id=auth.uid()
    and exists(select 1 from public.vibetutor_private_access(t.invitation_id) a
      where a.tutor_id=auth.uid());
  if not found then raise exception 'Private task unavailable' using errcode='42501'; end if;
end $$;

-- Group metadata is separate from school classes. Membership can only refer
-- to accepted private connections owned by the same tutor.
create table public.vibetutor_private_groups (
  id uuid primary key default gen_random_uuid(),
  tutor_id uuid not null references public.profiles(id) on delete cascade,
  title text not null check (char_length(trim(title)) between 1 and 100),
  created_at timestamptz not null default now(),
  unique (id,tutor_id)
);
create table public.vibetutor_private_group_members (
  group_id uuid not null references public.vibetutor_private_groups(id) on delete cascade,
  invitation_id uuid not null references public.vibetutor_student_invitations(id) on delete cascade,
  primary key(group_id,invitation_id)
);
alter table public.vibetutor_private_groups enable row level security;
alter table public.vibetutor_private_group_members enable row level security;
revoke all on public.vibetutor_private_groups,public.vibetutor_private_group_members from public,anon,authenticated;

create or replace function public.vibetutor_create_private_group(p_title text)
returns uuid language plpgsql security definer set search_path = '' as $$
declare v_id uuid;
begin
  perform public.vibetutor_ensure_private_tutor();
  if char_length(trim(coalesce(p_title,''))) not between 1 and 100 then raise exception 'Group name required';end if;
  insert into public.vibetutor_private_groups(tutor_id,title)
    values(auth.uid(),trim(p_title)) returning id into v_id;
  return v_id;
end $$;
create or replace function public.vibetutor_add_private_group_member(p_group uuid,p_invitation uuid)
returns void language plpgsql security definer set search_path = '' as $$
begin
  if not exists(select 1 from public.vibetutor_private_groups g where g.id=p_group and g.tutor_id=auth.uid())
    or not exists(select 1 from public.vibetutor_private_access(p_invitation) a where a.tutor_id=auth.uid())
  then raise exception 'Group and accepted tutoring connection required' using errcode='42501';end if;
  insert into public.vibetutor_private_group_members(group_id,invitation_id)
  values(p_group,p_invitation) on conflict do nothing;
end $$;
create or replace function public.vibetutor_my_private_groups()
returns jsonb language sql stable security definer set search_path = '' as $$
  select coalesce(jsonb_agg(jsonb_build_object('id',g.id,'title',g.title,
    'members',(select coalesce(jsonb_agg(jsonb_build_object('invitation_id',m.invitation_id,
      'student',s.name) order by s.name),'[]'::jsonb)
      from public.vibetutor_private_group_members m
      join public.vibetutor_student_invitations i on i.id=m.invitation_id and i.status='accepted'
      join public.students s on s.id=i.student_id and s.deleted_at is null
      where m.group_id=g.id and i.tutor_id=g.tutor_id)) order by g.created_at desc),'[]'::jsonb)
  from public.vibetutor_private_groups g where g.tutor_id=auth.uid()
$$;
revoke all on function public.vibetutor_assign_private_task(uuid,text,text),
 public.vibetutor_my_private_tasks(uuid),public.vibetutor_complete_private_task(uuid,text),
 public.vibetutor_review_private_task(uuid,text),public.vibetutor_create_private_group(text),
 public.vibetutor_add_private_group_member(uuid,uuid),public.vibetutor_my_private_groups()
 from public,anon;
grant execute on function public.vibetutor_assign_private_task(uuid,text,text),
 public.vibetutor_my_private_tasks(uuid),public.vibetutor_complete_private_task(uuid,text),
 public.vibetutor_review_private_task(uuid,text),public.vibetutor_create_private_group(text),
 public.vibetutor_add_private_group_member(uuid,uuid),public.vibetutor_my_private_groups()
 to authenticated;
commit;