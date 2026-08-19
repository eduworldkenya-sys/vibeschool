#!/usr/bin/env python3
"""VibeSchool Engineering Control Plane.

Deterministic, stdlib-only classifier and certification-freshness gate.
It deliberately does not mutate GitHub or production systems.
"""
from __future__ import annotations

import argparse
import hashlib
import json
import re
import subprocess
import sys
from dataclasses import asdict, dataclass
from pathlib import Path
from typing import Iterable

STATES = {
    "DEVELOPING", "BRANCH GREEN", "RECONCILE REQUIRED", "RECONCILING",
    "INTEGRATION GREEN", "SECURITY GREEN", "MERGE READY", "MERGED FOUNDATION",
    "BLOCKED FOUNDATION", "BLOCKED SECURITY", "BLOCKED DATA INTEGRITY",
    "BLOCKED PRODUCTION DRIFT", "SUPERSEDED", "ABANDONED",
}

DOMAINS = {
    "AUTH": ("src/app/auth/", "src/lib/auth", "middleware", "oauth", "password", "onboarding"),
    "DATABASE": ("supabase/migrations/", "supabase/schema", "database.types", "types/database"),
    "AUTHORIZATION": ("rls", "grant", "revoke", "security_definer", "storage", "authorization", "policy"),
    "IDENTITY": ("profile", "student", "teacher", "parent", "school_identity", "membership", "claim"),
    "HQ": ("src/app/hq/", "hq_", "founder"),
    "WORKER": ("worker", "autopilot", "workforce"),
    "TELEMETRY": ("telemetry", "analytics", "observability", "metric", "event"),
    "PAYMENTS": ("mpesa", "payment", "daraja", "wallet", "finance"),
    "CI": (".github/workflows/", ".github/actions/", "engineering_control_plane", "ci/"),
}

SECURITY_DOMAINS = {"AUTHORIZATION", "AUTH", "IDENTITY", "DATABASE", "WORKER", "PAYMENTS"}
SHARED_DOMAINS = {"AUTH", "DATABASE", "AUTHORIZATION", "IDENTITY", "CI"}

@dataclass(frozen=True)
class Classification:
    paths: list[str]
    domains: list[str]
    security_critical: bool
    shared_contract: bool
    requires_reconstruction: bool
    requires_generated_types: bool
    requires_build: bool


def run(*args: str, check: bool = True) -> str:
    p = subprocess.run(args, text=True, stdout=subprocess.PIPE, stderr=subprocess.PIPE)
    if check and p.returncode:
        raise RuntimeError(f"command failed: {' '.join(args)}\n{p.stderr.strip()}")
    return p.stdout.strip()


def changed_paths(base: str, head: str) -> list[str]:
    out = run("git", "diff", "--name-only", f"{base}...{head}")
    return sorted(x for x in out.splitlines() if x.strip())


def classify(paths: Iterable[str]) -> Classification:
    normalized = sorted(set(paths))
    domains: set[str] = set()
    lowered = [p.lower() for p in normalized]
    for domain, needles in DOMAINS.items():
        if any(any(needle.lower() in p for needle in needles) for p in lowered):
            domains.add(domain)
    requires_build = any(p.startswith(("src/", "app/", "pages/", "components/", "next.config", "package")) for p in normalized)
    return Classification(
        paths=normalized,
        domains=sorted(domains),
        security_critical=bool(domains & SECURITY_DOMAINS),
        shared_contract=bool(domains & SHARED_DOMAINS),
        requires_reconstruction="DATABASE" in domains,
        requires_generated_types="DATABASE" in domains or "IDENTITY" in domains,
        requires_build=requires_build,
    )


def migration_inventory(root: Path) -> dict:
    migration_dir = root / "supabase" / "migrations"
    files = sorted(p.name for p in migration_dir.glob("*.sql")) if migration_dir.exists() else []
    versions: dict[str, list[str]] = {}
    invalid: list[str] = []
    for name in files:
        m = re.match(r"^(\d{8,14})_[A-Za-z0-9_.-]+\.sql$", name)
        if not m:
            invalid.append(name)
            continue
        versions.setdefault(m.group(1), []).append(name)
    duplicates = {v: n for v, n in versions.items() if len(n) > 1}
    digest = hashlib.sha256("\n".join(files).encode()).hexdigest()
    return {
        "count": len(files), "distinct_versions": len(versions),
        "duplicates": duplicates, "invalid": invalid,
        "sha256": digest,
    }


def workflow_audit(root: Path) -> dict:
    wf_dir = root / ".github" / "workflows"
    findings = []
    total = 0
    with_concurrency = 0
    self_push_risk = []
    for path in sorted(list(wf_dir.glob("*.yml")) + list(wf_dir.glob("*.yaml"))):
        total += 1
        text = path.read_text(errors="replace")
        low = text.lower()
        if "\nconcurrency:" in low:
            with_concurrency += 1
        push_trigger = bool(re.search(r"(?m)^\s*push\s*:", text))
        pushes_git = bool(re.search(r"(?m)\bgit\s+push\b", text))
        if push_trigger and pushes_git:
            self_push_risk.append(str(path.relative_to(root)))
        if "pull_request_target" in low and "actions/checkout" in low:
            findings.append({"severity": "RED", "file": str(path.relative_to(root)), "kind": "PULL_REQUEST_TARGET_CHECKOUT"})
    return {
        "workflow_count": total,
        "with_concurrency": with_concurrency,
        "without_concurrency": total - with_concurrency,
        "self_push_risk": self_push_risk,
        "findings": findings,
    }


def is_exact_current_main(main_ref: str, head: str) -> bool:
    return subprocess.run(["git", "merge-base", "--is-ancestor", main_ref, head]).returncode == 0


def evidence_status(candidate_sha: str, main_sha: str, classification: Classification, inputs: dict) -> tuple[str, list[str]]:
    blockers: list[str] = []
    if inputs.get("candidate_sha") != candidate_sha:
        blockers.append("STALE OR MISSING EXACT-HEAD EVIDENCE")
    if inputs.get("main_sha") != main_sha:
        blockers.append("STALE OR MISSING EXACT-CURRENT-MAIN EVIDENCE")
    if classification.security_critical and inputs.get("security") != "GREEN":
        blockers.append("SECURITY CERTIFICATION NOT GREEN")
    if classification.requires_reconstruction and inputs.get("reconstruction") != "GREEN":
        blockers.append("CLEAN DATABASE RECONSTRUCTION NOT GREEN")
    if classification.requires_generated_types and inputs.get("generated_types") != "GREEN":
        blockers.append("GENERATED TYPE PARITY NOT GREEN")
    if classification.requires_build and inputs.get("build") != "GREEN":
        blockers.append("PRODUCTION BUILD NOT GREEN")
    if inputs.get("unresolved_red", 0) != 0:
        blockers.append("UNRESOLVED RED FINDINGS")
    return ("MERGE READY" if not blockers else "RECONCILE REQUIRED", blockers)


def adversarial_self_test() -> None:
    c = classify(["supabase/migrations/20260819000000_test.sql"])
    state, blockers = evidence_status("head-b", "main-b", c, {
        "candidate_sha": "head-b", "main_sha": "main-a", "security": "GREEN",
        "reconstruction": "GREEN", "generated_types": "GREEN", "build": "GREEN", "unresolved_red": 0,
    })
    assert state == "RECONCILE REQUIRED" and any("CURRENT-MAIN" in x for x in blockers)
    state, blockers = evidence_status("h", "m", classify(["src/lib/authorization.ts"]), {
        "candidate_sha": "h", "main_sha": "m", "security": "RED",
        "reconstruction": "GREEN", "generated_types": "GREEN", "build": "GREEN", "unresolved_red": 0,
    })
    assert state != "MERGE READY" and any("SECURITY" in x for x in blockers)
    docs = classify(["docs/notes/example.md"])
    assert not docs.requires_reconstruction and not docs.security_critical
    state, blockers = evidence_status("new", "m", docs, {"candidate_sha": "old", "main_sha": "m", "unresolved_red": 0})
    assert state != "MERGE READY" and any("HEAD" in x for x in blockers)
    assert re.match(r"^(\d{8,14})_", "20260523_class_groups.sql")
    assert re.match(r"^(\d{8,14})_", "20260819113112_example.sql")


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--base", default="origin/main")
    parser.add_argument("--head", default="HEAD")
    parser.add_argument("--mode", choices=("classify", "audit", "promotion", "self-test"), default="audit")
    parser.add_argument("--evidence", help="JSON evidence file for promotion mode")
    parser.add_argument("--output", default="control-plane-report.json")
    args = parser.parse_args()
    root = Path.cwd()

    if args.mode == "self-test":
        adversarial_self_test()
        print("engineering control-plane adversarial self-test: PASS")
        return 0

    classification = classify(changed_paths(args.base, args.head))
    report = {
        "candidate_sha": run("git", "rev-parse", args.head),
        "base_ref": args.base,
        "base_sha": run("git", "rev-parse", args.base),
        "classification": asdict(classification),
        "migration_inventory": migration_inventory(root),
        "workflow_audit": workflow_audit(root),
    }
    red = report["workflow_audit"]["findings"]
    mig = report["migration_inventory"]
    if mig["duplicates"] or mig["invalid"]:
        red.append({"severity": "RED", "kind": "MIGRATION_INVENTORY_INTEGRITY", "details": {"duplicates": mig["duplicates"], "invalid": mig["invalid"]}})

    if args.mode == "promotion":
        if not args.evidence:
            raise SystemExit("--evidence is required for promotion mode")
        inputs = json.loads(Path(args.evidence).read_text())
        current_main = run("git", "rev-parse", args.base)
        state, blockers = evidence_status(report["candidate_sha"], current_main, classification, inputs)
        if not is_exact_current_main(args.base, args.head):
            state = "RECONCILE REQUIRED"
            blockers.append("CURRENT MAIN IS NOT AN ANCESTOR OF CANDIDATE")
        if red:
            state = "BLOCKED SECURITY" if any(f.get("kind") == "PULL_REQUEST_TARGET_CHECKOUT" for f in red) else "BLOCKED DATA INTEGRITY"
            blockers.append("CONTROL-PLANE RED FINDINGS PRESENT")
        report["promotion"] = {"state": state, "blockers": sorted(set(blockers)), "evidence": inputs}

    Path(args.output).write_text(json.dumps(report, indent=2) + "\n")
    print(json.dumps(report, indent=2))
    if red:
        return 2
    if args.mode == "promotion" and report["promotion"]["state"] != "MERGE READY":
        return 3
    return 0

if __name__ == "__main__":
    sys.exit(main())
