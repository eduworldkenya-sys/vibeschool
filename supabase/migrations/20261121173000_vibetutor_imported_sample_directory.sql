-- Non-contactable VibeTutor sample preview of the founder's 2026-11-20 batch.
-- access: public-sanitized-sample public.vibetutor_sample_requests
-- authorization-test: public.vibetutor_sample_requests: anon/authenticated read only sanitized sample data;
-- no raw learner names, phones, notes or requester IDs; no insert/update/delete
-- privileges; sample UUIDs never pass the real request source check in contact RPC.
-- Imported requests remain private on their owner-only base table.
begin;
create table if not exists public.vibetutor_sample_requests (
  id uuid primary key,
  learner_label text not null,
  note text,
  levels text[] not null,
  subjects text[] not null,
  teaching_mode text not null,
  area text,
  budget_kes integer,
  available_days text[] not null,
  dayparts text[] not null,
  created_at timestamptz not null
);
alter table public.vibetutor_sample_requests enable row level security;
revoke all on public.vibetutor_sample_requests from public, anon, authenticated;
grant select on public.vibetutor_sample_requests to anon, authenticated;
drop policy if exists vibetutor_sample_requests_read on public.vibetutor_sample_requests;
create policy vibetutor_sample_requests_read
  on public.vibetutor_sample_requests for select to anon, authenticated using (true);
insert into public.vibetutor_sample_requests
  (id, learner_label, note, levels, subjects, teaching_mode, area,
   budget_kes, available_days, dayparts, created_at)
select r.id,
  ('Sample #' || row_number() over (order by r.id))::text,
  null::text,
  r.levels, r.subjects, r.teaching_mode, r.area,
  r.budget_kes, r.available_days, r.dayparts,
  date_trunc('day', r.created_at)
from public.vibetutor_requests r
where r.status = 'open'
  and r.source in ('hq_import_20261120_f','hq_import_20261120_m')
  and cardinality(r.levels)=1
  and r.levels[1] = any(array['Grade 4','Grade 5','Grade 6','Grade 7','Grade 8','Grade 9','Grade 10','Form 3']::text[])
  and r.area = any(array['Nairobi','Nakuru','Thika','Kiambu','Mombasa','Kisii','Kisumu','Eldoret']::text[])
  and r.teaching_mode in ('online','physical')
  and r.budget_kes between 200 and 700
  and r.available_days <@ array['Mon','Tue','Wed','Thu','Fri','Sat','Sun']::text[]
  and r.dayparts <@ array['morning','afternoon','evening','night']::text[]
  and cardinality(r.subjects) between 1 and 6
on conflict (id) do nothing;
comment on table public.vibetutor_sample_requests is 'Public preview-only fictional tutor-need examples from founder batch; no real student or contact is connected.';
commit;
