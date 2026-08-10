\set ON_ERROR_STOP on
\pset format unaligned
\pset tuples_only on

-- L0 foundation recovery instrument.
-- READ-ONLY. Run only against an isolated catalog snapshot or production for
-- evidence capture. It does not mutate schema, data, or migration history.
--
-- Historical boundary: 20260520000000.
-- The output is deliberately a scope/evidence ledger, NOT a baseline migration.

with seed(table_name) as (
  values
    ('schools'),
    ('profiles'),
    ('classes'),
    ('subjects'),
    ('teacher_classes'),
    ('timetable_slots'),
    ('country_majority_ages')
),
refs as (
  select
    c.relname as child_table,
    r.relname as parent_table,
    con.conname,
    pg_get_constraintdef(con.oid, true) as definition
  from pg_constraint con
  join pg_class c on c.oid = con.conrelid
  join pg_class r on r.oid = con.confrelid
  join pg_namespace cn on cn.oid = c.relnamespace
  join pg_namespace rn on rn.oid = r.relnamespace
  where con.contype = 'f'
    and cn.nspname = 'public'
    and rn.nspname in ('public', 'auth')
),
closure(table_name) as (
  select table_name from seed
  union
  select refs.parent_table
  from refs
  join closure on closure.table_name = refs.child_table
),
public_closure as (
  select distinct table_name
  from closure
  where table_name <> 'users'
),
columns_snapshot as (
  select
    c.table_name,
    jsonb_agg(
      jsonb_build_object(
        'name', c.column_name,
        'position', c.ordinal_position,
        'data_type', c.data_type,
        'udt_schema', c.udt_schema,
        'udt_name', c.udt_name,
        'nullable', c.is_nullable,
        'default', c.column_default,
        'identity', c.identity_generation,
        'generated', c.is_generated,
        'generation_expression', c.generation_expression
      ) order by c.ordinal_position
    ) as value
  from information_schema.columns c
  join public_closure f on f.table_name = c.table_name
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
      ) order by con.conname
    ) as value
  from pg_constraint con
  join pg_class cls on cls.oid = con.conrelid
  join pg_namespace n on n.oid = cls.relnamespace
  join public_closure f on f.table_name = cls.relname
  where n.nspname = 'public'
  group by cls.relname
),
index_snapshot as (
  select
    i.tablename as table_name,
    jsonb_agg(
      jsonb_build_object('name', i.indexname, 'definition', i.indexdef)
      order by i.indexname
    ) as value
  from pg_indexes i
  join public_closure f on f.table_name = i.tablename
  where i.schemaname = 'public'
  group by i.tablename
),
policy_snapshot as (
  select
    p.tablename as table_name,
    jsonb_agg(
      jsonb_build_object(
        'name', p.policyname,
        'permissive', p.permissive,
        'roles', p.roles,
        'command', p.cmd,
        'using', p.qual,
        'with_check', p.with_check
      ) order by p.policyname
    ) as value
  from pg_policies p
  join public_closure f on f.table_name = p.tablename
  where p.schemaname = 'public'
  group by p.tablename
),
table_snapshot as (
  select
    cls.relname as table_name,
    jsonb_build_object(
      'rls_enabled', cls.relrowsecurity,
      'force_rls', cls.relforcerowsecurity,
      'persistence', cls.relpersistence
    ) as value
  from pg_class cls
  join pg_namespace n on n.oid = cls.relnamespace
  join public_closure f on f.table_name = cls.relname
  where n.nspname = 'public'
)
select jsonb_pretty(
  jsonb_build_object(
    'historical_boundary', '20260520000000',
    'status', 'EVIDENCE_ONLY',
    'seed', (select jsonb_agg(table_name order by table_name) from seed),
    'dependency_closure', (select jsonb_agg(table_name order by table_name) from public_closure),
    'tables', coalesce((
      select jsonb_object_agg(
        t.table_name,
        jsonb_build_object(
          'table', ts.value,
          'columns', coalesce(cs.value, '[]'::jsonb),
          'constraints', coalesce(ks.value, '[]'::jsonb),
          'indexes', coalesce(ix.value, '[]'::jsonb),
          'policies', coalesce(ps.value, '[]'::jsonb)
        )
      )
      from public_closure t
      left join table_snapshot ts using (table_name)
      left join columns_snapshot cs using (table_name)
      left join constraint_snapshot ks using (table_name)
      left join index_snapshot ix using (table_name)
      left join policy_snapshot ps using (table_name)
    ), '{}'::jsonb),
    'foreign_keys', coalesce((
      select jsonb_agg(
        jsonb_build_object(
          'child_table', child_table,
          'parent_table', parent_table,
          'constraint', conname,
          'definition', definition
        ) order by child_table, conname
      )
      from refs
      where child_table in (select table_name from public_closure)
         or parent_table in (select table_name from public_closure)
    ), '[]'::jsonb)
  )
);
