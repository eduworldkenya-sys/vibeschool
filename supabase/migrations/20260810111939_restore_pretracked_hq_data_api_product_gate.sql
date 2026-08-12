-- L0 replay prerequisite restored from the repository's authoritative later definition.
-- The current history grants EXECUTE to this pre-request hook before its DDL appears.
create or replace function public.hq_data_api_product_gate()
returns void
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_uid uuid := auth.uid();
  v_profile_role text;
  v_product_key text;
  v_policy_key text;
  v_request_path text := coalesce(nullif(current_setting('request.path', true), ''), '');
  v_registry public.hq_policy_registry%rowtype;
  v_config public.hq_product_configs%rowtype;
  v_enabled boolean;
  v_candidate jsonb;
begin
  if v_uid is null then return; end if;
  if public.is_platform_owner() then return; end if;
  if v_request_path in ('/rpc/product_access_state', '/rpc/student_twin_policy_state') then return; end if;

  select p.role into v_profile_role from public.profiles p where p.id = v_uid;
  v_product_key := case v_profile_role when 'student' then 'student' when 'teacher' then 'teacher' when 'parent' then 'parent' when 'admin' then 'school_admin' else null end;
  if v_product_key is null then return; end if;
  v_policy_key := case v_product_key when 'student' then 'student.enabled' when 'teacher' then 'teacher.enabled' when 'parent' then 'parent.enabled' when 'admin' then 'school_admin.enabled' end;

  select pr.* into v_registry from public.hq_policy_registry pr where pr.policy_key = v_policy_key and pr.active;
  if not found then
    raise sqlstate 'PGRST' using message = json_build_object('code','HQ_POLICY_UNAVAILABLE','message','Product policy unavailable','details',v_product_key,'hint','Contact VibeSchool support')::text,
      detail = json_build_object('status',503,'status_text','Service Unavailable')::text;
  end if;

  select pc.* into v_config from public.hq_product_configs pc where pc.product_key = v_product_key and pc.config_key = v_policy_key and pc.active and pc.effective_at <= now() order by pc.updated_at desc limit 1;
  v_candidate := case when found then v_config.config_value else v_registry.default_value end;
  if jsonb_typeof(v_candidate) <> 'boolean' then v_enabled := case when v_registry.failure_mode = 'fail_open' then true else false end;
  else v_enabled := (v_candidate #>> '{}')::boolean; end if;
  if not v_enabled then
    raise sqlstate 'PGRST' using message = json_build_object('code','HQ_PRODUCT_DISABLED','message','This VibeSchool product is temporarily unavailable','details',v_product_key,'hint','Use product_access_state for current policy status')::text,
      detail = json_build_object('status',503,'status_text','Service Unavailable')::text;
  end if;
end
$function$;
