-- access: owner-only public.school_public_posts
-- authorization-test: public.school_public_posts scripts/test-school-public-home-contract.mjs
-- Public school information is separate from targeted VibeConnect circulars and private finance records.
-- Canonical school identity and verified school admin membership remain the only school-owner authorities.
create table public.school_public_posts (
  id uuid primary key default gen_random_uuid(),
  school_slug text not null references public.school_public_urls(slug) on delete restrict,
  kind text not null check (kind in ('announcement','fees','uniform','admissions','contact')),
  title text not null check (length(btrim(title)) between 3 and 130),
  body text not null check (length(btrim(body)) between 3 and 4000),
  details jsonb not null default '{}'::jsonb check (jsonb_typeof(details) = 'object'),
  status text not null default 'published' check (status in ('published','withdrawn')),
  publisher_kind text not null check (publisher_kind in ('school','hq')),
  published_by uuid not null references auth.users(id),
  published_at timestamptz not null default now(),
  withdrawn_at timestamptz,
  withdrawn_by uuid references auth.users(id),
  created_at timestamptz not null default now()
);
create index school_public_posts_latest_idx on public.school_public_posts(school_slug, published_at desc) where status='published';
create index school_public_posts_feed_idx on public.school_public_posts(published_at desc) where status='published';
alter table public.school_public_posts enable row level security;
revoke all on public.school_public_posts from public, anon, authenticated;
grant select(id, school_slug, kind, title, body, details, status, publisher_kind, published_at) on public.school_public_posts to anon, authenticated;
create policy school_public_posts_read_published on public.school_public_posts
 for select to anon, authenticated
 using (status='published' and exists(
   select 1 from public.schools_resolve_url_public_v1(school_slug, null, null)
 ));

-- access: service-only public.school_public_post_audit
-- authorization-test: public.school_public_post_audit scripts/test-school-public-home-contract.mjs
create table public.school_public_post_audit (
  id bigint generated always as identity primary key,
  post_id uuid not null references public.school_public_posts(id) on delete restrict,
  action text not null check(action in ('published','withdrawn')),
  actor_id uuid not null references auth.users(id),
  at timestamptz not null default now(),
  payload jsonb not null
);
alter table public.school_public_post_audit enable row level security;
revoke all on public.school_public_post_audit from public, anon, authenticated;

create or replace function public.school_can_publish_public_v1(p_slug text)
returns boolean language sql stable security definer
set search_path = public, pg_temp
as $$
  select (select auth.uid()) is not null
    and public.hq_profile_is_active((select auth.uid()))
    and exists (select 1 from public.schools_resolve_url_public_v1(lower(btrim(p_slug)), null, null))
    and (
      public.hq_human_has_permission((select auth.uid()), 'schools.publish')
      or exists (
        select 1 from public.school_public_urls u
        where u.slug=lower(btrim(p_slug))
          and u.school_id is not null
          and public.is_school_admin(u.school_id)
      )
    );
$$;

create or replace function public.school_publish_public_post_v1(
  p_slug text, p_kind text, p_title text, p_body text, p_details jsonb default '{}'::jsonb
) returns uuid language plpgsql security definer
set search_path = public, pg_temp
as $$
declare
  v_actor uuid := (select auth.uid());
  v_slug text := lower(btrim(p_slug));
  v_kind text := lower(btrim(p_kind));
  v_id uuid;
  v_school_id uuid;
  v_publisher text;
begin
  if v_actor is null or not public.hq_profile_is_active(v_actor) then
    raise exception 'Authentication required' using errcode='42501';
  end if;
  if not exists(select 1 from public.schools_resolve_url_public_v1(v_slug,null,null)) then
    raise exception 'School is not publicly available' using errcode='22023';
  end if;
  select school_id into v_school_id from public.school_public_urls where slug=v_slug;
  if v_school_id is not null and public.is_school_admin(v_school_id) then
    v_publisher := 'school';
  elsif public.hq_human_has_permission(v_actor,'schools.publish') then
    v_publisher := 'hq';
  else
    raise exception 'Verified school publisher required' using errcode='42501';
  end if;
  if v_kind not in ('announcement','fees','uniform','admissions','contact')
     or length(btrim(coalesce(p_title,''))) not between 3 and 130
     or length(btrim(coalesce(p_body,''))) not between 3 and 4000
     or p_details is null or jsonb_typeof(p_details)<>'object'
     or length(p_details::text)>4000 then
    raise exception 'Invalid school publication' using errcode='22023';
  end if;
  if v_kind='fees' and (
      not (p_details ? 'year' and p_details ? 'term' and p_details ? 'amount')
      or (p_details->>'year') !~ '^[0-9]{4}$'
      or (p_details->>'term') !~ '^[123]$'
      or (p_details->>'amount') !~ '^[0-9]{1,8}(\.[0-9]{1,2})?$'
      or coalesce((p_details->>'amount')::numeric,0)<=0
      or coalesce((p_details->>'currency'),'KES') <> 'KES'
    ) then
    raise exception 'Fees need verified year, term, and KES amount' using errcode='22023';
  end if;
  insert into public.school_public_posts
    (school_slug,kind,title,body,details,status,publisher_kind,published_by)
  values(v_slug,v_kind,btrim(p_title),btrim(p_body),p_details,'published',v_publisher,v_actor)
  returning id into v_id;
  insert into public.school_public_post_audit(post_id,action,actor_id,payload)
  values(v_id,'published',v_actor,jsonb_build_object('school_slug',v_slug,'kind',v_kind,'publisher_kind',v_publisher));
  return v_id;
end;
$$;

create or replace function public.school_withdraw_public_post_v1(p_post_id uuid)
returns boolean language plpgsql security definer set search_path=public,pg_temp
as $$
declare v_post public.school_public_posts%rowtype; v_actor uuid := (select auth.uid());
begin
  if v_actor is null or not public.hq_profile_is_active(v_actor) then
    raise exception 'Authentication required' using errcode='42501';
  end if;
  select * into v_post from public.school_public_posts where id=p_post_id for update;
  if not found then return false; end if;
  if not public.hq_human_has_permission(v_actor,'schools.publish')
    and not exists (select 1 from public.school_public_urls u where u.slug=v_post.school_slug
       and u.school_id is not null and public.is_school_admin(u.school_id)) then
    raise exception 'Verified school publisher required' using errcode='42501';
  end if;
  if v_post.status='withdrawn' then return true; end if;
  update public.school_public_posts set status='withdrawn', withdrawn_at=now(), withdrawn_by=v_actor where id=p_post_id;
  insert into public.school_public_post_audit(post_id,action,actor_id,payload)
    values(p_post_id,'withdrawn',v_actor,jsonb_build_object('school_slug',v_post.school_slug,'original_publisher',v_post.publisher_kind));
  return true;
end;
$$;

create or replace function public.school_followed_public_feed_v1(p_limit integer default 40)
returns table(id uuid, school_slug text, school_name text, kind text, title text, body text,
  details jsonb, publisher_kind text, published_at timestamptz)
language sql stable security definer set search_path=public,pg_temp
as $$
 select p.id,p.school_slug,s.school_name,p.kind,p.title,p.body,p.details,p.publisher_kind,p.published_at
 from (
   select school_slug as slug from public.school_follows where follower_id=(select auth.uid())
   union
   select u.slug from public.school_members sm join public.school_public_urls u on u.school_id=sm.school_id
     where sm.profile_id=(select auth.uid())
   union
   select u.slug from public.students st join public.student_schools ss on ss.student_id=st.id
     join public.school_public_urls u on u.school_id=ss.school_id
     where st.profile_id=(select auth.uid()) and st.deleted_at is null
   union
   select u.slug from public.parent_student_links pl join public.school_public_urls u on u.school_id=pl.school_id
     where pl.parent_id=(select auth.uid())
 ) f
 join public.school_public_posts p on p.school_slug=f.slug and p.status='published'
 join lateral public.schools_resolve_url_public_v1(f.slug,null,null) s on true
 where (select auth.uid()) is not null
 order by p.published_at desc, p.id desc
 limit least(greatest(coalesce(p_limit,40),1),100);
$$;

revoke all on function public.school_can_publish_public_v1(text) from public, anon;
revoke all on function public.school_publish_public_post_v1(text,text,text,text,jsonb) from public, anon;
revoke all on function public.school_withdraw_public_post_v1(uuid) from public, anon;
revoke all on function public.school_followed_public_feed_v1(integer) from public, anon;
grant execute on function public.school_can_publish_public_v1(text) to authenticated;
grant execute on function public.school_publish_public_post_v1(text,text,text,text,jsonb) to authenticated;
grant execute on function public.school_withdraw_public_post_v1(uuid) to authenticated;
grant execute on function public.school_followed_public_feed_v1(integer) to authenticated;
comment on table public.school_public_posts is 'Verified public school announcements, admissions, uniforms, contact and published fee notices; never targeted VibeConnect circulars or private finance.';
