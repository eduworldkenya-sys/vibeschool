begin;

-- Wallets were created with a 3-credit welcome balance by the teacher-wallet
-- trigger, but the corresponding ledger event was missing. Record that grant
-- explicitly so the wallet and immutable ledger have one source-consistent view.
create unique index if not exists uq_credit_initial_grant
  on public.vibe_credit_transactions(teacher_id, feature, type)
  where feature = 'system_welcome_grant' and type = 'earn';

insert into public.vibe_credit_transactions(
  teacher_id, type, feature, amount, balance_after, notes
)
select
  w.teacher_id,
  'earn',
  'system_welcome_grant',
  3,
  3,
  'Reconciled initial teacher wallet grant'
from public.vibe_credits w
left join (
  select teacher_id, coalesce(sum(amount),0) ledger_balance
  from public.vibe_credit_transactions
  group by teacher_id
) l on l.teacher_id = w.teacher_id
where w.balance - coalesce(l.ledger_balance,0) = 3
on conflict (teacher_id, feature, type) where feature='system_welcome_grant' and type='earn' do nothing;

-- One historical corrective-grant record (+5 credits) was present in the
-- ledger but had not been applied to the wallet. Bring the wallet to the
-- ledger-authoritative balance for that exact corrective event.
update public.vibe_credits
set balance = balance + 5,
    total_earned = total_earned + 5,
    updated_at = now()
where teacher_id = 'ef8fc119-2492-4b22-bc05-d86c6d4f6039'
  and balance = 1
  and total_earned = 3
  and total_spent = 2
  and exists (
    select 1 from public.vibe_credit_transactions t
    where t.teacher_id = public.vibe_credits.teacher_id
      and t.type = 'earn'
      and t.amount = 5
      and t.notes = 'Corrective grant — credits earned before wallet migration'
  );

create or replace function public.handle_new_teacher_wallet()
returns trigger
language plpgsql
security definer
set search_path = public, extensions, pg_temp
as $function$
begin
  if new.role in ('teacher','class_teacher','subject_teacher','head_teacher') then
    insert into public.vibe_credits(teacher_id,balance,total_earned,total_spent)
    values(new.id,3,3,0)
    on conflict(teacher_id) do nothing;

    insert into public.vibe_credit_transactions(
      teacher_id,type,feature,amount,balance_after,notes
    ) values (
      new.id,'earn','system_welcome_grant',3,3,'Initial teacher wallet grant'
    ) on conflict (teacher_id,feature,type) where feature='system_welcome_grant' and type='earn' do nothing;
  end if;
  return new;
end;
$function$;

alter function public.handle_new_teacher_wallet() set search_path = public, extensions, pg_temp;

commit;
