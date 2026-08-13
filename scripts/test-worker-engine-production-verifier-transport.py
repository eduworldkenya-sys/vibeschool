#!/usr/bin/env python3
from __future__ import annotations

import importlib.util
import os
import subprocess
from pathlib import Path
from unittest import mock

os.environ["SUPABASE_PROJECT_REF"] = "exampleprojectref"
os.environ["SUPABASE_ACCESS_TOKEN"] = "test-token"

SCRIPT = Path(__file__).with_name("worker-engine-verify-production-contract.py")
spec = importlib.util.spec_from_file_location("worker_engine_verify_production_contract", SCRIPT)
assert spec and spec.loader
module = importlib.util.module_from_spec(spec)
spec.loader.exec_module(module)


def test_curl_transport_success() -> None:
    completed = subprocess.CompletedProcess(args=["curl"], returncode=0, stdout='[{"ok": true}]', stderr="")
    with mock.patch.object(module.subprocess, "run", return_value=completed) as run:
        rows = module.query("select 1")
    assert rows == [{"ok": True}]
    args = run.call_args.args[0]
    assert args[0] == "curl"
    assert "/database/query/read-only" in args[args.index("POST") + 1]
    assert "Authorization: Bearer test-token" in args
    assert "User-Agent: Vibeschool-Worker-Engine-Production-Verifier/1.0" in args
    assert run.call_args.kwargs["input"] == '{"query": "select 1", "parameters": []}'


def test_transport_failure_is_fail_closed() -> None:
    completed = subprocess.CompletedProcess(args=["curl"], returncode=22, stdout="", stderr="HTTP 403")
    with mock.patch.object(module.subprocess, "run", return_value=completed):
        try:
            module.query("select 1")
        except SystemExit as exc:
            assert exc.code == 1
        else:
            raise AssertionError("transport failure must terminate verification")


def main() -> None:
    test_curl_transport_success()
    test_transport_failure_is_fail_closed()
    print("worker-engine production verifier transport tests passed")


if __name__ == "__main__":
    main()
