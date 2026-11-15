-- access: authenticated owner/school-admin writes; public published reads only.
-- authorization-test: public.school_public_content scripts/test-school-public-content-contract.mjs
-- authorization-test: public.school_public_content_audit scripts/test-school-public-content-contract.mjs
-- This is a public school site bulletin/requirements layer, NOT VibeConnect private circulars,
-- membership, an ERP fee ledger, or a duplicate document/event authority.
create table public.school_public_content (
  id uuid primary key default gen_random_uuid(),
  school_slug text not null references public.school_public_urls(slug) on delete restrict,
  author_id uuid not null references auth.users(id) on delete restrict,
  publisher_kind text not null check (publisher_kind in ('school','hq')),
  content_kind text not null check (content_kind in ('announcement','uniform','fees','admissions')),
  status text not null default 'draft' check (status in ('draft','published','withdrawn')),
  title text not null check (char_length(trim(title)) between 3 and 160),
  body text not null check (char_length(trim(body)) between 10 and 8000),
  academic_year integer check (academic_year between 2020 and 2100),
  term text check (term in ('Term 1','Term 2','Term 3','Annual','One-off')),
  amount_kes numeric(12,2) check (amount_kes is null or amount_kes >= 0),
  source_note text check (source_note is null or char_length(source_note) <= 600),
  published_at timestamptz,
  reviewed_by uuid references auth.users(id),
  reviewed_at timestamptz,
  revision integer not null default 1,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint published_requires_date check (status <> 'published' or published_at is not null),
  constraint verified_fees_require_evidence check (
    content_kind <> 'fees' or status <> 'published'
    or (academic_year is not null and amount_kes is not null
        and char_length(trim(coalesce(source_note,''))) >= 12 and reviewed_by is not null)
  )
);
create index school_public_content_feed_idx on public.school_public_content (school_slug, status, created_at desc);
alter table public.school_public_content enable row level security;
revoke all on public.school_public_content from public, anon, authenticated;
grant select on public.school_public_content to anon;
grant select, insert, update on public.school_public_content to authenticated;

create policy school_public_content_read_published on public.school_public_content
for select to anon, authenticated using (
  status = 'published'
  and exists(select 1 from public.schools_resolve_url_public_v1(school_slug, null, null))
);
create policy school_public_content_read_editor on public.school_public_content
for select to authenticated using (
  public.is_platform_owner()
  or exists (select 1 from public.schools_resolve_url_public_v1(school_slug, null, null) r
    where r.source_kind='canonical' and public.is_school_admin(r.source_id))
);

create policy school_public_content_insert_editor on public.school_public_content
for insert to authenticated with check (
  author_id = (select auth.uid())
  and (
    (public.is_platform_owner() and publisher_kind='hq')
    or (
      publisher_kind='school'
      and (status <> 'published' or content_kind <> 'fees')
      and exists(select 1 from public.schools_resolve_url_public_v1(school_slug, null, null) r
        where r.source_kind='canonical' and public.is_school_admin(r.source_id))
    )
  )
);
create policy school_public_content_update_editor on public.school_public_content
for update to authenticated using (
  public.is_platform_owner()
  or (publisher_kind='school' and exists(
    select 1 from public.schools_resolve_url_public_v1(school_slug, null, null) r
    where r.source_kind='canonical' and public.is_school_admin(r.source_id)
  ))
) with check (
  public.is_platform_owner()
  or (
    publisher_kind='school'
    and (status <> 'published' or content_kind <> 'fees')
    and exists(select 1 from public.schools_resolve_url_public_v1(school_slug, null, null) r
      where r.source_kind='canonical' and public.is_school_admin(r.source_id))
  )
);

create table public.school_public_content_audit (
  id bigint generated always as identity primary key,
  content_id uuid not null references public.school_public_content(id) on delete restrict,
  school_slug text not null,
  actor_id uuid,
  action text not null check (action in ('INSERT','UPDATE')),
  revision integer not null,
  snapshot jsonb not null,
  created_at timestamptz not null default now()
);
alter table public.school_public_content_audit enable row level security;
revoke all on public.school_public_content_audit from public, anon, authenticated;
grant select on public.school_public_content_audit to authenticated;
create policy school_public_content_audit_read_editor on public.school_public_content_audit
for select to authenticated using (
  public.is_platform_owner()
  or exists(select 1 from public.schools_resolve_url_public_v1(school_slug, null, null) r
    where r.source_kind='canonical' and public.is_school_admin(r.source_id))
);

create function public.school_public_content_prepare_v1()
returns trigger language plpgsql security invoker set search_path = public, pg_temp as $$
begin
  if tg_op = 'UPDATE' then
    if new.id is distinct from old.id
       or new.school_slug is distinct from old.school_slug
       or new.author_id is distinct from old.author_id
       or new.publisher_kind is distinct from old.publisher_kind
       or new.content_kind is distinct from old.content_kind
       or new.created_at is distinct from old.created_at then
      raise exception 'immutable_school_publication_identity';
    end if;
    new.revision := old.revision + 1;
  else
    new.revision := 1;
  end if;
  new.updated_at := now();
  if tg_op = 'INSERT' then
    new.published_at := null;
    new.reviewed_by := null;
    new.reviewed_at := null;
  else
    new.published_at := old.published_at;
    new.reviewed_by := old.reviewed_by;
    new.reviewed_at := old.reviewed_at;
  end if;
  if new.status = 'published' and (tg_op = 'INSERT' or old.status is distinct from 'published') then
    new.published_at := now();
    if new.content_kind = 'fees' then
      if not public.is_platform_owner() then raise exception 'fees_require_hq_verification'; end if;
      new.reviewed_by := auth.uid();
      new.reviewed_at := now();
    end if;
  elsif new.status = 'draft' then
    new.published_at := null;
  end if;
  return new;
end $$;
revoke all on function public.school_public_content_prepare_v1() from public, anon, authenticated;
create trigger school_public_content_prepare before insert or update on public.school_public_content
for each row execute function public.school_public_content_prepare_v1();

create function public.school_public_content_audit_v1()
returns trigger language plpgsql security definer set search_path = public, pg_temp as $$
begin
  insert into public.school_public_content_audit(content_id,school_slug,actor_id,action,revision,snapshot)
  values (new.id,new.school_slug,auth.uid(),tg_op,new.revision,to_jsonb(new));
  return new;
end $$;
revoke all on function public.school_public_content_audit_v1() from public, anon, authenticated;
create trigger school_public_content_audit after insert or update on public.school_public_content
for each row execute function public.school_public_content_audit_v1();

comment on table public.school_public_content is
 'Public school site posts and requirements. Private circulars remain in VibeConnect. Fee amounts require HQ evidence review.';
comment on table public.school_public_content_audit is
 'Append-only audit trail of school site content changes. Not publicly readable.';
