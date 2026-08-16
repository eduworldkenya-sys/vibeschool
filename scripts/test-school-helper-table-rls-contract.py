#!/usr/bin/env python3
from pathlib import Path

migration = Path('supabase/migrations/20260816184500_school_helper_tables_enable_rls.sql').read_text(encoding='utf-8').lower()

for table in ('school_levels', 'school_aliases', 'school_directory_sources'):
    assert f'alter table public.{table} enable row level security;' in migration, table

# The migration must not add client policies or restore direct client grants.
assert 'create policy' not in migration
assert 'grant ' not in migration
assert 'anon' not in migration
assert 'authenticated' not in migration

print('school helper-table RLS contract: PASS')
