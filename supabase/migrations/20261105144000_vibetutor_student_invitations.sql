-- Private tuition invitations. No school records are shared by this feature.
-- authorization-test: only listing owner creates/revokes invitations; student claims own identity with unguessable token;
-- authorization-test: only linked guardian can approve minors; no direct client table permissions.
begin;
create table public.vibetutor_student_invitations (
 id uuid primary key default gen_random_uuid(),
 token uuid not null unique default gen_random_uuid(),
 tutor_id uuid not null references public.vibetutor_tutors(profile_id) on delete cascade,
 student_id uuid references public.students(id) on delete set null,
 status text not null default 'open' check (status in ('open','pending_guardian','accepted','declined','revoked')),
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
 'student',case when i.status='open' then null else s.name end,'status',i.status,'created_at',i.created_at) order by i.created_at desc),'[]'::jsonb)
 from public.vibetutor_student_invitations i
 left join public.students s on s.id=i.student_id and s.deleted_at is null
 where i.tutor_id=auth.uid()
$$;
create or replace function public.vibetutor_revoke_student_invite(p_id uuid) returns void
language plpgsql security definer set search_path = '' as $$
begin
 update public.vibetutor_student_invitations set status='revoked',updated_at=now()
 where id=p_id and tutor_id=auth.uid() and status in ('open','pending_guardian','accepted');
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
commit;
