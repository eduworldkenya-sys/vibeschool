#!/usr/bin/env python3
import argparse
import os
import re
import shutil
from pathlib import Path

EXPECTED = ['20260818050300', '20260818050400']
MIGRATION_RE = re.compile(r'^(\d{8,14})_.+\.sql$')


def parse_remote(path: Path) -> set[str]:
    result: set[str] = set()
    text = path.read_text(encoding='utf-8', errors='replace')
    for line in text.splitlines():
        cols = [c.strip().strip('`') for c in line.split('|')]
        if len(cols) >= 2 and re.fullmatch(r'\d{8,14}', cols[1]):
            result.add(cols[1])
    return result


def local_migrations(directory: Path) -> dict[str, Path]:
    result: dict[str, Path] = {}
    for file in sorted(directory.glob('*.sql')):
        match = MIGRATION_RE.fullmatch(file.name)
        if not match:
            raise SystemExit(f'invalid migration filename: {file.name}')
        version = match.group(1)
        if version in result:
            raise SystemExit(f'duplicate local migration version {version}: {result[version].name}, {file.name}')
        result[version] = file
    return result


def prepare(args: argparse.Namespace) -> None:
    repo = Path(args.repo).resolve()
    evidence = repo / args.evidence
    stage = repo / args.stage
    before_path = repo / args.before
    remote = parse_remote(before_path)
    local = local_migrations(repo / 'supabase' / 'migrations')

    missing_targets = [v for v in EXPECTED if v not in local]
    if missing_targets:
        raise SystemExit(f'target migrations missing locally: {missing_targets}')

    pending = [v for v in EXPECTED if v not in remote]
    already = [v for v in EXPECTED if v in remote]
    if pending and already:
        raise SystemExit(f'partial Twin production state: applied={already} pending={pending}')

    evidence.mkdir(parents=True, exist_ok=True)
    (evidence / 'remote-versions-before.txt').write_text('\n'.join(sorted(remote)) + '\n', encoding='utf-8')
    (evidence / 'expected-versions.txt').write_text('\n'.join(pending) + ('\n' if pending else ''), encoding='utf-8')

    output = os.environ.get('GITHUB_OUTPUT')
    if output:
        with Path(output).open('a', encoding='utf-8') as fh:
            fh.write(f"needs_apply={'true' if pending else 'false'}\n")

    print(f'remote_versions={len(remote)} pending={pending}')
    if not pending:
        return
    if pending != EXPECTED:
        raise SystemExit(f'expected both Twin migrations to be pending together; pending={pending}')

    if stage.exists():
        shutil.rmtree(stage)
    stage_migrations = stage / 'supabase' / 'migrations'
    stage_migrations.mkdir(parents=True)
    shutil.copy2(repo / 'supabase' / 'config.toml', stage / 'supabase' / 'config.toml')

    staged: set[str] = set()
    placeholders: list[str] = []
    for version in sorted(remote):
        source = local.get(version)
        if source is not None:
            shutil.copy2(source, stage_migrations / source.name)
        else:
            placeholder = stage_migrations / f'{version}_production_history_placeholder.sql'
            placeholder.write_text(
                '-- Ledger-alignment placeholder for an already-applied production migration. Never executed.\n',
                encoding='utf-8',
            )
            placeholders.append(version)
        staged.add(version)

    for version in EXPECTED:
        source = local[version]
        shutil.copy2(source, stage_migrations / source.name)
        staged.add(version)

    wanted = remote | set(EXPECTED)
    if staged != wanted:
        raise SystemExit(f'stage mismatch missing={sorted(wanted-staged)} extra={sorted(staged-wanted)}')

    summary = (
        f'remote_versions={len(remote)}\n'
        f'placeholders={len(placeholders)}\n'
        f'staged_versions={len(staged)}\n'
        f'pending_versions={" ".join(EXPECTED)}\n'
    )
    (evidence / 'stage-summary.txt').write_text(summary, encoding='utf-8')
    print(summary, end='')


def verify(args: argparse.Namespace) -> None:
    repo = Path(args.repo).resolve()
    before = parse_remote(repo / args.before)
    after = parse_remote(repo / args.after)
    expected = set(EXPECTED)
    if not expected.issubset(after):
        raise SystemExit(f'Twin migrations not both recorded remotely: missing={sorted(expected-after)}')
    wanted = before | expected
    if after != wanted:
        raise SystemExit(f'unexpected ledger transition added={sorted(after-wanted)} removed={sorted(wanted-after)}')

    evidence = repo / args.evidence
    evidence.mkdir(parents=True, exist_ok=True)
    report = (
        f'versions={" ".join(EXPECTED)}\n'
        'status=PASSED\n'
        f'remote_before={len(before)}\n'
        f'remote_after={len(after)}\n'
    )
    (evidence / 'post-apply-ledger-assertion.txt').write_text(report, encoding='utf-8')
    print(report, end='')


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument('command', choices=['prepare', 'verify'])
    parser.add_argument('--repo', default='.')
    parser.add_argument('--before', default='.twin-production-promotion/migration-list-before.txt')
    parser.add_argument('--after', default='.twin-production-promotion/migration-list-after.txt')
    parser.add_argument('--evidence', default='.twin-production-promotion')
    parser.add_argument('--stage', default='.twin-production-promotion-stage')
    args = parser.parse_args()
    if args.command == 'prepare':
        prepare(args)
    else:
        verify(args)


if __name__ == '__main__':
    main()
