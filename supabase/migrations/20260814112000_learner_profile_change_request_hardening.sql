-- Learner profile correction request hardening.
-- Parent submissions are linked-learner-only and append-only; school review is RPC-only.

begin;

alter table public.child_change_requests enable row level security;

drop policy if exists "parent owns change requests" on public.child_change_requests;
drop policy if exists "parents read own learner correction requests" on public.child_change_requests;
drop policy if exists "parents create linked learner correction requests" on public.child_change_requests;

create policy "parents read own learner correction requests"
on public.child_change_requests for select to authenticated
using (
  parent_id = auth.uid()
  and exists (
    select 1 from public.parent_student_links psl
    where psl.parent_id = auth.uid()
      and psl.student_id = child_change_requests.student_id
  )
);

create policy "parents create linked learner correction requests"
on public.child_change_requests for insert to authenticated
with check (
  parent_id = auth.uid()
  and status = 'pending'
  and reviewed_by is null and reviewed_at is null and review_note is null
  and field in ('name','admission_number','date_of_birth','gender')
  and exists (
    select 1 from public.parent_student_links psl
    where psl.parent_id = auth.uid()
      and psl.student_id = child_change_requests.student_id
  )
);

revoke all on table public.child_change_requests from anon;
revoke update, delete, truncate on table public.child_change_requests from authenticated;
grant select, insert on table public.child_change_requests to authenticated;

create or replace function public.review_child_change_request(
  p_request_id uuid,
  p_decision text,
  p_review_note text default null
)
returns public.child_change_requests
language plpgsql
security definer
set search_path = public
as $$
declare
  v_request public.child_change_requests%rowtype;
  v_school_id uuid;
  v_is_admin boolean := false;
begin
  if auth.uid() is null then raise exception 'authentication required'; end if;
  if p_decision not in ('approved','rejected') then raise exception 'invalid decision'; end if;

  select r.*, c.school_id
    into v_request, v_school_id
  from public.child_change_requests r
  join public.students s on s.id = r.student_id
  left join public.classes c on c.id = s.class_id
  where r.id = p_request_id and r.deleted_at is null and r.status = 'pending'
  for update of r;

  if not found or v_school_id is null then
    raise exception 'pending request not found or learner has no school';
  end if;

  -- Existing VibeSchool school-membership model uses school_members.profile_id.
  select exists (
    select 1 from public.school_members sm
    where sm.school_id = v_school_id
      and sm.profile_id = auth.uid()
      and sm.role in ('admin','owner','school_admin')
  ) into v_is_admin;

  if not v_is_admin then raise exception 'school admin access required'; end if;

  if p_decision = 'approved' then
    if v_request.field = 'name' then
      update public.students set name = v_request.new_value, updated_at = now() where id = v_request.student_id;
    elsif v_request.field = 'admission_number' then
      update public.students set admission_number = nullif(v_request.new_value,''), updated_at = now() where id = v_request.student_id;
    elsif v_request.field = 'date_of_birth' then
      update public.students set date_of_birth = v_request.new_value::date, updated_at = now() where id = v_request.student_id;
    elsif v_request.field = 'gender' then
      update public.students set gender = v_request.new_value, updated_at = now() where id = v_request.student_id;
    else
      raise exception 'field is not reviewable';
    end if;
  end if;

  update public.child_change_requests
  set status = p_decision, reviewed_by = auth.uid(), reviewed_at = now(),
      review_note = nullif(trim(coalesce(p_review_note,'')),''), updated_at = now()
  where id = p_request_id
  returning * into v_request;

  return v_request;
end;
$$;

revoke all on function public.review_child_change_request(uuid,text,text) from public, anon;
grant execute on function public.review_child_change_request(uuid,text,text) to authenticated;

commit;
