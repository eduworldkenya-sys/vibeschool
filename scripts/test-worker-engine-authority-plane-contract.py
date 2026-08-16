#!/usr/bin/env python3
from pathlib import Path
import re
import sys

MIGRATIONS = Path('supabase/migrations')
HARDENED_BY = {
    'hq_workforce_capability_grants': '20260816101500_worker_engine_authority_plane_hardening.sql',
    'hq_workforce_certifications': '20260816101500_worker_engine_authority_plane_hardening.sql',
    'hq_workforce_creation_contracts': '20260816101500_worker_engine_authority_plane_hardening.sql',
    'hq_workforce_runtime_policies': '20260816101500_worker_engine_authority_plane_hardening.sql',
    'hq_workforce_workers': '20260816101500_worker_engine_authority_plane_hardening.sql',
    'hq_workforce_engine_contract': '20260816103000_worker_engine_engine_contract_control_plane_hardening.sql',
}


def normalize(sql: str) -> str:
    return re.sub(r'\s+', ' ', sql.lower()).strip()


def fail(msg: str) -> None:
    print(f'FAIL: {msg}', file=sys.stderr)
    raise SystemExit(1)


def main() -> None:
    for table, migration_name in HARDENED_BY.items():
        migration = MIGRATIONS / migration_name
        if not migration.exists():
            fail(f'{table}: missing hardening migration {migration_name}')
        sql = normalize(migration.read_text(encoding='utf-8'))
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

    targets = list(HARDENED_BY)
    earliest = min(HARDENED_BY.values())
    later = sorted(p for p in MIGRATIONS.glob('*.sql') if p.name >= earliest)
    dangerous = re.compile(
        r'grant\s+(?:all|insert|update|delete|truncate|references|trigger|[^;]*\b(?:insert|update|delete|truncate|references|trigger)\b[^;]*)'
        r'\s+on\s+table\s+public\.(%s)\s+to\s+service_role'
        % '|'.join(re.escape(t) for t in targets),
        re.IGNORECASE | re.DOTALL,
    )
    for path in later:
        text = path.read_text(encoding='utf-8')
        match = dangerous.search(text)
        if not match:
            continue
        table = match.group(1).lower()
        if path.name == HARDENED_BY[table]:
            # The hardening migration itself contains no widening grant; skip the
            # file rather than misclassify its explicit revoke statements.
            continue
        fail(f'{path.name}: re-opens service_role write access to {table}')

    print('PASS: Worker Engine authority/control planes are read-only to service_role and no later migration re-opens them')


if __name__ == '__main__':
    main()
