#!/usr/bin/env python3
"""Extract literal Supabase table/RPC contracts used by application TypeScript.

This intentionally does not try to infer dynamic relation names. It provides a
stable lower bound that the clean-rebuild gate can prove exists in the reconstructed
database. Dynamic/non-literal database access remains covered by generated types and
purpose-built contract tests. Supabase Storage `.storage.from("bucket")` calls are
excluded because bucket names are not PostgreSQL relations.
"""
from __future__ import annotations

import argparse
import json
import re
from pathlib import Path

SCAN_ROOTS = ("app", "components", "hooks", "lib")
EXTENSIONS = {".ts", ".tsx", ".js", ".jsx", ".mjs", ".cjs"}
FROM_RE = re.compile(r"(?<!\.storage)\.from\(\s*(['\"])([A-Za-z_][A-Za-z0-9_]*)\1\s*\)")
RPC_RE = re.compile(r"\.rpc\(\s*(['\"])([A-Za-z_][A-Za-z0-9_]*)\1(?:\s*[,\)])")


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--out-dir", default=".task2-artifacts/application-contracts")
    args = parser.parse_args()

    out = Path(args.out_dir)
    out.mkdir(parents=True, exist_ok=True)
    relations: dict[str, set[str]] = {}
    rpcs: dict[str, set[str]] = {}

    for root_name in SCAN_ROOTS:
        root = Path(root_name)
        if not root.exists():
            continue
        for path in sorted(root.rglob("*")):
            if not path.is_file() or path.suffix not in EXTENSIONS:
                continue
            try:
                text = path.read_text(encoding="utf-8")
            except UnicodeDecodeError:
                continue
            relpath = path.as_posix()
            for match in FROM_RE.finditer(text):
                relations.setdefault(match.group(2), set()).add(relpath)
            for match in RPC_RE.finditer(text):
                rpcs.setdefault(match.group(2), set()).add(relpath)

    relation_names = sorted(relations)
    rpc_names = sorted(rpcs)
    (out / "relations.txt").write_text("\n".join(relation_names) + ("\n" if relation_names else ""), encoding="utf-8")
    (out / "rpcs.txt").write_text("\n".join(rpc_names) + ("\n" if rpc_names else ""), encoding="utf-8")
    report = {
        "relations": {k: sorted(v) for k, v in sorted(relations.items())},
        "rpcs": {k: sorted(v) for k, v in sorted(rpcs.items())},
        "relation_count": len(relation_names),
        "rpc_count": len(rpc_names),
    }
    (out / "contracts.json").write_text(json.dumps(report, indent=2, sort_keys=True) + "\n", encoding="utf-8")
    print(json.dumps({"relation_count": len(relation_names), "rpc_count": len(rpc_names)}, sort_keys=True))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
