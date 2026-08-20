-- Forward repair for environments where the emergency-stop table was already applied.
-- This migration only tightens access; it does not invoke emergency stop or change runtime state.
alter table if exists public.hq_workforce_owner_control_events enable row level security;
alter table if exists public.hq_workforce_owner_control_events force row level security;
revoke all on table public.hq_workforce_owner_control_events from public,anon,authenticated,service_role;

revoke all on function public.hq_workforce_owner_emergency_stop(text) from public,anon,service_role;
grant execute on function public.hq_workforce_owner_emergency_stop(text) to authenticated;

do $$
begin
  if has_table_privilege('anon','public.hq_workforce_owner_control_events','SELECT')
     or has_table_privilege('anon','public.hq_workforce_owner_control_events','INSERT')
     or has_table_privilege('anon','public.hq_workforce_owner_control_events','UPDATE')
     or has_table_privilege('anon','public.hq_workforce_owner_control_events','DELETE')
     or has_table_privilege('authenticated','public.hq_workforce_owner_control_events','SELECT')
     or has_table_privilege('authenticated','public.hq_workforce_owner_control_events','INSERT')
     or has_table_privilege('authenticated','public.hq_workforce_owner_control_events','UPDATE')
     or has_table_privilege('authenticated','public.hq_workforce_owner_control_events','DELETE')
     or has_table_privilege('service_role','public.hq_workforce_owner_control_events','SELECT')
     or has_table_privilege('service_role','public.hq_workforce_owner_control_events','INSERT')
     or has_table_privilege('service_role','public.hq_workforce_owner_control_events','UPDATE')
     or has_table_privilege('service_role','public.hq_workforce_owner_control_events','DELETE') then
    raise exception 'hq_workforce_owner_control_events direct access contract violated';
  end if;
  if has_function_privilege('anon','public.hq_workforce_owner_emergency_stop(text)','EXECUTE')
     or has_function_privilege('service_role','public.hq_workforce_owner_emergency_stop(text)','EXECUTE')
     or not has_function_privilege('authenticated','public.hq_workforce_owner_emergency_stop(text)','EXECUTE') then
    raise exception 'hq_workforce_owner_emergency_stop execute contract violated';
  end if;
end $$;
