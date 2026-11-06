-- Private swap conversations are available ONLY after owner acceptance.
-- authorization-test: public.teacher_swap_messages (anon denied; unrelated authenticated denied; pending interest denied; accepted sender and listing owner read and insert own messages; spoofed sender denied)
-- No telephone number is required for new interest requests.
alter table public.teacher_swap_interests alter column contact_phone drop not null;
alter table public.teacher_swap_interests drop constraint if exists teacher_swap_interests_contact_phone_check;
alter table public.teacher_swap_interests add constraint teacher_swap_interests_contact_phone_check
  check(contact_phone is null or contact_phone ~ '^[+]?[0-9]{10,15}$');

create table if not exists public.teacher_swap_messages (
 id uuid primary key default gen_random_uuid(),
 interest_id uuid not null references public.teacher_swap_interests(id) on delete cascade,
 sender_id uuid not null references auth.users(id) on delete cascade,
 body text not null check(length(trim(body)) between 1 and 1000),
 created_at timestamptz not null default now()
);
create index if not exists swap_messages_interest_created_idx on public.teacher_swap_messages(interest_id,created_at);
alter table public.teacher_swap_messages enable row level security;
revoke all on public.teacher_swap_messages from public,anon,authenticated;
grant select,insert on public.teacher_swap_messages to authenticated;

create policy "accepted swap participants read messages" on public.teacher_swap_messages
 for select to authenticated using (
 exists (
 select 1 from public.teacher_swap_interests i join public.teacher_swap_listings l on l.id=i.listing_id
 where i.id=interest_id and i.status='accepted'
 and (i.sender_id=(select auth.uid()) or l.teacher_id=(select auth.uid()))
 )
);
create policy "accepted swap participants write own messages" on public.teacher_swap_messages
 for insert to authenticated with check (
 sender_id=(select auth.uid())
 and exists (
 select 1 from public.teacher_swap_interests i join public.teacher_swap_listings l on l.id=i.listing_id
 where i.id=interest_id and i.status='accepted' and l.status='published'
 and (i.sender_id=(select auth.uid()) or l.teacher_id=(select auth.uid()))
 )
);

-- Rate-limit messages in the database, not just the client.
create or replace function public.enforce_swap_message_rate() returns trigger
 language plpgsql security invoker set search_path = public as $$
begin
 if (select count(*) from public.teacher_swap_messages m where m.sender_id=new.sender_id
     and m.created_at>now()-interval '1 minute') >= 6 then
   raise exception 'Please wait before sending another message.';
 end if;
 return new;
end $$;
revoke all on function public.enforce_swap_message_rate() from public,anon,authenticated;
create trigger swap_message_rate_before_insert before insert on public.teacher_swap_messages
 for each row execute function public.enforce_swap_message_rate();
comment on table public.teacher_swap_messages is 'Accepted swap interest only; no public access or transfer approval implied.';
