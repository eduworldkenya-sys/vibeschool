-- Private one-to-one tuition: accepted invite is the sole access grant.
begin;
create table public.vibetutor_lessons (
 id uuid primary key default gen_random_uuid(),
 invitation_id uuid not null references public.vibetutor_student_invitations(id) on delete cascade,
 tutor_id uuid not null,
 student_id uuid not null,
 title text not null check (char_length(title) between 1 and 120),
 starts_at timestamptz not null,
 ends_at timestamptz not null,
 status text not null default 'scheduled' check(status in ('scheduled','cancelled','completed')),
 created_at timestamptz not null default now(),
 check(ends_at>starts_at and ends_at<=starts_at+interval '3 hours')
);
create index on public.vibetutor_lessons(invitation_id,starts_at);
alter table public.vibetutor_lessons enable row level security;
revoke all on public.vibetutor_lessons from anon,authenticated;
create table public.vibetutor_lesson_messages(
 id uuid primary key default gen_random_uuid(),
 invitation_id uuid not null references public.vibetutor_student_invitations(id) on delete cascade,
 sender_id uuid not null,
 body text not null check(char_length(trim(body)) between 1 and 1500),
 created_at timestamptz not null default now()
);
create index on public.vibetutor_lesson_messages(invitation_id,created_at);
alter table public.vibetutor_lesson_messages enable row level security;
revoke all on public.vibetutor_lesson_messages from anon,authenticated;
create or replace function public.vibetutor_private_access(p_invitation uuid)
returns table(tutor_id uuid, student_profile_id uuid, student_record_id uuid)
language sql stable security definer set search_path='' as $$
 select i.tutor_id,s.profile_id,i.student_id from public.vibetutor_student_invitations i
 join public.students s on s.id=i.student_id and s.deleted_at is null
 where i.id=p_invitation and i.status='accepted' and
 (i.tutor_id=auth.uid() or s.profile_id=auth.uid())
$$;
revoke all on function public.vibetutor_private_access(uuid) from public,anon,authenticated;
create or replace function public.vibetutor_schedule_lesson(p_invitation uuid,p_title text,p_start timestamptz,p_end timestamptz)
returns uuid language plpgsql security definer set search_path='' as $$
declare v_tutor uuid;v_student uuid;v_id uuid;
begin
 select a.tutor_id,a.student_record_id into v_tutor,v_student from public.vibetutor_private_access(p_invitation) a;
 if v_tutor is null or v_tutor<>auth.uid() then raise exception 'Active tutor connection required';end if;
 if length(trim(coalesce(p_title,''))) not between 1 and 120 or p_start<=now() or p_end<=p_start or p_end>p_start+interval '3 hours' then raise exception 'Invalid lesson date, time or title';end if;
 if exists(select 1 from public.vibetutor_lessons where tutor_id=v_tutor and status='scheduled' and starts_at<p_end and ends_at>p_start) then raise exception 'Tutor has an overlapping lesson';end if;
 insert into public.vibetutor_lessons(invitation_id,tutor_id,student_id,title,starts_at,ends_at)
 values(p_invitation,v_tutor,v_student,trim(p_title),p_start,p_end) returning id into v_id;
 return v_id;
end $$;
create or replace function public.vibetutor_cancel_lesson(p_lesson uuid)
returns void language plpgsql security definer set search_path='' as $$
begin
 update public.vibetutor_lessons l set status='cancelled'
 where l.id=p_lesson and l.status='scheduled'
 and exists(select 1 from public.vibetutor_private_access(l.invitation_id) a where a.tutor_id=auth.uid());
 if not found then raise exception 'Active tutor connection required';end if;
end $$;
create or replace function public.vibetutor_my_lessons()
returns jsonb language sql stable security definer set search_path='' as $$
 select coalesce(jsonb_agg(jsonb_build_object('id',l.id,'invitation_id',l.invitation_id,'title',l.title,'starts_at',l.starts_at,'ends_at',l.ends_at,'status',l.status) order by l.starts_at), '[]'::jsonb)
 from public.vibetutor_lessons l where exists(select 1 from public.vibetutor_private_access(l.invitation_id))
$$;
create or replace function public.vibetutor_send_lesson_message(p_invitation uuid,p_body text)
returns uuid language plpgsql security definer set search_path='' as $$
declare v_id uuid;
begin
 if not exists(select 1 from public.vibetutor_private_access(p_invitation)) then raise exception 'Accepted tuition connection required';end if;
 if length(trim(coalesce(p_body,''))) not between 1 and 1500 then raise exception 'Message must be 1 to 1500 characters';end if;
 if (select count(*) from public.vibetutor_lesson_messages where sender_id=auth.uid() and created_at>now()-interval '1 minute')>=10 then raise exception 'Message limit reached';end if;
 insert into public.vibetutor_lesson_messages(invitation_id,sender_id,body)
 values(p_invitation,auth.uid(),trim(p_body)) returning id into v_id;
 return v_id;
end $$;
create or replace function public.vibetutor_my_lesson_messages(p_invitation uuid)
returns jsonb language plpgsql stable security definer set search_path='' as $$
declare v_messages jsonb;
begin
 if not exists(select 1 from public.vibetutor_private_access(p_invitation)) then raise exception 'Accepted tuition connection required';end if;
 select coalesce(jsonb_agg(jsonb_build_object('id',m.id,'body',m.body,'mine',m.sender_id=auth.uid(),'created_at',m.created_at) order by m.created_at),'[]'::jsonb)
 into v_messages from (select * from public.vibetutor_lesson_messages where invitation_id=p_invitation order by created_at desc limit 100) m;
 return v_messages;
end $$;
revoke all on function public.vibetutor_schedule_lesson(uuid,text,timestamptz,timestamptz) from public,anon;
revoke all on function public.vibetutor_cancel_lesson(uuid) from public,anon;
revoke all on function public.vibetutor_my_lessons() from public,anon;
revoke all on function public.vibetutor_send_lesson_message(uuid,text) from public,anon;
revoke all on function public.vibetutor_my_lesson_messages(uuid) from public,anon;
grant execute on function public.vibetutor_schedule_lesson(uuid,text,timestamptz,timestamptz),public.vibetutor_cancel_lesson(uuid),public.vibetutor_my_lessons(),public.vibetutor_send_lesson_message(uuid,text),public.vibetutor_my_lesson_messages(uuid) to authenticated;
commit;