create or replace function public.assign_chapter_to_class(
  p_class_id uuid,
  p_chapter_id uuid,
  p_due_at timestamptz default null
)
returns jsonb
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  v_teacher_id uuid := auth.uid();
  v_school_id uuid;
  v_publication_id uuid;
  v_assignment_id uuid;
begin
  if v_teacher_id is null then
    return jsonb_build_object('ok', false, 'reason', 'auth_required');
  end if;
  if p_due_at is not null and p_due_at <= now() then
    return jsonb_build_object('ok', false, 'reason', 'due_date_must_be_future');
  end if;
  select tc.school_id into v_school_id
  from public.teacher_classes tc
  join public.classes c on c.id = tc.class_id and c.school_id = tc.school_id
  where tc.teacher_id = v_teacher_id and tc.class_id = p_class_id
  limit 1;
  if v_school_id is null then
    return jsonb_build_object('ok', false, 'reason', 'class_not_assigned');
  end if;
  select vc.publication_id into v_publication_id
  from public.vibe_chapters vc
  join public.vibe_publications vp on vp.id = vc.publication_id
  where vc.id = p_chapter_id
    and vc.status = 'published'
    and vp.status = 'published'
    and vp.format = 'vibetextbook';
  if v_publication_id is null then
    return jsonb_build_object('ok', false, 'reason', 'chapter_not_assignable');
  end if;
  if exists (
    select 1 from public.vibe_chapter_assignments a
    where a.teacher_id = v_teacher_id
      and a.class_id = p_class_id
      and a.chapter_id = p_chapter_id
      and a.status = 'assigned'
  ) then
    return jsonb_build_object('ok', false, 'reason', 'already_assigned');
  end if;
  insert into public.vibe_chapter_assignments(
    teacher_id, school_id, class_id, publication_id, chapter_id, due_at
  ) values (
    v_teacher_id, v_school_id, p_class_id, v_publication_id, p_chapter_id, p_due_at
  ) returning id into v_assignment_id;
  return jsonb_build_object(
    'ok', true,
    'reason', null,
    'assignment_id', v_assignment_id,
    'class_id', p_class_id,
    'chapter_id', p_chapter_id,
    'publication_id', v_publication_id,
    'due_at', p_due_at
  );
exception
  when unique_violation then
    return jsonb_build_object('ok', false, 'reason', 'already_assigned');
end;
$$;

create or replace function public.cancel_chapter_assignment(p_assignment_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  v_teacher_id uuid := auth.uid();
  v_owner uuid;
  v_status text;
begin
  if v_teacher_id is null then
    return jsonb_build_object('ok', false, 'reason', 'auth_required');
  end if;
  select teacher_id, status into v_owner, v_status
  from public.vibe_chapter_assignments
  where id = p_assignment_id;
  if not found then
    return jsonb_build_object('ok', false, 'reason', 'assignment_not_found');
  end if;
  if v_owner <> v_teacher_id then
    return jsonb_build_object('ok', false, 'reason', 'not_authorized');
  end if;
  if v_status <> 'cancelled' then
    update public.vibe_chapter_assignments
    set status = 'cancelled'
    where id = p_assignment_id;
  end if;
  return jsonb_build_object(
    'ok', true,
    'reason', null,
    'assignment_id', p_assignment_id,
    'status', 'cancelled'
  );
end;
$$;

revoke all on function public.assign_chapter_to_class(uuid, uuid, timestamptz) from public, anon;
revoke all on function public.cancel_chapter_assignment(uuid) from public, anon;
grant execute on function public.assign_chapter_to_class(uuid, uuid, timestamptz) to authenticated, service_role;
grant execute on function public.cancel_chapter_assignment(uuid) to authenticated, service_role;
