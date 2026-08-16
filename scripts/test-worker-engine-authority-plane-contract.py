#!/usr/bin/env python3
from pathlib import Path
import re
import sys

MIGRATIONS = Path('supabase/migrations')
TARGETS = [
    'hq_workforce_capability_grants',
    'hq_workforce_certifications',
    'hq_workforce_creation_contracts',
    'hq_workforce_runtime_policies',
    'hq_workforce_workers',
]
HARDENING_PREFIX = '20260816101500_worker_engine_authority_plane_hardening.sql'


def normalize(sql: str) -> str:
    return re.sub(r'\s+', ' ', sql.lower()).strip()


def fail(msg: str) -> None:
    print(f'FAIL: {msg}', file=sys.stderr)
    raise SystemExit(1)


def main() -> None:
    hardening = MIGRATIONS / HARDENING_PREFIX
    if not hardening.exists():
        fail(f'missing authority-plane hardening migration: {HARDENING_PREFIX}')

    sql = normalize(hardening.read_text(encoding='utf-8'))

    for table in TARGETS:
        if f'revoke all on table public.{table} from anon, authenticated;' not in sql:
            fail(f'{table}: anon/authenticated revoke missing')
        expected = (
            f'revoke insert, update, delete, truncate, references, trigger '
            f'on table public.{table} from service_role;'
        )
        if expected not in sql:
            fail(f'{table}: service_role write revoke missing')
        if f'grant select on table public.{table} to service_role;' not in sql:
            fail(f'{table}: service_role read-only grant missing')

    # Later migrations must not silently re-open the authority plane.
    later = sorted(p for p in MIGRATIONS.glob('*.sql') if p.name > HARDENING_PREFIX)
    dangerous = re.compile(
        r'grant\s+(?:all|insert|update|delete|truncate|references|trigger|[^;]*\b(?:insert|update|delete|truncate|references|trigger)\b[^;]*)'
        r'\s+on\s+table\s+public\.(%s)\s+to\s+service_role'
        % '|'.join(re.escape(t) for t in TARGETS),
        re.IGNORECASE | re.DOTALL,
    )
    for path in later:
        text = path.read_text(encoding='utf-8')
        match = dangerous.search(text)
        if match:
            fail(f'{path.name}: re-opens service_role write access to {match.group(1)}')

    print('PASS: Worker Engine authority-plane service_role contract is closed and no later migration re-opens it')


if __name__ == '__main__':
    main()
