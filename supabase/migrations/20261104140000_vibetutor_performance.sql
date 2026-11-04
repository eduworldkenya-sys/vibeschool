-- VibeTutor performance: index the learner foreign key and evaluate auth.uid()
-- once per statement instead of once per row. Behaviour is unchanged.

begin;

-- authorization-test: public.vibetutor_tutors owner-only read/write unchanged; policy rewritten to evaluate auth.uid() once per statement
-- authorization-test: public.vibetutor_requests owner-only read/write unchanged; policy rewritten to evaluate auth.uid() once per statement; requester_id now indexed

create index if not exists vibetutor_requests_requester_id_idx
  on public.vibetutor_requests (requester_id);

drop policy if exists vibetutor_tutors_owner_all on public.vibetutor_tutors;
create policy vibetutor_tutors_owner_all on public.vibetutor_tutors
  for all to authenticated
  using (profile_id = (select auth.uid()))
  with check (profile_id = (select auth.uid()));

drop policy if exists vibetutor_requests_owner_all on public.vibetutor_requests;
create policy vibetutor_requests_owner_all on public.vibetutor_requests
  for all to authenticated
  using (requester_id = (select auth.uid()))
  with check (requester_id = (select auth.uid()));

commit;
