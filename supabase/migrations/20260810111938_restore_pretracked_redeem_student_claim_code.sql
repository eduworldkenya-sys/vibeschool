-- L0 replay prerequisite restored from the authoritative production catalog.
create or replace function public.redeem_student_claim_code(p_user_id uuid, p_code text)
returns jsonb
language plpgsql
security definer
set search_path to 'public','extensions','pg_temp'
as $function$
declare
  v_row public.student_claim_codes%rowtype;
begin
  select * into v_row
  from public.student_claim_codes
  where code = p_code
  for update;

  if not found then raise exception 'Claim code not found.'; end if;
  if v_row.claimed then raise exception 'Claim code has already been used.'; end if;
  if v_row.expires_at < now() then raise exception 'Claim code has expired.'; end if;

  update public.student_claim_codes
  set claimed = true,
      student_id = p_user_id
  where id = v_row.id;

  return jsonb_build_object('ok', true, 'code', p_code);
end;
$function$;
