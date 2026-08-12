begin;

create or replace function public.spend_credit(
  p_teacher_id uuid,
  p_feature text,
  p_amount integer,
  p_notes text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $function$
declare
  v_balance integer;
  v_new_balance integer;
begin
  if auth.uid() is null or auth.uid() <> p_teacher_id then raise exception 'unauthorized_identity'; end if;
  if p_amount is null or p_amount <= 0 then raise exception 'invalid_credit_amount'; end if;

  perform public.hq_assert_product_enabled('billing','billing.enabled');

  insert into public.vibe_credits(teacher_id,balance,total_earned,total_spent)
  values(p_teacher_id,0,0,0)
  on conflict(teacher_id) do nothing;

  select balance into v_balance
  from public.vibe_credits
  where teacher_id=p_teacher_id
  for update;

  if coalesce(v_balance,0) < p_amount then
    return jsonb_build_object('success',false,'error','insufficient_credits','balance',coalesce(v_balance,0));
  end if;

  v_new_balance := v_balance - p_amount;

  update public.vibe_credits
  set balance=v_new_balance,
      total_spent=total_spent+p_amount,
      updated_at=now()
  where teacher_id=p_teacher_id;

  insert into public.vibe_credit_transactions(
    teacher_id,type,feature,amount,balance_after,notes
  ) values(
    p_teacher_id,'spend',p_feature,-p_amount,v_new_balance,p_notes
  );

  return jsonb_build_object('success',true,'balance',v_new_balance);
end;
$function$;

revoke execute on function public.spend_credit(uuid,text,integer,text) from public,anon;
grant execute on function public.spend_credit(uuid,text,integer,text) to authenticated,service_role;
alter function public.spend_credit(uuid,text,integer,text) set search_path=public,pg_temp;

commit;
