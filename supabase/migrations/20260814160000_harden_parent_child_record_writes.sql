begin;

create or replace function public.guard_parent_child_record_write()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'parent') then
    if new.parent_id is distinct from auth.uid() then
      raise exception 'Parent identity mismatch';
    end if;
    if not exists (
      select 1 from public.parent_student_links psl
      where psl.parent_id = auth.uid()
        and psl.student_id = new.student_id
        and coalesce(psl.access_level, 'full') <> 'none'
    ) then
      raise exception 'Child access not authorized';
    end if;
  end if;
  return new;
end;
$$;

do $$
declare t text;
begin
 foreach t in array array[
   'child_autonomy_log','child_books','child_change_requests','child_events',
   'child_goals','child_growth','child_media','child_profiles','child_share_links',
   'child_skills','child_streaks','child_vibe_id','finance_fee_payments',
   'finance_pocket_money','finance_savings_contributions','finance_savings_goals',
   'funhub_exams','health_records','health_vaccinations'
 ] loop
   execute format('drop trigger if exists trg_guard_parent_child_write on public.%I', t);
   execute format('create trigger trg_guard_parent_child_write before insert or update on public.%I for each row execute function public.guard_parent_child_record_write()', t);
 end loop;
end $$;

commit;
