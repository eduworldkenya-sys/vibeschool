#!/usr/bin/env python3
"""Read-only production verification for the promoted Worker Engine.

Uses Supabase Management API's read-only SQL endpoint. No DDL/DML is issued.
The verifier proves the exact promotion ledger, Worker Engine catalog presence,
RLS/direct-access boundaries, and that autonomous runtime switches remain off.
"""
from __future__ import annotations

import json
import os
import re
import subprocess
import sys
from pathlib import Path

PROJECT_REF = os.environ.get("SUPABASE_PROJECT_REF", "").strip()
ACCESS_TOKEN = os.environ.get("SUPABASE_ACCESS_TOKEN", "").strip()
EVIDENCE_PATH = Path(os.environ.get("WORKER_ENGINE_VERIFY_EVIDENCE", ".worker-engine-production-verify/verification.json"))
MIGRATIONS_DIR = Path("supabase/migrations")

APPROVED_VERSIONS = [
    "20260812191500", "20260812191600", "20260812193000", "20260812194000",
    "20260812195000", "20260812200000", "20260812201000", "20260812202000",
    "20260812202100", "20260812202200", "20260812202300", "20260812202400",
    "20260812202500", "20260812202600", "20260812211500", "20260812213000",
    "20260812214500", "20260812215500", "20260812221000", "20260812222000",
    "20260812223000", "20260813023028",
]

TABLE_RE = re.compile(r"create\s+table\s+(?:if\s+not\s+exists\s+)?public\.([a-zA-Z0-9_]+)", re.I)
FUNCTION_RE = re.compile(r"create\s+or\s+replace\s+function\s+public\.([a-zA-Z0-9_]+)\s*\(", re.I)


def die(message: str) -> None:
    print(f"WORKER ENGINE PRODUCTION VERIFICATION FAILED: {message}", file=sys.stderr)
    raise SystemExit(1)


def sql_literal(value: str) -> str:
    return "'" + value.replace("'", "''") + "'"


def rows_from_response(payload):
    if isinstance(payload, list):
        return payload
    if isinstance(payload, dict):
        for key in ("result", "data", "rows"):
            if isinstance(payload.get(key), list):
                return payload[key]
    die(f"unexpected Management API response shape: {type(payload).__name__}")


def query(sql: str):
    if not PROJECT_REF or not ACCESS_TOKEN:
        die("SUPABASE_PROJECT_REF and SUPABASE_ACCESS_TOKEN are required")

    url = f"https://api.supabase.com/v1/projects/{PROJECT_REF}/database/query/read-only"
    body = json.dumps({"query": sql, "parameters": []})

    # GitHub-hosted runners were blocked by Cloudflare Error 1010 when Python's
    # urllib TLS/client signature called api.supabase.com directly. Use curl as
    # the HTTP transport while keeping the same official read-only Management API
    # endpoint and bearer-token authentication. This does not change database
    # privileges or the read-only safety boundary.
    completed = subprocess.run(
        [
            "curl",
            "--silent",
            "--show-error",
            "--fail-with-body",
            "--max-time",
            "60",
            "--request",
            "POST",
            url,
            "--header",
            f"Authorization: Bearer {ACCESS_TOKEN}",
            "--header",
            "Content-Type: application/json",
            "--header",
            "Accept: application/json",
            "--header",
            "User-Agent: Vibeschool-Worker-Engine-Production-Verifier/1.0",
            "--data-binary",
            "@-",
        ],
        input=body,
        text=True,
        capture_output=True,
        timeout=70,
        check=False,
    )
    if completed.returncode != 0:
        detail = (completed.stderr or completed.stdout or "curl request failed").strip()
        die(f"read-only Management API query transport failed: {detail[:700]}")
    try:
        payload = json.loads(completed.stdout)
    except json.JSONDecodeError as exc:
        die(f"read-only Management API returned non-JSON response: {completed.stdout[:500]} ({exc})")
    return rows_from_response(payload)


def approved_migration_paths():
    paths = []
    for version in APPROVED_VERSIONS:
        matches = sorted(MIGRATIONS_DIR.glob(f"{version}_*.sql"))
        if len(matches) != 1:
            die(f"expected exactly one repository migration for {version}, found {len(matches)}")
        paths.append(matches[0])
    return paths


def collect_expected_objects(paths):
    tables, functions = set(), set()
    for path in paths:
        text = path.read_text(encoding="utf-8")
        tables.update(TABLE_RE.findall(text))
        functions.update(FUNCTION_RE.findall(text))
    if not tables or not functions:
        die("failed to extract expected Worker Engine tables/functions from certified migrations")
    return sorted(tables), sorted(functions)


def main() -> None:
    paths = approved_migration_paths()
    expected_tables, expected_functions = collect_expected_objects(paths)
    evidence = {
        "project_ref": PROJECT_REF,
        "approved_versions": APPROVED_VERSIONS,
        "expected_tables": expected_tables,
        "expected_functions": expected_functions,
        "checks": {},
    }

    versions_sql = ",".join(sql_literal(v) for v in APPROVED_VERSIONS)
    ledger = query(f"""
        select version::text as version
        from supabase_migrations.schema_migrations
        where version::text in ({versions_sql})
        order by version::text
    """)
    present_versions = sorted(str(row["version"]) for row in ledger)
    if present_versions != sorted(APPROVED_VERSIONS):
        missing = sorted(set(APPROVED_VERSIONS) - set(present_versions))
        extra = sorted(set(present_versions) - set(APPROVED_VERSIONS))
        die(f"promotion ledger mismatch; missing={missing} extra={extra}")
    evidence["checks"]["migration_ledger"] = {"status": "PASSED", "present_count": len(present_versions)}

    tables_sql = ",".join(sql_literal(v) for v in expected_tables)
    table_rows = query(f"""
        select c.relname as table_name,
               c.relrowsecurity as rls_enabled,
               (has_table_privilege('anon', c.oid, 'SELECT')
                or has_table_privilege('anon', c.oid, 'INSERT')
                or has_table_privilege('anon', c.oid, 'UPDATE')
                or has_table_privilege('anon', c.oid, 'DELETE')) as anon_dml,
               (has_table_privilege('authenticated', c.oid, 'SELECT')
                or has_table_privilege('authenticated', c.oid, 'INSERT')
                or has_table_privilege('authenticated', c.oid, 'UPDATE')
                or has_table_privilege('authenticated', c.oid, 'DELETE')) as authenticated_dml
        from pg_catalog.pg_class c
        join pg_catalog.pg_namespace n on n.oid=c.relnamespace
        where n.nspname='public'
          and c.relkind in ('r','p')
          and c.relname in ({tables_sql})
        order by c.relname
    """)
    by_table = {row["table_name"]: row for row in table_rows}
    missing_tables = sorted(set(expected_tables) - set(by_table))
    if missing_tables:
        die(f"missing promoted tables: {missing_tables}")
    rls_off = sorted(name for name, row in by_table.items() if not row["rls_enabled"])
    exposed = sorted(name for name, row in by_table.items() if row["anon_dml"] or row["authenticated_dml"])
    if rls_off:
        die(f"RLS disabled on promoted Worker Engine tables: {rls_off}")
    if exposed:
        die(f"anon/authenticated direct DML remains on service-only Worker Engine tables: {exposed}")
    evidence["checks"]["tables_rls_grants"] = {"status": "PASSED", "table_count": len(by_table)}

    functions_sql = ",".join(sql_literal(v) for v in expected_functions)
    function_rows = query(f"""
        select p.proname as function_name,
               bool_or(has_function_privilege('anon', p.oid, 'EXECUTE')) as anon_execute,
               bool_or(has_function_privilege('authenticated', p.oid, 'EXECUTE')) as authenticated_execute
        from pg_catalog.pg_proc p
        join pg_catalog.pg_namespace n on n.oid=p.pronamespace
        where n.nspname='public' and p.proname in ({functions_sql})
        group by p.proname
        order by p.proname
    """)
    by_function = {row["function_name"]: row for row in function_rows}
    missing_functions = sorted(set(expected_functions) - set(by_function))
    if missing_functions:
        die(f"missing promoted functions: {missing_functions}")
    exposed_functions = sorted(name for name, row in by_function.items() if row["anon_execute"] or row["authenticated_execute"])
    if exposed_functions:
        die(f"anon/authenticated EXECUTE remains on service-only Worker Engine functions: {exposed_functions}")
    evidence["checks"]["function_grants"] = {"status": "PASSED", "function_name_count": len(by_function)}

    switches = query("""
        select heartbeat_enabled, factory_enabled
        from public.hq_workforce_engine_contract
        where singleton=true
    """)
    if len(switches) != 1:
        die(f"expected singleton Worker Engine contract row, found {len(switches)}")
    if switches[0]["heartbeat_enabled"] or switches[0]["factory_enabled"]:
        die(f"autonomous activation switch is enabled: {switches[0]}")
    evidence["checks"]["autonomy_switches"] = {"status": "PASSED", "heartbeat_enabled": False, "factory_enabled": False}

    cron_relation = query("select pg_catalog.to_regclass('cron.job')::text as relation")
    cron_count = 0
    if cron_relation and cron_relation[0].get("relation"):
        cron_rows = query("select count(*)::int as count from cron.job where jobname='vibeschool-worker-engine-heartbeat'")
        cron_count = int(cron_rows[0]["count"])
    if cron_count != 0:
        die(f"Worker Engine heartbeat remains scheduled in pg_cron: count={cron_count}")
    evidence["checks"]["scheduler_off"] = {"status": "PASSED", "heartbeat_job_count": cron_count}

    legacy_signatures = [
        "public.hq_workforce_create_probation_worker(text,text,text,jsonb)",
        "public.hq_workforce_certify_probation_worker(uuid,text)",
        "public.hq_workforce_certify_probation_workers()",
    ]
    values = ",".join(f"({sql_literal(v)})" for v in legacy_signatures)
    legacy = query(f"""
        select v.signature,
               pg_catalog.to_regprocedure(v.signature)::text as resolved,
               case when pg_catalog.to_regprocedure(v.signature) is null then false
                    else has_function_privilege('service_role', pg_catalog.to_regprocedure(v.signature), 'EXECUTE') end as service_execute,
               case when pg_catalog.to_regprocedure(v.signature) is null then false
                    else has_function_privilege('authenticated', pg_catalog.to_regprocedure(v.signature), 'EXECUTE') end as authenticated_execute,
               case when pg_catalog.to_regprocedure(v.signature) is null then false
                    else has_function_privilege('anon', pg_catalog.to_regprocedure(v.signature), 'EXECUTE') end as anon_execute
        from (values {values}) as v(signature)
    """)
    legacy_exposed = [row for row in legacy if row["resolved"] and (row["service_execute"] or row["authenticated_execute"] or row["anon_execute"])]
    if legacy_exposed:
        die(f"legacy worker creation/certification bypass remains executable: {legacy_exposed}")
    evidence["checks"]["legacy_bypass_closed"] = {"status": "PASSED", "checked": len(legacy)}

    EVIDENCE_PATH.parent.mkdir(parents=True, exist_ok=True)
    EVIDENCE_PATH.write_text(json.dumps(evidence, indent=2, sort_keys=True) + "\n", encoding="utf-8")
    print("WORKER ENGINE PRODUCTION CONTRACT VERIFICATION PASSED")
    print(f"approved_migrations={len(APPROVED_VERSIONS)}")
    print(f"verified_tables={len(expected_tables)}")
    print(f"verified_function_names={len(expected_functions)}")
    print("heartbeat_enabled=false")
    print("factory_enabled=false")
    print("heartbeat_cron_jobs=0")


if __name__ == "__main__":
    main()
