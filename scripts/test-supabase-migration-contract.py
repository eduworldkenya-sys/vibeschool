#!/usr/bin/env python3
"""Self-contained regression tests for the migration access-contract guard."""

from __future__ import annotations

import importlib.util
import tempfile
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
VALIDATOR = ROOT / "scripts" / "validate-supabase-migration-contract.py"
SPEC = importlib.util.spec_from_file_location("migration_contract", VALIDATOR)
assert SPEC and SPEC.loader
MODULE = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(MODULE)


def errors_for(sql: str) -> list[str]:
    with tempfile.TemporaryDirectory() as directory:
        path = Path(directory) / "migration.sql"
        path.write_text(sql, encoding="utf-8")
        return MODULE.validate(path)


def require(condition: bool, message: str) -> None:
    if not condition:
        raise AssertionError(message)


secure = """
create table public.secure_items (id uuid primary key);
alter table public.secure_items enable row level security;
revoke all on table public.secure_items from public, anon, authenticated;
grant select on table public.secure_items to authenticated;
create policy secure_items_owner on public.secure_items for select
to authenticated using ((select auth.uid()) = id);
-- authorization-test: public.secure_items anon/wrong-user denied; owner allowed
"""
require(errors_for(secure) == [], "complete access contract must pass")

missing_rls = secure.replace(
    "alter table public.secure_items enable row level security;", ""
)
require(
    any("missing ENABLE ROW LEVEL SECURITY" in error for error in errors_for(missing_rls)),
    "missing RLS must fail",
)

missing_policy = secure.replace(
    "create policy secure_items_owner on public.secure_items for select\n"
    "to authenticated using ((select auth.uid()) = id);",
    "",
)
require(
    any("missing policy" in error for error in errors_for(missing_policy)),
    "missing policy must fail",
)

missing_grants = secure.replace(
    "revoke all on table public.secure_items from public, anon, authenticated;\n"
    "grant select on table public.secure_items to authenticated;",
    "",
)
require(
    any("missing explicit GRANT/REVOKE" in error for error in errors_for(missing_grants)),
    "missing object privilege contract must fail",
)

missing_auth_test = secure.replace(
    "-- authorization-test: public.secure_items anon/wrong-user denied; owner allowed",
    "",
)
require(
    any("missing authorization-test" in error for error in errors_for(missing_auth_test)),
    "missing authorization regression declaration must fail",
)

blanket = secure + "\ngrant all privileges on table public.secure_items to authenticated;\n"
require(
    any("blanket GRANT ALL" in error for error in errors_for(blanket)),
    "blanket authenticated grant must fail",
)

service_only = """
create table public.internal_jobs (id bigint generated always as identity primary key);
alter table public.internal_jobs enable row level security;
revoke all on table public.internal_jobs from public, anon, authenticated;
grant select, insert, update, delete on table public.internal_jobs to service_role;
-- access: service-only public.internal_jobs
-- authorization-test: public.internal_jobs anon/authenticated denied; service allowed
"""
require(errors_for(service_only) == [], "declared service-only table must pass")

private_schema = """
create table if not exists worker_engine_legacy_archive.lineage_manifest (
  object_name text primary key
);
alter table worker_engine_legacy_archive.lineage_manifest enable row level security;
revoke all on table worker_engine_legacy_archive.lineage_manifest from public, anon, authenticated, service_role;
-- access: owner-only worker_engine_legacy_archive.lineage_manifest
-- authorization-test: worker_engine_legacy_archive.lineage_manifest public/anon/authenticated/service_role denied; migration owner only
"""
require(
    errors_for(private_schema) == [],
    "schema-qualified owner-only table with explicit deny contract must pass",
)

private_missing_rls = private_schema.replace(
    "alter table worker_engine_legacy_archive.lineage_manifest enable row level security;",
    "",
)
require(
    any(
        "worker_engine_legacy_archive.lineage_manifest: missing ENABLE ROW LEVEL SECURITY" in error
        for error in errors_for(private_missing_rls)
    ),
    "schema-qualified table must be validated by full identity",
)

statement_boundary = """
grant all privileges on table public.internal_jobs to service_role;
grant select on table public.secure_items to authenticated;
"""
require(
    not any("blanket GRANT ALL" in error for error in errors_for(statement_boundary)),
    "GRANT ALL to service_role must not bleed into a later authenticated grant",
)

print("PASS: Supabase migration contract guard rejects unsafe table migrations")
