-- ============================================================================
-- Baseline migration for vibe_publications / vibe_chapters
-- ============================================================================
create table if not exists public.vibe_publications (
  id                uuid primary key default gen_random_uuid(),
  author_id         uuid not null references auth.users(id) on delete cascade,
  format            text not null,
  title             text default ''::text,
  subtitle          text default ''::text,
  cover_url         text default ''::text,
  description       text default ''::text,
  genre             text default 'other'::text,
  tags              text[] default '{}'::text[],
  language          text default 'en'::text,
  status            text default 'draft'::text,
  pricing           jsonb default '{"type": "free"}'::jsonb,
  chapter_count     integer default 0,
  total_reads       integer default 0,
  cbc_subject       text default ''::text,
  cbc_grade         text default ''::text,
  cbc_aligned       boolean default false,
  series_name       text default ''::text,
  series_number     integer default 0,
  publication_name  text default ''::text,
  issue_number      text default 0,
  published_at      timestamptz,
  created_at        timestamptz default now(),
  updated_at        timestamptz default now(),
  total_vibes       integer default 0,
  earnings_ksh      numeric default 0
);

create table if not exists public.vibe_chapters (
  id                  uuid primary key default gen_random_uuid(),
  publication_id      uuid not null references public.vibe_publications(id) on delete cascade,
  title               text default ''::text,
  number              integer not null default 1,
  blocks              jsonb default '[]'::jsonb,
  status              text default 'draft'::text,
  word_count          integer default 0,
  reading_time_min    integer default 0,
  learning_outcomes   text[] default '{}'::text[],
  cbc_strand          text default ''::text,
  created_at          timestamptz default now(),
  updated_at          timestamptz default now(),
  published_at        timestamptz
);

alter table public.vibe_publications
  drop constraint if exists vibe_publications_status_check;
alter table public.vibe_publications
  add constraint vibe_publications_status_check
  check (status in ('draft','published','archived')) not valid;

alter table public.vibe_chapters
  drop constraint if exists vibe_chapters_status_check;
alter table public.vibe_chapters
  add constraint vibe_chapters_status_check
  check (status in ('draft','published','locked')) not valid;

alter table public.vibe_publications enable row level security;
alter table public.vibe_chapters     enable row level security;

drop policy if exists "Author full access own publications" on public.vibe_publications;
drop policy if exists "Authors manage own publications"      on public.vibe_publications;
drop policy if exists "Public can read published"             on public.vibe_publications;
drop policy if exists "Public read published publications"    on public.vibe_publications;
drop policy if exists "author deletes own publications"       on public.vibe_publications;
drop policy if exists "author inserts own publications"       on public.vibe_publications;
drop policy if exists "author reads own publications"         on public.vibe_publications;
drop policy if exists "author updates own publications"       on public.vibe_publications;
drop policy if exists "public reads published publications"   on public.vibe_publications;
drop policy if exists "vibe_publications_admin"                on public.vibe_publications;

drop policy if exists "Author full access own chapters"        on public.vibe_chapters;
drop policy if exists "Authors manage own chapters"             on public.vibe_chapters;
drop policy if exists "Public can read published chapters"      on public.vibe_chapters;
drop policy if exists "Public read published or locked chapters" on public.vibe_chapters;
drop policy if exists "author deletes own chapters"             on public.vibe_chapters;
drop policy if exists "author inserts own chapters"             on public.vibe_chapters;
drop policy if exists "author reads own chapters"                on public.vibe_chapters;
drop policy if exists "author updates own chapters"              on public.vibe_chapters;
drop policy if exists "public reads published chapters"          on public.vibe_chapters;
drop policy if exists "vibe_chapters_admin"                      on public.vibe_chapters;

create policy "vibe_publications_owner_or_school_staff"
  on public.vibe_publications for all
  using (
    author_id = auth.uid()
    or exists (
      select 1 from school_members
      where school_members.profile_id = auth.uid()
        and school_members.role = any (array['admin'::member_role, 'teacher'::member_role])
    )
  )
  with check (
    author_id = auth.uid()
    or exists (
      select 1 from school_members
      where school_members.profile_id = auth.uid()
        and school_members.role = any (array['admin'::member_role, 'teacher'::member_role])
    )
  );

create policy "vibe_publications_public_read_published"
  on public.vibe_publications for select
  using (status = 'published');

create policy "vibe_chapters_owner_or_school_staff"
  on public.vibe_chapters for all
  using (
    exists (
      select 1 from vibe_publications p
      where p.id = vibe_chapters.publication_id
        and (
          p.author_id = auth.uid()
          or exists (
            select 1 from school_members
            where school_members.profile_id = auth.uid()
              and school_members.role = 'admin'::member_role
          )
        )
    )
  )
  with check (
    exists (
      select 1 from vibe_publications p
      where p.id = vibe_chapters.publication_id
        and (
          p.author_id = auth.uid()
          or exists (
            select 1 from school_members
            where school_members.profile_id = auth.uid()
              and school_members.role = 'admin'::member_role
          )
        )
    )
  );

create policy "vibe_chapters_public_read_published_or_locked"
  on public.vibe_chapters for select
  using (
    status in ('published', 'locked')
    and exists (
      select 1 from vibe_publications p
      where p.id = vibe_chapters.publication_id
        and p.status = 'published'
    )
  );

create index if not exists idx_vibe_publications_author_id on public.vibe_publications(author_id);
create index if not exists idx_vibe_publications_status    on public.vibe_publications(status);
create index if not exists idx_vibe_chapters_publication_id on public.vibe_chapters(publication_id);
create index if not exists idx_vibe_chapters_status         on public.vibe_chapters(status);

insert into storage.buckets (id, name, public)
values
  ('vibe-publication-covers', 'vibe-publication-covers', true),
  ('vibe-publication-images', 'vibe-publication-images', true)
on conflict (id) do nothing;

drop policy if exists "Authenticated upload vibe publication images"          on storage.objects;
drop policy if exists "Public read vibe publication images"                   on storage.objects;
drop policy if exists "anyone reads publication covers"                       on storage.objects;
drop policy if exists "authenticated users update own publication covers"     on storage.objects;
drop policy if exists "authenticated users upload publication covers"         on storage.objects;

create policy "vibe_publication_covers_public_read"
  on storage.objects for select
  using (bucket_id = 'vibe-publication-covers');

create policy "vibe_publication_images_public_read"
  on storage.objects for select
  using (bucket_id = 'vibe-publication-images');

create policy "vibe_publication_covers_authenticated_insert"
  on storage.objects for insert
  with check (bucket_id = 'vibe-publication-covers' and auth.role() = 'authenticated');

create policy "vibe_publication_images_authenticated_insert"
  on storage.objects for insert
  with check (bucket_id = 'vibe-publication-images' and auth.role() = 'authenticated');

create policy "vibe_publication_covers_owner_update"
  on storage.objects for update
  using (bucket_id = 'vibe-publication-covers' and owner = auth.uid())
  with check (bucket_id = 'vibe-publication-covers' and owner = auth.uid());

create policy "vibe_publication_images_owner_update"
  on storage.objects for update
  using (bucket_id = 'vibe-publication-images' and owner = auth.uid())
  with check (bucket_id = 'vibe-publication-images' and owner = auth.uid());

create policy "vibe_publication_covers_owner_delete"
  on storage.objects for delete
  using (bucket_id = 'vibe-publication-covers' and owner = auth.uid());

create policy "vibe_publication_images_owner_delete"
  on storage.objects for delete
  using (bucket_id = 'vibe-publication-images' and owner = auth.uid());

create table if not exists public.vibe_publication_views (
  id              uuid primary key default gen_random_uuid(),
  publication_id  uuid not null references public.vibe_publications(id) on delete cascade,
  viewer_id       uuid,
  viewed_at       timestamptz not null default now()
);

create index if not exists idx_vibe_publication_views_dedup
  on public.vibe_publication_views(publication_id, viewer_id, viewed_at);

alter table public.vibe_publication_views enable row level security;

create policy "vibe_publication_views_insert_via_rpc_only"
  on public.vibe_publication_views for insert
  with check (false);

create policy "vibe_publication_views_author_reads_own"
  on public.vibe_publication_views for select
  using (
    exists (
      select 1 from vibe_publications p
      where p.id = vibe_publication_views.publication_id
        and p.author_id = auth.uid()
    )
  );

create or replace function public.increment_publication_reads(pub_id uuid, viewer_id uuid default null)
 returns void
 language plpgsql
 security definer
 set search_path to 'public'
as $function$
begin
  if viewer_id is not null and exists (
    select 1 from vibe_publication_views
    where publication_id = pub_id
      and viewer_id = increment_publication_reads.viewer_id
      and viewed_at > now() - interval '24 hours'
  ) then
    return;
  end if;

  insert into vibe_publication_views (publication_id, viewer_id)
  values (pub_id, viewer_id);

  update vibe_publications
  set total_reads = total_reads + 1
  where id = pub_id;
end;
$function$;
