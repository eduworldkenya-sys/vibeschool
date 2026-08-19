-- Task 3 / Task 2 reconstruction parity repair.
--
-- Production already contains public.fn_sanitise_row(jsonb), and the reconstructed
-- baseline's public.fn_audit_log() depends on it. The helper itself was never recovered
-- into repository migration truth, so clean reconstruction could succeed structurally
-- but normal audited onboarding failed at runtime.
--
-- This forward migration restores the exact production helper semantics without
-- disabling audit triggers or weakening authorization behavior.

create or replace function public.fn_sanitise_row(p_row jsonb)
returns jsonb
language sql
immutable
set search_path = public
as $function$
  select p_row
    - 'full_name'
    - 'phone'
    - 'date_of_birth'
    - 'parental_consent_by'
    - 'parental_consent_at';
$function$;

comment on function public.fn_sanitise_row(jsonb) is
  'Sanitises audit snapshots by removing direct profile PII before persistence.';
