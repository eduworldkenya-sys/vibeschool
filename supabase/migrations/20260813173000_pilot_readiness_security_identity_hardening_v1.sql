begin;

alter view public.school_directory_public set (security_invoker = true);

revoke execute on function public.audit_school_creation_event() from public, anon, authenticated;
revoke execute on function public.audit_school_discovery_request_event() from public, anon, authenticated;
revoke execute on function public.guard_school_duplicate_identity() from public, anon, authenticated;

create unique index if not exists schools_active_identity_unique_idx
on public.schools (
  lower(regexp_replace(trim(name),'[^a-zA-Z0-9]+','','g')),
  lower(trim(coalesce(county,''))),
  lower(trim(coalesce(sub_county,'')))
)
where deleted_at is null and status in ('pending','active');

create unique index if not exists school_discovery_pending_identity_unique_idx
on public.school_discovery_requests (
  lower(regexp_replace(trim(name),'[^a-zA-Z0-9]+','','g')),
  lower(trim(coalesce(county,''))),
  lower(trim(coalesce(sub_county,'')))
)
where status in ('pending','under_review');

revoke execute on function public.school_search_rate_guard(text) from public, anon;
grant execute on function public.school_search_rate_guard(text) to authenticated;

commit;
