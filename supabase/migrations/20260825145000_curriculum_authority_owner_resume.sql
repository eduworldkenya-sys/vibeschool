-- Owner-only resume state for the Curriculum Authority operator surface.
-- Service-owned evidence tables remain unavailable to browser SELECT queries.

create or replace function public.curriculum_authority_resume_snapshot(p_import_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_source_ref text;
  v_import_status text;
  v_snapshot_id uuid;
  v_snapshot public.curriculum_authority_snapshots%rowtype;
begin
  perform public.hq_assert_owner();

  select source_ref, status
  into v_source_ref, v_import_status
  from public.curriculum_imports
  where id = p_import_id;

  if not found then
    raise exception 'curriculum_import_not_found';
  end if;

  if v_source_ref is null
     or left(v_source_ref, length('curriculum_authority_snapshot:')) <> 'curriculum_authority_snapshot:' then
    return jsonb_build_object(
      'resumed', false,
      'import_status', v_import_status,
      'reason', 'snapshot_not_bound'
    );
  end if;

  begin
    v_snapshot_id := replace(v_source_ref, 'curriculum_authority_snapshot:', '')::uuid;
  exception when invalid_text_representation then
    raise exception 'curriculum_snapshot_reference_invalid';
  end;

  select *
  into v_snapshot
  from public.curriculum_authority_snapshots
  where id = v_snapshot_id;

  if not found then
    raise exception 'curriculum_snapshot_not_found';
  end if;

  return jsonb_build_object(
    'resumed', true,
    'import_status', v_import_status,
    'source_id', v_snapshot.source_id,
    'snapshot_id', v_snapshot.id,
    'snapshot_status', v_snapshot.status,
    'observation_count', v_snapshot.observation_count
  );
end
$$;

revoke all on function public.curriculum_authority_resume_snapshot(uuid) from public, anon;
grant execute on function public.curriculum_authority_resume_snapshot(uuid) to authenticated;

comment on function public.curriculum_authority_resume_snapshot(uuid) is
'Restores owner-authorized Curriculum Authority workflow state without exposing service-only evidence tables to browser SELECT access.';
