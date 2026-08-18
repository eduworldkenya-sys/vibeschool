-- Parent Command Center R1: governed parent inbox + fee truth boundary.
-- authorization-test: public.parent_events
-- authorization-test: public.finance_parent_payment_claims
--
-- This migration deliberately keeps parent event production server-side,
-- preserves parent-submitted payment evidence separately from authoritative
-- school fee payments, and exposes only parent-owned read/ack mutations.

create table if not exists public.parent_events (
  id uuid primary key default gen_random_uuid(),
  parent_id uuid not null references public.profiles(id) on delete cascade,
  student_id uuid null references public.students(id) on delete cascade,
  school_id uuid null references public.schools(id) on delete cascade,
  category text not null check (category in (
    'attendance', 'homework', 'assessment', 'report', 'teacher_message',
    'school_notice', 'finance', 'learning', 'system'
  )),
  severity text not null default 'info' check (severity in ('info', 'success', 'warning', 'urgent')),
  title text not null,
  body text null,
  source_type text not null,
  source_id uuid null,
  dedupe_key text not null,
  action_href text null,
  metadata jsonb not null default '{}'::jsonb,
  occurred_at timestamptz not null default now(),
  delivered_at timestamptz not null default now(),
  read_at timestamptz null,
  acknowledged_at timestamptz null,
  created_at timestamptz not null default now(),
  unique (parent_id, dedupe_key)
);

create index if not exists parent_events_parent_created_idx
  on public.parent_events(parent_id, created_at desc);
create index if not exists parent_events_parent_unread_idx
  on public.parent_events(parent_id, created_at desc)
  where read_at is null;
create index if not exists parent_events_student_created_idx
  on public.parent_events(student_id, created_at desc)
  where student_id is not null;

alter table public.parent_events enable row level security;

revoke all on table public.parent_events from anon;
revoke all on table public.parent_events from authenticated;
grant select on table public.parent_events to authenticated;
grant update (read_at, acknowledged_at) on table public.parent_events to authenticated;
grant all on table public.parent_events to service_role;

drop policy if exists parent_events_parent_select on public.parent_events;
create policy parent_events_parent_select
  on public.parent_events
  for select
  to authenticated
  using ((select auth.uid()) = parent_id);

drop policy if exists parent_events_parent_update_receipt on public.parent_events;
create policy parent_events_parent_update_receipt
  on public.parent_events
  for update
  to authenticated
  using ((select auth.uid()) = parent_id)
  with check ((select auth.uid()) = parent_id);

comment on table public.parent_events is
  'Canonical in-app family event stream. Source systems emit governed, idempotent events; parents can only read and mark their own events read/acknowledged.';

create or replace function private.parent_event_emit(
  p_parent_id uuid,
  p_student_id uuid,
  p_school_id uuid,
  p_category text,
  p_severity text,
  p_title text,
  p_body text,
  p_source_type text,
  p_source_id uuid,
  p_dedupe_key text,
  p_action_href text,
  p_metadata jsonb,
  p_occurred_at timestamptz
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if p_parent_id is null or p_dedupe_key is null or p_title is null then
    return;
  end if;

  insert into public.parent_events (
    parent_id, student_id, school_id, category, severity, title, body,
    source_type, source_id, dedupe_key, action_href, metadata, occurred_at
  ) values (
    p_parent_id,
    p_student_id,
    p_school_id,
    case when p_category in ('attendance','homework','assessment','report','teacher_message','school_notice','finance','learning','system') then p_category else 'system' end,
    case when p_severity in ('info','success','warning','urgent') then p_severity else 'info' end,
    p_title,
    p_body,
    p_source_type,
    p_source_id,
    p_dedupe_key,
    p_action_href,
    coalesce(p_metadata, '{}'::jsonb),
    coalesce(p_occurred_at, now())
  )
  on conflict (parent_id, dedupe_key) do update
    set title = excluded.title,
        body = excluded.body,
        severity = excluded.severity,
        action_href = excluded.action_href,
        metadata = excluded.metadata,
        occurred_at = excluded.occurred_at;
end;
$$;

revoke all on function private.parent_event_emit(uuid,uuid,uuid,text,text,text,text,text,uuid,text,text,jsonb,timestamptz) from public;
revoke all on function private.parent_event_emit(uuid,uuid,uuid,text,text,text,text,text,uuid,text,text,jsonb,timestamptz) from anon;
revoke all on function private.parent_event_emit(uuid,uuid,uuid,text,text,text,text,text,uuid,text,text,jsonb,timestamptz) from authenticated;

-- Attendance exceptions: absence/late are attention events; normal presence stays
-- visible on the dashboard read model without creating notification noise.
create or replace function private.parent_event_from_attendance()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_parent record;
  v_severity text;
  v_title text;
begin
  if new.student_id is null or new.school_id is null then return new; end if;
  if not (new.status::text = 'absent' or new.status::text = 'late' or coalesce(new.is_late, false)) then return new; end if;

  v_severity := case when new.status::text = 'absent' then 'urgent' else 'warning' end;
  v_title := case when new.status::text = 'absent' then 'Absent from school' else 'Late arrival recorded' end;

  for v_parent in
    select psl.parent_id
    from public.parent_student_links psl
    where psl.student_id = new.student_id
      and coalesce(psl.access_level, 'full') <> 'none'
  loop
    perform private.parent_event_emit(
      v_parent.parent_id, new.student_id, new.school_id, 'attendance', v_severity,
      v_title,
      'Attendance was recorded as ' || case when coalesce(new.is_late,false) then 'late' else new.status::text end || ' for ' || new.date::text || '.',
      'attendance', new.id,
      'attendance:' || new.id::text || ':' || new.status::text || ':' || coalesce(new.is_late,false)::text,
      '/parent/child/' || new.student_id::text,
      jsonb_build_object('date', new.date, 'status', new.status::text, 'is_late', coalesce(new.is_late,false), 'alerts_enabled', coalesce((select psl2.receives_alerts from public.parent_student_links psl2 where psl2.parent_id=v_parent.parent_id and psl2.student_id=new.student_id limit 1), true)),
      coalesce(new.marked_at, now())
    );
  end loop;
  return new;
end;
$$;

-- Homework assignment: emit once per linked learner in the target class.
create or replace function private.parent_event_from_homework()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_rec record;
begin
  if new.class_id is null then return new; end if;
  for v_rec in
    select s.id as student_id, psl.parent_id, coalesce(new.school_id, c.school_id) as school_id
    from public.students s
    join public.classes c on c.id = s.class_id
    join public.parent_student_links psl on psl.student_id = s.id
    where s.class_id = new.class_id
      and coalesce(psl.access_level, 'full') <> 'none'
  loop
    perform private.parent_event_emit(
      v_rec.parent_id, v_rec.student_id, v_rec.school_id, 'homework', 'info',
      'New homework: ' || coalesce(new.title, 'Class task'),
      coalesce(new.subject, 'Classwork') || case when new.due_date is not null then ' · due ' || new.due_date::text else '' end,
      'homework', new.id,
      'homework:' || new.id::text || ':' || v_rec.student_id::text,
      '/parent/child/' || v_rec.student_id::text,
      jsonb_build_object('due_date', new.due_date, 'subject', new.subject),
      coalesce(new.created_at, now())
    );
  end loop;
  return new;
end;
$$;

-- Published report cards only; drafts/provisional states fail closed.
create or replace function private.parent_event_from_report_card()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_parent record;
begin
  if new.student_id is null or new.published_at is null then return new; end if;
  if tg_op = 'UPDATE' and old.published_at is not null and old.published_at = new.published_at then return new; end if;

  for v_parent in
    select psl.parent_id
    from public.parent_student_links psl
    where psl.student_id = new.student_id
      and coalesce(psl.access_level, 'full') <> 'none'
  loop
    perform private.parent_event_emit(
      v_parent.parent_id, new.student_id, new.school_id, 'report', 'success',
      'Report card published',
      'A new official report card is ready to view.',
      'report_cards', new.id,
      'report:' || new.id::text || ':' || new.published_at::text,
      '/parent/report-cards?studentId=' || new.student_id::text,
      jsonb_build_object('academic_year', new.academic_year, 'status', new.status),
      new.published_at
    );
  end loop;
  return new;
end;
$$;

-- Generated/teacher parent messages are delivered only once they have sent_at.
create or replace function private.parent_event_from_parent_message()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_parent record;
begin
  if new.student_id is null or new.sent_at is null then return new; end if;
  for v_parent in
    select psl.parent_id
    from public.parent_student_links psl
    where psl.student_id = new.student_id
      and coalesce(psl.access_level, 'full') <> 'none'
  loop
    perform private.parent_event_emit(
      v_parent.parent_id, new.student_id, new.school_id, 'teacher_message', 'info',
      coalesce(nullif(new.subject,''), 'Teacher update'),
      left(coalesce(new.body,''), 240),
      'parent_messages', new.id,
      'parent-message:' || new.id::text,
      '/parent/child/' || new.student_id::text || '/messages',
      jsonb_build_object('channel', new.channel, 'delivery_purpose', new.delivery_purpose, 'teacher_id', new.teacher_id),
      new.sent_at
    );
  end loop;
  return new;
end;
$$;

-- Explicit circular recipient delivery becomes a unified inbox event too.
create or replace function private.parent_event_from_circular_recipient()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_circular record;
  v_role text;
begin
  if new.profile_id is null then return new; end if;
  select p.role into v_role from public.profiles p where p.id = new.profile_id;
  if v_role <> 'parent' then return new; end if;

  select c.* into v_circular from public.vc_circulars c where c.id = new.circular_id;
  if v_circular.id is null or v_circular.sent_at is null then return new; end if;

  perform private.parent_event_emit(
    new.profile_id, null, v_circular.school_id, 'school_notice',
    case when coalesce(v_circular.requires_ack,false) then 'warning' else 'info' end,
    coalesce(v_circular.title, 'School notice'),
    left(coalesce(v_circular.body,''), 240),
    'vc_circulars', v_circular.id,
    'circular:' || v_circular.id::text || ':' || new.profile_id::text,
    '/parent/messages',
    jsonb_build_object('requires_ack', coalesce(v_circular.requires_ack,false), 'ack_deadline', v_circular.ack_deadline),
    v_circular.sent_at
  );
  return new;
end;
$$;

-- Fee structure publication/update: notify every linked finance-authorized parent.
create or replace function private.parent_event_from_fee_structure()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_rec record;
begin
  if new.class_id is null or new.school_id is null or new.deleted_at is not null then return new; end if;
  for v_rec in
    select s.id as student_id, psl.parent_id
    from public.students s
    join public.parent_student_links psl on psl.student_id = s.id
    where s.class_id = new.class_id
      and coalesce(psl.can_view_finance,false)
      and coalesce(psl.access_level,'full') <> 'none'
  loop
    perform private.parent_event_emit(
      v_rec.parent_id, v_rec.student_id, new.school_id, 'finance', 'warning',
      'School fees updated',
      coalesce(new.label, 'Fee structure') || ': ' || coalesce(new.currency,'KES') || ' ' || new.amount::text,
      'finance_fee_structures', new.id,
      'fee-structure:' || new.id::text || ':' || coalesce(new.updated_at,new.created_at,now())::text,
      '/parent/child/' || v_rec.student_id::text || '/finance',
      jsonb_build_object('amount', new.amount, 'currency', new.currency, 'term', new.term, 'year', new.year),
      coalesce(new.updated_at,new.created_at,now())
    );
  end loop;
  return new;
end;
$$;

-- School-confirmed payment receipt event. Legacy/unscoped parent-entered rows are
-- excluded because school_id is required for a trustworthy finance event.
create or replace function private.parent_event_from_fee_payment()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_parent record;
begin
  if new.student_id is null or new.school_id is null or new.deleted_at is not null then return new; end if;
  for v_parent in
    select psl.parent_id
    from public.parent_student_links psl
    where psl.student_id = new.student_id
      and psl.school_id = new.school_id
      and coalesce(psl.can_view_finance,false)
      and coalesce(psl.access_level,'full') <> 'none'
  loop
    perform private.parent_event_emit(
      v_parent.parent_id, new.student_id, new.school_id, 'finance', 'success',
      'Fee payment recorded',
      coalesce(new.currency,'KES') || ' ' || new.amount::text || ' was recorded by the school.',
      'finance_fee_payments', new.id,
      'fee-payment:' || new.id::text,
      '/parent/child/' || new.student_id::text || '/finance',
      jsonb_build_object('amount', new.amount, 'currency', new.currency, 'reference', new.reference, 'recorded_at', new.recorded_at),
      coalesce(new.created_at, now())
    );
  end loop;
  return new;
end;
$$;

revoke all on function private.parent_event_from_attendance() from public, anon, authenticated;
revoke all on function private.parent_event_from_homework() from public, anon, authenticated;
revoke all on function private.parent_event_from_report_card() from public, anon, authenticated;
revoke all on function private.parent_event_from_parent_message() from public, anon, authenticated;
revoke all on function private.parent_event_from_circular_recipient() from public, anon, authenticated;
revoke all on function private.parent_event_from_fee_structure() from public, anon, authenticated;
revoke all on function private.parent_event_from_fee_payment() from public, anon, authenticated;

drop trigger if exists trg_parent_event_attendance on public.attendance;
create trigger trg_parent_event_attendance
after insert or update of status, is_late on public.attendance
for each row execute function private.parent_event_from_attendance();

drop trigger if exists trg_parent_event_homework on public.homework;
create trigger trg_parent_event_homework
after insert on public.homework
for each row execute function private.parent_event_from_homework();

drop trigger if exists trg_parent_event_report_card on public.report_cards;
create trigger trg_parent_event_report_card
after insert or update of published_at on public.report_cards
for each row execute function private.parent_event_from_report_card();

drop trigger if exists trg_parent_event_parent_message on public.parent_messages;
create trigger trg_parent_event_parent_message
after insert or update of sent_at on public.parent_messages
for each row execute function private.parent_event_from_parent_message();

drop trigger if exists trg_parent_event_circular_recipient on public.vc_circular_recipients;
create trigger trg_parent_event_circular_recipient
after insert or update of delivered_at on public.vc_circular_recipients
for each row execute function private.parent_event_from_circular_recipient();

drop trigger if exists trg_parent_event_fee_structure on public.finance_fee_structures;
create trigger trg_parent_event_fee_structure
after insert or update of amount, label, term, year, deleted_at on public.finance_fee_structures
for each row execute function private.parent_event_from_fee_structure();

drop trigger if exists trg_parent_event_fee_payment on public.finance_fee_payments;
create trigger trg_parent_event_fee_payment
after insert on public.finance_fee_payments
for each row execute function private.parent_event_from_fee_payment();

-- Parent payment claims: evidence submitted by a guardian is not an official
-- school ledger entry until school finance/admin verifies it.
create table if not exists public.finance_parent_payment_claims (
  id uuid primary key default gen_random_uuid(),
  parent_id uuid not null references public.profiles(id) on delete cascade,
  student_id uuid not null references public.students(id) on delete cascade,
  school_id uuid null references public.schools(id) on delete cascade,
  amount numeric not null check (amount > 0),
  currency text not null default 'KES',
  method text null,
  reference text null,
  evidence_url text null,
  notes text null,
  payment_date date null,
  status text not null default 'pending' check (status in ('pending','confirmed','rejected','needs_school_review','cancelled')),
  reviewed_by uuid null references public.profiles(id) on delete set null,
  reviewed_at timestamptz null,
  linked_payment_id uuid null references public.finance_fee_payments(id) on delete set null,
  legacy_payment_id uuid null unique,
  submitted_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists finance_parent_payment_claims_parent_idx
  on public.finance_parent_payment_claims(parent_id, submitted_at desc);
create index if not exists finance_parent_payment_claims_school_idx
  on public.finance_parent_payment_claims(school_id, status, submitted_at desc);

alter table public.finance_parent_payment_claims enable row level security;
revoke all on table public.finance_parent_payment_claims from anon;
revoke all on table public.finance_parent_payment_claims from authenticated;
grant select, insert, update on table public.finance_parent_payment_claims to authenticated;
grant all on table public.finance_parent_payment_claims to service_role;

drop policy if exists finance_parent_claims_parent_select on public.finance_parent_payment_claims;
create policy finance_parent_claims_parent_select
  on public.finance_parent_payment_claims
  for select to authenticated
  using ((select auth.uid()) = parent_id);

drop policy if exists finance_parent_claims_parent_insert on public.finance_parent_payment_claims;
create policy finance_parent_claims_parent_insert
  on public.finance_parent_payment_claims
  for insert to authenticated
  with check (
    (select auth.uid()) = parent_id
    and school_id is not null
    and exists (
      select 1 from public.parent_student_links psl
      where psl.parent_id = (select auth.uid())
        and psl.student_id = finance_parent_payment_claims.student_id
        and psl.school_id = finance_parent_payment_claims.school_id
        and coalesce(psl.can_view_finance,false)
        and coalesce(psl.access_level,'full') <> 'none'
    )
    and status = 'pending'
    and reviewed_by is null
    and reviewed_at is null
    and linked_payment_id is null
  );

drop policy if exists finance_parent_claims_admin on public.finance_parent_payment_claims;
create policy finance_parent_claims_admin
  on public.finance_parent_payment_claims
  for all to authenticated
  using (school_id is not null and public.is_school_admin(school_id))
  with check (school_id is not null and public.is_school_admin(school_id));

comment on table public.finance_parent_payment_claims is
  'Guardian-submitted payment evidence. Never counted as school-confirmed paid fees until school/admin verification links it to finance_fee_payments.';

-- Convert unscoped legacy rows into non-authoritative claims before removing the
-- unsafe parent ledger insert policy. Rows without a resolvable school are
-- preserved as needs_school_review rather than silently treated as paid.
insert into public.finance_parent_payment_claims (
  parent_id, student_id, school_id, amount, currency, method, reference,
  evidence_url, notes, payment_date, status, legacy_payment_id, submitted_at
)
select
  f.parent_id,
  f.student_id,
  coalesce(f.school_id, c.school_id, psl.school_id),
  f.amount,
  coalesce(f.currency,'KES'),
  f.method,
  f.reference,
  f.receipt_url,
  f.notes,
  f.recorded_at,
  case when coalesce(f.school_id, c.school_id, psl.school_id) is null then 'needs_school_review' else 'pending' end,
  f.id,
  coalesce(f.created_at, now())
from public.finance_fee_payments f
left join public.students s on s.id = f.student_id
left join public.classes c on c.id = s.class_id
left join public.parent_student_links psl on psl.parent_id = f.parent_id and psl.student_id = f.student_id
where f.deleted_at is null
  and f.school_id is null
on conflict (legacy_payment_id) do nothing;

update public.finance_fee_payments
set deleted_at = coalesce(deleted_at, now())
where deleted_at is null
  and school_id is null;

-- Close authoritative ledger insertion to parents. School admins retain the
-- existing admin ALL policy. Parent visibility is child-link + finance permission,
-- not parent_id equality, so all official school-confirmed payments are visible
-- to every authorised guardian for the learner.
drop policy if exists finance_fee_payments_parent_insert on public.finance_fee_payments;
drop policy if exists finance_fee_payments_parent_select on public.finance_fee_payments;

create policy finance_fee_payments_parent_select
  on public.finance_fee_payments
  for select to authenticated
  using (
    deleted_at is null
    and school_id is not null
    and exists (
      select 1
      from public.parent_student_links psl
      where psl.parent_id = (select auth.uid())
        and psl.student_id = finance_fee_payments.student_id
        and psl.school_id = finance_fee_payments.school_id
        and coalesce(psl.can_view_finance,false)
        and coalesce(psl.access_level,'full') <> 'none'
    )
  );