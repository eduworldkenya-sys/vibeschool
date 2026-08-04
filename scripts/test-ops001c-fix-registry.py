#!/usr/bin/env python3
from pathlib import Path
import json
import subprocess
import tempfile

ROOT = Path(__file__).resolve().parents[1]
REGISTRY = ROOT / "scripts/agent/registry.json"
TOOL = ROOT / "scripts/agent/registry.py"
RUNNER = ROOT / "scripts/vibeschool-agent.sh"
COMMON = ROOT / "scripts/agent/common.sh"


def require(condition: bool, message: str) -> None:
    if not condition:
        raise AssertionError(message)
    print(f"PASS: {message}")


require(REGISTRY.exists(), "structured fix registry exists")
require(TOOL.exists(), "registry selector exists")

data = json.loads(REGISTRY.read_text(encoding="utf-8"))
require(data["schema_version"] == 1, "registry schema is versioned")

fixes = data["fixes"]
ids = [item["id"] for item in fixes]

require(len(ids) == len(set(ids)), "fix identifiers are unique")
require("LP-002A2B" in ids, "active lesson-plan fix is registered")
require("OPS-001C" in ids, "current operations milestone is registered")

lp = next(item for item in fixes if item["id"] == "LP-002A2B")
require(lp["status"] == "complete", "LP-002A2B is complete")
require(
    lp.get("completion_commit") == "a4b0987",
    "LP-002A2B records its verified completion commit",
)
require(
    lp.get("definition") is None,
    "completed LP-002A2B no longer exposes an executable definition",
)

lp_next = next(item for item in fixes if item["id"] == "LP-002A2C")
require(
    lp_next["status"] == "planned",
    "LP-002A2C is the next planned lesson-plan fix",
)
require(
    lp_next.get("definition") is None,
    "LP-002A2C is not selectable before an executable definition exists",
)

completed = {
    item["id"]
    for item in fixes
    if item["status"] == "complete"
}
require(
    all(dep in completed for dep in lp_next["depends_on"]),
    "LP-002A2C dependencies are complete",
)

validate = subprocess.run(
    ["python3", str(TOOL), "validate"],
    cwd=ROOT,
    text=True,
    capture_output=True,
)
require(validate.returncode == 0, "registry validates")
require("REGISTRY=VALID" in validate.stdout, "validator emits machine status")

next_result = subprocess.run(
    ["python3", str(TOOL), "next"],
    cwd=ROOT,
    text=True,
    capture_output=True,
)
require(
    next_result.returncode == 2,
    "next-fix selector reports no executable fix",
)
require(
    "NEXT_FIX=NONE" in next_result.stdout,
    "selector does not invent an executable LP-002A2C definition",
)

runner_text = RUNNER.read_text(encoding="utf-8")
common_text = COMMON.read_text(encoding="utf-8")

require(
    "agent_run_next_fix" in runner_text,
    "runner supports automatic fix execution",
)
require(
    "agent_show_next_fix" in runner_text,
    "runner exposes next-fix inspection",
)
require(
    "agent_list_fixes" in runner_text,
    "runner exposes registry listing",
)
require(
    "python3 \"$AGENT_REGISTRY_TOOL\" next" in common_text,
    "shared runner delegates selection to registry authority",
)

require(
    "scripts/test-ops001c-fix-registry" in common_text,
    "OPS-001C bootstrap test file is classified before commit",
)

with tempfile.TemporaryDirectory() as tmp:
    bad_path = Path(tmp) / "bad.json"
    bad_data = json.loads(REGISTRY.read_text())
    bad_data["fixes"].append(dict(bad_data["fixes"][0]))
    bad_path.write_text(json.dumps(bad_data), encoding="utf-8")

    bad = subprocess.run(
        [
            "python3",
            str(TOOL),
            "validate",
            "--registry",
            str(bad_path),
        ],
        cwd=ROOT,
        text=True,
        capture_output=True,
    )

    require(bad.returncode != 0, "duplicate fix identifiers fail closed")
    require(
        "duplicate fix id" in bad.stdout,
        "duplicate failure is explicit",
    )

print("OPS-001C structured fix registry tests PASSED")
