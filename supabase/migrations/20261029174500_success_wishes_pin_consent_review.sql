-- PIN-based receivers can request withdrawal, but a request is never an authorization to revoke.
alter table public.success_wish_data_requests
  drop constraint if exists success_wish_data_requests_kind_check;
alter table public.success_wish_data_requests
  add constraint success_wish_data_requests_kind_check
  check (kind in ('deletion','access','consent_withdrawal'));
create unique index if not exists success_wish_one_active_consent_withdrawal
  on public.success_wish_data_requests(receiver_id)
  where kind='consent_withdrawal' and status in ('pending','reviewing');
