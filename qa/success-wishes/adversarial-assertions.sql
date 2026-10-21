-- Disposable PostgreSQL 17 ONLY. Run AFTER the canonical fixture, the proposed
-- schema and docs/success-wishes/test-assertions.sql. No real child data.
--
-- Stronger adversarial checks: actual opt-out session revocation, epoch rotation,
-- duplicate admissions, lost enrollment and cross-school report confidentiality.

-- Fixture-only rights: production service-role application code never edits learner
-- enrollment here. These synthetic mutations simulate registry changes in CI.
grant insert,update,delete on public.students, public.student_classes to service_role;

-- Authorization tests for every private service-only table listed in the
-- canonical migration. Verify no grants to anonymous/authenticated clients,
-- including inherited rights, and service-role CRUD access only behind APIs.
do $sw_service_contract$
declare relation text;
begin
  foreach relation in array array[
    'public.success_wishes_schools','public.success_wishes_inboxes',
    'public.success_wishes_sessions','public.success_wishes_messages',
    'public.success_wishes_reports','public.success_wishes_audit',
    'public.success_wishes_attempts'
  ] loop
    if not exists (
      select 1 from pg_class c where c.oid=relation::regclass and c.relrowsecurity
    ) then raise exception 'Private table % lacks RLS', relation; end if;
    if has_table_privilege('anon',relation,'SELECT')
      or has_table_privilege('anon',relation,'INSERT')
      or has_table_privilege('anon',relation,'UPDATE')
      or has_table_privilege('anon',relation,'DELETE')
      or has_table_privilege('authenticated',relation,'SELECT')
      or has_table_privilege('authenticated',relation,'INSERT')
      or has_table_privilege('authenticated',relation,'UPDATE')
      or has_table_privilege('authenticated',relation,'DELETE')
      then raise exception 'Direct public API privileges leaked for %', relation; end if;
    if not has_table_privilege('service_role',relation,'SELECT')
      or not has_table_privilege('service_role',relation,'INSERT')
      or not has_table_privilege('service_role',relation,'UPDATE')
      or not has_table_privilege('service_role',relation,'DELETE')
      then raise exception 'Trusted service CRUD grants missing on %', relation; end if;
  end loop;
end $sw_service_contract$;

set role service_role;
insert into public.success_wishes_sessions(token_hash,inbox_id,access_epoch,expires_at)
select repeat('c',64), id, access_epoch, now()+interval '1 hour'
from public.success_wishes_inboxes
where school_id='22222222-2222-4222-8222-222222222222';
do $sw_adversarial$
begin
  if not exists(select 1 from public.success_wishes_sessions where token_hash=repeat('c',64))
    then raise exception 'Session test was not initialized'; end if;
end $sw_adversarial$;
reset role;

set role authenticated;
do $sw_adversarial$
begin
  perform set_config('request.jwt.claim.sub','44444444-4444-4444-8444-444444444444',true);
  if public.success_wishes_set_school_participation(
    '22222222-2222-4222-8222-222222222222',false,false
  ) is not true then raise exception 'School opt-out failed'; end if;
end $sw_adversarial$;
reset role;

set role service_role;
do $sw_adversarial$
begin
  if exists(select 1 from public.success_wishes_sessions where token_hash=repeat('c',64))
    then raise exception 'Opt-out left a previously issued guest session active'; end if;
  if public.success_wishes_match_recipient(
    '22222222-2222-4222-8222-222222222222','B-200','Brian Otieno'
  ) is not null then raise exception 'Opted-out school still permits candidate matching'; end if;
end $sw_adversarial$;
reset role;

set role authenticated;
do $sw_adversarial$
begin
  perform set_config('request.jwt.claim.sub','44444444-4444-4444-8444-444444444444',true);
  if public.success_wishes_set_school_participation(
    '22222222-2222-4222-8222-222222222222',true,true
  ) is not true then raise exception 'Opt-in after consent failed'; end if;
end $sw_adversarial$;
reset role;

set role service_role;
insert into public.success_wishes_sessions(token_hash,inbox_id,access_epoch,expires_at)
select repeat('d',64), id, access_epoch, now()+interval '1 hour'
from public.success_wishes_inboxes
where school_id='22222222-2222-4222-8222-222222222222';
select set_config('success_wishes.previous_epoch',
  (select access_epoch::text from public.success_wishes_inboxes
    where school_id='22222222-2222-4222-8222-222222222222'),false);
select set_config('success_wishes.previous_hash',
  (select access_code_hash from public.success_wishes_inboxes
    where school_id='22222222-2222-4222-8222-222222222222'),false);
reset role;

set role authenticated;
do $sw_adversarial$
declare result jsonb;
begin
  perform set_config('request.jwt.claim.sub','44444444-4444-4444-8444-444444444444',true);
  result := public.success_wishes_reset_access(
    '22222222-2222-4222-8222-222222222222',
    'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'
  );
  if (result->>'access_code') !~ '^[0-9A-F]{32}$'
    or (result->>'inbox_id') is null
    then raise exception 'Access rotation failed to issue a properly shaped one-time code'; end if;
end $sw_adversarial$;
reset role;

set role service_role;
do $sw_adversarial$
begin
  if exists(select 1 from public.success_wishes_sessions where token_hash=repeat('d',64))
    then raise exception 'Access-code reset did not revoke previous guest sessions'; end if;
  if (select access_epoch from public.success_wishes_inboxes
    where school_id='22222222-2222-4222-8222-222222222222')
      != current_setting('success_wishes.previous_epoch')::bigint + 1
    then raise exception 'Access-code reset did not advance access epoch'; end if;
  if (select access_code_hash from public.success_wishes_inboxes
    where school_id='22222222-2222-4222-8222-222222222222')
      = current_setting('success_wishes.previous_hash')
    then raise exception 'Access-code rotation reused old access hash'; end if;
end $sw_adversarial$;

-- Current enrollment must be re-validated after issuing an inbox.
update public.student_classes set is_current=false
where school_id='22222222-2222-4222-8222-222222222222';
do $sw_adversarial$
begin
  if public.success_wishes_match_recipient(
    '22222222-2222-4222-8222-222222222222','B-200','Brian Otieno'
  ) is not null then raise exception 'Inactive enrollment still allowed recipient matching'; end if;
end $sw_adversarial$;
update public.student_classes set is_current=true
where school_id='22222222-2222-4222-8222-222222222222';

-- Two students sharing an admission number must not be resolved arbitrarily.
insert into public.students(id,name,admission_number)
values ('cccccccc-cccc-4ccc-8ccc-cccccccccccc','Brian Otieno','B-200');
insert into public.student_classes(id,school_id,class_id,student_id,is_current)
values ('20000000-0000-4000-8000-000000000002',
 '22222222-2222-4222-8222-222222222222',
 '22222222-0000-4000-8000-000000000001',
 'cccccccc-cccc-4ccc-8ccc-cccccccccccc',true);
do $sw_adversarial$
begin
  if public.success_wishes_match_recipient(
    '22222222-2222-4222-8222-222222222222','B-200','Brian Otieno'
  ) is not null then raise exception 'Duplicate admissions resolved an ambiguous candidate'; end if;
end $sw_adversarial$;

-- Rejection must not affect other-school candidates.
delete from public.student_classes where student_id='cccccccc-cccc-4ccc-8ccc-cccccccccccc';
delete from public.students where id='cccccccc-cccc-4ccc-8ccc-cccccccccccc';
do $sw_adversarial$
begin
  if public.success_wishes_match_recipient(
    '22222222-2222-4222-8222-222222222222','B-200','Brian Otieno'
  ) is null then raise exception 'Valid recipient did not recover after duplicate removal'; end if;
  if public.success_wishes_match_recipient(
    '11111111-1111-4111-8111-111111111111','B-200','Brian Otieno'
  ) is not null then raise exception 'Cross-school candidate lookup leaked information'; end if;
end $sw_adversarial$;
reset role;
select 'success-wishes adversarial checks passed' as result;
