-- Task 7: School Admin communication authority.
-- Repository-first. Exact-candidate migration/security gates must pass before production apply.

create or replace function public.admin_search_school_community(
  p_school_id uuid,
  p_query text,
  p_limit integer default 12
)
returns table (
  profile_id uuid,
  full_name text,
  relationship text
)
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
begin
  if auth.uid() is null then
    raise exception 'authentication_required' using errcode = '42501';
  end if;
  if not public.is_school_admin(p_school_id) then
    raise exception 'school_admin_required' using errcode = '42501';
  end if;

  return query
  with community as (
    select sm.profile_id, p.full_name,
      case
        when sm.role::text in ('admin','owner') then 'admin'
        when sm.role::text = 'teacher' then 'teacher'
        else sm.role::text
      end as relationship
    from public.school_members sm
    join public.profiles p on p.id = sm.profile_id
    where sm.school_id = p_school_id

    union all

    select s.profile_id, p.full_name, 'student'::text
    from public.student_classes sc
    join public.students s on s.id = sc.student_id and s.deleted_at is null
    join public.profiles p on p.id = s.profile_id
    where sc.school_id = p_school_id
      and sc.is_current = true
      and s.profile_id is not null

    union all

    select l.parent_id, p.full_name, 'parent'::text
    from public.parent_student_links l
    join public.student_classes sc
      on sc.student_id = l.student_id
     and sc.school_id = p_school_id
     and sc.is_current = true
    join public.profiles p on p.id = l.parent_id
    where l.school_id = p_school_id
      and coalesce(l.access_level, 'full') <> 'none'
  ), dedup as (
    select distinct on (c.profile_id)
      c.profile_id,
      c.full_name,
      c.relationship
    from community c
    where c.profile_id <> auth.uid()
      and coalesce(c.full_name, '') ilike '%' || coalesce(p_query, '') || '%'
    order by c.profile_id,
      case c.relationship when 'teacher' then 1 when 'parent' then 2 when 'student' then 3 else 4 end
  )
  select d.profile_id, d.full_name, d.relationship
  from dedup d
  order by d.full_name nulls last, d.profile_id
  limit greatest(1, least(coalesce(p_limit, 12), 30));
end;
$$;

revoke all on function public.admin_search_school_community(uuid,text,integer) from public, anon;
grant execute on function public.admin_search_school_community(uuid,text,integer) to authenticated, service_role;

create or replace function public.admin_send_school_circular(
  p_school_id uuid,
  p_title text,
  p_body text,
  p_audience text,
  p_requires_ack boolean default true,
  p_ack_deadline timestamptz default null
)
returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_circular_id uuid;
begin
  if auth.uid() is null then
    raise exception 'authentication_required' using errcode = '42501';
  end if;
  if not public.is_school_admin(p_school_id) then
    raise exception 'school_admin_required' using errcode = '42501';
  end if;
  if p_audience not in ('all_staff','all_students','all_parents','everyone') then
    raise exception 'invalid_audience' using errcode = '22023';
  end if;
  if nullif(btrim(p_title), '') is null or nullif(btrim(p_body), '') is null then
    raise exception 'title_and_body_required' using errcode = '22023';
  end if;

  insert into public.vc_circulars (
    school_id, title, body, audience_type, requires_ack, ack_deadline, sent_by, sent_at
  ) values (
    p_school_id, btrim(p_title), btrim(p_body), p_audience,
    coalesce(p_requires_ack, true), p_ack_deadline, auth.uid(), now()
  )
  returning id into v_circular_id;

  insert into public.vc_circular_recipients (circular_id, profile_id)
  select v_circular_id, recipients.profile_id
  from (
    select distinct profile_id
    from (
      select sm.profile_id
      from public.school_members sm
      where sm.school_id = p_school_id
        and p_audience in ('all_staff','everyone')
        and sm.role::text in ('admin','owner','teacher')

      union all

      select s.profile_id
      from public.student_classes sc
      join public.students s on s.id = sc.student_id and s.deleted_at is null
      where sc.school_id = p_school_id
        and sc.is_current = true
        and s.profile_id is not null
        and p_audience in ('all_students','everyone')

      union all

      select l.parent_id
      from public.parent_student_links l
      join public.student_classes sc
        on sc.student_id = l.student_id
       and sc.school_id = p_school_id
       and sc.is_current = true
      where l.school_id = p_school_id
        and coalesce(l.access_level, 'full') <> 'none'
        and p_audience in ('all_parents','everyone')
    ) unioned
    where profile_id is not null
  ) recipients
  where public.is_school_community_profile(p_school_id, recipients.profile_id)
  on conflict do nothing;

  return v_circular_id;
end;
$$;

revoke all on function public.admin_send_school_circular(uuid,text,text,text,boolean,timestamptz) from public, anon;
grant execute on function public.admin_send_school_circular(uuid,text,text,text,boolean,timestamptz) to authenticated, service_role;
