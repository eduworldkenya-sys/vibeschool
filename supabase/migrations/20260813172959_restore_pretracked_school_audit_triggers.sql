-- TBL-011 production-derived prerequisite reconstruction.
-- These trigger functions and bindings exist in the production catalog before
-- 20260813173000_pilot_readiness_security_identity_hardening_v1.sql, which
-- revokes their direct execution. Restore the canonical trigger-only behavior
-- so blank replay matches that historical prerequisite.

create or replace function public.audit_school_creation_event()
returns trigger
language plpgsql
security definer
set search_path = public, extensions, pg_temp
as $function$
begin
  insert into public.security_audit_events(
    actor_id,event_type,resource_type,resource_id,outcome,risk_score,metadata
  ) values(
    auth.uid(),
    'school.creation_attempt',
    'school',
    new.id,
    'created',
    40,
    jsonb_build_object(
      'name', left(coalesce(new.name,''),120),
      'county', new.county,
      'sub_county', new.sub_county,
      'source', new.directory_source
    )
  );
  return new;
end;
$function$;

create or replace function public.audit_school_discovery_request_event()
returns trigger
language plpgsql
security definer
set search_path = public, extensions, pg_temp
as $function$
begin
  insert into public.security_audit_events(
    actor_id,event_type,resource_type,resource_id,outcome,risk_score,metadata
  ) values(
    auth.uid(),
    'school.discovery_request',
    'school_discovery_request',
    new.id,
    'submitted',
    15,
    jsonb_build_object(
      'name_length', length(coalesce(new.name,'')),
      'county', new.county,
      'sub_county', new.sub_county,
      'level', new.level
    )
  );
  return new;
end;
$function$;

revoke all on function public.audit_school_creation_event() from public, anon, authenticated, service_role;
revoke all on function public.audit_school_discovery_request_event() from public, anon, authenticated, service_role;

drop trigger if exists trg_audit_school_creation on public.schools;
create trigger trg_audit_school_creation
after insert on public.schools
for each row execute function public.audit_school_creation_event();

drop trigger if exists trg_audit_school_discovery_request on public.school_discovery_requests;
create trigger trg_audit_school_discovery_request
after insert on public.school_discovery_requests
for each row execute function public.audit_school_discovery_request_event();
