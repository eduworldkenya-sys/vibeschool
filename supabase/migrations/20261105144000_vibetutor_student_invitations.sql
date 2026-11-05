-- Private tuition invitations. No school records are shared by this feature.
-- authorization-test: only listing owner creates/revokes invitations; student claims own identity with unguessable token;
-- authorization-test: only linked guardian can approve minors; no direct client table permissions.
begin;
create table public.vibetutor_student_invitations (
 id uuid primary key default gen_random_uuid(),
 token uuid not null unique default gen_random_uuid(),
 tutor_id uuid not null references public.vibetutor_tutors(profile_id) on delete cascade,
 student_id uuid references public.students(id) on delete cascade,
 status text not null default 'open' check (status in ('open','invited','pending_guardian','accepted','declined','revoked')),
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now(),
 constraint tuition_invitation_claim check ((status='open' and student_id is null) or status='revoked' or student_id is not null)
);
create index on public.vibetutor_student_invitations(tutor_id,status);
create index on public.vibetutor_student_invitations(student_id,status);
alter table public.vibetutor_student_invitations enable row level security;
revoke all on public.vibetutor_student_invitations from anon, authenticated;
create or replace function public.vibetutor_create_student_invite() returns uuid
language plpgsql security definer set search_path = '' as $$
declare v_token uuid;
begin
 if auth.uid() is null or not exists(select 1 from public.vibetutor_tutors where profile_id=auth.uid()) then
   raise exception 'Tutor listing required';
 end if;
 if (select count(*) from public.vibetutor_student_invitations where tutor_id=auth.uid() and status in ('open','invited')) >= 5 then
   raise exception 'Maximum of 5 outstanding invitations. Revoke an unused invitation first';
 end if;
 insert into public.vibetutor_student_invitations(tutor_id) values(auth.uid()) returning token into v_token;
 return v_token;
end $$;
create or replace function public.vibetutor_claim_student_invite(p_token uuid) returns text
language plpgsql security definer set search_path = '' as $$
declare v_id uuid; v_student uuid; v_dob date; v_status text;
begin
 if auth.uid() is null then raise exception 'Sign in required'; end if;
 select id,date_of_birth into v_student,v_dob from public.students where profile_id=auth.uid() and deleted_at is null limit 1;
 if v_student is null then raise exception 'An active learner account is required'; end if;
 select id,status into v_id,v_status from public.vibetutor_student_invitations where token=p_token for update;
 if v_id is null then raise exception 'Invitation not found'; end if;
 if v_status <> 'open' then raise exception 'Invitation is no longer open'; end if;
 if v_dob is not null and v_dob <= (current_date - interval '18 years')::date then
   update public.vibetutor_student_invitations set student_id=v_student,status='accepted',updated_at=now() where id=v_id;
   return 'accepted';
 end if;
 update public.vibetutor_student_invitations set student_id=v_student,status='pending_guardian',updated_at=now() where id=v_id;
 return 'pending_guardian';
end $$;
create or replace function public.vibetutor_parent_student_invites() returns jsonb
language sql stable security definer set search_path = '' as $$
 select coalesce(jsonb_agg(jsonb_build_object('id',i.id,'student',s.name,'tutor',p.full_name,'status',i.status)), '[]'::jsonb)
 from public.vibetutor_student_invitations i
 join public.students s on s.id=i.student_id and s.deleted_at is null
 join public.parent_student_links l on l.student_id=s.id and l.parent_id=auth.uid()
 join public.profiles p on p.id=i.tutor_id
 where i.status='pending_guardian'
$$;
create or replace function public.vibetutor_decide_student_invite(p_id uuid,p_approve boolean) returns void
language plpgsql security definer set search_path = '' as $$
begin
 if auth.uid() is null then raise exception 'Sign in required'; end if;
 update public.vibetutor_student_invitations i set status=case when p_approve then 'accepted' else 'declined' end,updated_at=now()
 where i.id=p_id and i.status='pending_guardian'
 and exists(select 1 from public.parent_student_links l where l.student_id=i.student_id and l.parent_id=auth.uid());
 if not found then raise exception 'Invitation not available to your guardian account'; end if;
end $$;
create or replace function public.vibetutor_my_student_invites() returns jsonb
language sql stable security definer set search_path = '' as $$
 select coalesce(jsonb_agg(jsonb_build_object('id',i.id,'token',case when i.status='open' then i.token else null end,
 'student',case when i.status in ('open','invited') then null else s.name end,'status',i.status,'created_at',i.created_at) order by i.created_at desc),'[]'::jsonb)
 from public.vibetutor_student_invitations i
 left join public.students s on s.id=i.student_id and s.deleted_at is null
 where i.tutor_id=auth.uid()
$$;
create or replace function public.vibetutor_revoke_student_invite(p_id uuid) returns void
language plpgsql security definer set search_path = '' as $$
begin
 update public.vibetutor_student_invitations set status='revoked',updated_at=now()
 where id=p_id and tutor_id=auth.uid() and status in ('open','invited','pending_guardian','accepted');
 if not found then raise exception 'Invitation cannot be revoked'; end if;
end $$;
revoke all on function public.vibetutor_create_student_invite() from public;
revoke all on function public.vibetutor_claim_student_invite(uuid) from public;
revoke all on function public.vibetutor_parent_student_invites() from public;
revoke all on function public.vibetutor_decide_student_invite(uuid,boolean) from public;
revoke all on function public.vibetutor_my_student_invites() from public;
revoke all on function public.vibetutor_revoke_student_invite(uuid) from public;
grant execute on function public.vibetutor_create_student_invite() to authenticated;
grant execute on function public.vibetutor_claim_student_invite(uuid) to authenticated;
grant execute on function public.vibetutor_parent_student_invites() to authenticated;
grant execute on function public.vibetutor_decide_student_invite(uuid,boolean) to authenticated;
grant execute on function public.vibetutor_my_student_invites() to authenticated;
grant execute on function public.vibetutor_revoke_student_invite(uuid) to authenticated;
-- A private share code belongs to one claimed learner account. It is not an admission number
-- and does not authorize access to school records.
create table public.vibetutor_student_invite_codes (
 student_id uuid primary key references public.students(id) on delete cascade,
 code text not null unique default upper(substr(replace(gen_random_uuid()::text,'-',''),1,16)),
 created_at timestamptz not null default now(),
 constraint invite_code_format check (code ~ '^[0-9A-F]{16})
);
alter table public.vibetutor_student_invite_codes enable row level security;
revoke all on public.vibetutor_student_invite_codes from anon,authenticated;

create or replace function public.vibetutor_my_student_code() returns text
language plpgsql security definer set search_path = '' as $
declare v_student uuid; v_code text;
begin
 if auth.uid() is null then raise exception 'Sign in required'; end if;
 select id into v_student from public.students
 where profile_id=auth.uid() and deleted_at is null limit 1;
 if v_student is null then raise exception 'A claimed learner account is required'; end if;
 insert into public.vibetutor_student_invite_codes(student_id) values(v_student)
 on conflict(student_id) do nothing;
 select code into v_code from public.vibetutor_student_invite_codes where student_id=v_student;
 return v_code;
end $;

create or replace function public.vibetutor_invite_student_by_code(p_code text) returns text
language plpgsql security definer set search_path = '' as $
declare v_student uuid;
begin
 if auth.uid() is null or not exists(select 1 from public.vibetutor_tutors where profile_id=auth.uid()) then
   raise exception 'Tutor listing required';
 end if;
 if p_code is null or upper(trim(p_code)) !~ '^[0-9A-F]{16} then raise exception 'Invalid student code'; end if;
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
end $;

create or replace function public.vibetutor_student_inbox() returns jsonb
language sql stable security definer set search_path = '' as $
 select coalesce(jsonb_agg(jsonb_build_object(
   'id',i.id,'tutor',t.display_name,'status',i.status,'created_at',i.created_at
 ) order by i.created_at desc),'[]'::jsonb)
 from public.vibetutor_student_invitations i
 join public.students s on s.id=i.student_id and s.deleted_at is null and s.profile_id=auth.uid()
 join public.vibetutor_tutors t on t.profile_id=i.tutor_id
 where i.status in ('invited','pending_guardian','accepted')
$;

create or replace function public.vibetutor_respond_student_invite(p_id uuid,p_accept boolean) returns text
language plpgsql security definer set search_path = '' as $
declare v_student uuid; v_dob date; v_status text;
begin
 if auth.uid() is null then raise exception 'Sign in required'; end if;
 select id,date_of_birth into v_student,v_dob from public.students
 where profile_id=auth.uid() and deleted_at is null limit 1;
 if v_student is null then raise exception 'Student account required'; end if;
 perform 1 from public.vibetutor_student_invitations
 where id=p_id and student_id=v_student and status='invited' for update;
 if not found then raise exception 'Invitation unavailable'; end if;
 v_status := case
   when not p_accept then 'declined'
   when v_dob is not null and v_dob <= (current_date-interval '18 years')::date then 'accepted'
   else 'pending_guardian' end;
 update public.vibetutor_student_invitations set status=v_status,updated_at=now() where id=p_id;
 return v_status;
end $;

revoke all on function public.vibetutor_my_student_code() from public,anon;
revoke all on function public.vibetutor_invite_student_by_code(text) from public,anon;
revoke all on function public.vibetutor_student_inbox() from public,anon;
revoke all on function public.vibetutor_respond_student_invite(uuid,boolean) from public,anon;
grant execute on function public.vibetutor_my_student_code() to authenticated;
grant execute on function public.vibetutor_invite_student_by_code(text) to authenticated;
grant execute on function public.vibetutor_student_inbox() to authenticated;
grant execute on function public.vibetutor_respond_student_invite(uuid,boolean) to authenticated;

commit;
