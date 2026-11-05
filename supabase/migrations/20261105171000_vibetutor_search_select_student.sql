-- Search-and-select for private tutoring. Search is limited to signed-in tutors with a listing.
-- Only claimed student names are exposed; no contact, school, admission or academic details.
begin;
-- access: service-only public.vibetutor_student_search_log
-- authorization-test: public.vibetutor_student_search_log cannot be directly read or written by anon/authenticated; authenticated tutors may invoke rate-limited name search only.
create table public.vibetutor_student_search_log (
 id bigint generated always as identity primary key,
 tutor_id uuid not null references public.profiles(id) on delete cascade,
 searched_at timestamptz not null default now()
);
create index on public.vibetutor_student_search_log(tutor_id,searched_at);
alter table public.vibetutor_student_search_log enable row level security;
revoke all on table public.vibetutor_student_search_log from anon,authenticated;

create or replace function public.vibetutor_search_students(p_query text)
returns table(id uuid,name text)
language plpgsql security definer set search_path = '' as $$
declare v_query text;
begin
 if auth.uid() is null or not exists (
   select 1 from public.vibetutor_tutors where profile_id=auth.uid() and status='published'
 ) then raise exception 'A published tutor listing is required'; end if;
 v_query := trim(coalesce(p_query,''));
 if length(v_query)<3 or length(v_query)>80 then
   raise exception 'Search using at least 3 letters'; end if;
 if position('%' in v_query)>0 or position('_' in v_query)>0 or position(chr(92) in v_query)>0 then
   raise exception 'Search using a student name'; end if;
 if (select count(*) from public.vibetutor_student_search_log
     where tutor_id=auth.uid() and searched_at>now()-interval '1 hour')>=20 then
   raise exception 'Search limit reached; try again later'; end if;
 insert into public.vibetutor_student_search_log(tutor_id) values(auth.uid());
 return query
 select s.id,s.name
 from public.students s
 where s.deleted_at is null and s.profile_id is not null
   and s.name ilike '%'||v_query||'%'
 order by s.name,s.id limit 8;
end $$;

create or replace function public.vibetutor_invite_student(p_student_id uuid) returns text
language plpgsql security definer set search_path = '' as $$
begin
 if auth.uid() is null or not exists (
   select 1 from public.vibetutor_tutors where profile_id=auth.uid() and status='published'
 ) then raise exception 'A published tutor listing is required'; end if;
 if p_student_id is null or not exists (
   select 1 from public.students
   where id=p_student_id and deleted_at is null and profile_id is not null
 ) then raise exception 'Student not available'; end if;
 if (select count(*) from public.vibetutor_student_invitations
     where tutor_id=auth.uid() and created_at>now()-interval '1 hour')>=10 then
   raise exception 'Invitation limit reached; try again later'; end if;
 if (select count(*) from public.vibetutor_student_invitations
     where tutor_id=auth.uid() and status in ('open','invited'))>=5 then
   raise exception 'Too many pending invitations'; end if;
 -- A per-(tutor,student) lock avoids duplicate sends from rapid repeated clicks.
 perform pg_advisory_xact_lock(hashtextextended(auth.uid()::text||':'||p_student_id::text,0));
 if exists(select 1 from public.vibetutor_student_invitations
   where tutor_id=auth.uid() and student_id=p_student_id
   and status in ('invited','pending_guardian','accepted')) then
   raise exception 'Student already invited or connected'; end if;
 insert into public.vibetutor_student_invitations(tutor_id,student_id,status)
 values(auth.uid(),p_student_id,'invited');
 return 'sent';
end $$;

-- Show only the selected student's name to the inviting tutor.
create or replace function public.vibetutor_my_student_invites() returns jsonb
language sql stable security definer set search_path = '' as $$
 select coalesce(jsonb_agg(jsonb_build_object(
   'id',i.id,'token',case when i.status='open' then i.token else null end,
   'student',s.name,'status',i.status,'created_at',i.created_at
 ) order by i.created_at desc),'[]'::jsonb)
 from public.vibetutor_student_invitations i
 left join public.students s on s.id=i.student_id and s.deleted_at is null
 where i.tutor_id=auth.uid()
$$;

revoke all on function public.vibetutor_search_students(text) from public,anon;
revoke all on function public.vibetutor_invite_student(uuid) from public,anon;
grant execute on function public.vibetutor_search_students(text) to authenticated;
grant execute on function public.vibetutor_invite_student(uuid) to authenticated;
commit;
