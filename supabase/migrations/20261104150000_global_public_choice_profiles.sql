-- Public Global identity is isolated from private profiles and defaults to private.
create table if not exists public.global_public_profiles (
  profile_id uuid primary key references public.profiles(id) on delete cascade,
  username text,
  display_name text,
  bio text,
  avatar_url text,
  role_label text,
  county text,
  institution text,
  is_public boolean not null default false,
  show_social_counts boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint global_public_profiles_username_ck check (username is null or username ~ '^[a-z0-9_]{3,24}$'),
  constraint global_public_profiles_name_ck check (display_name is null or char_length(btrim(display_name)) between 2 and 80),
  constraint global_public_profiles_bio_ck check (bio is null or char_length(bio) <= 280),
  constraint global_public_profiles_avatar_ck check (avatar_url is null or avatar_url ~ '^https?://'),
  constraint global_public_profiles_public_ck check (not is_public or (username is not null and display_name is not null))
);
create unique index if not exists global_public_profiles_username_uq on public.global_public_profiles(username) where username is not null;
create table if not exists public.global_profile_follows (
  follower_id uuid not null references public.profiles(id) on delete cascade,
  followed_id uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key(follower_id, followed_id),
  constraint global_profile_follows_no_self check(follower_id <> followed_id)
);
create index if not exists global_profile_follows_followed_idx on public.global_profile_follows(followed_id, created_at desc);

create or replace function public.global_touch_public_profile_updated_at()
returns trigger language plpgsql set search_path = public, pg_temp as $$
begin new.updated_at := now(); return new; end $$;
drop trigger if exists global_public_profiles_touch_updated_at on public.global_public_profiles;
create trigger global_public_profiles_touch_updated_at before update on public.global_public_profiles
for each row execute function public.global_touch_public_profile_updated_at();

alter table public.global_public_profiles enable row level security;
alter table public.global_profile_follows enable row level security;
revoke all on public.global_public_profiles from anon, authenticated;
grant select, insert, update, delete on public.global_public_profiles to authenticated;
create policy global_public_profiles_read_own on public.global_public_profiles for select to authenticated using(profile_id = (select auth.uid()));
create policy global_public_profiles_insert_own on public.global_public_profiles for insert to authenticated with check(profile_id = (select auth.uid()));
create policy global_public_profiles_update_own on public.global_public_profiles for update to authenticated using(profile_id = (select auth.uid())) with check(profile_id = (select auth.uid()));
create policy global_public_profiles_delete_own on public.global_public_profiles for delete to authenticated using(profile_id = (select auth.uid()));

revoke all on public.global_profile_follows from anon, authenticated;
grant select, insert, delete on public.global_profile_follows to authenticated;
create policy global_profile_follows_read_participant on public.global_profile_follows for select to authenticated using(follower_id = (select auth.uid()) or followed_id = (select auth.uid()));
create policy global_profile_follows_insert_own on public.global_profile_follows for insert to authenticated with check (
  follower_id = (select auth.uid()) and exists (
    select 1 from public.global_public_profiles pp join public.profiles p on p.id = pp.profile_id
    where pp.profile_id = followed_id and pp.is_public = true
      and p.account_status = 'active'::public.account_status and p.is_anonymized = false
  )
);
create policy global_profile_follows_delete_own on public.global_profile_follows for delete to authenticated using(follower_id = (select auth.uid()));

create or replace function public.global_get_public_profile(p_username text)
returns table(profile_id uuid, username text, display_name text, bio text, avatar_url text, role_label text, county text, institution text, follower_count bigint, following_count bigint, is_following boolean)
language sql stable security definer set search_path = public, pg_temp as $$
 select pp.profile_id, pp.username, pp.display_name, pp.bio, pp.avatar_url, pp.role_label, pp.county, pp.institution,
   case when pp.show_social_counts then (select count(*) from public.global_profile_follows f where f.followed_id=pp.profile_id) else null end,
   case when pp.show_social_counts then (select count(*) from public.global_profile_follows f where f.follower_id=pp.profile_id) else null end,
   exists(select 1 from public.global_profile_follows f where f.follower_id=auth.uid() and f.followed_id=pp.profile_id)
 from public.global_public_profiles pp join public.profiles p on p.id=pp.profile_id
 where lower(pp.username)=lower(btrim(p_username)) and pp.is_public=true
   and p.account_status='active'::public.account_status and p.is_anonymized=false limit 1;
$$;

create or replace function public.global_get_public_profile_content(p_username text)
returns jsonb language plpgsql stable security definer set search_path = public, pg_temp as $$
declare v_id uuid; v_json jsonb;
begin
 select pp.profile_id into v_id from public.global_public_profiles pp join public.profiles p on p.id=pp.profile_id
 where lower(pp.username)=lower(btrim(p_username)) and pp.is_public=true
 and p.account_status='active'::public.account_status and p.is_anonymized=false limit 1;
 if v_id is null then return null; end if;
 select jsonb_build_object(
  'posts', coalesce((select jsonb_agg(x order by x->>'created_at' desc) from (
    select jsonb_build_object('id',s.id,'kind','story','title',s.title,'description',s.description,'image_url',s.cover_image_url,'created_at',s.created_at,'view_count',s.view_count,'href','/global/read/story/'||s.id::text) x
    from public.vibe_stories s where s.author_id=v_id and s.status='published'
    union all
    select jsonb_build_object('id',c.id,'kind',case when lower(coalesce(c.type,'')) like '%video%' then 'video' else 'resource' end,'title',c.title,'description',c.description,'image_url',c.thumbnail_url,'created_at',c.created_at,'view_count',c.view_count,'href','/global/read/'||c.id::text)
    from public.vibelearn_content c where c.submitted_by=v_id and c.status='live'
  ) q),'[]'::jsonb),
  'resources',coalesce((select jsonb_agg(jsonb_build_object('id',c.id,'kind','resource','title',c.title,'description',c.description,'image_url',c.thumbnail_url,'created_at',c.created_at,'view_count',c.view_count,'href','/global/read/'||c.id::text) order by c.created_at desc)
    from public.vibelearn_content c where c.submitted_by=v_id and c.status='live' and lower(coalesce(c.type,'')) not like '%video%'),'[]'::jsonb),
  'videos',coalesce((select jsonb_agg(jsonb_build_object('id',c.id,'kind','video','title',c.title,'description',c.description,'image_url',c.thumbnail_url,'created_at',c.created_at,'view_count',c.view_count,'href','/global/read/'||c.id::text) order by c.created_at desc)
    from public.vibelearn_content c where c.submitted_by=v_id and c.status='live' and lower(coalesce(c.type,'')) like '%video%'),'[]'::jsonb),
  'activity',coalesce((select jsonb_agg(a order by a->>'created_at' desc) from (
    select jsonb_build_object('kind','published_story','title',s.title,'created_at',s.published_at) a from public.vibe_stories s where s.author_id=v_id and s.status='published'
    union all
    select jsonb_build_object('kind','published_resource','title',c.title,'created_at',c.created_at) from public.vibelearn_content c where c.submitted_by=v_id and c.status='live'
  ) q),'[]'::jsonb)
 ) into v_json;
 return v_json;
end $$;

create or replace function public.global_follow_profile(p_username text)
returns boolean language plpgsql security definer set search_path = public, pg_temp as $$
declare v_target uuid;
begin
 if auth.uid() is null then raise exception 'Authentication required'; end if;
 select pp.profile_id into v_target from public.global_public_profiles pp join public.profiles p on p.id=pp.profile_id
 where lower(pp.username)=lower(btrim(p_username)) and pp.is_public=true and p.account_status='active'::public.account_status and p.is_anonymized=false;
 if v_target is null then raise exception 'Public profile not found'; end if;
 if v_target=auth.uid() then raise exception 'You cannot follow your own profile'; end if;
 insert into public.global_profile_follows(follower_id,followed_id) values(auth.uid(),v_target) on conflict do nothing;
 return true;
end $$;
create or replace function public.global_unfollow_profile(p_username text)
returns boolean language plpgsql security definer set search_path = public, pg_temp as $$
declare v_target uuid;
begin
 if auth.uid() is null then raise exception 'Authentication required'; end if;
 select profile_id into v_target from public.global_public_profiles where lower(username)=lower(btrim(p_username));
 if v_target is null then return false; end if;
 delete from public.global_profile_follows where follower_id=auth.uid() and followed_id=v_target;
 return true;
end $$;

revoke all on function public.global_get_public_profile(text) from public;
revoke all on function public.global_get_public_profile_content(text) from public;
revoke all on function public.global_follow_profile(text) from public;
revoke all on function public.global_unfollow_profile(text) from public;
grant execute on function public.global_get_public_profile(text) to anon, authenticated;
grant execute on function public.global_get_public_profile_content(text) to anon, authenticated;
grant execute on function public.global_follow_profile(text) to authenticated;
grant execute on function public.global_unfollow_profile(text) to authenticated;
