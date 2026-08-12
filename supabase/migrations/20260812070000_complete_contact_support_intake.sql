begin;

create table if not exists public.contact_requests (
  id uuid primary key default gen_random_uuid(),
  requester_id uuid not null references auth.users(id) on delete cascade,
  school_id uuid null,
  category text not null check (category in ('account','school_access','student_access','technical','privacy','legal','other')),
  subject text not null check (char_length(btrim(subject)) between 3 and 160),
  message text not null check (char_length(btrim(message)) between 10 and 5000),
  status text not null default 'open' check (status in ('open','in_progress','resolved','closed')),
  priority text not null default 'normal' check (priority in ('low','normal','high','urgent')),
  assigned_to uuid null references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  resolved_at timestamptz null
);

create index if not exists contact_requests_requester_idx on public.contact_requests(requester_id, created_at desc);
create index if not exists contact_requests_status_idx on public.contact_requests(status, priority, created_at desc);
create index if not exists contact_requests_school_idx on public.contact_requests(school_id, created_at desc);

alter table public.contact_requests enable row level security;
alter table public.contact_requests force row level security;

drop policy if exists contact_requests_insert_own on public.contact_requests;
create policy contact_requests_insert_own on public.contact_requests for insert to authenticated with check (requester_id = auth.uid());

drop policy if exists contact_requests_select_own_or_owner on public.contact_requests;
create policy contact_requests_select_own_or_owner on public.contact_requests for select to authenticated using (requester_id = auth.uid() or is_platform_owner());

drop policy if exists contact_requests_update_owner_only on public.contact_requests;
create policy contact_requests_update_owner_only on public.contact_requests for update to authenticated using (is_platform_owner()) with check (is_platform_owner());

commit;
