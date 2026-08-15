create or replace function public.teacher_generate_shared_claim_code(p_student_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions, pg_temp
as $$
declare
  v_student public.students%rowtype;
  v_code text;
  v_expires timestamptz := now() + interval '30 days';
  v_allowed boolean := false;
begin
  if auth.uid() is null then raise exception 'not_authenticated'; end if;

  select * into v_student
  from public.students
  where id = p_student_id and deleted_at is null;

  if not found then raise exception 'student_not_found'; end if;

  select exists (
    select 1
    from public.teachers t
    join public.classes c on c.teacher_id = t.id
    where t.user_id = auth.uid() and c.id = v_student.class_id
  ) or exists (
    select 1
    from public.teacher_classes tc
    join public.teachers t on t.id = tc.teacher_id
    where t.user_id = auth.uid() and tc.class_id = v_student.class_id
  ) into v_allowed;

  if not v_allowed then raise exception 'unauthorized_teacher'; end if;

  delete from public.student_claim_codes where student_id = p_student_id;

  loop
    v_code := upper(substr(md5(random()::text || clock_timestamp()::text || auth.uid()::text), 1, 6));
    exit when not exists (select 1 from public.student_claim_codes where code = v_code);
  end loop;

  insert into public.student_claim_codes(student_id, code, role, claimed, expires_at)
  values (p_student_id, v_code, 'shared', false, v_expires);

  return jsonb_build_object('status','success','student_id',p_student_id,'code',v_code,'expires_at',v_expires);
end;
$$;

revoke all on function public.teacher_generate_shared_claim_code(uuid) from public;
grant execute on function public.teacher_generate_shared_claim_code(uuid) to authenticated;

-- Legacy student/parent rows are intentionally NOT rewritten here. The later
-- shared-lifecycle migration first records which lane consumed each historical
-- credential, then reconciles role to `shared` without losing identity history.
