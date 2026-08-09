-- HQ Company Library private storage.
-- Mirrors the production storage migration history.

insert into storage.buckets (id, name, public)
values ('hq-company-library', 'hq-company-library', false)
on conflict (id) do update set public = false;

drop policy if exists "hq owners read company library objects" on storage.objects;
drop policy if exists "hq owners upload company library objects" on storage.objects;
drop policy if exists "hq owners update company library objects" on storage.objects;
drop policy if exists "hq owners delete company library objects" on storage.objects;

create policy "hq owners read company library objects" on storage.objects
for select to authenticated using (
  bucket_id = 'hq-company-library'
  and exists (select 1 from public.platform_owners po where po.profile_id = (select auth.uid()))
);

create policy "hq owners upload company library objects" on storage.objects
for insert to authenticated with check (
  bucket_id = 'hq-company-library'
  and exists (select 1 from public.platform_owners po where po.profile_id = (select auth.uid()))
);

create policy "hq owners update company library objects" on storage.objects
for update to authenticated using (
  bucket_id = 'hq-company-library'
  and exists (select 1 from public.platform_owners po where po.profile_id = (select auth.uid()))
) with check (
  bucket_id = 'hq-company-library'
  and exists (select 1 from public.platform_owners po where po.profile_id = (select auth.uid()))
);

create policy "hq owners delete company library objects" on storage.objects
for delete to authenticated using (
  bucket_id = 'hq-company-library'
  and exists (select 1 from public.platform_owners po where po.profile_id = (select auth.uid()))
);
