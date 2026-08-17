begin;

-- Sensitive parent writes derive parent identity from auth.uid().
-- The browser may supply a child id, but never a parent id.

create or replace function public.parent_add_health_record(
  p_student_id uuid, p_type text, p_title text, p_description text default null,
  p_doctor_name text default null, p_outcome text default null, p_recorded_at date default current_date
)
returns uuid language plpgsql security invoker set search_path = public, pg_temp as $$
declare caller uuid := auth.uid(); new_id uuid;
begin
  if caller is null then raise exception 'Authentication required'; end if;
  if not exists (select 1 from public.parent_student_links where parent_id=caller and student_id=p_student_id and coalesce(access_level,'full') <> 'none') then raise exception 'Child access not authorized'; end if;
  insert into public.health_records (student_id,parent_id,type,title,description,doctor_name,outcome,recorded_at)
  values (p_student_id,caller,nullif(trim(p_type),''),nullif(trim(p_title),''),nullif(trim(p_description),''),nullif(trim(p_doctor_name),''),nullif(trim(p_outcome),''),p_recorded_at)
  returning id into new_id;
  return new_id;
end; $$;

create or replace function public.parent_add_health_vaccination(
  p_student_id uuid, p_name text, p_dose text default null, p_recorded_at date default null,
  p_next_due date default null, p_administered_by text default null
)
returns uuid language plpgsql security invoker set search_path = public, pg_temp as $$
declare caller uuid := auth.uid(); new_id uuid;
begin
  if caller is null then raise exception 'Authentication required'; end if;
  if not exists (select 1 from public.parent_student_links where parent_id=caller and student_id=p_student_id and coalesce(access_level,'full') <> 'none') then raise exception 'Child access not authorized'; end if;
  insert into public.health_vaccinations (student_id,parent_id,name,dose,recorded_at,next_due,administered_by)
  values (p_student_id,caller,nullif(trim(p_name),''),nullif(trim(p_dose),''),p_recorded_at,p_next_due,nullif(trim(p_administered_by),''))
  returning id into new_id;
  return new_id;
end; $$;

create or replace function public.parent_archive_health_record(p_record_id uuid)
returns boolean language plpgsql security invoker set search_path = public, pg_temp as $$
declare caller uuid := auth.uid(); affected integer;
begin
  if caller is null then raise exception 'Authentication required'; end if;
  update public.health_records hr set deleted_at=now()
   where hr.id=p_record_id
     and exists (select 1 from public.parent_student_links psl where psl.parent_id=caller and psl.student_id=hr.student_id and coalesce(psl.access_level,'full') <> 'none');
  get diagnostics affected = row_count;
  return affected > 0;
end; $$;

create or replace function public.parent_archive_health_vaccination(p_vaccination_id uuid)
returns boolean language plpgsql security invoker set search_path = public, pg_temp as $$
declare caller uuid := auth.uid(); affected integer;
begin
  if caller is null then raise exception 'Authentication required'; end if;
  update public.health_vaccinations hv set deleted_at=now()
   where hv.id=p_vaccination_id
     and exists (select 1 from public.parent_student_links psl where psl.parent_id=caller and psl.student_id=hv.student_id and coalesce(psl.access_level,'full') <> 'none');
  get diagnostics affected = row_count;
  return affected > 0;
end; $$;

create or replace function public.parent_add_fee_payment(
  p_student_id uuid, p_amount numeric, p_method text default null, p_reference text default null,
  p_term text default null, p_year integer default null, p_notes text default null, p_recorded_at date default current_date
)
returns uuid language plpgsql security invoker set search_path = public, pg_temp as $$
declare caller uuid := auth.uid(); new_id uuid;
begin
  if caller is null then raise exception 'Authentication required'; end if;
  if not exists (select 1 from public.parent_student_links where parent_id=caller and student_id=p_student_id and coalesce(access_level,'full') <> 'none') then raise exception 'Child access not authorized'; end if;
  if p_amount is null or p_amount <= 0 then raise exception 'Amount must be greater than zero'; end if;
  insert into public.finance_fee_payments (student_id,parent_id,amount,method,reference,term,year,notes,recorded_at)
  values (p_student_id,caller,p_amount,nullif(trim(p_method),''),nullif(trim(p_reference),''),nullif(trim(p_term),''),p_year,nullif(trim(p_notes),''),p_recorded_at)
  returning id into new_id;
  return new_id;
end; $$;

create or replace function public.parent_add_pocket_money(
  p_student_id uuid, p_type text, p_amount numeric, p_description text default null, p_category text default null, p_recorded_at date default current_date
)
returns uuid language plpgsql security invoker set search_path = public, pg_temp as $$
declare caller uuid := auth.uid(); new_id uuid;
begin
  if caller is null then raise exception 'Authentication required'; end if;
  if not exists (select 1 from public.parent_student_links where parent_id=caller and student_id=p_student_id and coalesce(access_level,'full') <> 'none') then raise exception 'Child access not authorized'; end if;
  if p_amount is null or p_amount <= 0 then raise exception 'Amount must be greater than zero'; end if;
  insert into public.finance_pocket_money (student_id,parent_id,type,amount,description,category,recorded_at)
  values (p_student_id,caller,nullif(trim(p_type),''),p_amount,nullif(trim(p_description),''),nullif(trim(p_category),''),p_recorded_at)
  returning id into new_id;
  return new_id;
end; $$;

create or replace function public.parent_add_savings_goal(
  p_student_id uuid, p_title text, p_description text default null, p_target_amount numeric default 0, p_target_date date default null
)
returns uuid language plpgsql security invoker set search_path = public, pg_temp as $$
declare caller uuid := auth.uid(); new_id uuid;
begin
  if caller is null then raise exception 'Authentication required'; end if;
  if not exists (select 1 from public.parent_student_links where parent_id=caller and student_id=p_student_id and coalesce(access_level,'full') <> 'none') then raise exception 'Child access not authorized'; end if;
  if p_target_amount is null or p_target_amount <= 0 then raise exception 'Target amount must be greater than zero'; end if;
  insert into public.finance_savings_goals (student_id,parent_id,title,description,target_amount,saved_amount,status,target_date,recorded_at)
  values (p_student_id,caller,nullif(trim(p_title),''),nullif(trim(p_description),''),p_target_amount,0,'active',p_target_date,current_date)
  returning id into new_id;
  return new_id;
end; $$;

create or replace function public.parent_add_savings_contribution(
  p_student_id uuid, p_goal_id uuid, p_amount numeric, p_notes text default null, p_recorded_at date default current_date
)
returns uuid language plpgsql security invoker set search_path = public, pg_temp as $$
declare caller uuid := auth.uid(); new_id uuid; new_saved numeric; target numeric;
begin
  if caller is null then raise exception 'Authentication required'; end if;
  if not exists (select 1 from public.parent_student_links where parent_id=caller and student_id=p_student_id and coalesce(access_level,'full') <> 'none') then raise exception 'Child access not authorized'; end if;
  if p_amount is null or p_amount <= 0 then raise exception 'Amount must be greater than zero'; end if;
  select saved_amount,target_amount into new_saved,target from public.finance_savings_goals where id=p_goal_id and student_id=p_student_id and parent_id=caller and deleted_at is null for update;
  if not found then raise exception 'Savings goal not found'; end if;
  new_saved := coalesce(new_saved,0) + p_amount;
  insert into public.finance_savings_contributions (goal_id,student_id,parent_id,amount,notes,recorded_at)
  values (p_goal_id,p_student_id,caller,p_amount,nullif(trim(p_notes),''),p_recorded_at)
  returning id into new_id;
  update public.finance_savings_goals
     set saved_amount=new_saved,
         status=case when new_saved >= target then 'achieved' else 'active' end,
         achieved_at=case when new_saved >= target then coalesce(achieved_at,now()) else null end
   where id=p_goal_id and student_id=p_student_id and parent_id=caller;
  return new_id;
end; $$;

revoke all on function public.parent_add_health_record(uuid,text,text,text,text,text,date) from public,anon;
revoke all on function public.parent_add_health_vaccination(uuid,text,text,date,date,text) from public,anon;
revoke all on function public.parent_archive_health_record(uuid) from public,anon;
revoke all on function public.parent_archive_health_vaccination(uuid) from public,anon;
revoke all on function public.parent_add_fee_payment(uuid,numeric,text,text,text,integer,text,date) from public,anon;
revoke all on function public.parent_add_pocket_money(uuid,text,numeric,text,text,date) from public,anon;
revoke all on function public.parent_add_savings_goal(uuid,text,text,numeric,date) from public,anon;
revoke all on function public.parent_add_savings_contribution(uuid,uuid,numeric,text,date) from public,anon;

grant execute on function public.parent_add_health_record(uuid,text,text,text,text,text,date) to authenticated;
grant execute on function public.parent_add_health_vaccination(uuid,text,text,date,date,text) to authenticated;
grant execute on function public.parent_archive_health_record(uuid) to authenticated;
grant execute on function public.parent_archive_health_vaccination(uuid) to authenticated;
grant execute on function public.parent_add_fee_payment(uuid,numeric,text,text,text,integer,text,date) to authenticated;
grant execute on function public.parent_add_pocket_money(uuid,text,numeric,text,text,date) to authenticated;
grant execute on function public.parent_add_savings_goal(uuid,text,text,numeric,date) to authenticated;
grant execute on function public.parent_add_savings_contribution(uuid,uuid,numeric,text,date) to authenticated;

commit;
