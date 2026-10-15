-- Initially scaffolded with Supabase CLI 2.113.0 on 2026-10-11; renumbered after merged PR #764 to maintain monotonic migration order. STAGED ONLY.
-- DO NOT db push until historical migration-version equivalence is reconciled.
-- Verified candidate: original path docs/engineering/class-life-library/canonical_library_migration_candidate.sql
-- active pilot-blocker database-path lease is released. DO NOT apply directly
-- to production or merge dependent UI before authenticated integration tests.
-- Based on production schema reviewed 2026-10-11.

-- There are no production book or borrowing records as of the audit.
-- Enforce canonical identity for new library circulation and stock invariants.
alter table public.library_borrowings
  add constraint library_borrower_identity_ck check (
    (borrower_type='student' and student_id is not null and staff_id is null)
    or (borrower_type='staff' and staff_id is not null and student_id is null)
  ) not valid;
alter table public.library_books
  add constraint library_book_stock_ck check (
    total_copies is not null and total_copies between 1 and 5000
    and available_copies is not null and available_copies>=0
    and available_copies<=total_copies
  ) not valid;

-- Borrower choices come from current canonical enrollment and school membership.
create or replace function public.school_library_borrower_options(p_school_id uuid)
returns jsonb language plpgsql stable security definer
set search_path=public,auth,pg_temp as $$
declare v_result jsonb;
begin
  if auth.uid() is null or not public.is_school_admin(p_school_id) then
    raise exception 'school_admin_required' using errcode='42501';
  end if;
  select jsonb_build_object(
    'students', coalesce((
      select jsonb_agg(jsonb_build_object('id',r.id,'name',r.name,'class_name',r.class_name) order by r.name,r.id)
      from (
        select distinct on (s.id) s.id,s.name,c.name as class_name
        from public.student_classes sc
        join public.students s on s.id=sc.student_id and s.deleted_at is null
        join public.classes c on c.id=sc.class_id and c.school_id=sc.school_id
        where sc.school_id=p_school_id and sc.is_current
        order by s.id, sc.joined_at desc
      ) r
    ),'[]'::jsonb),
    'staff',coalesce((
      select jsonb_agg(jsonb_build_object('id',p.id,'name',p.full_name) order by p.full_name,p.id)
      from public.profiles p
      where p.account_status::text='active' and not coalesce(p.is_anonymized,false)
        and (exists(
        select 1 from public.school_members sm where sm.profile_id=p.id
          and sm.school_id=p_school_id and sm.role::text in ('admin','teacher','owner')
      ) or exists(
        select 1 from public.staff st where st.profile_id=p.id
          and st.school_id=p_school_id and st.deleted_at is null
          and lower(coalesce(st.status,'active'))='active'
      ))
    ),'[]'::jsonb)
  ) into v_result;
  return v_result;
end $$;

-- Admin issuance and teacher issuance both record the SAME library_borrowings
-- ledger. Row locks make inventory changes and loan creation atomic.
create or replace function public.school_issue_library_book(
  p_book_id uuid,p_student_id uuid,p_staff_id uuid,p_due_date date,
  p_condition text,p_request_id uuid
) returns uuid language plpgsql security definer
set search_path=public,auth,pg_temp as $$
declare
  v_uid uuid:=auth.uid();
  v_school_id uuid;
  v_available integer;
  v_class_id uuid;
  v_existing public.library_borrowings%rowtype;
  v_loan_id uuid;
  v_kind text;
begin
  if v_uid is null then raise exception 'not_authenticated' using errcode='42501'; end if;
  if p_request_id is null then raise exception 'issue_request_id_required'; end if;
  if (p_student_id is null) = (p_staff_id is null) then
    raise exception 'exactly_one_borrower_required';
  end if;
  if p_due_date is null or p_due_date<current_date or p_due_date>current_date+366 then
    raise exception 'due_date_invalid';
  end if;
  if p_condition is null or p_condition not in ('good','fair','damaged') then
    raise exception 'book_condition_invalid';
  end if;
  perform pg_advisory_xact_lock(hashtextextended(v_uid::text||':'||p_request_id::text,0));
  select * into v_existing from public.library_borrowings
    where issued_by=v_uid and issue_request_id=p_request_id;
  if found then
    if v_existing.book_id is distinct from p_book_id
       or v_existing.student_id is distinct from p_student_id
       or v_existing.staff_id is distinct from p_staff_id
       or v_existing.due_date is distinct from p_due_date
       or v_existing.condition_out is distinct from p_condition then
      raise exception 'issue_request_payload_conflict';
    end if;
    if not public.is_school_admin(v_existing.school_id) then
      raise exception 'school_admin_required' using errcode='42501';
    end if;
    return v_existing.id;
  end if;

  select b.school_id,b.available_copies into v_school_id,v_available
  from public.library_books b
  where b.id=p_book_id and b.deleted_at is null
  for update;
  if not found then raise exception 'school_book_not_found'; end if;
  if not public.is_school_admin(v_school_id) then
    raise exception 'school_admin_required' using errcode='42501';
  end if;
  if coalesce(v_available,0)<=0 then raise exception 'no_copies_available'; end if;
  if p_student_id is not null then
    v_kind:='student';
    select sc.class_id into v_class_id
    from public.student_classes sc
    join public.classes c on c.id=sc.class_id and c.school_id=sc.school_id
    join public.students s on s.id=sc.student_id and s.deleted_at is null
    where sc.student_id=p_student_id and sc.school_id=v_school_id and sc.is_current
    order by sc.joined_at desc limit 1;
    if v_class_id is null then
      raise exception 'borrower_not_currently_enrolled' using errcode='42501';
    end if;
  else
    v_kind:='staff';
    if not exists (
      select 1 from public.profiles p where p.id=p_staff_id
        and p.account_status::text='active' and not coalesce(p.is_anonymized,false)
    ) then
      raise exception 'staff_profile_not_active' using errcode='42501';
    end if;
    if not exists(
      select 1 from public.school_members sm
      where sm.profile_id=p_staff_id and sm.school_id=v_school_id
        and sm.role::text in ('admin','owner','teacher')
    ) and not exists(
      select 1 from public.staff st
      where st.profile_id=p_staff_id and st.school_id=v_school_id
        and st.deleted_at is null
        and lower(coalesce(st.status,'active'))='active'
    ) then
      raise exception 'staff_not_school_member' using errcode='42501';
    end if;
  end if;

  update public.library_books set available_copies=available_copies-1 where id=p_book_id;
  insert into public.library_borrowings(
    school_id,book_id,borrower_type,student_id,staff_id,issued_by,issued_at,
    due_date,condition_out,fine_amount,fine_paid,issued_for_class_id,issue_request_id
  ) values(
    v_school_id,p_book_id,v_kind,p_student_id,p_staff_id,v_uid,now(),
    p_due_date,p_condition,0,false,v_class_id,p_request_id
  ) returning id into v_loan_id;
  return v_loan_id;
end $$;

create or replace function public.school_return_library_book(
  p_borrowing_id uuid,p_condition_in text,p_fine_amount numeric,p_fine_paid boolean
) returns uuid language plpgsql security definer
set search_path=public,auth,pg_temp as $$
declare v_loan public.library_borrowings%rowtype;
begin
  if auth.uid() is null then raise exception 'not_authenticated' using errcode='42501'; end if;
  if p_condition_in is null or p_condition_in not in ('good','fair','damaged','lost') then
    raise exception 'book_condition_invalid';
  end if;
  if p_fine_amount is null or p_fine_amount<0 or p_fine_amount>100000 then
    raise exception 'fine_invalid';
  end if;
  select * into v_loan from public.library_borrowings
  where id=p_borrowing_id and deleted_at is null for update;
  if not found then raise exception 'borrowing_not_found'; end if;
  if not public.is_school_admin(v_loan.school_id) then
    raise exception 'school_admin_required' using errcode='42501';
  end if;
  if v_loan.returned_at is not null then raise exception 'borrowing_already_returned'; end if;
  -- Lock catalogue before the physical-copy trigger changes copy state.
  -- Issue, return, repair and archival must all serialize on this row.
  perform 1 from public.library_books where id=v_loan.book_id
    and school_id=v_loan.school_id and deleted_at is null for update;
  if not found then raise exception 'school_book_not_found'; end if;
  update public.library_borrowings set returned_at=now(),condition_in=p_condition_in,
    fine_amount=p_fine_amount,fine_paid=(p_fine_paid and p_fine_amount>0)
  where id=p_borrowing_id;
  if p_condition_in in ('good','fair') then
    update public.library_books
    set available_copies=least(total_copies,available_copies+1)
    where id=v_loan.book_id and school_id=v_loan.school_id and deleted_at is null;
  end if;
  return p_borrowing_id;
end $$;

-- Prevent the unsafe two-request REST write path (including admin).
-- Existing class-teacher circulation is via authorized definer RPCs.
revoke insert,update,delete on public.library_borrowings from authenticated;
-- Direct catalogue edits (including hiding books with live loans) are not authorized.
-- The browser can still register a new book through its existing INSERT policy.
revoke update,delete on public.library_books from authenticated;

revoke all on function public.school_library_borrower_options(uuid) from public,anon;
revoke all on function public.school_issue_library_book(uuid,uuid,uuid,date,text,uuid) from public,anon;
revoke all on function public.school_return_library_book(uuid,text,numeric,boolean) from public,anon;
grant execute on function public.school_library_borrower_options(uuid) to authenticated;
grant execute on function public.school_issue_library_book(uuid,uuid,uuid,date,text,uuid) to authenticated;
grant execute on function public.school_return_library_book(uuid,text,numeric,boolean) to authenticated;

-- Existing rows (if added during release window) MUST be audited before validation.
-- Once all borrowers are linked and stock reconciled, VALIDATE CONSTRAINTs.
