-- Restore the HQ Publishing Inbox through owner-gated RPCs.
-- HQ base tables remain private: authenticated clients must not receive direct table grants.

create or replace function public.hq_list_publishing_work(p_limit integer default 200)
returns setof public.hq_work_items
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  perform public.hq_assert_owner();
  return query
  select w.*
  from public.hq_work_items w
  where w.work_type in (
    'teacher_guide_review',
    'assessment_moderation',
    'content_depth_revision',
    'vibelab_review',
    'publication_release'
  )
  order by w.created_at desc
  limit greatest(1, least(coalesce(p_limit, 200), 500));
end;
$$;

create or replace function public.hq_list_publication_release_checks(p_limit integer default 300)
returns setof public.publication_release_checks
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  perform public.hq_assert_owner();
  return query
  select c.*
  from public.publication_release_checks c
  order by c.checked_at desc
  limit greatest(1, least(coalesce(p_limit, 300), 1000));
end;
$$;

revoke all on function public.hq_list_publishing_work(integer) from public, anon;
revoke all on function public.hq_list_publication_release_checks(integer) from public, anon;
grant execute on function public.hq_list_publishing_work(integer) to authenticated;
grant execute on function public.hq_list_publication_release_checks(integer) to authenticated;
