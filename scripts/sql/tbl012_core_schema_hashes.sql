\set ON_ERROR_STOP on
\pset tuples_only on
\pset format unaligned

with core_tables as (
  select unnest(array[
    'timetable_slots',
    'teacher_classes',
    'teaching_occurrences',
    'school_periods'
  ]) as table_name
),
table_flags as (
  select
    cls.relname as table_name,
    jsonb_build_object(
      'rls_enabled', cls.relrowsecurity,
      'force_rls', cls.relforcerowsecurity,
      'replica_identity', cls.relreplident,
      'persistence', cls.relpersistence
    ) as value
  from pg_class cls
  join pg_namespace n
    on n.oid = cls.relnamespace
  join core_tables t
    on t.table_name = cls.relname
  where n.nspname = 'public'
),
columns_snapshot as (
  select
    c.table_name,
    jsonb_agg(
      jsonb_build_object(
        'name', c.column_name,
        'position', c.ordinal_position,
        'data_type', c.data_type,
        'udt_name', c.udt_name,
        'nullable', c.is_nullable,
        'default', c.column_default,
        'identity', c.identity_generation,
        'generated', c.is_generated,
        'generation_expression', c.generation_expression
      )
      order by c.ordinal_position
    ) as value
  from information_schema.columns c
  join core_tables t
    on t.table_name = c.table_name
  where c.table_schema = 'public'
  group by c.table_name
),
constraint_snapshot as (
  select
    cls.relname as table_name,
    jsonb_agg(
      jsonb_build_object(
        'name', con.conname,
        'type', con.contype,
        'definition', pg_get_constraintdef(con.oid, true),
        'validated', con.convalidated,
        'deferrable', con.condeferrable,
        'deferred', con.condeferred
      )
      order by con.conname
    ) as value
  from pg_constraint con
  join pg_class cls
    on cls.oid = con.conrelid
  join pg_namespace n
    on n.oid = cls.relnamespace
  join core_tables t
    on t.table_name = cls.relname
  where n.nspname = 'public'
  group by cls.relname
),
index_snapshot as (
  select
    i.tablename as table_name,
    jsonb_agg(
      jsonb_build_object(
        'name', i.indexname,
        'definition', i.indexdef
      )
      order by i.indexname
    ) as value
  from pg_indexes i
  join core_tables t
    on t.table_name = i.tablename
  where i.schemaname = 'public'
  group by i.tablename
),
trigger_snapshot as (
  select
    cls.relname as table_name,
    jsonb_agg(
      jsonb_build_object(
        'name', trg.tgname,
        'definition', pg_get_triggerdef(trg.oid, true),
        'function', p.oid::regprocedure::text
      )
      order by trg.tgname
    ) as value
  from pg_trigger trg
  join pg_class cls
    on cls.oid = trg.tgrelid
  join pg_namespace n
    on n.oid = cls.relnamespace
  join pg_proc p
    on p.oid = trg.tgfoid
  join core_tables t
    on t.table_name = cls.relname
  where n.nspname = 'public'
    and not trg.tgisinternal
  group by cls.relname
)
select jsonb_pretty(
  jsonb_build_object(
    'schema_version', 1,
    'tables',
    jsonb_object_agg(
      t.table_name,
      jsonb_build_object(
        'table_hash',
          md5(coalesce(tf.value, '{}'::jsonb)::text),
        'columns_hash',
          md5(coalesce(cs.value, '[]'::jsonb)::text),
        'constraints_hash',
          md5(coalesce(ks.value, '[]'::jsonb)::text),
        'indexes_hash',
          md5(coalesce(ix.value, '[]'::jsonb)::text),
        'triggers_hash',
          md5(coalesce(tr.value, '[]'::jsonb)::text)
      )
      order by t.table_name
    )
  )
)
from core_tables t
left join table_flags tf using (table_name)
left join columns_snapshot cs using (table_name)
left join constraint_snapshot ks using (table_name)
left join index_snapshot ix using (table_name)
left join trigger_snapshot tr using (table_name);
