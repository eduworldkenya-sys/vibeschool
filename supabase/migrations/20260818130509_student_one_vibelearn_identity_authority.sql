-- Student = 1 VibeLearn identity and gamification authority.
-- Durable learner identity is students.id. Client cannot mint arbitrary points.

drop policy if exists vibelearn_saved_owner on public.vibelearn_saved;
create policy vibelearn_saved_owner on public.vibelearn_saved
for all to authenticated
using (
  exists (select 1 from public.students s where s.id=vibelearn_saved.student_id and s.profile_id=(select auth.uid()) and s.deleted_at is null)
)
with check (
  exists (select 1 from public.students s where s.id=vibelearn_saved.student_id and s.profile_id=(select auth.uid()) and s.deleted_at is null)
);

drop policy if exists vibelearn_completed_read_own on public.vibelearn_completed;
create policy vibelearn_completed_read_own on public.vibelearn_completed
for select to authenticated
using (
  exists (select 1 from public.students s where s.id=vibelearn_completed.student_id and s.profile_id=(select auth.uid()) and s.deleted_at is null)
);

drop policy if exists vibelearn_completed_write_own on public.vibelearn_completed;
create policy vibelearn_completed_write_own on public.vibelearn_completed
for insert to authenticated
with check (
  exists (select 1 from public.students s where s.id=vibelearn_completed.student_id and s.profile_id=(select auth.uid()) and s.deleted_at is null)
);

create or replace function public.student_award_vibelearn_points(p_action text, p_content_id uuid default null)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_student_id uuid := public.current_student_id();
  v_points integer;
begin
  if auth.uid() is null then raise exception 'not_authenticated'; end if;
  if v_student_id is null then raise exception 'learner_identity_not_found'; end if;

  v_points := case p_action
    when 'complete_ebook' then 20
    when 'complete_epage' then 10
    when 'submit_content' then 15
    when 'content_viewed' then 2
    when 'daily_streak' then 25
    else null
  end;
  if v_points is null then raise exception 'invalid_vibelearn_action'; end if;

  if p_content_id is not null and not exists(select 1 from public.vibelearn_content c where c.id=p_content_id) then
    raise exception 'content_not_found';
  end if;

  insert into public.vibelearn_points(student_id,action,points,content_id)
  values(v_student_id,p_action,v_points,p_content_id);
end
$$;

create or replace function public.student_touch_vibelearn_streak()
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_student_id uuid := public.current_student_id();
  v_today date := (now() at time zone 'Africa/Nairobi')::date;
  v_yesterday date := ((now() at time zone 'Africa/Nairobi')::date - 1);
  v_row public.vibelearn_streaks%rowtype;
  v_new integer;
begin
  if auth.uid() is null then raise exception 'not_authenticated'; end if;
  if v_student_id is null then raise exception 'learner_identity_not_found'; end if;

  select * into v_row from public.vibelearn_streaks where student_id=v_student_id for update;
  if not found then
    insert into public.vibelearn_streaks(student_id,current_streak,longest_streak,last_active_date)
    values(v_student_id,1,1,v_today);
    perform public.student_award_vibelearn_points('daily_streak',null);
    return;
  end if;

  if v_row.last_active_date = v_today then return; end if;
  v_new := case when v_row.last_active_date = v_yesterday then coalesce(v_row.current_streak,0)+1 else 1 end;

  update public.vibelearn_streaks
  set current_streak=v_new,
      longest_streak=greatest(coalesce(longest_streak,0),v_new),
      last_active_date=v_today,
      updated_at=clock_timestamp()
  where student_id=v_student_id;

  perform public.student_award_vibelearn_points('daily_streak',null);
end
$$;

revoke all on function public.student_award_vibelearn_points(text,uuid) from public, anon;
revoke all on function public.student_touch_vibelearn_streak() from public, anon;
grant execute on function public.student_award_vibelearn_points(text,uuid) to authenticated;
grant execute on function public.student_touch_vibelearn_streak() to authenticated;

revoke insert, update, delete on public.vibelearn_points from anon, authenticated;
revoke insert, update, delete on public.vibelearn_streaks from anon, authenticated;

do $$
begin
  if exists(select 1 from pg_policies where schemaname='public' and tablename in ('vibelearn_saved','vibelearn_completed') and roles @> array['public']::name[]) then
    raise exception 'student_one_vibelearn_public_policy_postcondition_failed';
  end if;
  if has_table_privilege('authenticated','public.vibelearn_points','INSERT') or has_table_privilege('authenticated','public.vibelearn_streaks','INSERT') then
    raise exception 'student_one_vibelearn_direct_gamification_write_postcondition_failed';
  end if;
end
$$;
