-- authorization-test: public.library_book_copies scoped teacher/admin reads; stock mutations through RPC only; outsider/disabled/anon denied
-- authorization-test: public.library_inventory_events active school-admin reads; direct audit mutations denied
-- Initially scaffolded with Supabase CLI 2.113.0 on 2026-10-11; renumbered after merged PR #764 to maintain monotonic migration order. STAGED ONLY.
-- DO NOT db push until historical migration-version equivalence is reconciled.
-- Verified candidate: original path docs/engineering/class-life-library/canonical_library_copies_migration_candidate.sql
-- Apply ONLY after canonical_library_migration_candidate.sql.
-- All circulation remains on library_borrowings; never make a second loan ledger.

create table public.library_book_copies (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools(id),
  book_id uuid not null references public.library_books(id),
  copy_number integer not null check(copy_number>=1),
  accession_code text not null,
  state text not null default 'available'
    check(state in ('available','on_loan','repair','lost','retired')),
  last_condition text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(book_id,copy_number),
  unique(school_id,accession_code)
);
create index library_book_copies_available_idx on public.library_book_copies(book_id,copy_number)
  where state='available';
alter table public.library_book_copies enable row level security;
create policy library_copies_school_read
  on public.library_book_copies for select to authenticated
  using (
    exists(select 1 from public.profiles p where p.id=(select auth.uid()) and p.account_status::text='active' and not coalesce(p.is_anonymized,false))
    and public.is_operational_school_member(school_id)
    and (public.is_school_admin(school_id) or exists (
      select 1 from public.teacher_classes tc
      where tc.school_id=library_book_copies.school_id
        and tc.teacher_id=auth.uid()
        and public.teacher_can_access_class(tc.class_id,tc.subject_id,false)
    ))
  );
revoke all on public.library_book_copies from public,anon,authenticated;
grant select on public.library_book_copies to authenticated;
grant all on public.library_book_copies to service_role;

alter table public.library_borrowings
  add column copy_id uuid references public.library_book_copies(id);
create unique index library_active_copy_loan_idx
  on public.library_borrowings(copy_id)
  where returned_at is null and deleted_at is null and copy_id is not null;

-- Existing loans must be resolved into physical copies before activation.
do $guard$
begin
  if exists (
    select 1 from public.library_borrowings where deleted_at is null
  ) then
    raise exception 'physical_copy_backfill_requires_existing_loan_reconciliation';
  end if;
end $guard$;

-- Existing catalogue titles may be registered but not on loan.
insert into public.library_book_copies(school_id,book_id,copy_number,accession_code)
select b.school_id,b.id,n,
  'BK-'||replace(b.id::text,'-','')||'-'||lpad(n::text,4,'0')
from public.library_books b
cross join lateral generate_series(1,b.total_copies) n
where b.deleted_at is null and b.school_id is not null;

create or replace function public.library_seed_book_copies()
returns trigger language plpgsql security definer set search_path=public,pg_temp as $$
begin
  if new.school_id is null or new.total_copies is null or new.total_copies<1
      or new.available_copies is distinct from new.total_copies then
    raise exception 'library_new_book_stock_invalid';
  end if;
  insert into public.library_book_copies(school_id,book_id,copy_number,accession_code)
  select new.school_id,new.id,n,
    'BK-'||replace(new.id::text,'-','')||'-'||lpad(n::text,4,'0')
  from generate_series(1,new.total_copies) n;
  return new;
end $$;
create trigger library_book_auto_copies
after insert on public.library_books
for each row execute function public.library_seed_book_copies();

-- Atomic allocation is triggered only by the EXISTING ledger insertion.
-- The teacher/admin issue RPC owns the book counter decrement and the
-- resulting loan row insert in the same database transaction.
create or replace function public.library_assign_physical_copy()
returns trigger language plpgsql security definer set search_path=public,pg_temp as $$
declare v_copy_id uuid;
begin
  if new.copy_id is not null then
    raise exception 'copy_selection_must_be_server_authoritative';
  end if;
  select c.id into v_copy_id from public.library_book_copies c
  where c.book_id=new.book_id and c.school_id=new.school_id and c.state='available'
  order by c.copy_number for update skip locked limit 1;
  if v_copy_id is null then raise exception 'no_available_physical_copy'; end if;
  update public.library_book_copies
    set state='on_loan',last_condition=new.condition_out,updated_at=now()
  where id=v_copy_id;
  new.copy_id:=v_copy_id;
  return new;
end $$;
create trigger library_borrowing_allocate_copy
before insert on public.library_borrowings
for each row execute function public.library_assign_physical_copy();

create or replace function public.library_return_physical_copy()
returns trigger language plpgsql security definer set search_path=public,pg_temp as $$
declare v_state text;
begin
  if old.returned_at is null and new.returned_at is not null then
    if old.copy_id is null then raise exception 'borrowing_copy_missing'; end if;
    v_state:=case when new.condition_in in ('good','fair') then 'available'
                  when new.condition_in='damaged' then 'repair'
                  when new.condition_in='lost' then 'lost'
                  else null end;
    if v_state is null then raise exception 'book_return_condition_required'; end if;
    update public.library_book_copies
      set state=v_state,last_condition=new.condition_in,updated_at=now()
    where id=old.copy_id and state='on_loan';
    if not found then raise exception 'copy_not_on_loan'; end if;
  end if;
  return new;
end $$;
create trigger library_borrowing_return_copy
after update of returned_at on public.library_borrowings
for each row execute function public.library_return_physical_copy();

-- Staff repairs/returns, and re-stocking, must be privileged inventory actions
-- in a later slice. Direct copy edits are not granted to any browser client.
revoke all on function public.library_seed_book_copies() from public,anon,authenticated;
revoke all on function public.library_assign_physical_copy() from public,anon,authenticated;
revoke all on function public.library_return_physical_copy() from public,anon,authenticated;

-- Preserve existing teacher issue RPC, which already serializes a book row,
-- enforces class authority, and inserts into library_borrowings: copy assigned
-- by trigger. Strengthen returned-condition stock handling for damaged items.
create or replace function public.teacher_return_class_library_book(
  p_borrowing_id uuid,p_condition_in text default 'good'
) returns uuid language plpgsql security definer
set search_path=public,auth,pg_temp as $$
declare v_uid uuid:=auth.uid(); v_loan public.library_borrowings%rowtype;
begin
  if v_uid is null then raise exception 'not_authenticated' using errcode='42501'; end if;
  if not exists(select 1 from public.profiles p where p.id=auth.uid() and p.account_status::text='active' and not coalesce(p.is_anonymized,false)) then raise exception 'actor_not_active' using errcode='42501'; end if;
  if p_condition_in is null or p_condition_in not in ('good','fair','damaged','lost') then
    raise exception 'book_condition_invalid'; end if;
  select * into v_loan from public.library_borrowings
    where id=p_borrowing_id and borrower_type='student' and deleted_at is null for update;
  if not found then raise exception 'borrowing_not_found'; end if;
  if v_loan.issued_for_class_id is not null then
    if not public.teacher_can_access_class(v_loan.issued_for_class_id,null,false) then
      raise exception 'teacher_class_not_authorized' using errcode='42501'; end if;
  elsif not exists(
    select 1 from public.student_classes sc
    where sc.student_id=v_loan.student_id and sc.school_id=v_loan.school_id and sc.is_current
      and public.teacher_can_access_class(sc.class_id,null,false)
  ) then raise exception 'teacher_class_not_authorized' using errcode='42501'; end if;
  if v_loan.returned_at is not null then raise exception 'borrowing_already_returned'; end if;
  perform 1 from public.library_books where id=v_loan.book_id
    and school_id=v_loan.school_id and deleted_at is null for update;
  if not found then raise exception 'school_book_not_found'; end if;
  update public.library_borrowings set returned_at=now(),condition_in=p_condition_in
    where id=p_borrowing_id and returned_at is null;
  if p_condition_in in ('good','fair') then
    update public.library_books set available_copies=least(coalesce(total_copies,0),coalesce(available_copies,0)+1)
    where id=v_loan.book_id and school_id=v_loan.school_id and deleted_at is null;
  end if;
  return p_borrowing_id;
end $$;

-- Minimal school-authorized inventory maintenance. Ledger is not a second
-- circulation authority: it audits only physical-copy stock adjustments.
create table public.library_inventory_events (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools(id),
  book_id uuid not null references public.library_books(id),
  copy_id uuid references public.library_book_copies(id),
  actor_id uuid not null references public.profiles(id),
  request_id uuid not null,
  action text not null check(action in ('repair_complete','restock')),
  quantity integer not null check(quantity between 1 and 5000),
  created_at timestamptz not null default now(),
  unique(actor_id,request_id),
  constraint inventory_event_scope_ck check (
    (action='repair_complete' and copy_id is not null and quantity=1)
    or (action='restock' and copy_id is null)
  )
);
create index library_inventory_events_book_idx
  on public.library_inventory_events(school_id,book_id,created_at);
alter table public.library_inventory_events enable row level security;
create policy library_inventory_events_school_admin_read
  on public.library_inventory_events for select to authenticated
  using (public.is_school_admin(school_id) and exists(select 1 from public.profiles p where p.id=(select auth.uid()) and p.account_status::text='active' and not coalesce(p.is_anonymized,false)));
revoke all on public.library_inventory_events from public,anon,authenticated;
grant select on public.library_inventory_events to authenticated;
grant all on public.library_inventory_events to service_role;

-- Display only the physical copies of one school-authorized title.
create or replace function public.school_list_library_copies(p_book_id uuid)
returns jsonb language plpgsql stable security definer
set search_path=public,auth,pg_temp as $copylist$
declare v_school uuid; v_copies jsonb;
begin
  if auth.uid() is null then raise exception 'not_authenticated' using errcode='42501'; end if;
  if not exists(select 1 from public.profiles p where p.id=auth.uid() and p.account_status::text='active' and not coalesce(p.is_anonymized,false)) then raise exception 'actor_not_active' using errcode='42501'; end if;
  select school_id into v_school from public.library_books
    where id=p_book_id and deleted_at is null;
  if not found then raise exception 'school_book_not_found'; end if;
  if not public.is_school_admin(v_school) then
    raise exception 'school_admin_required' using errcode='42501';
  end if;
  select coalesce(jsonb_agg(jsonb_build_object(
      'id',id,'accession_code',accession_code,'copy_number',copy_number,
      'state',state,'last_condition',last_condition) order by copy_number),'[]'::jsonb)
    into v_copies from public.library_book_copies
    where book_id=p_book_id and school_id=v_school;
  return v_copies;
end $copylist$;

-- A returned damaged book is quarantined until a school administrator
-- explicitly certifies that the same physical copy can circulate again.
create or replace function public.school_repair_library_copy(
  p_copy_id uuid,p_request_id uuid
) returns uuid language plpgsql security definer
set search_path=public,auth,pg_temp as $repair$
declare v_uid uuid:=auth.uid(); v_book uuid; v_school uuid;
  v_copy public.library_book_copies%rowtype;
  v_event public.library_inventory_events%rowtype;
begin
  if v_uid is null then raise exception 'not_authenticated' using errcode='42501'; end if;
  if not exists(select 1 from public.profiles p where p.id=auth.uid() and p.account_status::text='active' and not coalesce(p.is_anonymized,false)) then raise exception 'actor_not_active' using errcode='42501'; end if;
  if p_request_id is null then raise exception 'inventory_request_id_required'; end if;
  perform pg_advisory_xact_lock(hashtextextended(v_uid::text||':'||p_request_id::text,0));
  select * into v_event from public.library_inventory_events
    where actor_id=v_uid and request_id=p_request_id;
  if found then
    if v_event.action<>'repair_complete' or v_event.copy_id is distinct from p_copy_id then
      raise exception 'inventory_request_payload_conflict';
    end if;
    if not public.is_school_admin(v_event.school_id) then
      raise exception 'school_admin_required' using errcode='42501'; end if;
    return p_copy_id;
  end if;
  select book_id,school_id into v_book,v_school from public.library_book_copies
    where id=p_copy_id;
  if not found then raise exception 'copy_not_found'; end if;
  -- Always lock book before copy, matching the issue/return transaction order.
  perform 1 from public.library_books
    where id=v_book and school_id=v_school and deleted_at is null for update;
  if not found then raise exception 'school_book_not_found'; end if;
  if not public.is_school_admin(v_school) then
    raise exception 'school_admin_required' using errcode='42501'; end if;
  select * into v_copy from public.library_book_copies where id=p_copy_id for update;
  if v_copy.book_id<>v_book or v_copy.school_id<>v_school or v_copy.state<>'repair' then
    raise exception 'copy_not_awaiting_repair';
  end if;
  update public.library_book_copies
    set state='available',last_condition='good',updated_at=now()
    where id=p_copy_id;
  update public.library_books set available_copies=available_copies+1
    where id=v_book and school_id=v_school;
  insert into public.library_inventory_events(
    school_id,book_id,copy_id,actor_id,request_id,action,quantity
  ) values(v_school,v_book,p_copy_id,v_uid,p_request_id,'repair_complete',1);
  return p_copy_id;
end $repair$;

-- Register newly purchased/donated copies to an existing title. Deterministic
-- numbering + a request ledger prevent both duplicate accession and double
-- stock adjustment on client retries.
create or replace function public.school_restock_library_book(
  p_book_id uuid,p_count integer,p_request_id uuid
) returns uuid language plpgsql security definer
set search_path=public,auth,pg_temp as $restock$
declare v_uid uuid:=auth.uid(); v_school uuid; v_total integer; v_next integer;
  v_event public.library_inventory_events%rowtype;
begin
  if v_uid is null then raise exception 'not_authenticated' using errcode='42501'; end if;
  if not exists(select 1 from public.profiles p where p.id=auth.uid() and p.account_status::text='active' and not coalesce(p.is_anonymized,false)) then raise exception 'actor_not_active' using errcode='42501'; end if;
  if p_request_id is null then raise exception 'inventory_request_id_required'; end if;
  if p_count is null or p_count<1 or p_count>5000 then raise exception 'invalid_restock_quantity'; end if;
  perform pg_advisory_xact_lock(hashtextextended(v_uid::text||':'||p_request_id::text,0));
  select * into v_event from public.library_inventory_events
    where actor_id=v_uid and request_id=p_request_id;
  if found then
    if v_event.action<>'restock' or v_event.book_id is distinct from p_book_id
       or v_event.quantity is distinct from p_count then
      raise exception 'inventory_request_payload_conflict';
    end if;
    if not public.is_school_admin(v_event.school_id) then
      raise exception 'school_admin_required' using errcode='42501'; end if;
    return p_book_id;
  end if;
  select school_id,total_copies into v_school,v_total
  from public.library_books where id=p_book_id and deleted_at is null for update;
  if not found then raise exception 'school_book_not_found'; end if;
  if not public.is_school_admin(v_school) then
    raise exception 'school_admin_required' using errcode='42501'; end if;
  if v_total+p_count>5000 then raise exception 'school_book_stock_limit'; end if;
  select coalesce(max(copy_number),0) into v_next
  from public.library_book_copies where book_id=p_book_id;
  insert into public.library_book_copies(school_id,book_id,copy_number,accession_code)
  select v_school,p_book_id,v_next+n,
    'BK-'||replace(p_book_id::text,'-','')||'-'||lpad((v_next+n)::text,4,'0')
  from generate_series(1,p_count) n;
  update public.library_books set total_copies=total_copies+p_count,
    available_copies=available_copies+p_count where id=p_book_id;
  insert into public.library_inventory_events(
    school_id,book_id,actor_id,request_id,action,quantity
  ) values(v_school,p_book_id,v_uid,p_request_id,'restock',p_count);
  return p_book_id;
end $restock$;

-- Removing a catalogue title must not orphan an active school loan.
-- Keep archived loan history and copy accession records; retire unloaned copies
-- atomically and deny client-side catalogue edits.
create or replace function public.school_archive_library_book(p_book_id uuid)
returns uuid language plpgsql security definer
set search_path=public,auth,pg_temp as $archive$
declare v_school uuid; v_archived timestamptz;
begin
  if auth.uid() is null then raise exception 'not_authenticated' using errcode='42501'; end if;
  if not exists(select 1 from public.profiles p where p.id=auth.uid() and p.account_status::text='active' and not coalesce(p.is_anonymized,false)) then raise exception 'actor_not_active' using errcode='42501'; end if;
  select school_id,deleted_at into v_school,v_archived
    from public.library_books where id=p_book_id for update;
  if not found then raise exception 'school_book_not_found'; end if;
  if not public.is_school_admin(v_school) then
    raise exception 'school_admin_required' using errcode='42501'; end if;
  if v_archived is not null then return p_book_id; end if;
  if exists(select 1 from public.library_borrowings
    where book_id=p_book_id and school_id=v_school
      and returned_at is null and deleted_at is null) then
    raise exception 'book_has_active_borrowings';
  end if;
  -- Preserve "lost" as the terminal audited physical state. Other
  -- non-loaned copies are retired rather than erased or re-circulated.
  update public.library_book_copies
    set state='retired',updated_at=now()
    where book_id=p_book_id and school_id=v_school and state<>'lost';
  update public.library_books set deleted_at=now(),available_copies=0
    where id=p_book_id and school_id=v_school;
  return p_book_id;
end $archive$;

revoke all on function public.school_list_library_copies(uuid) from public,anon;
revoke all on function public.school_repair_library_copy(uuid,uuid) from public,anon;
revoke all on function public.school_restock_library_book(uuid,integer,uuid) from public,anon;
revoke all on function public.school_archive_library_book(uuid) from public,anon;
grant execute on function public.school_archive_library_book(uuid) to authenticated;
grant execute on function public.school_list_library_copies(uuid) to authenticated;
grant execute on function public.school_repair_library_copy(uuid,uuid) to authenticated;
grant execute on function public.school_restock_library_book(uuid,integer,uuid) to authenticated;
