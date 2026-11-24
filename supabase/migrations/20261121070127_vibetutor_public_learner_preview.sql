-- Public discovery uses only explicitly opted-in parent requests; no private child data.
begin;
alter table public.vibetutor_requests add column if not exists public_preview boolean not null default false;
create or replace view public.vibetutor_open_requests with (security_invoker=false, security_barrier=true) as
select r.id, ('Learner-' || left(r.id::text, 6))::text as learner_label, null::text as note,
 r.levels, r.subjects, r.teaching_mode, r.area, r.budget_kes, r.available_days, r.dayparts,
 date_trunc('day', r.created_at) as created_at
from public.vibetutor_requests r join public.profiles p on p.id=r.requester_id
where r.status='open' and r.public_preview and p.role::text='parent'
 and r.area = any(array['Nairobi','Mombasa','Nakuru','Eldoret','Kisumu','Thika','Ruiru','Kitengela','Ongata Rongai','Kiambu','Machakos','Meru','Nyeri','Kakamega','Kisii','Naivasha','Bungoma','Kericho','Embu','Online (anywhere)']::text[])
 and r.levels <@ array['Grade 1–3','Grade 4–6','Grade 7–9','Grade 10–12','Form 1–4','University']::text[] and cardinality(r.levels)>0 and cardinality(r.levels)<=1
 and r.subjects <@ array['English','Kiswahili','Mathematical Activities','Environmental Activities','Creative Activities','Christian Religious Education','Islamic Religious Education','Hindu Religious Education','Indigenous Languages','Mathematics','Science & Technology','Social Studies','Agriculture','Creative Arts','Religious Education','Integrated Science','Pre-Technical Studies','Biology','Chemistry','Physics','Geography','History','Business Studies','Computer Studies','Statistics','Computer Science','Economics','Accounting','Engineering']::text[] and cardinality(r.subjects)>0 and cardinality(r.subjects)<=6
 and r.available_days <@ array['Mon','Tue','Wed','Thu','Fri','Sat','Sun']::text[]
 and r.dayparts <@ array['morning','afternoon','evening','night']::text[]
 and (r.budget_kes is null or r.budget_kes between 1 and 100000);
revoke all on public.vibetutor_open_requests from public, anon, authenticated;
grant select on public.vibetutor_open_requests to anon, authenticated;
-- Existing owner-only base-table RLS remains unchanged.
commit;


-- access: owner-only public.vibetutor_request_interests
-- authorization-test: public.vibetutor_request_interests only participants read; verified published teachers create rate-limited enquiries; only the owning parent may accept or decline; revoked and closed requests remove enquiries; anon denied
-- Interest workflow: a verified published teacher may contact the parent/guardian
-- through a private, limited inquiry; no guardian contact fields enter public browsing.
begin;
create table if not exists public.vibetutor_request_interests (
  id uuid primary key default gen_random_uuid(),
  request_id uuid not null references public.vibetutor_requests(id) on delete cascade,
  tutor_id uuid not null references public.profiles(id) on delete cascade,
  message text not null check (char_length(trim(message)) between 10 and 500),
  guardian_reply text check (guardian_reply is null or char_length(trim(guardian_reply)) between 10 and 500),
  status text not null default 'pending' check (status in ('pending','accepted','declined')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint vibetutor_interest_one_per_teacher unique(request_id,tutor_id)
);
create index if not exists vibetutor_interests_tutor_idx on public.vibetutor_request_interests(tutor_id,created_at desc);
create index if not exists vibetutor_interests_request_idx on public.vibetutor_request_interests(request_id,created_at desc);
alter table public.vibetutor_request_interests enable row level security;
revoke all on public.vibetutor_request_interests from public,anon,authenticated;
grant select on public.vibetutor_request_interests to authenticated;
drop policy if exists vibetutor_interests_participant_read on public.vibetutor_request_interests;
create policy vibetutor_interests_participant_read
 on public.vibetutor_request_interests for select to authenticated
 using (tutor_id=(select auth.uid()) or exists (
   select 1 from public.vibetutor_requests r where r.id=request_id and r.requester_id=(select auth.uid())
 ));
create or replace function public.vibetutor_request_interest_send(p_request uuid,p_message text)
returns uuid language plpgsql security definer set search_path='' as $$
declare v_user uuid := auth.uid(); v_id uuid;
begin
 if v_user is null then raise exception 'Sign in required' using errcode='42501'; end if;
 if p_message is null or char_length(trim(p_message)) not between 10 and 500 then raise exception 'Invalid enquiry' using errcode='22023'; end if;
 if not exists (select 1 from public.vibetutor_tutors t join public.profiles p on p.id=t.profile_id
   where t.profile_id=v_user and t.status='published' and p.role::text='teacher')
 then raise exception 'Published teacher profile required' using errcode='42501'; end if;
 if not exists (select 1 from public.vibetutor_requests r join public.profiles p on p.id=r.requester_id
    where r.id=p_request and r.status='open' and r.public_preview and p.role::text='parent')
 then raise exception 'This request is not available' using errcode='42501'; end if;
 if (select count(*) from public.vibetutor_request_interests i where i.tutor_id=v_user
    and i.created_at>now()-interval '24 hours')>=10
 then raise exception 'Daily enquiry limit reached' using errcode='42901'; end if;
 insert into public.vibetutor_request_interests(request_id,tutor_id,message)
 values (p_request,v_user,trim(p_message)) on conflict (request_id,tutor_id) do nothing returning id into v_id;
 if v_id is null then raise exception 'Enquiry already sent' using errcode='23505'; end if;
 return v_id;
end $$;
revoke all on function public.vibetutor_request_interest_send(uuid,text) from public,anon,authenticated;
grant execute on function public.vibetutor_request_interest_send(uuid,text) to authenticated;
create or replace function public.vibetutor_request_interest_reply(p_interest uuid,p_status text,p_reply text)
returns void language plpgsql security definer set search_path='' as $$
declare v_user uuid:=auth.uid();
begin
 if v_user is null then raise exception 'Sign in required' using errcode='42501'; end if;
 if p_status not in ('accepted','declined') then raise exception 'Invalid response' using errcode='22023'; end if;
 if p_status='accepted' and (p_reply is null or char_length(trim(p_reply)) not between 10 and 500)
 then raise exception 'Reply must be 10-500 characters' using errcode='22023'; end if;
 update public.vibetutor_request_interests i
 set status=p_status,guardian_reply=case when p_status='accepted' then trim(p_reply) else null end,updated_at=now()
 from public.vibetutor_requests r join public.profiles p on p.id=r.requester_id
 where i.id=p_interest and i.request_id=r.id and i.status='pending'
   and r.requester_id=v_user and r.public_preview and r.status='open' and p.role::text='parent';
 if not found then raise exception 'Not authorized or enquiry unavailable' using errcode='42501'; end if;
end $$;
revoke all on function public.vibetutor_request_interest_reply(uuid,text,text) from public,anon,authenticated;
grant execute on function public.vibetutor_request_interest_reply(uuid,text,text) to authenticated;
create or replace function public.vibetutor_revoke_interests_on_unpublish()
returns trigger language plpgsql security definer set search_path='' as $$
begin
 if (old.public_preview and not new.public_preview) or (old.status='open' and new.status<>'open') then
   delete from public.vibetutor_request_interests i where i.request_id=new.id;
 end if;
 return new;
end $$;
revoke all on function public.vibetutor_revoke_interests_on_unpublish() from public,anon,authenticated;
drop trigger if exists vibetutor_unpublish_revoke_interests on public.vibetutor_requests;
create trigger vibetutor_unpublish_revoke_interests
 after update of public_preview,status on public.vibetutor_requests
 for each row execute function public.vibetutor_revoke_interests_on_unpublish();
comment on table public.vibetutor_request_interests is 'Private parent/tutor inquiry records. Teachers never receive child identity or parent phone from public browsing.';
commit;
