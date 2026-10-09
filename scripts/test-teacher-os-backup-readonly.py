#!/usr/bin/env python3
"""Actual encrypted capture/restore rehearsal. Synthetic, network-isolated PostgreSQL only."""
import hashlib
import json
import os
from pathlib import Path
import subprocess
import tempfile
import time
import uuid

IMAGE = 'postgres@sha256:2d2b8998d31037bf721cfdf764d76ba74171b4fab3431b7f72c27c56ddbdf9e3'
HELPER = Path(__file__).with_name('teacher-os-backup-readonly.py').resolve()
created = []

def run(args, **kwargs):
    return subprocess.run(args, check=True, capture_output=True, **kwargs)

def container(user):
    name = 'vibeschool-backup-rehearsal-' + uuid.uuid4().hex[:12]
    result = run(['docker','run','--detach','--name',name,'--network','none',
                  '--label','vibeschool.fixture=backup-rehearsal','--env','POSTGRES_USER='+user,
                  '--env','POSTGRES_HOST_AUTH_METHOD=trust',IMAGE])
    identity = result.stdout.decode().strip()
    created.append(identity)
    assert run(['docker','inspect','--format','{{.HostConfig.NetworkMode}}',identity]).stdout.strip() == b'none'
    for _ in range(100):
        ready = subprocess.run(['docker','exec',identity,'pg_isready','-U',user], capture_output=True)
        if ready.returncode == 0:
            return identity
        time.sleep(0.1)
    raise AssertionError('Owned synthetic PostgreSQL fixture did not become ready')

try:
    with tempfile.TemporaryDirectory(prefix='vibeschool-backup-test-') as temporary:
        root = Path(temporary)
        root.chmod(0o700)
        source, target = container('postgres'), container('fixture_restorer')
        fixture = """
CREATE ROLE fixture_teacher NOLOGIN;
CREATE SCHEMA auth; CREATE SCHEMA storage; CREATE SCHEMA supabase_migrations;
CREATE TABLE auth.users(id integer PRIMARY KEY, fixture_marker text NOT NULL);
CREATE TABLE storage.objects(id integer PRIMARY KEY, name text NOT NULL);
CREATE TABLE supabase_migrations.schema_migrations(version text PRIMARY KEY);
CREATE TABLE public.backup_fixture(id integer PRIMARY KEY, school_id integer NOT NULL);
INSERT INTO auth.users VALUES(1,'synthetic-user');
INSERT INTO storage.objects VALUES(1,'synthetic-metadata-only');
INSERT INTO supabase_migrations.schema_migrations VALUES('synthetic-version');
INSERT INTO public.backup_fixture VALUES(1,7),(2,8);
ALTER TABLE public.backup_fixture ENABLE ROW LEVEL SECURITY;
CREATE POLICY fixture_school ON public.backup_fixture FOR SELECT TO fixture_teacher USING(school_id=7);
GRANT SELECT ON public.backup_fixture TO fixture_teacher;
CREATE FUNCTION public.fixture_school() RETURNS integer LANGUAGE sql IMMUTABLE AS 'SELECT 7';
"""
        run(['docker','exec','-i',source,'psql','-U','postgres','-v','ON_ERROR_STOP=1'], input=fixture.encode())
        tools = root/'tools';tools.mkdir(mode=0o700)
        for tool in ['psql','pg_dump','pg_dumpall']:
            wrapper = tools/tool
            wrapper.write_text('#!/bin/sh\n'
                'printf "%s\\n" "$PGSSLMODE" > "'+str(root/'tls-mode')+'"\n'
                'printf "%s\\n" "$PGOPTIONS" > "'+str(root/'read-mode')+'"\n'
                + ('if [ "$BACKUP_TEST_DUMP_FAILURE" = "yes" ] && [ "$1" != "--version" ]; then printf partial; exit 23; fi\n' if tool == 'pg_dump' else '')
                + 'if [ "$1" = "--version" ]; then exec docker exec '+source+' '+tool+' --version; fi\n'
                + 'exec docker exec -i --env PGOPTIONS --env PGAPPNAME '+source+' '+tool+' -U postgres "$@"\n')
            wrapper.chmod(0o700)
        home = root/'gpg';home.mkdir(mode=0o700)
        env = {**os.environ, 'PATH':str(tools)+':'+os.environ['PATH'],'GNUPGHOME':str(home),
               'PGHOST':'/var/run/postgresql','PGUSER':'postgres','PGDATABASE':'postgres',
               'PGSSLMODE':'disable','BACKUP_TEST_DUMP_FAILURE':''}
        # A hostile TLS setting is only a fixture input; the capture helper must override it.
        run(['gpg','--batch','--pinentry-mode','loopback','--passphrase','',
             '--quick-generate-key','Synthetic backup fixture','default','default','1d'], env=env)
        public = run(['gpg','--with-colons','--list-keys'],env=env).stdout.decode()
        env['BACKUP_GPG_RECIPIENT'] = next(line.split(':')[9] for line in public.splitlines() if line.startswith('fpr:'))
        output = root/'encrypted'
        result = run(['python3',str(HELPER),'--output-dir',str(output)],env=env)
        assert b'production write testing remains blocked' in result.stdout
        assert (root/'tls-mode').read_text().strip() == 'verify-full'
        assert (root/'read-mode').read_text().strip() == '-c default_transaction_read_only=on'
        directories = list(output.iterdir());assert len(directories) == 1
        archive = directories[0]
        manifest = json.loads((archive/'manifest.json').read_text())
        assert manifest['database_capture_complete'] is True and manifest['recoverability_verified'] is False
        counts = {row['schema']+'.'+row['table']:row['rows'] for row in manifest['tables']}
        assert counts == {'auth.users':1,'storage.objects':1,'supabase_migrations.schema_migrations':1,'public.backup_fixture':2}
        for name, metadata in manifest['artifacts'].items():
            assert (archive/name).stat().st_mode & 0o077 == 0
            assert hashlib.sha256((archive/name).read_bytes()).hexdigest() == metadata['sha256']
            assert b'synthetic-user' not in (archive/name).read_bytes()
        for name, client in [('globals.sql.gpg','psql'),('database.dump.gpg','pg_restore')]:
            producer = subprocess.Popen(['gpg','--batch','--decrypt',str(archive/name)],env=env,stdout=subprocess.PIPE,stderr=subprocess.DEVNULL)
            options = ['-v','ON_ERROR_STOP=1'] if client=='psql' else ['--exit-on-error']
            try:
                restored = subprocess.run(['docker','exec','-i',target,client,'-U','fixture_restorer','-d','postgres',*options],stdin=producer.stdout,capture_output=True)
                producer.stdout.close();producer.wait()
                assert producer.returncode == 0 and restored.returncode == 0, 'Isolated restoration failed'
            finally:
                if producer.poll() is None:producer.kill();producer.wait()
        sql = "SELECT count(*) FROM auth.users;SELECT count(*) FROM storage.objects;SELECT count(*) FROM supabase_migrations.schema_migrations;SELECT count(*) FROM public.backup_fixture;SELECT public.fixture_school();SELECT relrowsecurity FROM pg_class WHERE oid='public.backup_fixture'::regclass;SET ROLE fixture_teacher;SELECT count(*) FROM public.backup_fixture;SELECT count(*) FROM public.backup_fixture WHERE school_id=8;"
        verified = run(['docker','exec',target,'psql','-U','fixture_restorer','-d','postgres','-Atc',sql]).stdout.decode().splitlines()
        assert verified == ['1','1','1','2','7','t','SET','1','0'], 'Data/role/RLS recovery mismatch'
        before = set(output.iterdir())
        rejected = subprocess.run(['python3',str(HELPER),'--output-dir',str(output)],env={**env,'BACKUP_TEST_DUMP_FAILURE':'yes'},capture_output=True)
        assert rejected.returncode != 0 and set(output.iterdir()) == before, 'Partial failed exports must be removed'
        missing_key = subprocess.run(['python3',str(HELPER),'--output-dir',str(output)],env={**env,'BACKUP_GPG_RECIPIENT':'0'*40},capture_output=True)
        assert missing_key.returncode != 0 and set(output.iterdir()) == before
        denied_path = subprocess.run(['python3',str(HELPER),'--output-dir',str(HELPER.parent.parent/'must-not-exist-backup')],env=env,capture_output=True)
        assert denied_path.returncode != 0 and b'outside the Git checkout' in denied_path.stderr
        assert not (HELPER.parent.parent/'must-not-exist-backup').exists()
        # Source data and its RLS remain unchanged by capture/failure paths.
        source_check = run(['docker','exec',source,'psql','-U','postgres','-Atc',"SELECT count(*) FROM public.backup_fixture;SELECT relrowsecurity FROM pg_class WHERE oid='public.backup_fixture'::regclass;"]).stdout.decode().splitlines()
        assert source_check == ['2','t']
        print('Encrypted backup rehearsal PASS: consistent full capture, Auth/Storage metadata/history, restore, ownership/function/RLS and cross-school denial, TLS/read-only enforcement, private output and failure cleanup. Synthetic fixtures only; no production backup is verified.')
finally:
    for identity in created:
        subprocess.run(['docker','rm','--force',identity],stdout=subprocess.DEVNULL,stderr=subprocess.DEVNULL)
