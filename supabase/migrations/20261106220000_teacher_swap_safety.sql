-- Swap safety: per-listing block and private reports, no public user/contact exposure.
-- authorization-test: public.teacher_swap_reports (anon denied; only reporter may insert/read their own; reporter cannot modify/delete; target identity must belong to reported listing)
alter table public.teacher_swap_interests drop constraint if exists teacher_swap_interests_status_check;
alter table public.teacher_swap_interests add constraint teacher_swap_interests_status_check
  check(status in ('pending','accepted','declined','blocked'));
drop policy if exists "swap sender withdraw" on public.teacher_swap_interests;
create policy "swap sender withdraw" on public.teacher_swap_interests
 for delete to authenticated using(sender_id=(select auth.uid()) and status <> 'blocked');

create table if not exists public.teacher_swap_reports (
 id uuid primary key default gen_random_uuid(),
 reporter_id uuid not null references auth.users(id) on delete cascade,
 listing_id uuid not null references public.teacher_swap_listings(id) on delete cascade,
 target_teacher_id uuid not null references auth.users(id) on delete cascade,
 reason text not null check(reason in ('Misleading listing','Spam','Privacy concern','Other')),
 details text not null default '' check(length(details)<=500),
 created_at timestamptz not null default now(),
 constraint swap_one_report_per_listing unique(reporter_id,listing_id)
);
create index if not exists teacher_swap_reports_created_idx on public.teacher_swap_reports(created_at desc);
alter table public.teacher_swap_reports enable row level security;
revoke all on public.teacher_swap_reports from public,anon,authenticated;
grant select,insert on public.teacher_swap_reports to authenticated;
drop policy if exists "swap report author read" on public.teacher_swap_reports;
create policy "swap report author read" on public.teacher_swap_reports
 for select to authenticated using (reporter_id=(select auth.uid()));
drop policy if exists "swap report author submit" on public.teacher_swap_reports;
create policy "swap report author submit" on public.teacher_swap_reports
 for insert to authenticated with check (
 reporter_id=(select auth.uid()) and reporter_id<>target_teacher_id
 and exists(select 1 from public.teacher_swap_listings l
            where l.id=listing_id and l.teacher_id=target_teacher_id and l.status='published')
);
comment on table public.teacher_swap_reports is 'Private authenticated teacher swap reports; HQ/service-role moderation review only. No public report data.';
