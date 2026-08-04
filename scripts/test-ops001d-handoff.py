#!/usr/bin/env python3
from pathlib import Path
import json
import subprocess
import tempfile

ROOT = Path(__file__).resolve().parents[1]

REGISTRY = ROOT / "scripts/agent/registry.json"
HANDOFF = ROOT / "scripts/agent/handoff.py"
RUNNER = ROOT / "scripts/vibeschool-agent.sh"
COMMON = ROOT / "scripts/agent/common.sh"


def require(condition: bool, message: str) -> None:
    if not condition:
        raise AssertionError(message)
    print(f"PASS: {message}")


require(HANDOFF.exists(), "implementation handoff generator exists")

data = json.loads(REGISTRY.read_text(encoding="utf-8"))
fix = next(item for item in data["fixes"] if item["id"] == "LP-002A2B")
contract = fix.get("handoff")

require(isinstance(contract, dict), "LP-002A2B has a structured handoff")
require(bool(contract.get("finding")), "handoff records the proven finding")
require(bool(contract.get("objective")), "handoff records the objective")
require(
    len(contract.get("affected_files", [])) >= 4,
    "handoff identifies implementation files",
)
require(
    len(contract.get("required_contracts", [])) >= 4,
    "handoff defines architecture contracts",
)
require(
    len(contract.get("safety_constraints", [])) >= 4,
    "handoff defines safety constraints",
)
require(
    "git diff --check" in contract.get("verification_commands", []),
    "handoff includes repository verification",
)

runner_text = RUNNER.read_text(encoding="utf-8")
common_text = COMMON.read_text(encoding="utf-8")
handoff_text = HANDOFF.read_text(encoding="utf-8")

require(
    'agent_generate_handoff "$ARGUMENT"' in runner_text,
    "runner exposes the handoff command",
)
require(
    "agent_generate_handoff()" in common_text,
    "shared runner implements handoff generation",
)
require(
    "scripts/test-ops001d-handoff" in common_text,
    "OPS-001D bootstrap test is classified",
)
require(
    "git commit" not in handoff_text
    and "git push" not in handoff_text
    and "supabase db push" not in handoff_text,
    "handoff generator cannot commit, push or migrate",
)

with tempfile.TemporaryDirectory() as tmp:
    runtime = Path(tmp) / ".vibeschool-agent"

    result = subprocess.run(
        [
            "python3",
            str(HANDOFF),
            "LP-002A2B",
            "--runtime",
            str(runtime),
        ],
        cwd=ROOT,
        text=True,
        capture_output=True,
    )

    require(
        result.returncode == 0,
        "handoff generator executes",
    )
    require(
        "HANDOFF_FILE=" in result.stdout,
        "handoff generator reports its output path",
    )
    require(
        "# Vibeschool Implementation Handoff — LP-002A2B"
        in result.stdout,
        "handoff identifies the selected fix",
    )
    require(
        "## Proven finding" in result.stdout,
        "handoff includes evidence section",
    )
    require(
        "## Safety constraints" in result.stdout,
        "handoff includes safety section",
    )
    require(
        "## Required verification" in result.stdout,
        "handoff includes verification section",
    )

    generated = runtime / "handoffs/LP-002A2B.md"
    require(generated.exists(), "handoff is persisted in runtime storage")

    generated_text = generated.read_text(encoding="utf-8")
    require(
        "components/teacher/LessonPlanModal.tsx" in generated_text,
        "handoff identifies LessonPlanModal",
    )
    require(
        "lib/teaching/lessonParentDelivery.ts" in generated_text,
        "handoff identifies the shared service target",
    )

print("OPS-001D implementation handoff tests PASSED")
