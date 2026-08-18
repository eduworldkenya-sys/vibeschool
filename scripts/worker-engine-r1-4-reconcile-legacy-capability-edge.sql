-- WE-R1.4 protected recovery prerequisite: reconcile the historical
-- hq_workforce_capability_edges name collision observed in production.
--
-- The legacy table models skill-manifest edges. WE-R1.3X later reused the same
-- relation name for capability-to-capability edges. Production currently has the
-- legacy shape with zero rows, so CREATE TABLE IF NOT EXISTS in 20260815091000
-- cannot create the canonical relation and its index creation then fails.
--
-- This repair is intentionally fail-closed. It only archives the exact observed
-- zero-row legacy shape. Any data, unknown shape, pre-existing archive, or partial
-- canonical shape aborts recovery.

do $reconcile$
declare
  v_columns text[];
  v_row_count bigint;
begin
  if to_regclass('public.hq_workforce_capability_edges') is null then
    return;
  end if;

  -- Already canonical: nothing to reconcile.
  if exists (
       select 1 from information_schema.columns
       where table_schema='public' and table_name='hq_workforce_capability_edges'
         and column_name='from_capability_id'
     )
     and exists (
       select 1 from information_schema.columns
       where table_schema='public' and table_name='hq_workforce_capability_edges'
         and column_name='to_capability_id'
     ) then
    return;
  end if;

  select array_agg(column_name order by ordinal_position)
    into v_columns
  from information_schema.columns
  where table_schema='public' and table_name='hq_workforce_capability_edges';

  if v_columns is distinct from array[
    'id','from_skill_manifest_id','to_skill_manifest_id','relation_type',
    'input_mapping','output_mapping','condition_contract','priority','enabled',
    'created_at','updated_at'
  ]::text[] then
    raise exception 'WE-R1.4 recovery blocked: capability edge collision has unknown shape: %', v_columns;
  end if;

  execute 'select count(*) from public.hq_workforce_capability_edges' into v_row_count;
  if v_row_count <> 0 then
    raise exception 'WE-R1.4 recovery blocked: legacy capability edge collision contains % rows', v_row_count;
  end if;

  if to_regclass('public.hq_workforce_skill_capability_edges_legacy') is not null then
    raise exception 'WE-R1.4 recovery blocked: legacy capability edge archive already exists';
  end if;

  -- Index names are schema-global, so free the canonical names before the new
  -- capability graph migration creates its relation and indexes.
  alter index if exists public.hq_workforce_capability_edges_from_idx
    rename to hq_workforce_skill_capability_edges_legacy_from_idx;
  alter index if exists public.hq_workforce_capability_edges_to_idx
    rename to hq_workforce_skill_capability_edges_legacy_to_idx;

  alter table public.hq_workforce_capability_edges
    rename to hq_workforce_skill_capability_edges_legacy;

  alter table public.hq_workforce_skill_capability_edges_legacy enable row level security;
  revoke all on table public.hq_workforce_skill_capability_edges_legacy from public, anon, authenticated;
  comment on table public.hq_workforce_skill_capability_edges_legacy is
    'Archived zero-row legacy skill-manifest edge relation preserved by WE-R1.4 production recovery; not canonical capability graph.';
end
$reconcile$;
