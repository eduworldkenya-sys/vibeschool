-- HQ Signal Center R3 legacy signup compaction closure.
-- Every legacy per-user signup notification becomes retained resolved history.
-- One daily digest remains active, including days that had only one legacy signup.

begin;

do $$
declare
  d date;
  c bigint;
begin
  for d in
    select distinct created_at::date
    from public.hq_notifications
    where title='New signup'
      and category='growth'
      and fingerprint like 'legacy:%'
  loop
    select count(*) into c
    from public.hq_notifications
    where title='New signup'
      and category='growth'
      and fingerprint like 'legacy:%'
      and created_at::date=d;

    perform public.hq_upsert_notification(
      'growth:legacy-signups:'||d::text,
      'growth','info','digest',
      'Signups · '||d::text,
      c||' user'||case when c=1 then '' else 's' end||' joined VibeSchool.',
      '/hq?view=users','View users','legacy_signup_compaction',null,
      jsonb_build_object('signup_count',c,'date',d)
    );

    update public.hq_notifications
    set status='resolved',
        read_at=coalesce(read_at,now()),
        resolved_at=coalesce(resolved_at,now())
    where title='New signup'
      and category='growth'
      and fingerprint like 'legacy:%'
      and created_at::date=d;
  end loop;
end $$;

commit;
