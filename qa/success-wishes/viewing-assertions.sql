-- Disposable PostgreSQL 17 only. Runs after canonical fixtures and the
-- private Success Wishes foundation, as well as the viewing-window migration.

do $viewing_rls$
begin
  if not exists (
    select 1 from pg_class c
    where c.oid='public.success_wishes_viewing_windows'::regclass and c.relrowsecurity
  ) then raise exception 'Viewing schedule lacks RLS'; end if;
  if has_table_privilege('anon','public.success_wishes_viewing_windows','SELECT')
    or has_table_privilege('authenticated','public.success_wishes_viewing_windows','SELECT')
    or has_table_privilege('anon','public.success_wishes_viewing_windows','INSERT')
    or has_table_privilege('authenticated','public.success_wishes_viewing_windows','INSERT')
    or has_table_privilege('authenticated','public.success_wishes_viewing_windows','DELETE')
    then raise exception 'Viewing schedule exposed through direct Data API'; end if;
  if not has_table_privilege('service_role','public.success_wishes_viewing_windows','INSERT')
    or not has_table_privilege('service_role','public.success_wishes_viewing_windows','SELECT')
    then raise exception 'Missing service-only viewing schedule permissions'; end if;
end $viewing_rls$;

set role service_role;
insert into public.success_wishes_viewing_windows (
  school_id,weekday,starts_at,ends_at,venue,guidance,is_active
) values
 ('11111111-1111-4111-8111-111111111111',1,'15:00','16:00','School library','Ask for the supervised school device',true),
 ('22222222-2222-4222-8222-222222222222',2,'13:00','14:00','Learning centre','',true);

do $viewing_isolation$
begin
  if (select count(*) from public.success_wishes_viewing_windows
      where school_id='11111111-1111-4111-8111-111111111111')<>1
    then raise exception 'School Alpha viewing schedule not isolated'; end if;
  if (select count(*) from public.success_wishes_viewing_windows
      where school_id='22222222-2222-4222-8222-222222222222')<>1
    then raise exception 'School Beta viewing schedule not isolated'; end if;

  begin
    insert into public.success_wishes_viewing_windows (
      school_id,weekday,starts_at,ends_at,venue
    ) values ('11111111-1111-4111-8111-111111111111',1,'16:00','15:00','Classroom');
    raise exception 'Invalid viewing schedule times accepted';
  exception when check_violation then null;
  end;
  begin
    insert into public.success_wishes_viewing_windows (
      school_id,weekday,starts_at,ends_at,venue
    ) values ('11111111-1111-4111-8111-111111111111',1,'15:00','16:00','Another room');
    raise exception 'Duplicate viewing window accepted';
  exception when unique_violation then null;
  end;
end $viewing_isolation$;
reset role;

set role anon;
do $viewing_anonymous$
begin
  begin
    perform count(*) from public.success_wishes_viewing_windows;
    raise exception 'Anonymous Data API may read viewing schedule';
  exception when insufficient_privilege then null;
  end;
end $viewing_anonymous$;
reset role;

set role authenticated;
do $viewing_authenticated$
begin
  begin
    perform count(*) from public.success_wishes_viewing_windows;
    raise exception 'Ordinary authenticated Data API may read viewing schedule';
  exception when insufficient_privilege then null;
  end;
end $viewing_authenticated$;
reset role;

select 'success-wishes school-device viewing authorization assertions passed' as result;
