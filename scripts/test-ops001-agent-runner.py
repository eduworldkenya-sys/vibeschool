#!/usr/bin/env python3
from pathlib import Path
import json
import subprocess
import tempfile

ROOT = Path(__file__).resolve().parents[1]

runner = ROOT / "scripts/vibeschool-agent.sh"
common = ROOT / "scripts/agent/common.sh"
report = ROOT / "scripts/agent/report.py"
fix = ROOT / "scripts/agent/fixes/LP-002A2B.sh"
state = ROOT / ".vibeschool-agent/state.json"


def require(condition: bool, message: str) -> None:
    if not condition:
        raise AssertionError(message)
    print(f"PASS: {message}")


require(runner.exists(), "agent entrypoint exists")
require(common.exists(), "shared runner library exists")
require(report.exists(), "compact report generator exists")
require(fix.exists(), "LP-002A2B fix definition exists")

runner_text = runner.read_text()
common_text = common.read_text()
fix_text = fix.read_text()

require(
    'agent_run_fix "$ARGUMENT"' in runner_text,
    "runner dispatches registered fix audits",
)
require(
    'agent_abort "unregistered fix ID' in common_text,
    "unknown fixes fail closed",
)
require(
    "does not execute database migrations" in runner_text,
    "read-only safety is documented",
)
require(
    "git commit" not in common_text and "git push" not in common_text,
    "runner cannot commit or push",
)
require(
    "supabase db push" not in fix_text
    and "supabase migration" not in fix_text
    and ".rpc(" not in fix_text,
    "registered audit cannot mutate Supabase",
)
require(
    "AUDIT_EXIT=" in fix_text
    and "TEST_EXIT=" in fix_text
    and "DIFF_EXIT=" in fix_text,
    "fix definition emits machine-readable results",
)
require(
    "FINDING=" in fix_text and "NEXT_ACTION=" in fix_text,
    "fix definition emits compact engineering guidance",
)

require(
    "last_run = data.get(\"last_run\")" in common_text,
    "agent status handles an empty last-run state",
)

require(
    "scripts/vibeschool-agent" in common_text
    and "scripts/agent/" in common_text,
    "bootstrap implementation files are explicitly classified",
)

require(
    r"\.vibeschool-agent/" in common_text,
    "untracked agent state directory is classified during bootstrap",
)

require(
    r"scripts/agent/.*" in common_text,
    "untracked agent implementation directory is classified during bootstrap",
)

require(
    '"mode": "read_only"' in report.read_text(),
    "report generator writes read-only runtime state",
)

with tempfile.TemporaryDirectory() as tmp:
    raw = Path(tmp) / "raw.log"
    report_path = Path(tmp) / "report.md"
    state_path = Path(tmp) / "state.json"

    raw.write_text(
        "\n".join(
            [
                "AUDIT_EXIT=0",
                "TEST_EXIT=0",
                "SCOPE_EXIT=0",
                "DIFF_EXIT=0",
                "FINDING=test finding",
            ]
        )
        + "\n"
    )

    completed = subprocess.run(
        [
            "python3",
            str(report),
            "--fix-id",
            "TEST-001",
            "--run-id",
            "test-run",
            "--exit-code",
            "0",
            "--raw-log",
            str(raw),
            "--report",
            str(report_path),
            "--state",
            str(state_path),
        ],
        cwd=ROOT,
        text=True,
        capture_output=True,
    )

    require(completed.returncode == 0, "report generator executes")
    require("RESULT=PASS" in report_path.read_text(), "report is compact and machine-readable")
    require(
        json.loads(state_path.read_text())["last_run"]["status"] == "PASS",
        "report generator updates agent state",
    )

print("OPS-001 autonomous runner contract tests PASSED")
