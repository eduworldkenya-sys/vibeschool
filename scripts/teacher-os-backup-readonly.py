#!/usr/bin/env python3
"""Capture encrypted logical PostgreSQL backups. Never restore or mutate source data."""
import argparse
import hashlib
import json
import os
from pathlib import Path
import re
import select
import shutil
import subprocess
import sys
import time
import uuid

class BackupError(Exception):
    pass

def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--output-dir', required=True, help='Private directory outside the repository')
    args = parser.parse_args()
    repo = Path(__file__).resolve().parent.parent
    out = Path(args.output_dir).resolve()
    if out == repo or repo in out.parents:
        raise BackupError('Backup output must be outside the Git checkout.')
    required = ['PGHOST', 'PGDATABASE', 'PGUSER', 'BACKUP_GPG_RECIPIENT']
    missing = [key for key in required if not os.environ.get(key)]
    if missing:
        raise BackupError('Missing secure configuration: ' + ', '.join(missing))
    if '://' in os.environ['PGDATABASE'] or '=' in os.environ['PGDATABASE']:
        raise BackupError('Use separate PG connection settings, never a credential-bearing connection URL.')
    for tool in ['psql', 'pg_dump', 'pg_dumpall', 'gpg']:
        if not shutil.which(tool):
            raise BackupError('Required executable is unavailable: ' + tool)
    os.umask(0o077)
    env = dict(os.environ)
    # Keep connection identity explicit: service files must not override these settings.
    env.pop('PGSERVICE', None)
    env.pop('PGSERVICEFILE', None)
    # libpq enforces TLS hostname/chain verification for TCP; Unix sockets have no TLS layer.
    env.update(PGSSLMODE='verify-full', PGCONNECT_TIMEOUT='15',
               PGOPTIONS='-c default_transaction_read_only=on', PGAPPNAME='vibeschool-readonly-backup')
    if not env.get('PGSSLROOTCERT') and not env['PGHOST'].startswith('/'):
        env['PGSSLROOTCERT'] = 'system'  # libpq 17+ uses the system CA store.
    recipient = env['BACKUP_GPG_RECIPIENT']
    if not re.fullmatch(r'[0-9A-Fa-f]{40,64}', recipient):
        raise BackupError('BACKUP_GPG_RECIPIENT must be the independently verified full public-key fingerprint.')
    key = subprocess.run(['gpg', '--batch', '--list-keys', recipient], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    if key.returncode:
        raise BackupError('The verified backup encryption public key is not available.')
    out.mkdir(parents=True, exist_ok=True)
    if out.stat().st_mode & 0o077:
        raise BackupError('The backup parent directory must have mode 700; do not use shared artifact directories.')
    run = out / (time.strftime('%Y%m%dT%H%M%SZ', time.gmtime()) + '-' + uuid.uuid4().hex[:8])
    run.mkdir(mode=0o700)
    holder = None
    capture_complete = False
    try:
        holder = subprocess.Popen(['psql', '-X', '-qAt', '--no-password', '--set', 'ON_ERROR_STOP=1'], env=env,
                                  stdin=subprocess.PIPE, stdout=subprocess.PIPE, stderr=subprocess.DEVNULL, bufsize=0)
        buffered = bytearray()
        def send(sql):
            holder.stdin.write((sql + '\n').encode())
            holder.stdin.flush()
        def line():
            while b'\n' not in buffered:
                if not select.select([holder.stdout], [], [], 30)[0]:
                    raise BackupError('Read-only snapshot metadata timed out.')
                chunk = os.read(holder.stdout.fileno(), 65536)
                if not chunk:
                    raise BackupError('Read-only database metadata failed; inspect secure connection/access settings.')
                buffered.extend(chunk)
            value, _, remaining = buffered.partition(b'\n')
            buffered[:] = remaining
            return value.decode().strip()
        send('BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY; SELECT pg_export_snapshot();')
        snapshot = line()
        if not re.fullmatch(r'[0-9A-Fa-f]+-[0-9A-Fa-f]+-[0-9]+', snapshot):
            raise BackupError('A consistent read-only database snapshot could not be confirmed.')
        send("SELECT json_build_object('server_version',current_setting('server_version'),'server_version_num',current_setting('server_version_num'),'extensions',(SELECT json_agg(json_build_object('name',extname,'version',extversion)) FROM pg_extension),'foreign_tables',(SELECT count(*) FROM pg_class WHERE relkind='f'))::text;")
        metadata = json.loads(line())
        version = subprocess.run(['pg_dump', '--version'], capture_output=True, text=True, env=env)
        match = re.search(r'(\d+)\.\d+', version.stdout)
        if version.returncode or not match or int(match.group(1)) < int(metadata['server_version_num']) // 10000:
            raise BackupError('The PostgreSQL dump client is older than the source server; install a compatible client.')
        send("SELECT format('SELECT json_build_object(''schema'',%L,''table'',%L,''rows'',count(*))::text FROM %I.%I;',n.nspname,c.relname,n.nspname,c.relname) FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE c.relkind IN ('r','p') AND n.nspname NOT IN ('pg_catalog','information_schema') AND n.nspname NOT LIKE 'pg_toast%%' AND n.nspname NOT LIKE 'pg_temp%%' ORDER BY n.nspname,c.relname\n\\gexec\nSELECT 'INVENTORY_DONE';")
        tables = []
        while True:
            value = line()
            if value == 'INVENTORY_DONE':
                break
            tables.append(json.loads(value))
        def encrypt(command, filename):
            dest = run / filename
            with dest.open('xb') as target:
                producer = subprocess.Popen(command, env=env, stdout=subprocess.PIPE, stderr=subprocess.DEVNULL)
                try:
                    encrypted = subprocess.Popen(['gpg', '--batch', '--encrypt', '--recipient', recipient],
                                                  stdin=producer.stdout, stdout=target, stderr=subprocess.DEVNULL)
                    producer.stdout.close()
                    encrypted.wait()
                    if encrypted.returncode and producer.poll() is None:
                        producer.terminate()
                    producer.wait()
                    if encrypted.returncode or producer.returncode:
                        raise BackupError('Encrypted ' + filename + ' capture failed; no usable backup is certified.')
                finally:
                    if producer.poll() is None:
                        producer.kill()
                        producer.wait()
            if not dest.stat().st_size:
                raise BackupError('An encrypted backup artifact is empty.')
        # No exclusions, no --enable-row-security, no partial role-filtered export.
        encrypt(['pg_dump', '--no-password', '--format=custom', '--snapshot=' + snapshot], 'database.dump.gpg')
        encrypt(['pg_dumpall', '--no-password', '--globals-only', '--no-role-passwords'], 'globals.sql.gpg')
        send('ROLLBACK;')
        holder.stdin.close()
        holder.wait(timeout=20)
        if holder.returncode:
            raise BackupError('Read-only snapshot closure failed.')
        source = '|'.join(env.get(name, '') for name in ['PGHOST','PGPORT','PGDATABASE'])
        def digest(path):
            checksum = hashlib.sha256()
            with path.open('rb') as stream:
                for block in iter(lambda: stream.read(1024 * 1024), b''):
                    checksum.update(block)
            return checksum.hexdigest()
        manifest = {
            'captured_at': time.strftime('%Y-%m-%dT%H:%M:%SZ', time.gmtime()),
            'source_fingerprint': hashlib.sha256(source.encode()).hexdigest(),
            'server': metadata, 'client': version.stdout.strip(), 'tables': tables,
            'artifacts': {p.name: {'bytes': p.stat().st_size, 'sha256': digest(p)} for p in run.glob('*.gpg')},
            'database_capture_complete': not bool(metadata['foreign_tables']), 'recoverability_verified': False,
            'limitations': ['Role passwords are intentionally excluded; provision target database login credentials separately.',
                            'Storage binary objects, project settings/secrets and encryption root keys require separate protected backup.',
                            'Foreign-table contents are not captured by this archive.' if metadata['foreign_tables'] else 'No foreign tables were discovered.',
                            'A restore rehearsal in an isolated compatible Supabase/PostgreSQL target is required.'],
        }
        (run / 'manifest.json').write_text(json.dumps(manifest, indent=2) + '\n')
        capture_complete = True
        print('Encrypted database and role capture completed. Restore, Storage and project-configuration verification are still required; production write testing remains blocked.')
    finally:
        if holder and holder.poll() is None:
            holder.terminate()
            holder.wait(timeout=20)
        if not capture_complete:
            shutil.rmtree(run)

if __name__ == '__main__':
    try:
        main()
    except (BackupError, OSError, subprocess.SubprocessError, ValueError) as error:
        # Never print child stderr, connection settings, SQL data, URLs or passwords.
        print(str(error) if isinstance(error, BackupError) else 'Backup capture failed; no recoverability claim.', file=sys.stderr)
        sys.exit(1)
