#!/usr/bin/env python3
"""Read-only WE-R1.4 production deployment attestation.

This is intentionally separate from activation. It proves the deployed schema matches the
certified repository migration family and that all autonomous switches/authority remain OFF.
"""
from __future__ import annotations

import hashlib
import importlib.util
import json
import subprocess
from pathlib import Path

BASE_PATH = Path(__file__).with_name("worker-engine-verify-production-contract.py")
spec = importlib.util.spec_from_file_location("worker_engine_base_verifier", BASE_PATH)
assert spec and spec.loader
base = importlib.util.module_from_spec(spec)
spec.loader.exec_module(base)

MIGRATIONS = Path("supabase/migrations")
EVIDENCE = Path(".worker-engine-production-verify/r1-4-attestation.json")

REQUIRED_RELATIONS = [
    "hq_workforce_capability_authority_grants",
    "hq_workforce_execution_intents",
    "hq_workforce_execution_verifications",
    "hq_workforce_execution_compensations",
    "hq_workforce_execution_outcomes",
    "hq_workforce_execution_escalations",
    "hq_workforce_execution_breakers",
    "hq_workforce_execution_breaker_events",
    "hq_workforce_canary_queue_memberships",
    "hq_workforce_verifier_assignments",
    "hq_workforce_execution_envelopes",
]
REQUIRED_FUNCTIONS = [
    "public.hq_workforce_consequential_execution_gateway(uuid)",
    "public.hq_workforce_verify_consequential_execution(uuid,text)",
    "public.hq_workforce_compensate_consequential_execution(uuid,text,text)",
    "public.hq_workforce_assert_execution_not_stopped(uuid,text)",
    "public.hq_workforce_get_execution_dossier(uuid)",
    "public.hq_workforce_assign_verifier(uuid,text,timestamptz)",
    "public.hq_workforce_scheduled_factory_heartbeat()",
]


def die(msg: str) -> None:
    base.die(f"WE-R1.4 attestation: {msg}")


def release_migrations() -> list[Path]:
    files: list[Path] = []
    for path in sorted(MIGRATIONS.glob("20260815*_worker_engine*.sql")):
        files.append(path)
    for path in sorted(MIGRATIONS.glob("20260816*_worker_engine_production_readiness*.sql")):
        files.append(path)
    if not files:
        die("release migration family is empty")
    return files


def sha256(path: Path) -> str:
    return hashlib.sha256(path.read_bytes()).hexdigest()


def git_head() -> str:
    cp = subprocess.run(["git", "rev-parse", "HEAD"], text=True, capture_output=True, check=False)
    if cp.returncode != 0:
        die("cannot resolve exact Git HEAD")
    return cp.stdout.strip()


def main() -> None:
    paths = release_migrations()
    versions = [p.name.split("_", 1)[0] for p in paths]
    if len(versions) != len(set(versions)):
        die("duplicate release migration version")

    ledger_sql = ",".join(base.sql_literal(v) for v in versions)
    rows = base.query(f"select version::text as version from supabase_migrations.schema_migrations where version::text in ({ledger_sql}) order by version::text")
    present = sorted(str(r["version"]) for r in rows)
    missing_versions = sorted(set(versions) - set(present))
    if missing_versions:
        die(f"production migration ledger missing {missing_versions}")

    relation_values = ",".join(f"({base.sql_literal(x)})" for x in REQUIRED_RELATIONS)
    rels = base.query(f"""
      select v.name, pg_catalog.to_regclass('public.'||v.name)::text as resolved
      from (values {relation_values}) v(name)
    """)
    missing_relations = [r["name"] for r in rels if not r["resolved"]]
    if missing_relations:
        die(f"missing R1.4 relations: {missing_relations}")

    fn_values = ",".join(f"({base.sql_literal(x)})" for x in REQUIRED_FUNCTIONS)
    fns = base.query(f"""
      select v.signature,
             pg_catalog.to_regprocedure(v.signature)::text as resolved,
             case when pg_catalog.to_regprocedure(v.signature) is null then null
                  else encode(digest(pg_get_functiondef(pg_catalog.to_regprocedure(v.signature)),'sha256'),'hex') end as definition_sha256,
             case when pg_catalog.to_regprocedure(v.signature) is null then false
                  else has_function_privilege('service_role',pg_catalog.to_regprocedure(v.signature),'EXECUTE') end as service_execute,
             case when pg_catalog.to_regprocedure(v.signature) is null then false
                  else has_function_privilege('authenticated',pg_catalog.to_regprocedure(v.signature),'EXECUTE') end as authenticated_execute
      from (values {fn_values}) v(signature)
    """)
    missing_functions = [r["signature"] for r in fns if not r["resolved"]]
    if missing_functions:
        die(f"missing R1.4 functions: {missing_functions}")

    legacy = base.query("""
      select has_function_privilege('service_role','public.hq_workforce_execute_safe_queue()','EXECUTE') as service_execute
    """)
    if legacy[0]["service_execute"]:
        die("legacy hq_workforce_execute_safe_queue remains service-role executable")

    state_rows = base.query("""
      select heartbeat_enabled,factory_enabled,runtime_execution_enabled,runtime_autonomy_level,
             runtime_max_risk,runtime_anomaly_paused,shadow_enabled,shadow_scheduler_enabled,shadow_global_stop
      from public.hq_workforce_engine_contract where singleton=true
    """)
    if len(state_rows) != 1:
        die("engine contract singleton missing")
    s = state_rows[0]
    expected = {
        "heartbeat_enabled": False,
        "factory_enabled": False,
        "runtime_execution_enabled": False,
        "runtime_autonomy_level": 0,
        "runtime_max_risk": 0,
        "runtime_anomaly_paused": False,
        "shadow_enabled": False,
        "shadow_scheduler_enabled": False,
        "shadow_global_stop": True,
    }
    mismatch = {k: s.get(k) for k, v in expected.items() if s.get(k) != v}
    if mismatch:
        die(f"fail-closed state mismatch: {mismatch}")

    counts = base.query("""
      select
        (select count(*)::int from public.hq_workforce_capability_authority_grants where status='active') as active_authority,
        (select count(*)::int from public.hq_workforce_runtime_policies where status='active') as active_policies,
        (select count(*)::int from public.hq_workforce_verifier_assignments where status='assigned') as assigned_verifiers
    """)[0]
    if any(int(counts[k]) != 0 for k in counts):
        die(f"unexpected production authority/policy/verifier activation: {counts}")

    factory = base.query("select lower(pg_get_functiondef('public.hq_workforce_scheduled_factory_heartbeat()'::regprocedure)) as def")[0]["def"]
    if "runtime_execution_enabled" not in factory or "runtime_anomaly_paused" not in factory:
        die("Factory heartbeat does not obey runtime/anomaly master gates")

    verifier_acl = next(r for r in fns if r["signature"] == "public.hq_workforce_assign_verifier(uuid,text,timestamptz)")
    if verifier_acl["service_execute"] or not verifier_acl["authenticated_execute"]:
        die("verifier assignment ACL does not match owner-gated transport contract")
    dossier_acl = next(r for r in fns if r["signature"] == "public.hq_workforce_get_execution_dossier(uuid)")
    if dossier_acl["service_execute"] or not dossier_acl["authenticated_execute"]:
        die("execution dossier ACL does not match owner-only read contract")

    cron_rel = base.query("select pg_catalog.to_regclass('cron.job')::text as relation")[0]["relation"]
    cron_count = 0
    if cron_rel:
        cron_count = int(base.query("""
          select count(*)::int as count from cron.job
          where lower(jobname) like '%worker%engine%' or lower(jobname) like '%heartbeat%'
             or lower(command) like '%hq_workforce_scheduled_factory_heartbeat%'
        """)[0]["count"])
    if cron_count:
        die(f"Worker Engine cron remains active/present: {cron_count}")

    evidence = {
        "status": "PASSED",
        "git_sha": git_head(),
        "release_migrations": [{"version": v, "path": str(p), "sha256": sha256(p)} for v, p in zip(versions, paths)],
        "function_definitions": {r["signature"]: r["definition_sha256"] for r in fns},
        "required_relations": REQUIRED_RELATIONS,
        "engine_state": s,
        "active_counts": counts,
        "worker_engine_cron_count": cron_count,
    }
    EVIDENCE.parent.mkdir(parents=True, exist_ok=True)
    EVIDENCE.write_text(json.dumps(evidence, indent=2, sort_keys=True) + "\n", encoding="utf-8")
    print("WE-R1.4 PRODUCTION DEPLOYMENT ATTESTATION PASSED")
    print(f"git_sha={evidence['git_sha']}")
    print(f"migration_count={len(paths)}")
    print("runtime_execution_enabled=false")
    print("active_authority=0")
    print("active_policies=0")
    print("worker_engine_cron_count=0")


if __name__ == "__main__":
    main()
