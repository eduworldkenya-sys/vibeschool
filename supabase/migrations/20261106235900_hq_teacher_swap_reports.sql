-- Add swap reports to the existing HQ moderation page; protect all report data.
-- authorization-test: public.hq_teacher_swap_reports (anon denied; non-HQ authenticated denied; HQ owner sees private reports)
-- authorization-test: public.hq_decide_teacher_swap_report (anon denied; ordinary users denied; platform owner only; audited decision)
alter table public.teacher_swap_reports
 add column if not exists status text not null default 'open',
 add column if not exists review_note text,
 add column if not exists reviewed_at timestamptz,
 add column if not exists reviewed_by uuid references auth.users(id);
alter table public.teacher_swap_reports drop constraint if exists teacher_swap_reports_status_check;
alter table public.teacher_swap_reports add constraint teacher_swap_reports_status_check
 check(status in ('open','reviewed','dismissed'));
alter table public.teacher_swap_reports drop constraint if exists teacher_swap_reports_note_limit;
alter table public.teacher_swap_reports add constraint teacher_swap_reports_note_limit
 check(review_note is null or length(review_note)<=500);

create or replace function public.hq_teacher_swap_reports(p_limit integer default 100)
returns table(id uuid, listing_id uuid, reason text, details text, status text, created_at timestamptz, review_note text, reviewed_at timestamptz, current_county text, preferred_county text)
language plpgsql security definer set search_path='public' as $$
begin
 perform public.hq_assert_owner();
 return query
 select r.id,r.listing_id,r.reason,r.details,r.status,r.created_at,r.review_note,r.reviewed_at,
        l.current_county,l.preferred_county
 from public.teacher_swap_reports r
 left join public.teacher_swap_listings l on l.id=r.listing_id
 order by (case when r.status='open' then 0 else 1 end),r.created_at desc
 limit least(greatest(coalesce(p_limit,100),1),300);
end $$;
revoke all on function public.hq_teacher_swap_reports(integer) from public,anon,authenticated;
grant execute on function public.hq_teacher_swap_reports(integer) to authenticated;

create or replace function public.hq_decide_teacher_swap_report(p_id uuid,p_status text,p_note text default '')
returns void language plpgsql security definer set search_path='public' as $$
begin
 perform public.hq_assert_owner();
 if (select auth.uid()) is null or not coalesce(public.is_platform_owner(),false) then
   raise exception 'Owner moderation required' using errcode='42501';
 end if;
 if p_status not in ('reviewed','dismissed') or length(coalesce(p_note,''))>500 then
   raise exception 'Invalid moderation decision';
 end if;
 update public.teacher_swap_reports r
 set status=p_status,review_note=left(nullif(trim(p_note),''),500),
     reviewed_at=now(),reviewed_by=(select auth.uid())
 where r.id=p_id and r.status='open';
 if not found then raise exception 'Report is unavailable or already decided'; end if;
end $$;
revoke all on function public.hq_decide_teacher_swap_report(uuid,text,text) from public,anon,authenticated;
grant execute on function public.hq_decide_teacher_swap_report(uuid,text,text) to authenticated;
