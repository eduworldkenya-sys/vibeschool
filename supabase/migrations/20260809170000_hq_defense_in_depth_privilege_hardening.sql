-- HQ defense-in-depth privilege hardening.
-- RLS remains the row-level authority boundary; this migration also removes
-- unnecessary grants so anonymous clients cannot even attempt direct HQ table access.

do $$
declare r record;
begin
  for r in
    select c.relname
    from pg_class c
    join pg_namespace n on n.oid=c.relnamespace
    where n.nspname='public'
      and c.relkind='r'
      and (c.relname like 'hq_%' or c.relname='platform_owners')
  loop
    execute format('revoke all privileges on table public.%I from anon', r.relname);
  end loop;
end $$;

-- Membership in platform_owners is authority, not ordinary application data.
-- Authenticated clients may only observe it through its owner-only RLS policy.
revoke insert, update, delete, truncate, references, trigger on table public.platform_owners from authenticated;
grant select on table public.platform_owners to authenticated;
alter table public.platform_owners enable row level security;

-- hq_access_log was pretracked in production and is not created by the repository
-- before this historical hardening migration. Preserve the hardening when the
-- table exists without making blank replay depend on undocumented production DDL.
do $$
begin
  if to_regclass('public.hq_access_log') is not null then
    execute 'revoke insert, update, delete, truncate, references, trigger on table public.hq_access_log from authenticated';
    execute 'grant select on table public.hq_access_log to authenticated';
    execute 'alter table public.hq_access_log enable row level security';
  end if;
end $$;
