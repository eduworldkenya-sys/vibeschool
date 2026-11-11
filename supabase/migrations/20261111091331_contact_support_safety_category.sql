-- Canonical contact support: allow safeguarding category through the existing
-- authenticated support-request RPC and HQ case ledger.
-- No new anonymous access, users, tables or data visibility is introduced.

alter table public.contact_requests
  drop constraint if exists contact_requests_category_check;

alter table public.contact_requests
  add constraint contact_requests_category_check
  check (category = any(array[
    'account','school_access','student_access','technical',
    'privacy','legal','safety','other'
  ]::text[]));

create or replace function public.submit_contact_request(
  p_category text, p_subject text, p_message text
)
returns uuid
language plpgsql
security definer
set search_path to 'public', 'pg_temp'
as $function$
declare
  v_uid uuid := auth.uid();
  v_request uuid;
  v_case uuid;
  v_severity text;
begin
  if v_uid is null then raise exception 'Authentication required'; end if;
  if p_category not in (
    'account','school_access','student_access','technical',
    'privacy','legal','safety','other'
  ) then raise exception 'Invalid category'; end if;
  if char_length(btrim(p_subject)) not between 3 and 160 then raise exception 'Invalid subject'; end if;
  if char_length(btrim(p_message)) not between 10 and 5000 then raise exception 'Invalid message'; end if;

  -- Safeguarding concerns are placed in the existing high-priority lane.
  -- This is an internal triage classification, not an emergency-service promise.
  v_severity := case
    when p_category in ('privacy','legal','safety') then 'high'
    when p_category in ('account','technical','school_access','student_access') then 'normal'
    else 'low'
  end;

  insert into public.contact_requests(requester_id, category, subject, message, priority)
  values(v_uid, p_category, btrim(p_subject), btrim(p_message), v_severity)
  returning id into v_request;

  insert into public.hq_support_cases(
    source, requester_id, category, severity, status, title, description,
    resolution_evidence, created_at, updated_at, sla_due_at
  )
  values(
    'contact', v_uid, p_category, v_severity, 'open',
    btrim(p_subject), btrim(p_message),
    jsonb_build_object('contact_request_id', v_request),
    now(), now(), now() + case v_severity
      when 'high' then interval '4 hours'
      when 'normal' then interval '24 hours'
      else interval '72 hours'
    end
  )
  returning id into v_case;

  return v_case;
end;
$function$;
