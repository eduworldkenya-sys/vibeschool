-- Safe data-minimising cleanup for the already deployed private text domain.
-- The public Success Wishes and M-Pesa runtime flags remain disabled.
-- Does not delete any media asset or payment reference (media needs a separate worker).
begin;

do $sw_cron_check$
begin
  if not exists(select 1 from pg_extension where extname='pg_cron') then
    raise exception 'pg_cron_must_be_enabled';
  end if;
  if not exists(
    select 1 from pg_proc p join pg_namespace n on n.oid=p.pronamespace
    where n.nspname='public' and p.proname='success_wishes_cleanup'
  ) then raise exception 'success_wishes_cleanup_missing'; end if;
end $sw_cron_check$;

-- pg_cron upserts a named job. A single scheduled task avoids accidental
-- duplicate workers on re-run; job executes with its registering DB role.
select cron.schedule(
  'success-wishes-text-expiry',
  '*/30 * * * *',
  'select public.success_wishes_cleanup(500);'
);

commit;
