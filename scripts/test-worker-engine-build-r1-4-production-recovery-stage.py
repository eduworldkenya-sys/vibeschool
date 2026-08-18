#!/usr/bin/env python3
from __future__ import annotations

import importlib.util
import tempfile
from pathlib import Path

SCRIPT = Path(__file__).with_name('worker-engine-build-r1-4-production-recovery-stage.py')
spec = importlib.util.spec_from_file_location('recovery', SCRIPT)
assert spec and spec.loader
r = importlib.util.module_from_spec(spec)
spec.loader.exec_module(r)


def main() -> None:
    with tempfile.TemporaryDirectory() as tmp:
        root = Path(tmp)
        mig = root / 'migrations'
        mig.mkdir()
        required = r.REQUIRED_FOUNDATIONS | r.REQUIRED_CLOSURE | {r.PARITY_BRIDGE}
        extra = {
            '20260815124000','20260815125000','20260815130100','20260815130200',
            '20260815131500','20260815132500','20260815133500','20260815141000',
            '20260818112100','20260818112200','20260818112300','20260818112400',
            '20260818112500','20260818112600','20260818112700','20260818112800',
            '20260818112900'
        }
        expected = required | extra
        for v in expected:
            (mig / f'{v}_worker_engine_fixture.sql').write_text('-- fixture\n')
        (mig / '20260818084507_student_twin_fixture.sql').write_text('-- unrelated\n')
        (mig / '20260815210000_school_fixture.sql').write_text('-- unrelated\n')
        found = r.discover_recovery_versions(mig)
        assert expected == found
        assert '20260818084507' not in found and '20260815210000' not in found
        r.configure_scope(mig)
        assert r.module.APPROVED_WORKER_ENGINE_VERSIONS == expected

        stage = root / 'stage'
        staged_migrations = stage / 'supabase' / 'migrations'
        staged_migrations.mkdir(parents=True)
        target = staged_migrations / f'{r.TARGET_VERSION}_worker_engine_fixture.sql'
        target.write_text('-- canonical migration body\n')
        transformed = r.inject_legacy_collision_repair(stage)
        assert transformed == target.name
        text = target.read_text()
        assert text.startswith('-- WE-R1.4 protected recovery prerequisite')
        assert 'archive already exists' in text
        assert 'legacy capability edge collision contains % rows' in text
        assert text.endswith('-- canonical migration body\n')

        try:
            r.inject_legacy_collision_repair(stage)
        except r.module.StageFailure as exc:
            assert 'already injected' in str(exc)
        else:
            raise AssertionError('duplicate repair injection must fail closed')

    print('Worker Engine R1.4 production recovery staging contract PASSED')


if __name__ == '__main__':
    main()
